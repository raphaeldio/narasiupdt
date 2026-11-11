"""Pencarian dan penilaian bukti untuk satu klaim (PRD FR06–FR07)."""

import asyncio
import logging
import re
from dataclasses import dataclass

from .cache import Cache, SingleFlight, memo
from .corpus import Corpus
from .feeds import FactFeedIndex, rating_and_claim
from .matching import MATCH_MIN, context_match
from .models import Claim, Evidence, EvidenceOrigin
from .providers.factcheck import FactCheckAPI
from .providers.gemini import cosine
from .providers.llm import LLMRouter
from .providers.newsrss import NewsSearch
from .providers.tavily import TavilySearch
from .ratings import (credibility, domain_of, is_factcheck_page, is_factcheck_title, is_satire_rating,
                      verdict_value)
from .text import keywords, normalize
from .usage import usage

log = logging.getLogger("narasi.evidence")
MAX_EVIDENCE = 5

_STANCE_RATING = {"refutes": "Hoaks", "misleading": "Menyesatkan", "supports": "Benar"}
# Tanpa LLM, berita media terverifikasi yang judulnya sangat mirip klaim dianggap memberitakan hal yang sama.
REPORTED_RATING = "Diberitakan media"
REPORTED_MATCH_MIN = 0.72
_HEDGE = re.compile(
    r"\b(viral|benarkah|faktanya|fakta|klarifikasi|bantah|membantah|dibantah|isu|kabar|hoaks|hoax|narasi|klaim|"
    r"beredar|disebut|diduga|rumor|rumors|claim|claims|alleged|allegedly|denies|denied|fact check|debunk)\b")
# Kata bantahan di judul. "penipuan"/"palsu" sengaja tidak ada: judul seperti "cara menghindari penipuan"
# bukan bantahan (label "[PENIPUAN]" dalam kurung siku tetap terbaca lewat rating_and_claim).
_ID_FALSE = re.compile(r"\b(hoaks|hoax|tidak benar|disinformasi|misinformasi|keliru|salah(?! satu| seorang| paham| kaprah| sasaran| tangkap| ketik))\b")


@dataclass
class Candidate:
    claim_reviewed: str
    publisher: str
    title: str
    url: str
    rating: str  # kosong = sikap belum diketahui (hasil pencarian)
    date: str | None
    credibility: float
    origin: EvidenceOrigin
    content: str = ""
    reason: str | None = None
    # Domain penerbit bila `url` berupa pengalih (hasil Google News).
    source_url: str = ""

    @property
    def site(self) -> str:
        return self.source_url or self.url


def rating_from_title(title: str) -> str:
    """Rating dari konvensi judul artikel cek fakta ("[HOAKS] …", "Fact Check: … NOT …")."""
    t = normalize(title)
    if re.search(r"\bmenyesatkan\b", t):
        return "Menyesatkan"
    if _ID_FALSE.search(t):
        return "Hoaks"
    rating, _ = rating_and_claim(title, "en")
    return {"False": "Hoaks", "Misleading": "Menyesatkan"}.get(rating, rating)


async def _safe(coro, timeout: float, what: str) -> list:
    try:
        return await asyncio.wait_for(coro, timeout)
    except Exception as exc:  # timeout, HTTP, parsing: sumber ini dilewati
        log.warning("%s gagal: %s", what, exc)
        return []


class EvidenceFinder:
    def __init__(self, corpus: Corpus, cache: Cache, ttl: int, timeout: float,
                 gemini: LLMRouter | None, factcheck: FactCheckAPI | None, tavily: TavilySearch | None,
                 feeds: FactFeedIndex | None = None, news: NewsSearch | None = None):
        self.feeds = feeds
        self.news = news
        self.corpus = corpus
        self.cache = cache
        self.ttl = ttl
        self.timeout = timeout
        self.gemini = gemini
        self.factcheck = factcheck
        self.tavily = tavily
        # Penonton serentak untuk klaim yang sama berbagi satu pencarian daring.
        self._flight = SingleFlight()

    async def quick(self, claim: Claim) -> list[Evidence]:
        """Bukti tanpa jaringan (cache kolektif + korpus terkurasi) untuk label awal dalam milidetik."""
        cached = await self.cache.get(f"claim:{claim.id}")
        if cached is not None:
            return [Evidence(**e) for e in cached]
        return await self._assess(claim, self._local(claim), remote=False)

    def _local(self, claim: Claim) -> list[Candidate]:
        """Sumber tanpa jaringan: korpus terkurasi + indeks feed pemeriksa fakta."""
        found = self._from_corpus(claim.text)
        for text in _texts(claim):
            found.extend(self._from_feeds(text))
        return _dedupe(found)

    async def find(self, claim: Claim) -> list[Evidence]:
        key = f"claim:{claim.id}"
        cached = await self.cache.get(key)
        if cached is not None:
            usage.record("evidence", "cache")
            return [Evidence(**e) for e in cached]
        found, shared = await self._flight.run(key, lambda: self._find_remote(claim))
        usage.record("evidence", "shared" if shared else "call")
        return [Evidence(**e) for e in found]

    async def _find_remote(self, claim: Claim) -> list[dict]:
        candidates = self._local(claim)
        jobs = []
        if self.factcheck:
            jobs.append(_safe(self._from_factcheck(claim.text, "id"), self.timeout, "factcheck(id)"))
            jobs.append(_safe(self._from_factcheck(claim.text, None), self.timeout, "factcheck"))
            if claim.original:
                jobs.append(_safe(self._from_factcheck(claim.original, None), self.timeout, "factcheck(asli)"))
            jobs.extend(self._query_jobs(claim))
        if self.tavily:
            jobs.append(_safe(self._from_search(claim.original or claim.text), self.timeout, "tavily"))
        if self.news:
            # Berita dicari dalam bahasa klaim; klaim asing yang sudah diterjemahkan dicari di dua edisi.
            searches = {(claim.language, claim.original or claim.text)}
            if claim.original:
                searches.add(("id", claim.text))
            jobs.extend(_safe(self._from_news(text, lang), self.timeout, f"news({lang})") for lang, text in searches)
        for found in await asyncio.gather(*jobs):
            candidates.extend(found)

        evidence = [e.model_dump() for e in await self._assess(claim, _dedupe(candidates))]
        await self.cache.set(f"claim:{claim.id}", evidence, self.ttl)
        return evidence

    async def find_by_queries(self, claim: Claim) -> list[Evidence]:
        """Pencarian tambahan dengan kata kunci LLM untuk klaim yang sudah dicari dengan kalimat utuh."""
        if not self.factcheck or not claim.queries:
            return []
        # Kata kunci yang sama untuk klaim yang sama dicari sekali untuk semua penonton.
        found, source = await memo(self.cache, self._flight, f"claimq:{claim.id}:{'|'.join(claim.queries)}",
                                   self.ttl, lambda: self._find_queries_remote(claim))
        usage.record("evidence_queries", source)
        return [Evidence(**e) for e in found]

    async def _find_queries_remote(self, claim: Claim) -> list[dict]:
        candidates = [c for found in await asyncio.gather(*self._query_jobs(claim)) for c in found]
        evidence = await self._assess(claim, _dedupe(candidates))
        if evidence:
            key = f"claim:{claim.id}"
            cached = [Evidence(**e) for e in await self.cache.get(key) or []]
            await self.cache.set(key, [e.model_dump() for e in merge_evidence(cached, evidence)], self.ttl)
        return [e.model_dump() for e in evidence]

    def _query_jobs(self, claim: Claim) -> list:
        # Fact Check mencocokkan kata kunci: kalimat klaim panjang sering tidak menemukan apa-apa,
        # jadi kata kunci ringkas hasil rumusan LLM ikut dicari (semua bahasa).
        return [_safe(self._from_factcheck(q, None), self.timeout, "factcheck(query)") for q in claim.queries]

    def _from_corpus(self, text: str) -> list[Candidate]:
        return [
            Candidate(e.claim, e.publisher, e.title, e.url, e.rating, e.date, e.credibility, "corpus")
            for e in self.corpus.search(text)
        ]

    def _from_feeds(self, text: str) -> list[Candidate]:
        if self.feeds is None:
            return []
        return [
            Candidate(e.claim, e.publisher, e.title, e.url, e.rating, e.date, credibility(e.url), "feed", e.summary)
            for e in self.feeds.search(text)
        ]

    async def _from_news(self, text: str, language: str) -> list[Candidate]:
        assert self.news
        usage.record("news", "call")
        hits = await self.news.search(keywords(text, 9), self.timeout, language)
        return [
            Candidate(h.title, h.publisher, h.title, h.url, "", h.date, credibility(h.source_url), "news",
                      source_url=h.source_url)
            for h in hits
        ]

    async def _from_factcheck(self, text: str, language: str | None) -> list[Candidate]:
        assert self.factcheck
        usage.record("factcheck", "call")
        reviews = await self.factcheck.search(text, self.timeout, language)
        return [
            Candidate(r.claim_reviewed, r.publisher, r.title, r.url, r.rating, r.date,
                      credibility(r.url, from_factcheck_api=True), "factcheck")
            for r in reviews
        ]

    async def _from_search(self, text: str) -> list[Candidate]:
        assert self.tavily
        usage.record("tavily", "call")
        hits = await self.tavily.search(text, self.timeout)
        return [
            Candidate(h.title, domain_of(h.url), h.title, h.url, "", h.date, credibility(h.url), "search", h.content)
            for h in hits
        ]

    async def _semantic(self, claim: str, candidates: list[Candidate]) -> list[float | None]:
        if not self.gemini or not candidates:
            return [None] * len(candidates)
        texts = [claim] + [c.claim_reviewed or c.title for c in candidates]
        vectors = await _safe(self.gemini.embed(texts, self.timeout), self.timeout, "embedding")
        if len(vectors) != len(texts):
            return [None] * len(candidates)
        return [self.gemini.rescale(cosine(vectors[0], v)) for v in vectors[1:]]

    async def _assess(self, claim: Claim, candidates: list[Candidate], remote: bool = True) -> list[Evidence]:
        # Tanpa jaringan (label awal) kecocokan memakai leksikal + aturan konteks saja.
        semantic = await self._semantic(claim.text, candidates) if remote else [None] * len(candidates)
        matched: list[tuple[Candidate, float]] = []
        for cand, sem in zip(candidates, semantic):
            reviewed = cand.claim_reviewed if cand.origin != "search" else f"{cand.title}. {cand.content[:300]}"
            # Klaim asing dicocokkan dalam versi terjemahan dan versi aslinya; yang terbaik dipakai.
            score = max(context_match(text, reviewed, sem) for text in _texts(claim))
            if score >= MATCH_MIN:
                matched.append((cand, score))

        await self._resolve_stance(claim.text, [(c, s) for c, s in matched if not c.rating], remote)

        evidence = []
        for cand, score in matched:
            if not cand.rating:
                continue
            verdict = verdict_value(cand.rating)
            if verdict is None and not is_satire_rating(cand.rating):
                continue  # rating tidak dikenal: tidak dipakai
            if (cand.origin in ("search", "news") and verdict
                    and not (is_factcheck_page(cand.site) or is_factcheck_title(cand.title))):
                # Berita umum (mis. "manfaat daun sirsak") boleh mendukung, tapi bantahan harus dari
                # halaman cek fakta atau sumber resmi; sikap "menyesatkan" tebakan LLM tidak cukup.
                continue
            evidence.append(Evidence(
                claim_id=claim.id, publisher=cand.publisher, title=cand.title, url=cand.url,
                rating=cand.rating, verdict=verdict, date=cand.date, claim_reviewed=cand.claim_reviewed,
                match=score, credibility=cand.credibility, origin=cand.origin, reason=cand.reason,
            ))
        evidence.sort(key=lambda e: e.weight, reverse=True)
        return evidence[:MAX_EVIDENCE]

    async def _resolve_stance(self, claim: str, scored: list[tuple[Candidate, float]], remote: bool = True) -> None:
        """Isi rating hasil pencarian: dari judul artikel cek fakta dulu, LLM untuk sisanya, lalu heuristik berita."""
        for h, _ in scored:
            h.rating = rating_from_title(h.title)
        scored = [(h, s) for h, s in scored if not h.rating]
        hits = [h for h, _ in scored]
        judged = False
        if hits and self.gemini and remote:
            items = [{"title": h.title, "content": h.content} for h in hits]
            verdicts = await _safe(self.gemini.classify_stance(claim, items, self.timeout), self.timeout, "stance")
            judged = bool(verdicts)
            for item in verdicts:
                idx = item.get("index")
                if not isinstance(idx, int) or not 0 <= idx < len(hits) or not item.get("same_event"):
                    continue
                stance = item.get("stance")
                if stance in _STANCE_RATING:
                    hits[idx].rating = str(item.get("rating") or _STANCE_RATING[stance])
                    hits[idx].reason = str(item.get("reason") or "").strip()[:300] or None
                    # Pastikan rating bebas dari LLM tetap terbaca dengan arah yang sama.
                    if verdict_value(hits[idx].rating) is None:
                        hits[idx].rating = _STANCE_RATING[stance]
        if judged:
            return
        # LLM tidak tersedia (atau gagal): berita media terverifikasi yang judulnya nyaris sama dengan klaim
        # dan tidak bernada meragukan dihitung sebagai pemberitaan yang mendukung. Bantahan tidak pernah
        # lahir dari jalur ini.
        for h, score in scored:
            if (h.origin == "news" and not h.rating and score >= REPORTED_MATCH_MIN
                    and "?" not in h.title and not _HEDGE.search(normalize(h.title))):
                h.rating = REPORTED_RATING
                h.reason = "Judul berita dari media terverifikasi memuat peristiwa yang sama."


def _texts(claim: Claim) -> list[str]:
    return [claim.text, claim.original] if claim.original else [claim.text]


def _dedupe(candidates: list[Candidate]) -> list[Candidate]:
    seen: set[str] = set()
    out = []
    for c in candidates:
        key = c.url.rstrip("/")
        if key in seen:
            continue
        seen.add(key)
        out.append(c)
    return out


def merge_evidence(current: list[Evidence], extra: list[Evidence]) -> list[Evidence]:
    """Gabung dua daftar bukti untuk klaim yang sama: satu per URL, bobot tertinggi dulu."""
    by_url: dict[str, Evidence] = {}
    for e in [*current, *extra]:
        key = e.url.rstrip("/")
        if key not in by_url or e.weight > by_url[key].weight:
            by_url[key] = e
    return sorted(by_url.values(), key=lambda e: e.weight, reverse=True)[:MAX_EVIDENCE]
