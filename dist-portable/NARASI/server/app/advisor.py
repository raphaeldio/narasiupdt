"""Rekomendasi aksi selanjutnya untuk petugas, plus parameter simulasi dampaknya.

Aturannya sengaja eksplisit (bukan kotak hitam): petugas bisa membaca alasan tiap saran.
Angka efek (`growth_cut`, `reach_cut`, `delay_hours`) adalah ASUMSI awal model simulasi di dashboard,
bukan hasil pengukuran; dashboard menampilkannya sebagai asumsi dan petugas bisa menggesernya.
"""

from typing import Any

from .topics import GENERAL, TOPIC_AUTHORITY, TOPIC_LABELS

# growth_cut: seberapa besar laju sebaran turun setelah aksi berjalan (0..1).
# reach_cut: porsi tayangan yang hilang karena konten diturunkan (0..1).
# delay_hours: jeda dari keputusan sampai aksi mulai terasa.
ACTIONS: dict[str, dict[str, Any]] = {
    "klarifikasi": {
        "title": "Terbitkan klarifikasi resmi",
        "owner": "Dispenad / Pendam",
        "how": "Unggah bantahan singkat + bukti di akun resmi, sematkan tautan sumber, lalu kirim ke media.",
        "delay_hours": 3, "growth_cut": 0.45, "reach_cut": 0.0, "effort": "sedang",
    },
    "takedown": {
        "title": "Ajukan penurunan konten",
        "owner": "Komdigi + platform",
        "how": "Laporkan video teratas lewat kanal aduan konten Komdigi dan fitur lapor platform, lampirkan bukti.",
        "delay_hours": 12, "growth_cut": 0.1, "reach_cut": 0.55, "effort": "sedang",
    },
    "kontra_narasi": {
        "title": "Sebar kontra-narasi di kanal satuan",
        "owner": "Pendam / Penrem",
        "how": "Bagikan versi ringkas klarifikasi ke grup satuan, Babinsa, dan mitra komunitas di wilayah terdampak.",
        "delay_hours": 1, "growth_cut": 0.25, "reach_cut": 0.0, "effort": "ringan",
    },
    "cek_fakta": {
        "title": "Minta pemeriksaan ke pemeriksa fakta",
        "owner": "Mafindo / Komdigi",
        "how": "Kirim klaim dan tautan videonya ke kanal aduan pemeriksa fakta supaya ada rujukan resmi.",
        "delay_hours": 8, "growth_cut": 0.2, "reach_cut": 0.0, "effort": "ringan",
    },
    "edukasi": {
        "title": "Ingatkan prajurit dan keluarga",
        "owner": "Komandan satuan",
        "how": "Sampaikan lewat jam komandan atau grup internal: jangan ikut menyebarkan, laporkan bila melihat.",
        "delay_hours": 2, "growth_cut": 0.12, "reach_cut": 0.0, "effort": "ringan",
    },
    "teruskan": {
        "title": "Teruskan ke instansi terkait",
        "owner": "Instansi sesuai topik",
        "how": "Kirim ringkasan narasi dan tautannya ke instansi yang berwenang untuk klarifikasi.",
        "delay_hours": 6, "growth_cut": 0.2, "reach_cut": 0.0, "effort": "ringan",
    },
    "eskalasi": {
        "title": "Laporkan ke pimpinan",
        "owner": "Kadispenad / Kapendam",
        "how": "Buat laporan singkat: isi narasi, sebaran, bukti, dan aksi yang sudah berjalan.",
        "delay_hours": 1, "growth_cut": 0.0, "reach_cut": 0.0, "effort": "ringan",
    },
    "pantau": {
        "title": "Pantau dulu",
        "owner": "Petugas piket",
        "how": "Belum perlu tindakan. Cek lagi bila penonton naik atau ada laporan baru.",
        "delay_hours": 0, "growth_cut": 0.0, "reach_cut": 0.0, "effort": "ringan",
    },
}

URGENCY_RANK = {"segera": 0, "hari_ini": 1, "pantau": 2}


def baseline(viewers_1h: int, viewers_prev_1h: int, reach: int) -> dict[str, float]:
    """Titik awal simulasi: laju per jam, faktor tumbuh per jam, dan jangkauan sejauh ini."""
    if viewers_prev_1h > 0:
        growth = viewers_1h / viewers_prev_1h
    else:
        growth = 1.6 if viewers_1h >= 3 else 1.1
    return {"rate": float(viewers_1h), "growth": round(min(3.0, max(0.6, growth)), 2), "reach": float(reach)}


def recommend(n: dict[str, Any], taken: set[str] | None = None) -> list[dict[str, Any]]:
    """Daftar aksi berurutan untuk satu narasi. `taken` = aksi yang sudah dicatat petugas."""
    taken = taken or set()
    label, level, rising = n.get("label"), n.get("level"), bool(n.get("rising"))
    tni, basis = bool(n.get("tni_related")), n.get("basis") or "evidence"
    topic = n.get("topic") or GENERAL
    reports, videos = int(n.get("reports") or 0), int(n.get("videos") or 1)
    platforms = len(n.get("platforms") or {})
    hot = level == "tinggi" or rising
    out: list[tuple[str, str, str]] = []

    def add(action: str, urgency: str, why: str) -> None:
        if action not in (a for a, _, _ in out):
            out.append((action, urgency, why))

    proven = basis == "evidence" and label in ("hoax", "caution")
    if proven and tni:
        add("klarifikasi", "segera" if hot else "hari_ini",
            "Sudah ada bantahan dari sumber terpercaya dan narasinya mencatut TNI, jadi klarifikasi resmi paling "
            "cepat memotong sebaran." if label == "hoax" else
            "Isinya kehilangan konteks. Klarifikasi yang melengkapi konteks lebih efektif daripada sekadar membantah.")
    elif proven:
        add("teruskan", "segera" if hot else "hari_ini",
            f"Topiknya {TOPIC_LABELS.get(topic, topic).lower()}, di luar wewenang TNI AD. "
            f"Paling pas diteruskan ke {TOPIC_AUTHORITY.get(topic, TOPIC_AUTHORITY[GENERAL])}.")

    if label == "hoax" and basis == "evidence" and (level == "tinggi" or reports >= 2):
        add("takedown", "segera" if rising else "hari_ini",
            f"{reports} laporan pengguna dan bukti bantahan sudah cukup untuk mengajukan penurunan konten."
            if reports else "Prioritasnya tinggi dan buktinya ada, cukup kuat untuk mengajukan penurunan konten.")
    if proven and (rising or videos >= 3 or platforms >= 2):
        add("kontra_narasi", "segera" if rising else "hari_ini",
            f"Narasi ini sudah muncul di {videos} video" + (f" pada {platforms} platform" if platforms >= 2 else "")
            + ". Satu klarifikasi tidak cukup, perlu disebar lewat kanal satuan.")

    if not proven and label in ("caution", "unverified") and (reports or tni or hot):
        add("cek_fakta", "segera" if hot else "hari_ini",
            "Belum ada rujukan cek fakta. Minta diperiksa dulu supaya klarifikasi punya dasar yang kuat."
            if basis != "signals" else
            "Baru terdeteksi dari pola bahasanya, belum ada bukti. Jangan dibantah dulu, minta diperiksa.")

    if level == "tinggi" and (rising or reports >= 3):
        add("eskalasi", "segera", "Prioritas tinggi dan masih bergerak. Pimpinan perlu tahu sebelum makin ramai.")
    if tni and label in ("hoax", "caution") and (hot or topic == "penipuan"):
        add("edukasi", "hari_ini",
            "Prajurit dan keluarga sering jadi sasaran sekaligus penyebar tanpa sadar. Ingatkan lewat jalur internal.")
    if not out or (not hot and not reports):
        add("pantau", "pantau", "Sebarannya masih kecil. Cukup dipantau, sistem akan menaikkan prioritas bila berubah.")

    out.sort(key=lambda item: URGENCY_RANK[item[1]])
    recs = []
    for action, urgency, why in out[:4]:
        spec = ACTIONS[action]
        owner = TOPIC_AUTHORITY.get(topic, spec["owner"]) if action == "teruskan" else spec["owner"]
        recs.append({"id": action, "title": spec["title"], "owner": owner, "how": spec["how"], "urgency": urgency,
                     "why": why, "done": action in taken})
    return recs
