import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# contract/ and ml/ sit next to app/ at the repo root
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from contract.predict_contract import predict  # noqa: E402
from app.offline import cache  # noqa: E402
from app.config.fields import FIELDS  # noqa: E402

app = FastAPI(title="MedHub app")

STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
def health():
    return {"status": "ok", "demo_mode": cache.mode()}


@app.get("/fields")
def fields():
    return FIELDS


@app.post("/predict")
def run_predict(patient: dict):
    mode = cache.mode()

    if mode == "offline":
        return cache.offline_or_fallback(patient)

    output = predict(patient)

    if mode == "record":
        cache.record(patient, output)

    return output
