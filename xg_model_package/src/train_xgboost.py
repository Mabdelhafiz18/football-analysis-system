"""
train_xgboost.py — Train an XGBoost xG classifier on the shot CSV.

Pipeline:
  • one-hot encode categoricals, pass numerics/flags through
  • stratified train/test split
  • class-imbalance handling via scale_pos_weight
  • XGBoost classifier
  • evaluation: ROC-AUC, log-loss, Brier, accuracy, precision, recall, confusion
  • calibration curve (reliability bins) — important for xG (probabilities matter)
  • saves model (.pkl), feature schema (.json), training report (.json)

Usage:
    python src/train_xgboost.py --csv data/processed/xg_training.csv \
        --model-out models/xg_xgboost.pkl \
        --schema-out models/xg_feature_schema.json \
        --report-out models/xg_training_report.json
"""

from __future__ import annotations
import argparse
import json
import os
import sys

import numpy as np
import pandas as pd

import features as F


def build_schema(numeric, categorical, flags) -> dict:
    def descr(name):
        return {
            "distance_to_goal": "Distance from shot location to goal center (m).",
            "angle_to_goal": "Angle subtended by goal mouth from shot point (deg).",
            "shot_x": "Shot x-coordinate on 120m pitch.",
            "shot_y": "Shot y-coordinate on 70m pitch.",
        }.get(name, f"{name} feature.")

    return {
        "schema_version": "xg_feature_schema.v1",
        "pitch_training": "StatsBomb 120x80",
        "pitch_inference": "Vision 120x70 meters",
        "trained_model_features": [{"name": n, "type": "numeric", "description": descr(n)}
                                   for n in numeric]
                                  + [{"name": n, "type": "categorical",
                                      "description": f"{n} category."} for n in categorical]
                                  + [{"name": n, "type": "binary_flag",
                                      "description": f"{n} flag."} for n in flags],
        "categorical_features": categorical,
        "numeric_features": numeric + flags,
        "vision_diagnostic_features": [
            {"name": n, "type": "numeric",
             "description": "Vision-only scene feature; diagnostic unless model trained with it."}
            for n in F.VISION_DIAGNOSTIC_FEATURES
        ],
        "quality_thresholds": {"low": 0.05, "medium": 0.15, "high": 0.35},
    }


def main():
    ap = argparse.ArgumentParser(description="Train XGBoost xG model.")
    ap.add_argument("--csv", required=True)
    ap.add_argument("--model-out", required=True)
    ap.add_argument("--schema-out", required=True)
    ap.add_argument("--report-out", required=True)
    ap.add_argument("--test-size", type=float, default=0.2)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    try:
        import xgboost as xgb
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import (roc_auc_score, log_loss, brier_score_loss,
                                     accuracy_score, precision_score, recall_score,
                                     confusion_matrix)
        from sklearn.calibration import calibration_curve
    except ImportError as e:
        print(f"[TRAIN][ERROR] Missing dependency: {e}. "
              f"pip install xgboost scikit-learn pandas numpy", file=sys.stderr)
        return 1

    if not os.path.exists(args.csv):
        print(f"[TRAIN][ERROR] CSV not found: {args.csv}", file=sys.stderr)
        return 1

    df = pd.read_csv(args.csv)
    numeric = F.TRAINED_NUMERIC
    flags = F.TRAINED_FLAGS
    categorical = F.TRAINED_CATEGORICAL

    # one-hot encode categoricals (fixed columns saved in schema for inference parity)
    X_cat = pd.get_dummies(df[categorical].astype(str), prefix=categorical)
    X = pd.concat([df[numeric + flags].astype(float), X_cat], axis=1)
    y = df["is_goal"].astype(int).values
    feature_columns = list(X.columns)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=args.test_size, random_state=args.seed, stratify=y)

    n_pos = int(y_train.sum())
    n_neg = int(len(y_train) - n_pos)
    scale_pos_weight = (n_neg / n_pos) if n_pos > 0 else 1.0

    model = xgb.XGBClassifier(
        n_estimators=400, max_depth=4, learning_rate=0.05,
        subsample=0.85, colsample_bytree=0.85,
        min_child_weight=3, gamma=0.5,
        scale_pos_weight=scale_pos_weight,
        objective="binary:logistic", eval_metric="logloss",
        random_state=args.seed, n_jobs=4,
    )
    # Calibrate probabilities (isotonic) — xG values must match real conversion
    # rates, not just rank correctly. We hold out a calibration split.
    from sklearn.calibration import CalibratedClassifierCV
    X_fit, X_cal, y_fit, y_cal = train_test_split(
        X_train, y_train, test_size=0.25, random_state=args.seed, stratify=y_train)
    model.fit(X_fit, y_fit)
    base_model = model
    try:
        # sklearn >= 1.6: prefit via FrozenEstimator
        from sklearn.frozen import FrozenEstimator
        calibrated = CalibratedClassifierCV(FrozenEstimator(model), method="isotonic")
        calibrated.fit(X_cal, y_cal)
    except ImportError:
        # sklearn < 1.6: cv="prefit"
        calibrated = CalibratedClassifierCV(model, method="isotonic", cv="prefit")
        calibrated.fit(X_cal, y_cal)
    model = calibrated

    proba = model.predict_proba(X_test)[:, 1]
    pred = (proba >= 0.5).astype(int)

    metrics = {
        "roc_auc": float(roc_auc_score(y_test, proba)),
        "log_loss": float(log_loss(y_test, proba, labels=[0, 1])),
        "brier_score": float(brier_score_loss(y_test, proba)),
        "accuracy": float(accuracy_score(y_test, pred)),
        "precision": float(precision_score(y_test, pred, zero_division=0)),
        "recall": float(recall_score(y_test, pred, zero_division=0)),
    }
    cm = confusion_matrix(y_test, pred).tolist()

    # calibration (reliability) — does predicted xG match real conversion?
    try:
        frac_pos, mean_pred = calibration_curve(y_test, proba, n_bins=8, strategy="quantile")
        calibration = [{"mean_predicted": float(mp), "fraction_positive": float(fp)}
                       for mp, fp in zip(mean_pred, frac_pos)]
    except Exception as e:
        calibration = []
        print(f"[TRAIN][WARN] calibration failed: {e}", file=sys.stderr)

    importance = sorted(
        [{"feature": f, "importance": float(i)}
         for f, i in zip(feature_columns, base_model.feature_importances_)],
        key=lambda d: d["importance"], reverse=True)

    limitations = []
    if n_pos < 100:
        limitations.append(f"Only {n_pos} positive (goal) samples in train; metrics may be noisy.")
    limitations.append("Model trained on StatsBomb event features only; Vision diagnostic "
                        "features (pressure, GK distance) are NOT inputs and remain diagnostic.")
    limitations.append("body_part/shot_type from Vision are usually 'unknown'/'open_play', "
                        "which shifts inference toward open-play priors.")

    # ── save artifacts ──────────────────────────────────────────────────────
    os.makedirs(os.path.dirname(args.model_out) or ".", exist_ok=True)
    import pickle
    with open(args.model_out, "wb") as f:
        pickle.dump({"model": model, "base_model": base_model,
                     "feature_columns": feature_columns,
                     "numeric": numeric, "flags": flags, "categorical": categorical},
                    f)

    schema = build_schema(numeric, categorical, flags)
    schema["encoded_feature_columns"] = feature_columns
    with open(args.schema_out, "w", encoding="utf-8") as f:
        json.dump(schema, f, ensure_ascii=False, indent=2)

    report = {
        "model_type": "XGBoostClassifier",
        "dataset_source": "StatsBomb Open Data",
        "num_shots": int(len(df)),
        "num_goals": int(df["is_goal"].sum()),
        "num_non_goals": int(len(df) - df["is_goal"].sum()),
        "train_size": int(len(X_train)),
        "test_size": int(len(X_test)),
        "scale_pos_weight": round(scale_pos_weight, 3),
        "metrics": metrics,
        "confusion_matrix": cm,
        "feature_importance": importance,
        "calibration": calibration,
        "limitations": limitations,
    }
    with open(args.report_out, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"[TRAIN] DONE — ROC-AUC={metrics['roc_auc']:.3f} "
          f"Brier={metrics['brier_score']:.4f} LogLoss={metrics['log_loss']:.4f}")
    print(f"[TRAIN] model → {args.model_out}")
    print(f"[TRAIN] top features: "
          f"{', '.join(d['feature'] for d in importance[:5])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
