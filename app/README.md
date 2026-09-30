# Green Clinic questionnaire draft

Run from the repository root using `run-windows.sh` (Git Bash on Windows),
then open http://localhost:8000. The existing launcher installs the repository's
dependencies, so its installation step may need internet access.
The form itself uses only local assets and the local `/fields` endpoint.

This draft ends with an editable answer review, as requested. It does not call
`/predict`, persist answers, or produce medical recommendations. Refreshing the
page clears the answers. The existing prediction endpoint is unchanged; its
placeholder contract must be updated before integrating checkup results.

## Extending the form

Edit `app/config/fields.py`. Each field has a contract key, Russian label, type,
and zero-based step (0–3). Supported types: `number`, `select`, `boolean`, and
`multiselect`. Options are `[contract_value, display_label]` pairs. Use `required`,
`min`, `max`, `hint`, `default`, and `show_if` for validation and presentation.
Dot-separated keys serialize to nested objects, such as `last_screening.scr_breast`.
`collectInput()` in `app/static/app.js` builds the future integration payload.
Only values defined in `spec/CONTRACT.md` are included; broader questionnaire
suggestions without contract values are not added.

Urgent symptoms stop progression immediately. The triggering answer remains
editable. Conditional pregnancy and screening answers are removed when they
no longer apply. Optional questions can remain blank; skipping the last step
clears that step's answers.

## Assets and checks

- Colors and typography follow the supplied palette and https://greenclinic.kz/ru/.
- Local logo: https://greenclinic.kz/wp-content/uploads/2024/01/logo-footer.svg.
- Geologica: https://github.com/google/fonts/tree/main/ofl/geologica;
  license included in `static/fonts/OFL.txt`.
- `preview-desktop.png` and `preview-mobile.png` show the initial screen.
- Verified with the existing installed Playwright/Chromium: required fields,
  numeric bounds, urgent symptoms, pregnancy visibility, conditional cleanup,
  nested serialization, editing, skip/reset, child flow, mobile overflow,
  schema-load failure/retry, no prediction requests, and no JavaScript errors.
- `node --check app/static/app.js`, `python contract/predict_contract.py`, and
  `git diff --check` passed.
