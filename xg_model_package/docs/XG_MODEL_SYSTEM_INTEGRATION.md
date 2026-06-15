# xG Model — System Integration

## 1. Overview

This document describes the Expected Goals (xG) module added to the Football AI
system. xG estimates the probability that a given shot becomes a goal, based on a
model trained on real shot outcomes from public data, then applied to shots
detected in our Vision pipeline output.

## 2. Why xG was added

The system already detects offside situations. xG adds **chance-quality analysis**:
how dangerous each shot was, which team created better chances, and why — turning
raw tracking into coaching/broadcast insight without any manual labeling.

## 3. Existing system architecture

```
Football Video → Vision Core → NDJSON + Redis (vc:{job_id})
   → Offside Model → events:{job_id}:offside
   → Visualizer + Backend + Frontend
```

The Vision Core, offside model, and offside visualizer are unchanged.

## 4. New xG architecture

```
Vision NDJSON / Redis vc:{job_id}
   → xG Inference Module (shot detection + feature extraction + model)
   → outputs/xg_events.json + Redis events:{job_id}:xg
   → xG Visualizer + Backend API + Frontend Dashboard
```

## 5. Connection to Vision Core

xG consumes the same per-frame NDJSON the offside model uses. Required fields:
`frame_id`, `timestamp_sec`, `homography_age_frames`, `ball_gap_frames`, and
`objects` with `class_id` (0 ball, 1 GK, 2 player, 3 ref), `team_id`,
`pitch_xy_m`, `is_on_pitch`, `id`. No new Vision fields are required.

## 6. Connection to Redis

xG publishes to `events:{job_id}:xg`. Each stream entry has a single `data` field
containing the JSON event (same convention as `events:{job_id}:offside`).

## 7. Connection to Backend

Recommended endpoints:

```
GET /api/jobs/:jobId/xg/events
GET /api/jobs/:jobId/xg/summary
GET /api/jobs/:jobId/xg/shot/:shotId
GET /api/jobs/:jobId/xg/video
```

The backend reads `outputs/xg_events.json` (or the Redis stream) and serves it.
`summary` aggregates total shots, total xG, per-team xG, and the best chance.

## 8. Connection to Frontend Dashboard

Dashboard surfaces: total shots, total xG, team xG, best chance, xG timeline,
shot map, and a shot table (Time, Team, Shooter, xG, Quality, Distance, Angle,
Nearest Defender, Goal Visibility, Replay). Each shot expands to its explanation
(summary, top positive/negative factors) and freeze-frame visualization.

## 9. Training data source

StatsBomb Open Data (public). Shot events are pulled from the official GitHub
mirror; optionally StatsBomb 360 freeze-frame data where available.

## 10. Training pipeline

`download_statsbomb.py` → `build_training_dataset.py` → `train_xgboost.py`.
The label is the **actual outcome** `is_goal` (1 if Goal). The model is **not**
trained to copy any provider's xG value.

## 11–13. Feature engineering and the two feature groups

All features live in `features.py`.

**Trained model features** (in both StatsBomb and Vision): `distance_to_goal`,
`angle_to_goal`, `shot_x`, `shot_y`, `body_part`, `shot_type`, `play_pattern`,
and flags `is_penalty`, `is_free_kick`, `is_header`, `is_foot`, `is_first_time`,
`under_pressure`.

**Vision diagnostic features** (tracking-only, NOT model inputs): goalkeeper
distance and lateral offset, nearest defender distance, defenders within
2/5/10m, defenders in the shot cone, nearest defender in cone, goal visible
ratio, attackers/defenders in box, local density, ball speed before shot.

The schema (`models/xg_feature_schema.json`) records both groups explicitly so
diagnostic features are never silently fed to the trained model.

## 14. Model evaluation (actual run, FIFA World Cup 2022 subset)

Trained on 1494 shots (195 goals, 13.1% conversion):

- ROC-AUC: **0.773**
- Brier score: **0.092** (well calibrated after isotonic calibration)
- Log-loss: 0.533
- Top features: body part (header), penalty, angle to goal — all football-sensible.

Probabilities are isotonic-calibrated so predicted xG matches observed conversion
rates (verified via the calibration curve in `xg_training_report.json`). More
data (more competitions, `--max-matches` higher) raises AUC further.

## 15. Model output schema

See section 10 of the build spec / example in `outputs/xg_events.json`. Each event
carries `xg`, `quality`, `trained_features`, `vision_diagnostic_features`,
`explanation` (summary + signed SHAP factors + diagnostic factors), and `debug`.

## 16. Redis stream schema

`events:{job_id}:xg`, field `data` = JSON string of one xG event.

## 17. API endpoints

As in section 7.

## 18. Dashboard UI

As in section 8.

## 19. Visualizer overlay

`xg_visualizer.py` overlays, per shot window: info panel (xG, quality, summary,
top + / − factor), shot marker, shooter ID, and ball/cone context. Falls back to
a text report if the video is absent.

## 20. CLI commands

See `README.md`.

## 21. Folder structure

```
xg_model_package/
  data/{raw,processed}/   models/   src/   outputs/   docs/
  README.md   requirements.txt
```

## 22. Known limitations

- StatsBomb event features differ from Vision freeze-frame features; pressure/GK
  features remain diagnostic unless the model is retrained with matching inputs.
- Vision shot detection is heuristic without labeled shot frames.
- `body_part`/`shot_type` are usually unknown from Vision → predictions lean on
  open-play priors.
- Homography quality affects pitch coordinates; player-ID instability affects
  shooter/defender assignment; GK detection quality affects GK features.

## 23. Future work

Labeled shots from our own pipeline; manual shot-annotation tool; supervised shot
detector; Vision-enhanced xG trained with freeze-frame labels; geometric occlusion
for goal visibility; xA and post-shot xG; player/team xG reports; live xG streaming.

## 24. Troubleshooting

- **No shots detected**: lower `--min-ball-speed` or `--min-shot-depth-m`; check
  the NDJSON actually contains ball detections (`class_id` 0).
- **Too many shots**: raise `--min-ball-speed`, `--min-shot-depth-m`, or
  `--dedup-window-frames`.
- **Redis publish fails**: ensure the server is reachable; the module degrades
  gracefully and still writes the JSON file.
- **SHAP missing**: explanations fall back to directional reasoning automatically.
- **Coordinates look wrong**: check `homography_age_frames`; high ages are skipped
  by shot detection via `--max-homography-age-frames`.
```
