"""
Offline demo mode.

DEMO_MODE=offline  -> predict() is never called; answers come from cache.jsonl,
                       keyed by a hash of the input. Falls back to a canned
                       response if the exact input was never seen.
DEMO_MODE=record   -> predict() is called AND every (input, output) pair is
                       appended to cache.jsonl. Run this during normal testing
                       so the offline cache fills itself.
DEMO_MODE=live     -> (default) predict() is called, nothing is cached.
"""
import hashlib
import json
import os
from pathlib import Path
from typing import Optional

CACHE_PATH = Path(__file__).parent / "cache.jsonl"

_FALLBACK = {
    "label": "soon",
    "score": 0.5,
    "confidence": "low",
    "reasons": [{"factor": "offline", "detail": "no cached answer for this input", "weight": 1.0}],
    "recommended_action": "Offline fallback: no cached prediction, please try another example.",
    "needs_doctor_review": True,
    "missing_fields": [],
    "model_version": "offline-fallback",
    "error": None,
}


def _key(patient: dict) -> str:
    return hashlib.sha256(json.dumps(patient, sort_keys=True).encode()).hexdigest()


def lookup(patient: dict) -> Optional[dict]:
    if not CACHE_PATH.exists():
        return None
    target = _key(patient)
    with CACHE_PATH.open() as f:
        for line in f:
            row = json.loads(line)
            if row["key"] == target:
                return row["output"]
    return None


def record(patient: dict, output: dict) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CACHE_PATH.open("a") as f:
        f.write(json.dumps({"key": _key(patient), "output": output}) + "\n")


def offline_or_fallback(patient: dict) -> dict:
    return lookup(patient) or _FALLBACK


def mode() -> str:
    return os.environ.get("DEMO_MODE", "live")
