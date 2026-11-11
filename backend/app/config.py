from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Layanan eksternal. Kosong = komponen itu berjalan dalam mode lokal.
    gemini_api_key: str = ""
    # gemini-2.5-flash tidak lagi tersedia untuk pengguna baru (Okt 2026).
    gemini_model: str = "gemini-3.8-flash"
    gemini_embed_model: str = "gemini-embedding-001"
    # Model 3.x: "low" adalah level tercepat yang didukung gemini-3.8-flash ("minimal" ditolak).
    gemini_thinking_level: str | None = "low"
    # Dicoba berurutan bila model utama menolak (503/429) atau habis waktu.
    gemini_fallback_models: list[str] = ["gemini-3.6-flash", "gemini-3.5-flash"]
    # Batas permintaan per menit sesuai kuota key (key gratis umumnya ~10). 0 = tanpa batas.
    gemini_rpm: int = 10
    # Model 2.5: 0 mematikan "thinking" agar lebih cepat.
    gemini_thinking_budget: int | None = 0

    groq_api_key: str = ""
    groq_asr_model: str = "whisper-large-v3-turbo"
    # LLM teks + vision di Groq: jauh lebih cepat dan kuota gratisnya lebih longgar daripada Gemini.
    groq_llm_model: str = "qwen/qwen3.8-27b"
    # Urutan penyedia LLM untuk klaim, OCR, sikap bukti, dan kesimpulan; yang gagal dilewati.
    llm_order: list[str] = ["groq", "gemini"]

    factcheck_api_key: str = ""
    tavily_api_key: str = ""

    # Sumber bukti tanpa kunci API (pendekatan selain Google Fact Check).
    # Indeks artikel pemeriksa fakta dari RSS (TurnBackHoax, Snopes, PolitiFact, Full Fact, Lead Stories).
    fact_feeds: bool = True
    feeds_path: str = "var/feeds.json"
    feeds_refresh_minutes: int = 30
    # Pencarian berita di media terverifikasi lewat RSS Google News, mengikuti bahasa klaim.
    news_search: bool = True

    redis_url: str = ""
    cache_ttl_seconds: int = 7 * 24 * 3600

    # "production": server menolak start bila DASHBOARD_TOKEN kosong dan data uji dimatikan.
    environment: str = "development"

    cors_origins: list[str] = ["http://localhost:5174", "http://127.0.0.1:5174", "http://localhost:5173", "http://127.0.0.1:5173"]
    dashboard_token: str = ""
    # ID extension NARASI resmi; kosong = semua extension Chrome boleh memanggil API (mode pengembangan).
    extension_ids: list[str] = []
    # Laporan berstatus "ditutup" dihapus setelah sekian hari. 0 = simpan selamanya.
    closed_report_retention_days: int = 90

    # Pagar kuota LLM untuk seluruh server (semua penyedia digabung). 0 = tanpa batas.
    # Bila terlampaui, tahap yang punya pengganti heuristik memakai heuristik; OCR dilewati.
    llm_max_per_minute: int = 30
    llm_max_per_day: int = 5000
    # Hasil LLM disimpan di cache kolektif agar teks/caption yang sama tidak pernah dikirim dua kali.
    llm_cache_ttl_seconds: int = 30 * 24 * 3600

    # Korpus data uji untuk pengujian otomatis (bukan data fact-check sungguhan).
    testbed_fixtures: bool = False

    # Anggaran waktu per tahap (detik), sesuai PRD Bagian 9.4.
    llm_timeout: float = 4.0
    # Frame gambar ke LLM multimodal butuh lebih lama daripada teks.
    ocr_timeout: float = 8.0
    asr_timeout: float = 6.0
    evidence_timeout: float = 3.0
    session_deadline: float = 25.0

    rate_limit_per_minute: int = 60

    # Folder hasil build dashboard (paket portabel): bila diisi, dashboard disajikan di "/" oleh server ini.
    static_dir: str = ""

    # Laporan & peringatan dini TNI AD (FR18).
    reports_db_path: str = "var/narasi.db"
    # Garam hash ID instalasi; isi nilai tetap agar hitungan penonton unik konsisten antar-restart.
    viewer_salt: str = ""
    # Webhook petugas (mis. https://api.telegram.org/bot<token>/sendMessage?chat_id=<id>).
    alert_webhook_url: str = ""
    # Level minimum yang dikirim otomatis: "sedang" atau "tinggi". Laporan pengguna selalu dikirim.
    alert_min_level: str = "tinggi"


@lru_cache
def get_settings() -> Settings:
    return Settings()
