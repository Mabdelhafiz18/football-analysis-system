"""
build_training_dataset.py — Convert raw StatsBomb shots into a training CSV.

Reads data/raw/shots.jsonl (from download_statsbomb.py), computes the trained
model features (features.py), attaches the is_goal label and a few metadata
columns for debugging, and writes one row per shot.

Usage:
    python src/build_training_dataset.py --raw data/raw --out data/processed/xg_training.csv
"""

from __future__ import annotations
import argparse
import csv
import json
import os
import sys

import features as F

META_COLS = ["match_id", "competition_name", "season_name", "minute", "second",
             "outcome", "statsbomb_xg"]


def main():
    ap = argparse.ArgumentParser(description="Build xG training CSV from raw StatsBomb shots.")
    ap.add_argument("--raw", required=True, help="Dir containing shots.jsonl")
    ap.add_argument("--out", required=True, help="Output CSV path")
    ap.add_argument("--drop-penalties", action="store_true",
                    help="Exclude penalties (they dominate high-xG and are trivial).")
    args = ap.parse_args()

    shots_path = os.path.join(args.raw, "shots.jsonl")
    if not os.path.exists(shots_path):
        print(f"[BUILD][ERROR] Not found: {shots_path}. Run download_statsbomb.py first.",
              file=sys.stderr)
        return 1

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)

    cols = F.TRAINED_MODEL_FEATURES + ["is_goal"] + META_COLS
    n_rows = n_goals = n_skipped = 0

    with open(shots_path, encoding="utf-8") as fin, \
         open(args.out, "w", newline="", encoding="utf-8") as fout:
        writer = csv.DictWriter(fout, fieldnames=cols)
        writer.writeheader()

        for line in fin:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                n_skipped += 1
                continue
            ev = rec.get("event", {})
            feats = F.trained_features_from_statsbomb(ev)
            if feats is None:
                n_skipped += 1
                continue

            stype = feats["shot_type"]
            if args.drop_penalties and stype == "penalty":
                n_skipped += 1
                continue

            label = F.label_from_statsbomb(ev)
            shot = ev.get("shot", {}) or {}
            row = dict(feats)
            row["is_goal"] = label
            row["match_id"] = rec.get("match_id")
            row["competition_name"] = rec.get("competition_name", "")
            row["season_name"] = rec.get("season_name", "")
            row["minute"] = ev.get("minute")
            row["second"] = ev.get("second")
            row["outcome"] = (shot.get("outcome") or {}).get("name", "")
            row["statsbomb_xg"] = shot.get("statsbomb_xg")   # kept for comparison only, NOT a feature

            writer.writerow(row)
            n_rows += 1
            n_goals += label

    if n_rows == 0:
        print("[BUILD][ERROR] No usable shots produced.", file=sys.stderr)
        return 1

    print(f"[BUILD] DONE — {n_rows} shots ({n_goals} goals, "
          f"{100*n_goals/n_rows:.1f}% conversion), {n_skipped} skipped → {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
