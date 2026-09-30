"""12 контрольных пациентов из spec/examples.json + карусель на 10 эталонных."""
import json
import sys
from pathlib import Path

from engine import morning, predict

ROOT = Path(__file__).parent
EXAMPLES = json.loads((ROOT / "spec" / "examples.json").read_text(encoding="utf-8"))
SAMPLES = json.loads((ROOT / "spec" / "sample_inputs.json").read_text(encoding="utf-8"))


def check(ex):
    out = predict(dict(ex["input"]))
    exp = ex["expect"]
    errs = []
    if out.get("error"):
        return [out["error"]]
    if out["age_year"] != exp["age_year"]:
        errs.append(f"возраст {out['age_year']} ≠ {exp['age_year']}")
    if bool(out["red_flag"]) != exp["red_flag"]:
        errs.append("красный флаг")
    if not exp["red_flag"]:
        if out["package"]["id"] != exp["package"]:
            errs.append(f"пакет {out['package']['id']} ≠ {exp['package']}")
        got = sorted(f["rule_id"] for f in out["free"])
        if got != sorted(exp["free_rules"]):
            errs.append(f"бесплатно {got} ≠ {sorted(exp['free_rules'])}")
        got_no = sorted(n["rule_id"] for n in out["not_eligible"])
        if got_no != sorted(exp["not_eligible"]):
            errs.append(f"не положено {got_no} ≠ {sorted(exp['not_eligible'])}")
    return errs


def test_examples():
    bad = {ex["name"]: e for ex in EXAMPLES if (e := check(ex))}
    assert not bad, bad


def test_samples_and_morning():
    pats = []
    for i, s in enumerate(SAMPLES if isinstance(SAMPLES, list) else SAMPLES.get("patients", [])):
        inp = s.get("input", s)
        out = predict(dict(inp))
        assert not out.get("error"), out
        if not out["red_flag"]:
            names = [x["exam"] for x in out["items"]] + [x["exam"] for x in out["extras"]]
            pats.append({"id": i, "label": s.get("name", str(i)), "names": names})
    m = morning(pats)
    assert m["same_time"]["patients"] and m["staggered"]["avg_wait"] < m["same_time"]["avg_wait"]


if __name__ == "__main__":
    ok = 0
    for ex in EXAMPLES:
        e = check(ex)
        print("OK " if not e else "ERR", ex["name"], "" if not e else e)
        ok += not e
    print(f"{ok}/{len(EXAMPLES)}")


def test_consent_and_route_prep():
    out = predict({"sex": "F", "birth_year": 1984, "checkup_year": 2026, "urgent": "none", "pregnant": "no"})
    titles = [c["title"] for c in out["consents"]]
    assert titles[0].startswith("Согласие на обследование")
    assert any("наркоз" in t for t in titles)
    rooms = {s["room"]: s for s in out["route"]["steps"]}
    assert [p["title"] for p in rooms["112"]["prep"]] == ["Гастроскопия — без еды 8 часов, без воды 2 часа"]
    assert [p["title"] for p in rooms["113"]["prep"]] == ["Колоноскопия — очищение кишечника"]


def test_scenario_days_fit_close():
    from fastapi.testclient import TestClient
    import app
    r = TestClient(app.app).post("/api/scenario", json={}).json()
    assert len(r["patients"]) == 25
    assert all(d["day_end"] <= "18:00" for d in r["days"])
    assert sum(1 for p in r["patients"] if p["red_flag"]) == 1


def test_scenarios_ml_fixes():
    # приказ № 75: «отказавшиеся от курения менее 15 лет назад» — ровно 15 лет не входит
    base = {"sex": "M", "birth_year": 1974, "checkup_year": 2026, "urgent": "none", "hazardous_work_10y": False}
    lung = lambda sm: [f["rule_id"] for f in predict(dict(base, smoking=sm))["free"]].count("scr_lung")
    assert lung({"pack_years": 20, "quit_years_ago": 14}) == 1
    assert lung({"pack_years": 20, "quit_years_ago": 15}) == 0
    # срок отказа неизвестен — «уточнить у врача», а не «положено»
    out = predict(dict(base, smoking={"pack_years": 25}))
    assert "scr_lung" in [c["rule_id"] for c in out["clarify"]]
    # гепатиты: «18 лет и старше» — полные годы на дату расчёта
    teen = {"sex": "M", "birth_date": "2008-10-01", "checkup_year": 2026, "urgent": "none"}
    assert "scr_hepatitis" not in [f["rule_id"] for f in predict(dict(teen, visit_date="2026-09-30"))["free"]]
    assert "scr_hepatitis" in [f["rule_id"] for f in predict(dict(teen, visit_date="2026-10-01"))["free"]]
    # пакет по полным годам на дату расчёта
    assert predict({"sex": "M", "birth_date": "1986-10-01", "checkup_year": 2026, "urgent": "none", "visit_date": "2026-10-01"})["package"]["id"] == "prime_extended"


def test_scenarios_ml_report():
    import subprocess
    r = subprocess.run([sys.executable, str(ROOT / "tools" / "run_ml_scenarios.py")], capture_output=True, text=True, encoding="utf-8")
    assert "block=3/3" in r.stdout and "states=46 ok=46 screening=287/287" in r.stdout, r.stdout + r.stderr
