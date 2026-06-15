# xG Model Package — Trained Expected-Goals for the Football AI System

A real, trained **Expected Goals (xG)** model that plugs into the existing Vision
Core → NDJSON/Redis pipeline, alongside the offside model. It trains an XGBoost
classifier on **StatsBomb Open Data** shot outcomes (goal / no-goal), then runs
inference on Vision NDJSON, detecting shots from ball kinematics and predicting xG.

The existing Vision, Offside model, and Offside visualizer are **not modified**.
xG is an independent module writing to its own Redis stream `events:{job_id}:xg`.

---

## Setup

```powershell
cd xg_model_package
pip install -r requirements.txt
```

## 1. Download training data (StatsBomb Open Data)

```powershell
python src/download_statsbomb.py --out data/raw --competitions 43 --max-matches 64
```

Add `--use-360` to also pull freeze-frame data where available. Drop
`--competitions` to pull across all competitions (use `--max-matches` to cap).

## 2. Build the training dataset

```powershell
python src/build_training_dataset.py --raw data/raw --out data/processed/xg_training.csv
```

## 3. Train the model

```powershell
python src/train_xgboost.py --csv data/processed/xg_training.csv `
  --model-out models/xg_xgboost.pkl `
  --schema-out models/xg_feature_schema.json `
  --report-out models/xg_training_report.json
```

Produces a calibrated XGBoost model, the feature schema, and a full training
report (ROC-AUC, log-loss, Brier, calibration curve, feature importance).

## 4. Run inference on Vision NDJSON

```powershell
python src/predict_from_vision_ndjson.py --ndjson croatia_test_3min_v2.ndjson `
  --model models/xg_xgboost.pkl --schema models/xg_feature_schema.json `
  --out outputs/xg_events.json --fps 25 --job-id match_001
```

With Redis publishing:

```powershell
python src/predict_from_vision_ndjson.py --ndjson croatia_test_3min_v2.ndjson `
  --model models/xg_xgboost.pkl --schema models/xg_feature_schema.json `
  --out outputs/xg_events.json --fps 25 --job-id match_001 `
  --redis redis://localhost:6379 --publish-redis
```

Outputs: `outputs/xg_events.json` and `outputs/xg_features.csv`.

## 5. Visualize on video

```powershell
python src/xg_visualizer.py --source_video_path croatia_test_3min.mp4 `
  --ndjson_path croatia_test_3min_v2.ndjson --xg_events outputs/xg_events.json `
  --output_video_path outputs/xg_visualized.mp4 --always_show_panel
```

If the video is missing, a text report is written instead (safe fallback).

---

## How xG is computed

**Trained features** (used by the model, available in both StatsBomb and Vision):
distance to goal, angle to goal, shot x/y, body part, shot type, play pattern,
penalty/free-kick/header/foot/first-time/under-pressure flags.

**Vision diagnostic features** (computed from tracking, NOT model inputs — shown
for explanation only): goalkeeper distance/offset, nearest defender, defenders in
cone, defenders within 2/5/10m, goal visible ratio, box occupancy, local density,
ball speed before shot.

This separation is enforced in `features.py` and recorded in
`models/xg_feature_schema.json`.

## Shot detection (from Vision)

Conservative heuristic on ball kinematics: sharp ball-speed jump, motion toward
the opponent goal, an attacker close before release then separation after, origin
in the final third, fresh homography, small ball gap, and de-duplication. All
thresholds are CLI-configurable. It is tuned to **miss weak shots rather than
invent false ones**.

## Integration

- Backend & frontend integration: see `docs/XG_MODEL_SYSTEM_INTEGRATION.md`.
- Redis stream: `events:{job_id}:xg`, each entry a `data` field with the event JSON.

## Limitations

- StatsBomb event features differ from Vision freeze-frame features; pressure/GK
  features stay diagnostic unless the model is retrained with matching inputs.
- Vision shot detection is heuristic without labeled shot frames.
- Homography quality and player-ID stability affect coordinates and shooter/defender
  assignment.
- `body_part`/`shot_type` are usually unknown from Vision, shifting predictions
  toward open-play priors.

## Future work

Train on labeled shots from our own Vision pipeline; add a shot-annotation tool;
supervised shot detector; Vision-enhanced xG with freeze-frame labels; geometric
occlusion for goal visibility; xA, post-shot xG; player/team xG reports; live xG
streaming to the dashboard.
