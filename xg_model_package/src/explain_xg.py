"""
explain_xg.py — Human-readable explanation for each xG prediction.

Prefers SHAP (per-shot signed contributions from the trained model). Falls back
to global feature-importance directional reasoning if SHAP is unavailable.

Trained-model features get real/directional effects; Vision diagnostic features
are always labelled "diagnostic" (they did NOT enter the trained model) — exactly
as required by the system spec.
"""

from __future__ import annotations
from typing import Optional

_REASONS = {
    "distance_to_goal": "Closer shots usually have a higher scoring probability.",
    "angle_to_goal": "A wider angle to goal means more of the net is available.",
    "shot_x": "Shot position along the pitch length affects proximity to goal.",
    "shot_y": "Central positions generally offer better angles than wide ones.",
    "is_penalty": "Penalties convert at a very high rate.",
    "is_free_kick": "Direct free kicks convert at a low rate.",
    "is_header": "Headers generally convert worse than foot shots.",
    "is_foot": "Foot shots generally convert better than headers.",
    "is_first_time": "First-time shots can reduce keeper set time but add contact difficulty.",
    "under_pressure": "Pressure from defenders reduces shot quality.",
    "body_part": "Body part used affects conversion (head vs foot).",
    "shot_type": "Set pieces vs open play change the scoring baseline.",
    "play_pattern": "How the chance developed changes its baseline quality.",
}

_DIAG_REASONS = {
    "nearest_defender_distance": "A nearby defender increases pressure.",
    "goalkeeper_distance": "Keeper proximity/positioning affects the open target.",
    "goalkeeper_lateral_offset": "A keeper off his line laterally can leave space.",
    "goal_visible_ratio": "More visible goal mouth means a cleaner shooting lane.",
    "defenders_in_cone": "Defenders inside the shooting cone can block the shot.",
    "nearest_defender_in_cone": "The closest blocker in the cone affects the lane.",
    "num_defenders_2m": "Defenders within 2m heavily contest the shot.",
    "num_defenders_5m": "Defenders within 5m apply pressure.",
    "num_defenders_10m": "Local defensive numbers shape the chance.",
    "attackers_box": "Support in the box can affect rebounds and options.",
    "defenders_box": "Crowded box reduces clear sight of goal.",
    "local_density": "High local congestion makes scoring harder.",
    "ball_speed_before_shot": "Ball speed before the shot hints at strike power/first-time.",
}


def _smart_reason(feature: str, value, effect: float | None = None) -> str:
    """
    Value-aware human explanation.
    Explains what the actual feature value means, not only the feature name.
    This only changes the explanation text; it does not change xG or model logic.
    """

    if feature == "is_first_time":
        if value == 1:
            return "The shot was taken first-time. This can reduce goalkeeper reaction time but can also make ball contact harder."
        return "The shot was not first-time. In this context, the model associated the controlled shot setup with this contribution."

    if feature == "under_pressure":
        if value == 1:
            return "The shooter was marked as under pressure, which usually lowers shot quality."
        return "The shooter was not marked as under pressure, giving more time and space to shoot."

    if feature == "is_header":
        if value == 1:
            return "The shot was a header. Headers usually have lower conversion rates than foot shots."
        return "The shot was not a header, which avoids the lower conversion profile usually associated with headers."

    if feature == "is_foot":
        if value == 1:
            return "The shot was taken with the foot, which generally has a stronger scoring profile than headers."
        return "The body part was not confirmed as a foot shot, so the model cannot reward it as a confirmed foot attempt."

    if feature == "is_penalty":
        if value == 1:
            return "The shot was a penalty, which has a very high scoring probability."
        return "The shot was not a penalty, so it does not receive the high penalty baseline."

    if feature == "is_free_kick":
        if value == 1:
            return "The shot was a direct free kick, which usually has a lower scoring probability than close-range open-play shots."
        return "The shot was not a direct free kick."

    if feature == "is_one_on_one":
        if value == 1:
            return "The shot was marked as one-on-one, which usually increases shot quality."
        return "The shot was not marked as one-on-one."

    if feature == "is_open_goal":
        if value == 1:
            return "The shot was marked as open goal, which strongly increases scoring probability."
        return "The shot was not marked as open goal."

    if feature == "is_set_piece":
        if value == 1:
            return "The shot came from a set-piece context, which changes the scoring baseline."
        return "The shot came from open play or was not marked as a set-piece."

    if feature == "distance_to_goal":
        try:
            v = float(value)
            if v < 8:
                return "The shot was very close to goal, which strongly increases scoring probability."
            if v < 16:
                return "The shot was inside a dangerous shooting range."
            if v < 25:
                return "The shot was from medium range, so the chance quality is limited."
            return "The shot was far from goal, which strongly reduces scoring probability."
        except Exception:
            pass

    if feature == "angle_to_goal":
        try:
            v = float(value)
            if v >= 35:
                return "The shot had a wide angle to goal, giving a larger visible target."
            if v >= 18:
                return "The shot had a moderate angle to goal."
            return "The shot had a narrow angle to goal, reducing the available target."
        except Exception:
            pass

    if feature == "shot_x":
        return "Shot position along the pitch length affects how close the attempt is to the target goal."

    if feature == "shot_y":
        return "Shot position across the pitch affects whether the attempt is central or wide."

    if feature == "body_part":
        return f"The model used body_part={value}, which affects the baseline scoring probability."

    if feature == "shot_type":
        return f"The model used shot_type={value}, which changes the expected scoring baseline."

    if feature == "play_pattern":
        return f"The model used play_pattern={value}, which describes how the chance was created."

    return _REASONS.get(feature, f"{_readable(feature)} influences the model.")


def _readable(name: str) -> str:
    base = name.split("_")[0]
    return name.replace("_", " ")


def explain_prediction(bundle, X_row, trained: dict, diagnostic: dict,
                       xg: float, top_k: int = 3) -> dict:
    """Return explanation dict: summary, top_positive_factors, top_negative_factors."""
    feature_columns = bundle["feature_columns"]
    base_model = bundle.get("base_model")

    positive, negative = [], []

    # ── try SHAP on the base (uncalibrated) tree model ──────────────────────
    shap_vals = None
    if base_model is not None:
        try:
            import shap
            explainer = shap.TreeExplainer(base_model)
            sv = explainer.shap_values(X_row)
            import numpy as np
            shap_vals = np.array(sv)[0] if not isinstance(sv, list) else np.array(sv[1])[0]
        except Exception:
            shap_vals = None

    if shap_vals is not None:
        contribs = sorted(zip(feature_columns, shap_vals), key=lambda t: t[1], reverse=True)
        for fname, val in contribs:
            if abs(val) < 1e-4:
                continue
            base_feat = _map_encoded_to_base(fname)
            entry = {
                "feature": base_feat,
                "value": _value_of(base_feat, trained),
                "effect": f"{val:+.3f}",
                "source": "trained_model",
                "reason": _smart_reason(base_feat, _value_of(base_feat, trained), float(val)),
            }
            (positive if val > 0 else negative).append(entry)
        positive = positive[:top_k]
        negative = negative[-top_k:][::-1] if negative else []
    else:
        # ── fallback: directional reasoning from global importance ──────────
        positive, negative = _directional_fallback(bundle, trained, top_k)

    # ── always append diagnostic factors (clearly marked) ───────────────────
    diag_factors = []
    for dname, dval in diagnostic.items():
        if dval is None:
            continue
        diag_factors.append({
            "feature": dname,
            "value": dval,
            "effect": "diagnostic",
            "source": "vision_diagnostic",
            "reason": _DIAG_REASONS.get(dname, f"{_readable(dname)} (scene context).")
                      + " This is diagnostic unless the model was trained with freeze-frame features.",
        })

    summary = _summary(xg, trained, diagnostic)
    # attach a couple of the most relevant diagnostics to negatives for visibility
    return {
        "summary": summary,
        "top_positive_factors": positive,
        "top_negative_factors": (negative + diag_factors)[:max(top_k, 3)],
    }


def _map_encoded_to_base(encoded: str) -> str:
    for cat in ("body_part", "shot_type", "play_pattern"):
        if encoded.startswith(cat + "_"):
            return cat
    return encoded


def _value_of(base_feat: str, trained: dict):
    v = trained.get(base_feat)
    return round(v, 3) if isinstance(v, float) else v


def _directional_fallback(bundle, trained, top_k):
    """No SHAP: use sign heuristics on key features."""
    pos, neg = [], []
    dist = trained.get("distance_to_goal", 30)
    ang = trained.get("angle_to_goal", 10)
    if dist < 12:
        pos.append(_dir_entry("distance_to_goal", dist, "+"))
    else:
        neg.append(_dir_entry("distance_to_goal", dist, "-"))
    if ang > 25:
        pos.append(_dir_entry("angle_to_goal", ang, "+"))
    else:
        neg.append(_dir_entry("angle_to_goal", ang, "-"))
    if trained.get("is_penalty"):
        pos.append(_dir_entry("is_penalty", 1, "+"))
    if trained.get("is_header"):
        neg.append(_dir_entry("is_header", 1, "-"))
    return pos[:top_k], neg[:top_k]


def _dir_entry(feat, val, sign):
    return {"feature": feat, "value": round(val, 3) if isinstance(val, float) else val,
            "effect": "directional", "source": "trained_model",
            "reason": _smart_reason(feat, val, None)}


def _summary(xg, trained, diagnostic) -> str:
    dist = trained.get("distance_to_goal")
    ang = trained.get("angle_to_goal")
    parts = []
    if xg >= 0.35:
        parts.append("Big chance")
    elif xg >= 0.15:
        parts.append("High quality chance")
    elif xg >= 0.05:
        parts.append("Low quality chance")
    else:
        parts.append("Very low quality chance")
    if dist is not None:
        parts.append(f"shot ~{dist:.0f}m from goal")
    if ang is not None:
        parts.append(f"angle ~{ang:.0f}°")
    gv = diagnostic.get("goal_visible_ratio")
    if gv is not None:
        parts.append(f"visible goal ~{int(gv*100)}%")
    return ", ".join(parts) + f". Predicted xG {xg:.2f}."
