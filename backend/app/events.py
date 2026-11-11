"""Bus peristiwa realtime untuk dashboard (aliran data pipeline).

Setiap langkah analisis menerbitkan peristiwa kecil tanpa identitas penonton:
  masuk → tahap → klaim → bukti → vonis → (laporan | peringatan | aksi)
Dashboard berlangganan lewat SSE (/v1/stream). Riwayat terakhir disimpan di memori supaya
dashboard yang baru dibuka langsung punya isi.
"""

import asyncio
import time
from collections import Counter, deque
from typing import Any

KEEP = 300
QUEUE_MAX = 500


class EventBus:
    def __init__(self, keep: int = KEEP):
        self._recent: deque[dict[str, Any]] = deque(maxlen=keep)
        self._subscribers: set[asyncio.Queue] = set()
        self._seq = 0
        self.totals: Counter[str] = Counter()
        self.started = time.time()

    def publish(self, type_: str, **data: Any) -> dict[str, Any]:
        self._seq += 1
        event = {"id": self._seq, "ts": time.time(), "type": type_, **data}
        self._recent.append(event)
        self.totals[type_] += 1
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                # Dashboard yang lambat tidak boleh menahan pipeline: peristiwa lamanya dibuang.
                try:
                    queue.get_nowait()
                    queue.put_nowait(event)
                except (asyncio.QueueEmpty, asyncio.QueueFull):
                    pass
        return event

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=QUEUE_MAX)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self._subscribers.discard(queue)

    def recent(self, limit: int = 100) -> list[dict[str, Any]]:
        return list(self._recent)[-limit:]

    def snapshot(self) -> dict[str, Any]:
        now = time.time()
        last_minute = [e for e in self._recent if e["ts"] >= now - 60]
        return {
            "since": self.started,
            "totals": dict(self.totals),
            "per_minute": dict(Counter(e["type"] for e in last_minute)),
            "subscribers": len(self._subscribers),
        }


# Satu bus per proses; pipeline, laporan, dan API menerbitkan ke sini.
bus = EventBus()
