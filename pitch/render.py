"""Рендер pitch/deck.html -> pitch/Qorgan_pitch.pdf через headless Chrome/Edge (без внешних зависимостей)."""
import os
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "deck.html"
OUT = HERE / "Qorgan_pitch.pdf"

CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    shutil.which("chrome") or "", shutil.which("google-chrome") or "", shutil.which("chromium") or "",
]
browser = next((c for c in CANDIDATES if c and os.path.exists(c)), None)
if not browser:
    sys.exit("Не найден Chrome/Edge — укажите путь в CANDIDATES")

subprocess.run([browser, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                f"--print-to-pdf={OUT}", SRC.as_uri()], check=True)
print("OK:", OUT)
