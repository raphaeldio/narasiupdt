"""Korpus terkurasi: bantahan resmi yang dikelola tim (dan data uji bila diaktifkan untuk pengujian)."""

import json
from dataclasses import dataclass
from pathlib import Path

from .ratings import credibility
from .text import lexical_similarity

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CANDIDATE_MIN = 0.25


@dataclass(frozen=True)
class CorpusEntry:
    id: str
    claim: str
    rating: str
    publisher: str
    title: str
    url: str
    date: str | None
    credibility: float


def _load(path: Path) -> list[CorpusEntry]:
    entries = []
    for raw in json.loads(path.read_text(encoding="utf-8")):
        cred = raw.pop("credibility", None)
        entries.append(CorpusEntry(**raw, credibility=cred if cred is not None else credibility(raw["url"])))
    return entries


class Corpus:
    def __init__(self, include_testbed: bool):
        self.entries = _load(DATA_DIR / "corpus.json")
        if include_testbed:
            self.entries += _load(DATA_DIR / "testbed_fixtures.json")

    def search(self, claim: str, limit: int = 5) -> list[CorpusEntry]:
        scored = [(lexical_similarity(claim, e.claim), e) for e in self.entries]
        scored = [(s, e) for s, e in scored if s >= CANDIDATE_MIN]
        scored.sort(key=lambda x: x[0], reverse=True)
        return [e for _, e in scored[:limit]]
