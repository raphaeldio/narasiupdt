"""Penghitung pemakaian layanan berkuota (LLM, ASR, Fact Check, Tavily, embedding) untuk bukti hemat kuota.

`calls` = permintaan yang benar-benar dikirim ke penyedia; `cache` dan `shared` = permintaan yang
dihemat karena hasilnya sudah ada di cache kolektif atau menumpang panggilan serentak yang sama.
"""

import time
from collections import Counter


class Usage:
    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.started = time.time()
        self.calls: Counter[str] = Counter()
        self.saved: Counter[str] = Counter()
        self.skipped: Counter[str] = Counter()

    def record(self, service: str, source: str) -> None:
        """source: "call", "cache", "shared", atau "budget" (ditolak pagar kuota)."""
        if source == "call":
            self.calls[service] += 1
        elif source == "budget":
            self.skipped[service] += 1
        else:
            self.saved[f"{service}:{source}"] += 1

    def snapshot(self) -> dict:
        llm_calls = sum(n for k, n in self.calls.items() if k.startswith("llm."))
        llm_saved = sum(n for k, n in self.saved.items() if k.startswith("llm."))
        total = llm_calls + llm_saved
        return {
            "since": self.started,
            "calls": dict(self.calls),
            "saved": dict(self.saved),
            "skipped_by_budget": dict(self.skipped),
            "llm_calls": llm_calls,
            "llm_saved": llm_saved,
            "llm_saving_rate": round(llm_saved / total, 3) if total else 0.0,
        }


usage = Usage()
