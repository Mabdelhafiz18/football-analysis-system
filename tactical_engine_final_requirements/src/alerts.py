from config import ALERT_THRESHOLDS


class AlertsModule:
    def generate(self, frame, teams, possession, pressure, progression, transition, reliability):
        alerts = []
        timestamp = frame["timestamp_sec"]

        for team_key, metrics in teams.items():
            team_id = int(team_key)
            if not metrics.get("reliable", True):
                alerts.append(self._alert(team_id, "low_detection_count", "Team has low player detection count", "medium", timestamp))
                continue

            if metrics["width"] >= ALERT_THRESHOLDS["large_width"]:
                alerts.append(self._alert(team_id, "large_width", "Team is stretched too wide", "medium", timestamp))
            if metrics["depth"] >= ALERT_THRESHOLDS["large_depth"]:
                alerts.append(self._alert(team_id, "large_depth", "Team lines are too stretched vertically", "medium", timestamp))
            if metrics["compactness"] >= ALERT_THRESHOLDS["low_compactness"]:
                alerts.append(self._alert(team_id, "low_compactness", "Team compactness is low", "high", timestamp))
            if metrics["block_type"] == "high_block":
                alerts.append(self._alert(team_id, "high_defensive_line", "Defensive line is high", "medium", timestamp))
            gaps = metrics.get("line_gaps", {})
            if gaps.get("defense_midfield_gap", 0) >= ALERT_THRESHOLDS["space_between_lines"] or gaps.get("midfield_attack_gap", 0) >= ALERT_THRESHOLDS["space_between_lines"]:
                alerts.append(self._alert(team_id, "space_between_lines", "Large gap between team lines", "high", timestamp))

        # Only show unclear possession when we truly have no team after soft/window fallback.
        if possession.get("team_id") is None:
            alerts.append(self._alert(None, "unclear_possession", "Ball possession is unclear", "low", timestamp))

        if pressure.get("ball_carrier_under_pressure"):
            alerts.append(self._alert(possession.get("team_id"), "ball_carrier_under_pressure", "Ball carrier is under pressure", "high", timestamp))
        if progression.get("is_final_third_entry"):
            alerts.append(self._alert(possession.get("team_id"), "final_third_entry", "Ball entered the final third", "medium", timestamp))
        if progression.get("is_box_entry"):
            alerts.append(self._alert(possession.get("team_id"), "box_entry", "Ball entered the penalty box zone", "high", timestamp))
        if transition.get("active"):
            alerts.append(self._alert(transition.get("team_id"), "counter_attack" if transition.get("is_counter_attack") else "transition", "Transition detected", "high", timestamp))
        if reliability.get("overall_confidence", 0) < 0.55:
            alerts.append(self._alert(None, "low_detection_reliability", "Tracking reliability is low", "medium", timestamp))

        # Deduplicate by type/team and keep a clean demo list.
        return self._deduplicate(alerts)

    def _deduplicate(self, alerts):
        seen = set()
        clean = []
        severity_rank = {"high": 0, "medium": 1, "low": 2, "info": 3}
        for alert in sorted(alerts, key=lambda a: severity_rank.get(a.get("severity"), 9)):
            key = (alert.get("team_id"), alert.get("type"))
            if key in seen:
                continue
            seen.add(key)
            clean.append(alert)
        return clean[:6]

    def _alert(self, team_id, alert_type, message, severity, timestamp):
        return {"team_id": team_id, "type": alert_type, "message": message, "severity": severity, "timestamp_sec": timestamp}
