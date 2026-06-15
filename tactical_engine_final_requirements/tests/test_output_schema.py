import sys, json
sys.path.append("src")
from engine import TacticalIntelligenceEngine


def test_output_schema_from_sample():
    engine = TacticalIntelligenceEngine()
    outputs = engine.process_ndjson("sample_data/vision_sample.ndjson")
    latest = outputs[-1]
    for key in ["job_id","frame_id","timestamp_sec","ball","teams","possession","ball_progression","pressure","transition","alerts","reliability"]:
        assert key in latest
    assert "0" in latest["teams"] and "1" in latest["teams"]
