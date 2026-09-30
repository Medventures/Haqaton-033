from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config.fields import FIELDS
from app.recommendations import InvalidAnswers, recommend

app = FastAPI(title="Green Clinic questionnaire")

STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/fields")
def fields():
    return FIELDS


@app.post("/recommendations")
async def recommendations(request: Request):
    try:
        payload = await request.json()
        result = recommend(payload)
    except (InvalidAnswers, ValueError) as exc:
        message = str(exc) if isinstance(exc, InvalidAnswers) else "Не удалось прочитать ответы анкеты."
        return JSONResponse({"error": message}, status_code=422, headers={"Cache-Control": "no-store"})
    return JSONResponse(result, headers={"Cache-Control": "no-store"})
