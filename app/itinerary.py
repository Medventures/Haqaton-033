"""Illustrative logistics only: times and locations are not clinic bookings."""
import re


def build_itinerary(package):
    if not package:
        return []
    groups = [
        ("Анализы", "Лаборатория · кабинет 101", 45, ("анализ", "кров", "липид", "глюкоз", "гормон", "витамин", "пробы", "гемоглобин", "пса", "ферритин", "онкомаркер", "гепатит")),
        ("УЗИ и функциональная диагностика", "Отделение диагностики · кабинет 202", 90, ("узи", "уздг", "эхокг", "экг")),
        ("Лучевая диагностика", "Отделение диагностики · кабинет 203", 45, ("кт", "маммограф", "рентген")),
        ("Консультации специалистов", "Консультативное отделение · кабинет 301", 90, ("консультац", "осмотр", "заключение")),
        ("Дополнительные обследования", "Кабинет уточнит координатор", 30, ()),
        ("Эндоскопия", "Отделение эндоскопии · кабинет 204", 90, ("гастроскоп", "колоноскоп")),
    ]
    buckets = [[] for _ in groups]
    for exam in package["exams"]:
        text = exam.casefold()
        # Endoscopy takes precedence for combined procedure descriptions.
        index = next((i for i in [5, 0, 1, 2, 3]
                      if any(bool(re.search(r"\bкт\b", text)) if word == "кт" else word in text
                             for word in groups[i][3])), 4)
        buckets[index].append(exam)
    route = [{"time": "08:00", "title": "Встреча с координатором", "location": "Ресепшен · 1 этаж",
              "exams": [], "note": "Уточнение программы и порядка посещения кабинетов."}]
    minutes = 8 * 60 + 15
    for (title, location, duration, _), exams in zip(groups, buckets):
        if not exams:
            continue
        route.append({"time": f"{minutes // 60:02}:{minutes % 60:02}", "title": title,
                      "location": location, "exams": exams, "note": ""})
        minutes += duration
    route.append({"time": f"{minutes // 60:02}:{minutes % 60:02}", "title": "Завершение визита",
                  "location": "Ресепшен · 1 этаж", "exams": [],
                  "note": "Уточните сроки готовности результатов и время итогового обсуждения с врачом."})
    return route
