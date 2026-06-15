import argparse
import json
import os
from engine import TacticalIntelligenceEngine


def main():
    parser = argparse.ArgumentParser(description="Final Tactical Intelligence Engine")
    parser.add_argument("--input", default="sample_data/vision_sample.ndjson", help="Path to Vision Core NDJSON file")
    parser.add_argument("--output", default="outputs/latest_tactical_output.json", help="Output JSON path")
    args = parser.parse_args()

    engine = TacticalIntelligenceEngine()
    outputs = engine.process_ndjson(args.input)
    latest = outputs[-1]

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(latest, f, indent=2)

    print("=" * 80)
    print("FINAL TACTICAL INTELLIGENCE ENGINE - RUN SUCCESSFUL")
    print("=" * 80)
    print(f"Job ID: {latest['job_id']}")
    print(f"Frame ID: {latest['frame_id']}")
    print(f"Timestamp: {latest['timestamp_sec']}")
    print(f"Alerts Count: {len(latest['alerts'])}")
    print(f"Reliability Score: {latest['reliability']['overall_confidence']}")
    print("\nALERTS:")
    for alert in latest["alerts"]:
        print(f"- [{alert['severity'].upper()}] {alert['type']} | team={alert['team_id']} | {alert['message']}")
    print(f"\nFull JSON saved to: {args.output}")


if __name__ == "__main__":
    main()
