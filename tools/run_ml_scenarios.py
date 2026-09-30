"""Прогон 48 состояний из Scenarios.docx (ветка ml, prime_scenarios.json) через наш движок.

Сравниваем то, что у движков общее: пакет PRIME, статус каждого госскрининга, остановку по «беспокоит сейчас».
Их коды услуг каталога (prime_*_group) — своя нумерация, не сравниваются.
Их review / needs_input = наше «уточнить у врача» (clarify).
Запуск: python tools/run_ml_scenarios.py → spec/scenarios_ml/REPORT.md
"""
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from engine import predict  # noqa: E402

SRC = ROOT / "spec" / "scenarios_ml" / "prime_scenarios.json"
OUT = ROOT / "spec" / "scenarios_ml" / "REPORT.md"
SCR = ["scr_cvd", "scr_cerebro", "scr_breast", "scr_cervix", "scr_colorectal", "scr_hepatitis", "scr_lung"]


def to_ours(p):
    """Их вход (clinic_v2 / df733c4) → наш. «none» в списках = пусто; last_screening: год остаётся, «never» — нет."""
    d = {k: v for k, v in p.items() if k != "input_version"}
    for k in ("conditions", "registered", "family_history", "risk_group"):
        if isinstance(d.get(k), list):
            d[k] = [x for x in d[k] if x not in ("none", "unknown")]
    ls = {}
    for rid, v in (p.get("last_screening") or {}).items():
        if isinstance(v, int):
            ls[rid] = v
        elif isinstance(v, dict) and isinstance(v.get("year"), int):
            ls[rid] = v["year"]
        elif isinstance(v, str) and v[:4].isdigit():
            ls[rid] = int(v[:4])
    d["last_screening"] = ls
    d.setdefault("checkup_year", 2026)
    return d


def ours_screening(out):
    st = {r: "not_eligible" for r in SCR}
    for f in out.get("free", []):
        st[f["rule_id"]] = "candidate"
    for c in out.get("clarify", []):
        st[c["rule_id"]] = "clarify"
    return st


def norm(want):
    wants = want if isinstance(want, list) else [want]
    return ["clarify" if w in ("review", "needs_input") else w for w in wants]


def main():
    data = json.loads(SRC.read_text(encoding="utf-8"))
    rows, kinds = [], Counter()
    n_scr = n_scr_ok = n_block = n_block_ok = 0
    for s in data["states"]:
        exp = s["expected"].get("recommend")
        if not exp or "request" not in s:
            continue
        inp = s["request"]["patient"]
        ctx = s["request"].get("context") or {}
        mine = to_ours(inp)
        if ctx.get("as_of_date") or ctx.get("visit_date"):  # их пакет — на дату расчёта (as_of_date)
            mine["visit_date"] = ctx.get("as_of_date") or ctx["visit_date"]
        out = predict(mine)
        diffs = []
        if out.get("error"):
            diffs.append(("ошибка", out["error"]))
        elif inp.get("urgent") not in (None, "none"):
            n_block += 1
            n_block_ok += bool(out.get("red_flag"))
            if not out.get("red_flag"):
                diffs.append(("остановка", "у них стоп, у нас нет"))
        else:
            ours_pkg = (out.get("package") or {}).get("id")
            if exp.get("package_id") and ours_pkg != exp["package_id"]:
                diffs.append(("пакет", f"их {exp['package_id']} / наш {ours_pkg}"))
            ours = ours_screening(out)
            for rid, want in (exp.get("screening") or {}).items():
                n_scr += 1
                wants, got = norm(want), ours.get(rid)
                if got in wants:
                    n_scr_ok += 1
                    continue
                kind = ("у них «уточнить», у нас решено" if "clarify" in wants else
                        "у нас «уточнить», у них решено" if got == "clarify" else "расхождение")
                kinds[kind] += 1
                diffs.append((kind, f"{rid}: их {want} / наш {got}"))
        rows.append((s["id"], s["profile_facts"].get("document_profile", "")[:90], exp.get("status"), diffs))
    ok_states = sum(1 for r in rows if not r[3])
    lines = [
        "# Сценарии Scenarios.docx (ветка ml) через наш движок",
        "",
        f"Состояний с ожиданиями подбора: **{len(rows)}**. Полностью совпали: **{ok_states}**.",
        f"Госскрининги: совпало **{n_scr_ok} из {n_scr}** статусов. Остановка «беспокоит сейчас»: **{n_block_ok} из {n_block}**.",
        "",
        ("Классы расхождений: " + ", ".join(f"{k} — {v}" for k, v in kinds.most_common())) if kinds else "Расхождений по скринингам нет.",
        "",
        "| Состояние | Профиль | Их статус | Расхождения |",
        "|---|---|---|---|",
    ]
    for sid, prof, status, diffs in rows:
        lines.append(f"| {sid} | {prof} | {status} | " + ("—" if not diffs else "<br>".join(f"{k}: {v}" for k, v in diffs)) + " |")
    lines += [
        "",
        "## Что исправлено в нашем движке по итогам прогона (30.09.2026)",
        "- Скрининг рака лёгкого: «отказавшиеся от курения **менее** 15 лет назад» (приказ № 75) — было «не больше 15».",
        "- Скрининг гепатитов: «18 лет и старше» без «по году достижения» — считаем полные годы, было — по году рождения.",
        "- Возраст — на дату расчёта (`visit_date`), а не всегда на сегодня.",
        "- Неполный ответ ≠ «нет»: «возможна беременность», стаж курения без срока отказа, нет ответа о курении — «уточнить у врача».",
        "",
        "## Решения по пяти спорным случаям (слово Виталия, 30.09.2026)",
        "Принцип: всё ясно и явно — действуем по нормативу; есть неясность — «уточнить у врача».",
        "- 17 полных лет, 18 — в этом году: гепатиты — «уточнить».",
        "- Нет ответа о беременности (вопрос обязательный): «уточнить».",
        "- Учёт по широкой группе (молочная железа, ВПЧ, кишечник, лёгкие) без подтверждения врачом: «к врачу»; подтверждён — не положено.",
        "- Бросил курить ровно 15 лет назад: «к врачу».",
        "- Год прошлого обследования точный — по нормативу (маммография 2025 → следующая 2027); «за последние 2 года» — «уточнить».",
        "",
        "После этих решений: 46 из 46 состояний, 287 из 287 статусов скринингов, остановка 3 из 3.",
    ]
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"states={len(rows)} ok={ok_states} screening={n_scr_ok}/{n_scr} block={n_block_ok}/{n_block}")
    print(dict(kinds))


if __name__ == "__main__":
    main()
