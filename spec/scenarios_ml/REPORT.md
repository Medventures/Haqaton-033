# Сценарии Scenarios.docx (ветка ml) через наш движок

Состояний с ожиданиями подбора: **46**. Полностью совпали: **46**.
Госскрининги: совпало **287 из 287** статусов. Остановка «беспокоит сейчас»: **3 из 3**.

Расхождений по скринингам нет.

| Состояние | Профиль | Их статус | Расхождения |
|---|---|---|---|
| S01-A | Профиль F0 + H0; DOB 1991-05-12, F, for_child=false. as_of_date=2026-09-30, checkup_year=2 | ready | — |
| S02-A | Профиль M0 + H0; DOB 1984-05-12, M, for_child=false. as_of_date=2026-09-30, checkup_year=2 | ready | — |
| S03-A | Профиль C0 + H0; DOB 2016-05-12, M, for_child=true. as_of_date=2026-09-30, checkup_year=20 | ready | — |
| S04-A | Профиль DOB 2008-10-01, M; checkup_year=2026 и visit_date=2026-10-01 во всех состояниях. А | ready | — |
| S04-B | Профиль DOB 2008-10-01, M; checkup_year=2026 и visit_date=2026-10-01 во всех состояниях. А | ready | — |
| S04-C | Профиль DOB 2008-10-01, M; checkup_year=2026 и visit_date=2026-10-01 во всех состояниях. А | needs_input | — |
| S05-A | Профиль M0 + H0; DOB 1986-10-01, M, for_child=false. checkup_year=2026, visit_date=2026-10 | ready | — |
| S05-B | Профиль M0 + H0; DOB 1986-10-01, M, for_child=false. checkup_year=2026, visit_date=2026-10 | ready | — |
| S06-A | Профиль F0 + H0; DOB 1986-12-01, F, for_child=false, pregnant=no явно. as_of_date=2026-09- | ready | — |
| S07-A | Профиль M, DOB 1991-05-12, for_child=false; age_full=35, age_year=35. as_of_date=2026-09-3 | review | — |
| S07-B | Профиль M, DOB 1991-05-12, for_child=false; age_full=35, age_year=35. as_of_date=2026-09-3 | review | — |
| S07-C | Профиль M, DOB 1991-05-12, for_child=false; age_full=35, age_year=35. as_of_date=2026-09-3 | review | — |
| S08-A | Профиль M0 + H0; DOB 1991-05-12, M, for_child=false. as_of_date=2026-09-30, checkup_year=2 | needs_input | — |
| S08-B | Профиль M0 + H0; DOB 1991-05-12, M, for_child=false. as_of_date=2026-09-30, checkup_year=2 | ready | — |
| S09-A | Профиль F0 + H0; F, DOB 1982-05-12; for_child=false; as_of_date=2026-09-30, checkup_year=2 | review | — |
| S09-B | Профиль F0 + H0; F, DOB 1982-05-12; for_child=false; as_of_date=2026-09-30, checkup_year=2 | review | — |
| S10-A | Профиль F0 + H0; F, DOB 1991-05-12; for_child=false; age_full=35, age_year=35. Даты: as_of | review | — |
| S10-B | Профиль F0 + H0; F, DOB 1991-05-12; for_child=false; age_full=35, age_year=35. Даты: as_of | review | — |
| S11-A | Профиль F0 + H0; F, DOB 1984-05-12; for_child=false; age_full=42, age_year=42; as_of_date= | review | — |
| S11-B | Профиль F0 + H0; F, DOB 1984-05-12; for_child=false; age_full=42, age_year=42; as_of_date= | review | — |
| S11-C | Профиль F0 + H0; F, DOB 1984-05-12; for_child=false; age_full=42, age_year=42; as_of_date= | review | — |
| S12-A | Профиль M0 + H0; M, DOB 1974-05-12; for_child=false; age_full=52, age_year=52; as_of_date= | ready | — |
| S12-B | Профиль M0 + H0; M, DOB 1974-05-12; for_child=false; age_full=52, age_year=52; as_of_date= | ready | — |
| S12-C | Профиль M0 + H0; M, DOB 1974-05-12; for_child=false; age_full=52, age_year=52; as_of_date= | ready | — |
| S13-A | Профиль M0 + H0; M, DOB 1974-05-12, for_child=false; age_full=52, age_year=52; as_of_date= | ready | — |
| S13-B | Профиль M0 + H0; M, DOB 1974-05-12, for_child=false; age_full=52, age_year=52; as_of_date= | ready | — |
| S13-C | Профиль M0 + H0; M, DOB 1974-05-12, for_child=false; age_full=52, age_year=52; as_of_date= | ready | — |
| S14-A | Профиль F0 + H0, кроме истории scr_breast; F, DOB 1984-05-12, for_child=false; age_full=42 | review | — |
| S15-A | Профиль F0 + H0, кроме scr_breast; F, DOB 1984-05-12, for_child=false; age_full=42, age_ye | review | — |
| S16-A | Профиль F0; F, DOB 1984-05-12, for_child=false; age_full=42, age_year=42; as_of_date=2026- | review | — |
| S16-B | Профиль F0; F, DOB 1984-05-12, for_child=false; age_full=42, age_year=42; as_of_date=2026- | review | — |
| S16-C | Профиль F0; F, DOB 1984-05-12, for_child=false; age_full=42, age_year=42; as_of_date=2026- | review | — |
| S17-A | Профиль M0 + H0; M, DOB 1974-05-12; for_child=false; age_full=52, age_year=52; as_of_date= | ready | — |
| S18-A | Профиль M0 + H0; M, DOB=1991-05-12, for_child=false; as_of_date=2026-09-30, checkup_year=2 | ready | — |
| S19-A | Профиль M0 + H0; M, DOB=1991-05-12, for_child=false; as_of_date=2026-09-30, checkup_year=2 | review | — |
| S20-A | Профиль C0 + H0; M, DOB=2016-05-12, for_child=true; as_of_date=2026-09-30, checkup_year=20 | ready | — |
| S20-B | Профиль C0 + H0; M, DOB=2016-05-12, for_child=true; as_of_date=2026-09-30, checkup_year=20 | ready | — |
| S21-A | Профиль M0 + H0; M, DOB=1991-05-12, for_child=false; as_of_date=2026-09-30, checkup_year=2 | ready | — |
| S22-A | Профиль M0 + H0; M, DOB=1991-05-12, for_child=false; as_of_date=2026-09-30, checkup_year=2 | ready | — |
| S22-B | Профиль M0 + H0; M, DOB=1991-05-12, for_child=false; as_of_date=2026-09-30, checkup_year=2 | ready | — |
| S23-A | Профиль M0 + H0; M, DOB=1991-05-12, for_child=false; as_of_date=2026-09-30, checkup_year=2 | ready | — |
| S23-B | Профиль M0 + H0; M, DOB=1991-05-12, for_child=false; as_of_date=2026-09-30, checkup_year=2 | ready | — |
| S23-C | Профиль M0 + H0; M, DOB=1991-05-12, for_child=false; as_of_date=2026-09-30, checkup_year=2 | ready | — |
| S23-D | Профиль M0 + H0; M, DOB=1991-05-12, for_child=false; as_of_date=2026-09-30, checkup_year=2 | ready | — |
| S24-A | Профиль M0 + H0; M, DOB=1991-05-12, for_child=false; as_of_date=2026-09-30, checkup_year=2 | ready | — |
| S24-B | Профиль M0 + H0; M, DOB=1991-05-12, for_child=false; as_of_date=2026-09-30, checkup_year=2 | ready | — |

## Что исправлено в нашем движке по итогам прогона (30.09.2026)
- Скрининг рака лёгкого: «отказавшиеся от курения **менее** 15 лет назад» (приказ № 75) — было «не больше 15».
- Скрининг гепатитов: «18 лет и старше» без «по году достижения» — считаем полные годы, было — по году рождения.
- Возраст — на дату расчёта (`visit_date`), а не всегда на сегодня.
- Неполный ответ ≠ «нет»: «возможна беременность», стаж курения без срока отказа, нет ответа о курении — «уточнить у врача».

## Решения по пяти спорным случаям (слово Виталия, 30.09.2026)
Принцип: всё ясно и явно — действуем по нормативу; есть неясность — «уточнить у врача».
- 17 полных лет, 18 — в этом году: гепатиты — «уточнить».
- Нет ответа о беременности (вопрос обязательный): «уточнить».
- Учёт по широкой группе (молочная железа, ВПЧ, кишечник, лёгкие) без подтверждения врачом: «к врачу»; подтверждён — не положено.
- Бросил курить ровно 15 лет назад: «к врачу».
- Год прошлого обследования точный — по нормативу (маммография 2025 → следующая 2027); «за последние 2 года» — «уточнить».

После этих решений: 46 из 46 состояний, 287 из 287 статусов скринингов, остановка 3 из 3.