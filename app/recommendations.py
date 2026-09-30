"""Local checkup selection from spec/rules.json; independent of the ML contract."""
import json
import math
from datetime import date
from pathlib import Path

from app.config.fields import FIELDS
from app.itinerary import build_itinerary

RULES = json.loads((Path(__file__).resolve().parents[1] / "spec" / "rules.json").read_text(encoding="utf-8"))


class InvalidAnswers(ValueError):
    pass


def matches(when, answers, age):
    for key, expected in when.items():
        value = answers.get(key)
        if key == "age_min":
            matched = age >= expected
        elif key == "age_max":
            matched = age <= expected
        elif key == "age_year":
            matched = age in expected
        elif key == "not_registered":
            matched = not set(expected).intersection(answers.get("registered", []))
        elif key == "not_pregnant":
            matched = answers.get("pregnant") not in ("yes", "unsure")
        elif key == "any_of":
            matched = any(matches(option, answers, age) for option in expected)
        elif key in ("pack_years_min", "quit_years_max"):
            smoking = answers.get("smoking", {})
            value = smoking.get("pack_years" if key == "pack_years_min" else "quit_years_ago")
            matched = value is not None and (value >= expected if key == "pack_years_min" else value <= expected)
        elif isinstance(value, list):
            matched = expected in value
        elif isinstance(expected, list):
            matched = value in expected
        else:
            matched = value == expected
        if not matched:
            return False
    return True


def validate_answers(payload):
    """Validate the same schema as the form, then discard hidden answers."""
    if not isinstance(payload, dict):
        raise InvalidAnswers("Передайте ответы анкеты в виде объекта.")
    answers = {}
    for field in FIELDS:
        path = field["name"].split(".")
        value = payload
        for key in path:
            if not isinstance(value, dict):
                raise InvalidAnswers("Неверный формат ответов анкеты.")
            value = value.get(key)
            if value is None:
                break
        if value is None or value == "":
            if field.get("required"):
                raise InvalidAnswers(f'Заполните поле «{field["label"]}».')
            continue
        kind = field["type"]
        valid = True
        if kind == "number":
            valid = type(value) is int or (type(value) is float and math.isfinite(value))
            if valid and field.get("increment") != "any":
                valid = value == int(value)
            if valid:
                valid = value >= field.get("min", -math.inf)
                maximum = field.get("max")
                if isinstance(maximum, int):
                    valid = valid and value <= maximum
        elif kind == "date":
            try:
                valid = isinstance(value, str) and date.fromisoformat(value).isoformat() == value
            except (ValueError, TypeError):
                valid = False
        elif kind == "text":
            valid = isinstance(value, str) and len(value) <= 4000
        else:
            options = [option for option, _ in field["options"]]
            if kind == "multiselect":
                valid = isinstance(value, list) and all(isinstance(item, str) and item in options for item in value)
            elif kind == "boolean":
                valid = type(value) is bool
            else:
                valid = isinstance(value, str) and value in options
        if not valid:
            raise InvalidAnswers(f'Проверьте поле «{field["label"]}».')
        target = answers
        for key in path[:-1]:
            target = target.setdefault(key, {})
        target[path[-1]] = value

    answers.setdefault("checkup_year", date.today().year)
    answers["checkup_year"] = int(answers["checkup_year"])
    birth = date.fromisoformat(answers["birth_date"])
    birth_field = next(field for field in FIELDS if field["name"] == "birth_date")
    if not date.fromisoformat(birth_field["min"]) <= birth <= min(date.today(), date.fromisoformat(birth_field["max"])):
        raise InvalidAnswers("Проверьте дату рождения.")
    answers["birth_year"] = birth.year
    age = answers["checkup_year"] - birth.year
    if not 0 <= age <= 120:
        raise InvalidAnswers("Возраст в году обследования должен быть от 0 до 120 лет.")
    for field in FIELDS:
        path = field["name"].split(".")
        target = answers
        for key in path[:-1]:
            target = target.get(key, {})
        if not matches(field.get("show_if", {}), answers, age):
            target.pop(path[-1], None)
    for last in answers.get("last_screening", {}).values():
        if not birth.year <= last <= answers["checkup_year"]:
            raise InvalidAnswers("Год прошлого обследования должен быть между годом рождения и годом чекапа.")
    if answers.get("last_period") and not birth <= date.fromisoformat(answers["last_period"]) <= date.today():
        raise InvalidAnswers("Проверьте дату последних месячных.")
    return answers


def recommend(payload):
    answers = validate_answers(payload)
    age = answers["checkup_year"] - answers["birth_year"]
    result = dict(age_year=age, package=None, items=[], screenings=[], additions=[],
                  not_eligible=[], red_flags=[], warnings=[], preparation=[], next_visit=[],
                  summary={"free_count": 0, "paid_count": 0}, needs_doctor_review=True,
                  model_version="app-rules-1", error=None, itinerary=[])
    if answers["urgent"] != "none":
        result["red_flags"] = ["При этих симптомах чекап не подходит. Звоните 103 или обратитесь к врачу сегодня."]
        return result

    # rules.json defines age by the year reached during the checkup year.
    package = next((p for p in RULES["packages"] if matches(p["when"], answers, age)), None)
    pregnant = answers.get("pregnant") in ("yes", "unsure")

    def allowed(exam):
        return not pregnant or not any(word in exam.casefold() for word in ("кт", "маммограф", "рентген"))

    if pregnant:
        result["warnings"].append("Беременность возможна: КТ, маммография и рентген исключены. Состав программы обсудите с врачом.")
    if package:
        suffix = answers["sex"].lower()
        exams = package["exams"] + package.get("female_exams" if suffix == "f" else "male_exams", [])
        result["package"] = {
            "id": package["id"], "name": package.get(f"name_{suffix}", package.get("name_mini", package["name"])),
            "payment": package["payment"], "price": package["price"], "source": package["source"],
            "exams": [exam for exam in exams if allowed(exam)],
        }
        for exam in result["package"]["exams"]:
            result["items"].append(dict(exam=exam, payment=package["payment"], rule_id=package["id"],
                                        why="Входит в пакет PRIME", source=package["source"], highlights=[]))
    else:
        result["warnings"].append("Для этого возраста в текущих правилах нет пакета. Обсудите программу с врачом.")

    for rule in RULES["screening"]:
        when = rule["when"]
        demographic = {key: value for key, value in when.items() if key in ("sex", "age_year", "age_min", "age_max")}
        if not matches(demographic, answers, age):
            continue
        reason = None
        if set(when.get("not_registered", [])).intersection(answers.get("registered", [])):
            reason = RULES["registered_exclusion_note"]
        elif pregnant and (when.get("not_pregnant") or any(not allowed(exam) for exam in rule["stage1"])):
            reason = "При возможной беременности обследование нужно обсудить с врачом."
        elif not matches(when, answers, age):
            reason = "Указанных факторов риска недостаточно для этого скрининга."
        last = answers.get("last_screening", {}).get(rule["id"])
        if not reason and last is not None and answers["checkup_year"] - last < rule["repeat_years"]:
            reason = "После прошлого обследования ещё не прошёл установленный интервал."
            result["next_visit"].append({"rule_id": rule["id"], "year": int(last + rule["repeat_years"])})
        if reason:
            result["not_eligible"].append({"rule_id": rule["id"], "name": rule["name"], "why": reason})
            continue
        where = "Green Clinic, по прикреплению" if answers.get("attached_to") == "green_clinic" else "Поликлиника прикрепления"
        screening = {**rule, "where": f'{where}, в пределах {rule["deadline_days"]} дней'}
        result["screenings"].append(screening)
        for exam in rule["stage1"]:
            result["items"].append(dict(exam=exam, payment=rule["payment"], rule_id=rule["id"],
                                        why=rule["name"], source=rule["source"], where=screening["where"]))

    catalog = {item["id"]: item for item in RULES["prime_catalog"]}
    additions = {}
    package_text = " ".join(result["package"]["exams"]).casefold() if package else ""
    for rule in RULES["anamnesis_rules"]:
        if not matches(rule["when"], answers, age):
            continue
        for item in result["items"]:
            if item["payment"] == "paid_prime" and any(word.casefold() in item["exam"].casefold() for word in rule.get("emphasize", [])):
                item["highlights"].append(rule["why"])
                item["needs_doctor_validation"] = rule.get("needs_doctor_validation", False)
        if rule.get("skip_if_in_package", "\0").casefold() in package_text:
            continue
        for key in rule.get("add", []):
            addition = additions.setdefault(key, {**catalog[key], "why": [], "source": rule["source"],
                                                 "needs_doctor_validation": rule.get("needs_doctor_validation", False)})
            if rule["why"] not in addition["why"]:
                addition["why"].append(rule["why"])
    result["additions"] = list(additions.values())
    for addition in result["additions"]:
        result["items"].append(dict(exam=addition["name"], payment="paid_prime", rule_id=addition["id"],
                                    why="; ".join(addition["why"]), source=addition["source"], needs_doctor_validation=True))
    exam_text = " ".join(item["exam"] for item in result["items"]).casefold()
    result["preparation"] = [rule for rule in RULES["prep_catalog"]
                             if matches(rule.get("when_answer", {}), answers, age)
                             and any(word.casefold() in exam_text for word in rule["match"])]
    result["summary"] = {
        "free_count": sum(item["payment"].startswith("free_") for item in result["items"]),
        "paid_count": sum(item["payment"] == "paid_prime" for item in result["items"]),
    }
    result["itinerary"] = build_itinerary(result["package"])
    return result
