"""Watchlist entitas TNI (PRD FR13)."""

import re

from .text import normalize

_TERMS = [
    r"tni", r"tni ad", r"angkatan darat", r"tentara", r"prajurit", r"kodam", r"kodim", r"korem",
    r"koramil", r"kostrad", r"kopassus", r"babinsa", r"dandim", r"danrem", r"pangdam", r"danramil",
    r"ksad", r"kasad", r"panglima tni", r"yonif", r"batalyon", r"puspen", r"dispenad", r"pendam",
    r"marinir", r"paskhas", r"denpom", r"pomdam", r"militer",
]
_PATTERN = re.compile(r"\b(" + "|".join(_TERMS) + r")\b")


def is_tni_related(text: str) -> bool:
    return bool(_PATTERN.search(normalize(text)))
