# Final Tactical Intelligence Engine

Ready version aligned with the Tactical Intelligence Engine requirements document.

## What it does

Reads Vision Core tracking frames using the real schema:

- `objects`
- `class_id`
- `team_id`
- `pitch_xy_m`
- `is_on_pitch`
- `confidence`

Then outputs dashboard-ready tactical insights:

- Team Shape
- Formation
- Heatmap 21x14 + points
- Possession
- Pressure level
- Ball Progression
- Transitions / Counter Attack flag
- Tactical Alerts
- Reliability

## Run with sample NDJSON

```powershell
cd "C:\Users\Moaz Alnoby\Downloads\tactical_engine_final_requirements"
$env:PYTHONPATH="src"
python src/main.py
```

Or:

```powershell
python src/main.py --input sample_data/vision_sample.ndjson --output outputs/latest_tactical_output.json
```

## Redis stream mode

Install Redis and dependencies:

```powershell
pip install -r requirements.txt
```

Run worker:

```powershell
$env:PYTHONPATH="src"
python src/redis_worker.py
```

It reads from:

```text
vision:frames
```

And writes to:

```text
tactical:insights
```

## Output

The final JSON is saved at:

```text
outputs/latest_tactical_output.json
```

The output schema matches the dashboard-oriented format:

```json
{
  "job_id": "test_jersey_001",
  "frame_id": 10,
  "timestamp_sec": 9.0,
  "ball": {},
  "teams": {"0": {}, "1": {}},
  "possession": {},
  "ball_progression": {},
  "pressure": {},
  "transition": {},
  "alerts": [],
  "reliability": {}
}
```
