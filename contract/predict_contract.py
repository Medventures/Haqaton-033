"""
contract/predict_contract.py  --  DRAFT, freeze at Milestone 1 (T0 + 1h15)

The agreement between app/ (tech lead) and ml/ (model developer).
Field names are PLACEHOLDERS until the real task/data are published.

Rules:
  1. Input and output are plain JSON-serializable dicts.
  2. predict() never raises. Failures come back in the "error" field.
  3. Every input field is optional. The model handles missing values.
  4. Same input -> same output (no randomness in the demo).
  5. app/ only ever calls predict(). It never imports anything else from ml/.
"""
from typing import Literal, Optional, TypedDict


class PatientInput(TypedDict, total=False):
    age: int
    sex: Literal["m", "f"]
    symptoms: list[str]
    vitals: dict[str, float]
    labs: dict[str, float]
    history: list[str]
    free_text: str


class Reason(TypedDict):
    factor: str
    detail: str
    weight: float


class Prediction(TypedDict):
    label: Literal["urgent", "soon", "routine"]
    score: float
    confidence: Literal["low", "medium", "high"]
    reasons: list[Reason]
    recommended_action: str
    needs_doctor_review: bool
    missing_fields: list[str]
    model_version: str
    error: Optional[str]


def predict(patient: PatientInput) -> Prediction:
    """STUB. ml/ replaces the body at Milestone 3 without changing the signature."""
    return {
        "label": "soon",
        "score": 0.5,
        "confidence": "low",
        "reasons": [{"factor": "stub", "detail": "placeholder answer", "weight": 1.0}],
        "recommended_action": "Stub answer: model not connected yet.",
        "needs_doctor_review": True,
        "missing_fields": [],
        "model_version": "stub-0",
        "error": None,
    }


EXAMPLES: list[tuple[PatientInput, dict]] = [
    (
        {"age": 62, "sex": "m", "symptoms": ["chest_pain"],
         "vitals": {"hr": 112, "sbp": 92, "spo2": 93},
         "labs": {"troponin": 0.9}, "history": ["hypertension"]},
        {"needs_doctor_review": True},  # stub always True; tighten once real model lands
    ),
    (
        {"age": 25, "sex": "f", "symptoms": ["mild_headache"],
         "vitals": {"hr": 72, "sbp": 118, "spo2": 99}},
        {"needs_doctor_review": True},
    ),
    (
        {"age": 70, "symptoms": ["dizziness"]},
        {"needs_doctor_review": True},
    ),
]


def check_examples() -> None:
    for i, (given, expected) in enumerate(EXAMPLES, 1):
        got = predict(given)
        for key, want in expected.items():
            assert got[key] == want, f"example {i}: {key} = {got[key]!r}, expected {want!r}"
    print("contract OK")


if __name__ == "__main__":
    check_examples()
