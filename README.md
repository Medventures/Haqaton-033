# MedHub app scaffold

## Run
```
./run.sh
```
Open http://localhost:8000

## Demo modes
```
DEMO_MODE=live ./run.sh      # default: calls predict() directly
DEMO_MODE=record ./run.sh    # calls predict() AND saves each answer to cache
DEMO_MODE=offline ./run.sh   # never calls predict(), replays from cache
```
Use `run-windows.sh` for Windows.

Run in `record` mode during normal testing so the offline cache fills itself
with real answers. Switch to `offline` for the demo if Wi-Fi is bad.

## Where things live
- `app/main.py` — FastAPI server, three routes: `/`, `/fields`, `/predict`.
- `app/config/fields.py` — the input form schema. **Edit this when the real
  task/data are published at T0** — the page re-renders itself from this list.
- `app/static/` — the page (`index.html`, `style.css`, `app.js`). No CDN
  dependencies, vendored on purpose so the demo survives bad Wi-Fi.
- `app/offline/cache.py` — the offline fallback described above.
- `contract/predict_contract.py` — the frozen agreement with `ml/`. Owned by
  tech lead + model developer together. Contains the stub `predict()` you're
  building against right now, plus the three example checks.
- `ml/` — model developer's folder, not yet built.

## Before every push
```
python contract/predict_contract.py   # 30-second contract check
```

## Milestones this scaffold is aimed at
- T0 + 1h15: replace placeholder fields in `contract/predict_contract.py` and
  `app/config/fields.py` with the real ones, freeze the contract.
- T0 + 2.5h: skeleton (screen → server → model stub → answer) — this repo
  already does that; confirm it still runs end to end with the real fields.
- T0 + 4h: `ml/` plugs in the real model behind the same `predict()` signature.
