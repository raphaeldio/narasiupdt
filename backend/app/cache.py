"""Cache kolektif (PRD FR12): Redis bila REDIS_URL diisi, memori proses bila tidak."""

import asyncio
import json
import time
from collections.abc import Awaitable, Callable
from typing import Any, Protocol


class Cache(Protocol):
    name: str

    async def get(self, key: str) -> Any | None: ...
    async def set(self, key: str, value: Any, ttl: int) -> None: ...
    async def close(self) -> None: ...


class MemoryCache:
    name = "memory"

    def __init__(self, max_items: int = 5000):
        self._data: dict[str, tuple[float, str]] = {}
        self._max = max_items

    async def get(self, key: str) -> Any | None:
        item = self._data.get(key)
        if not item:
            return None
        expires, payload = item
        if expires < time.monotonic():
            self._data.pop(key, None)
            return None
        return json.loads(payload)

    async def set(self, key: str, value: Any, ttl: int) -> None:
        if len(self._data) >= self._max:
            # Buang entri yang paling cepat kedaluwarsa.
            oldest = min(self._data, key=lambda k: self._data[k][0])
            self._data.pop(oldest, None)
        self._data[key] = (time.monotonic() + ttl, json.dumps(value))

    async def close(self) -> None:
        self._data.clear()


class RedisCache:
    name = "redis"

    def __init__(self, url: str):
        from redis.asyncio import Redis

        self._redis = Redis.from_url(url, decode_responses=True, socket_timeout=0.5)

    async def get(self, key: str) -> Any | None:
        try:
            payload = await self._redis.get(f"narasi:{key}")
        except Exception:
            return None
        return json.loads(payload) if payload else None

    async def set(self, key: str, value: Any, ttl: int) -> None:
        try:
            await self._redis.set(f"narasi:{key}", json.dumps(value), ex=ttl)
        except Exception:
            pass

    async def close(self) -> None:
        await self._redis.aclose()


def create_cache(redis_url: str) -> Cache:
    return RedisCache(redis_url) if redis_url else MemoryCache()


class SingleFlight:
    """Satu pekerjaan per kunci: pemanggil serentak dengan kunci sama menunggu hasil yang sama.

    Pekerjaan dilindungi dari pembatalan pemanggil (mis. batas waktu satu sesi), jadi hasilnya
    tetap selesai dan tersimpan di cache untuk penonton berikutnya.
    """

    def __init__(self) -> None:
        self._inflight: dict[str, asyncio.Task] = {}

    def __len__(self) -> int:
        return len(self._inflight)

    async def run(self, key: str, factory: Callable[[], Awaitable[Any]]) -> tuple[Any, bool]:
        """Kembalikan (hasil, ikut_menunggu): True bila pekerjaan sudah dimulai pemanggil lain."""
        task = self._inflight.get(key)
        shared = task is not None
        if task is None:
            task = asyncio.ensure_future(factory())
            self._inflight[key] = task
            task.add_done_callback(lambda t: (self._inflight.pop(key, None), t.cancelled() or t.exception()))
        return await asyncio.shield(task), shared


async def memo(cache: "Cache", flight: SingleFlight, key: str, ttl: int,
               factory: Callable[[], Awaitable[Any]]) -> tuple[Any, str]:
    """Cache kolektif + singleflight. Sumber: "cache", "shared" (menumpang panggilan serentak), atau "call"."""
    hit = await cache.get(key)
    if hit is not None:
        return hit, "cache"

    async def call() -> Any:
        value = await factory()
        await cache.set(key, value, ttl)
        return value

    value, shared = await flight.run(key, call)
    return value, "shared" if shared else "call"
