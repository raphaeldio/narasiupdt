from typing import Literal

from pydantic import BaseModel, Field

Platform = Literal["instagram", "tiktok", "youtube", "facebook", "testbed"]
Modality = Literal["caption", "ocr", "audio"]
Stage = Literal["caption", "ocr", "audio", "final"]
# "neutral" = tidak ada klaim faktual yang perlu diperiksa (opini, hiburan, ajakan biasa).
Label = Literal["hoax", "caution", "supported", "unverified", "satire", "neutral", "error"]
# Dasar label: bukti cek fakta/berita, pola bahasa (sinyal risiko), penilaian AI, atau tidak ada.
Basis = Literal["evidence", "signals", "ai", "none"]
ClaimKind = Literal["factual", "opinion", "satire"]
# "feed" = indeks artikel pemeriksa fakta (RSS), "news" = pencarian berita di media terverifikasi.
EvidenceOrigin = Literal["factcheck", "search", "corpus", "feed", "news"]


class AnalyzeRequest(BaseModel):
    platform: Platform
    video_id: str = Field(min_length=1, max_length=128)
    url: str = Field(default="", max_length=2048)
    caption: str = Field(default="", max_length=5000)
    hashtags: list[str] = Field(default_factory=list, max_length=50)
    mode: Literal["multimodal", "caption"] = "multimodal"


class PrefetchRequest(BaseModel):
    platform: Platform
    video_id: str = Field(min_length=1, max_length=128)
    caption: str = Field(default="", max_length=5000)


FeedItemKind = Literal["text", "image", "video"]


class ScanItem(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    kind: FeedItemKind
    text: str = Field(default="", max_length=5000)
    hashtags: list[str] = Field(default_factory=list, max_length=50)
    url: str = Field(default="", max_length=2048)


class ScanRequest(BaseModel):
    platform: Platform
    items: list[ScanItem] = Field(min_length=1, max_length=10)


class FramesRequest(BaseModel):
    frames: list[str] = Field(min_length=1, max_length=5)


class AudioRequest(BaseModel):
    chunk: str
    index: int = Field(ge=0, le=2)


class FeedbackRequest(BaseModel):
    platform: Platform
    video_id: str = Field(min_length=1, max_length=128)
    claim_id: str | None = None
    reason: str = Field(default="tidak_relevan", max_length=500)


class Claim(BaseModel):
    id: str
    text: str
    source: Modality
    kind: ClaimKind = "factual"
    tni_related: bool = False
    topic: str = "umum"
    language: str = "id"
    # Kalimat asli bila klaim berbahasa asing dan sudah ditulis ulang LLM ke Bahasa Indonesia.
    original: str | None = None
    # Kata kunci pencarian Fact Check yang dirumuskan LLM; hanya dipakai server, tidak dikirim ke klien.
    queries: list[str] = Field(default_factory=list, exclude=True)


class Evidence(BaseModel):
    claim_id: str
    publisher: str
    title: str
    url: str
    rating: str
    verdict: float | None  # v(e): 1.0 bantahan, 0.6 menyesatkan, 0.0 benar, None satire
    date: str | None = None
    claim_reviewed: str | None = None
    match: float
    credibility: float
    origin: EvidenceOrigin
    # Alasan singkat dari LLM saat menilai sikap hasil pencarian; kosong untuk rating dari pemeriksa fakta.
    reason: str | None = None

    @property
    def weight(self) -> float:
        return self.match * self.credibility


class AnalysisResult(BaseModel):
    platform: Platform
    video_id: str
    stage: Stage
    final: bool
    score: int | None
    label: Label
    confidence: Literal["high", "medium", "low"] | None
    tni_related: bool
    basis: Basis = "none"
    topics: list[str] = Field(default_factory=list)
    language: str = "id"
    # Sinyal risiko dari pola bahasa: {"score": int, "level": str, "signals": [...]}.
    risk: dict | None = None
    # Penilaian AI saat belum ada rujukan cek fakta: {"verdict", "confidence", "reason"}.
    ai: dict | None = None
    claims: list[Claim]
    evidence: list[Evidence]
    conclusion: str | None
    notes: list[str] = Field(default_factory=list)
    cached: bool = False


class ScanResult(BaseModel):
    id: str
    label: Label
    score: int | None
    tni_related: bool
    claims: int
    cached: bool
    basis: Basis = "none"
    topic: str = "umum"
    language: str = "id"
    risk: int = 0


class ScanResponse(BaseModel):
    results: list[ScanResult]


ReportReason = Literal["mencatut_tni", "provokasi", "hoaks", "lainnya"]
ReportStatus = Literal["baru", "ditinjau", "ditindaklanjuti", "ditutup"]


class ReportRequest(BaseModel):
    platform: Platform
    video_id: str = Field(min_length=1, max_length=128)
    url: str = Field(default="", max_length=2048)
    reason: ReportReason = "mencatut_tni"
    note: str = Field(default="", max_length=500)
    result: AnalysisResult | None = None


class ActionRequest(BaseModel):
    narrative: str = Field(min_length=1, max_length=64)
    action: str = Field(min_length=1, max_length=40)
    note: str = Field(default="", max_length=300)


class ReportUpdate(BaseModel):
    status: ReportStatus
    note: str = Field(default="", max_length=500)
