# Договорённость: анкета → программа чекапа (проект, заморозить при всех)

Заменяет поля-заглушки в `contract/predict_contract.py` и `app/config/fields.py` (правит Наталья).
Функция та же: `predict(input) -> output`, никогда не падает, ошибки — в поле `error`.

## Вход (анкета)
| Поле | Тип | Значения | Обязательное |
|---|---|---|---|
| `sex` | select | `M` / `F` | да |
| `birth_year` | number | 1920–2025 | да |
| `checkup_year` | number | по умолчанию текущий (2026) | нет |
| `registered` | multiselect | `hypertension` АГ · `ihd` ИБС · `diabetes` СД · `glaucoma` глаукома · `cerebrovascular` · `breast_cancer` · `cervical_cancer` · `colorectal` — «состою на учёте (динамическое наблюдение)» | нет |
| `complaints` | multiselect | `fatigue` усталость · `chest_pain` боль в груди | нет |
| `family_history` | multiselect | `colorectal_cancer` рак кишечника у родственника | нет |
| `risk_group` | multiselect | группы риска по гепатитам (см. `rules.json`, `scr_hepatitis`) | нет |
| `for_child` | bool | для ребёнка — детский пакет | нет |
| `urgent` | select | `chest_pain` · `dyspnea` · `stroke_signs` · `none` → любой кроме `none` = красный флаг, пакет не предлагать | да |
| `pregnant` | select | `yes` · `no` · `unsure` (Ж 18–55) → без КТ/маммографии/рентгена, «обсудите с врачом» | нет |
| `attached_to` | select | `green_clinic` · `other` · `unknown` → где делать бесплатную часть | нет |
| `last_screening` | dict | `{"scr_breast": 2025, ...}` — год последнего скрининга; если не прошёл период — не предлагать | нет |

## Выход
```json
{
  "age_year": 42,
  "package": {"id": "prime_extended", "name": "Check-up расширенный после 40 лет", "payment": "paid_prime", "price": null},
  "items": [
    {"exam": "Маммография (4 снимка)", "payment": "free_gobmp", "why": "Скрининг рака молочной железы: женщины 40–76 лет, чётный год", "source": "Приказ МЗ РК ҚР ДСМ-174/2020, прил. 1 п.3", "where": "поликлиника прикрепления, в пределах 60 дней", "rule_id": "scr_breast"},
    {"exam": "КТ грудной клетки", "payment": "paid_prime", "why": "Входит в пакет PRIME «расширенный после 40»", "source": "primegc.kz/check-up", "where": "PRIME, в день визита", "rule_id": "prime_extended"}
  ],
  "summary": {"free_count": 3, "paid_count": 11},
  "not_eligible": [{"rule_id": "scr_cvd", "why": "Состоите на учёте по АГ — обследование у вашего врача по наблюдению"}],
  "red_flags": [],
  "route": ["08:00 Анализы натощак", "..."],
  "next_visit": [{"rule_id": "scr_breast", "year": 2028}],
  "needs_doctor_review": true,
  "reasons": [{"factor": "...", "detail": "...", "weight": 1.0}],
  "model_version": "rules-0.1",
  "error": null
}
```
`payment`: `free_gobmp` | `free_osms` | `paid_prime`. Если обследование есть и в госскрининге, и в пакете PRIME
(`prime_overlap`), показываем ОБЕ опции: «бесплатно — в поликлинике до 60 дней» / «в PRIME — сегодня, в составе пакета».
`reasons` заполнять из `items` (совместимость с каркасом). `needs_doctor_review` = true всегда (решение за врачом).

## Правила экрана (голос)
- Никогда не «вам поставлен диагноз», только «рекомендуем обследование, потому что…».
- Бесплатное не прятать и не заменять платным. Красный флаг (боль в груди) — поверх всего, чекап не предлагать.
- Правила с `needs_doctor_validation` показывать с пометкой «рекомендация клиники, уточните у врача».
