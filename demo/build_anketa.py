"""Сборка demo/anketa.html: вшивает spec/rules.json в demo/anketa.src.html (правила — один источник с движком).

Запуск: python demo/build_anketa.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
src = (ROOT / "demo" / "anketa.src.html").read_text(encoding="utf-8")
rules = json.loads((ROOT / "spec" / "rules.json").read_text(encoding="utf-8"))
marker = "/*RULES_JSON*/null"
if marker not in src:
    raise SystemExit(f"В anketa.src.html нет метки {marker}")
out = src.replace(marker, json.dumps(rules, ensure_ascii=False).replace("</", "<\\/"))
(ROOT / "demo" / "anketa.html").write_text(out, encoding="utf-8")
print("OK:", ROOT / "demo" / "anketa.html")
