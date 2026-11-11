"""Kirim peringatan ke kanal petugas (webhook generik: Telegram sendMessage, Slack, Discord, dll)."""

import logging
from typing import Any

import httpx

log = logging.getLogger("narasi.notifier")

PLATFORM_NAMES = {"instagram": "Instagram", "tiktok": "TikTok", "youtube": "YouTube Shorts",
                  "facebook": "Facebook", "testbed": "Testbed"}
LABEL_NAMES = {"hoax": "indikasi hoaks", "caution": "perlu diwaspadai", "unverified": "belum terverifikasi",
               "supported": "didukung sumber", "satire": "satire", "error": "gagal diperiksa"}


def format_alert(alert: dict[str, Any], reason: str) -> str:
    score = f" {alert['score']}%" if alert.get("score") is not None else ""
    lines = [
        f"[NARASI · prioritas {alert['level'].upper()}] {reason}",
        f"Platform: {PLATFORM_NAMES.get(alert['platform'], alert['platform'])}",
        f"Label: {LABEL_NAMES.get(alert['label'], alert['label'])}{score}"
        + (" · terkait TNI" if alert.get("tni_related") else ""),
        f"Penonton unik 1 jam: {alert['viewers_1h']} (jam sebelumnya {alert['viewers_prev_1h']})"
        + (" · NAIK CEPAT" if alert.get("rising") else ""),
        f"Laporan pengguna: {alert['reports']}",
    ]
    if alert.get("claim"):
        lines.append(f"Klaim: {alert['claim']}")
    if alert.get("url"):
        lines.append(alert["url"])
    return "\n".join(lines)


class Notifier:
    def __init__(self, client: httpx.AsyncClient, url: str):
        self._client = client
        self._url = url

    @property
    def enabled(self) -> bool:
        return bool(self._url)

    async def send(self, alert: dict[str, Any], reason: str) -> None:
        if not self._url:
            return
        text = format_alert(alert, reason)
        try:
            # "text" untuk Telegram/Slack, "content" untuk Discord; "alert" untuk integrasi sendiri.
            await self._client.post(self._url, json={"text": text, "content": text, "alert": alert}, timeout=5)
        except Exception as exc:
            log.warning("webhook gagal: %s", exc)
