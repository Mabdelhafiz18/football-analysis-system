import json
from config import WINDOWS
from parser import VisionFrameParser
from state_manager import StateManager
from team_metrics import TeamMetricsModule
from heatmap import HeatmapModule
from formation import FormationModule
from possession import PossessionModule
from pressure import PressureModule
from ball_progression import BallProgressionModule
from transitions import TransitionModule
from reliability import ReliabilityModule
from alerts import AlertsModule
from schema import OutputSchemaBuilder


class TacticalIntelligenceEngine:
    def __init__(self):
        self.parser = VisionFrameParser()
        self.state = StateManager()
        self.team_metrics = TeamMetricsModule()
        self.heatmap = HeatmapModule()
        self.formation = FormationModule()
        self.possession = PossessionModule()
        self.pressure = PressureModule()
        self.progression = BallProgressionModule()
        self.transitions = TransitionModule()
        self.reliability = ReliabilityModule()
        self.alerts = AlertsModule()
        self.schema = OutputSchemaBuilder()

    def process_raw_frame(self, raw_frame):
        frame = self.parser.parse(raw_frame)
        job_id = frame.get("job_id") or "default"
        self.state.add_frame(frame)

        short_window = self.state.get_window(job_id, WINDOWS["short"])
        medium_window = self.state.get_window(job_id, WINDOWS["medium"])
        long_window = self.state.get_window(job_id, WINDOWS["long"])

        teams = self.team_metrics.calculate(frame)
        formations = self.formation.calculate(medium_window)
        heatmaps = self.heatmap.calculate(long_window)
        frame_possession = self.possession.calculate_frame(frame)
        window_possession = self.possession.calculate_window(short_window)

        # If the current frame possession is unclear, keep the dashboard useful by
        # falling back to the short-window dominant team with low confidence.
        display_possession = dict(frame_possession)
        if display_possession.get("team_id") is None and window_possession.get("dominant_team_id") is not None:
            display_possession["team_id"] = window_possession.get("dominant_team_id")
            display_possession["player_id"] = None
            display_possession["confidence"] = window_possession.get("avg_confidence", 0.0)
            display_possession["quality"] = "window_fallback"
            display_possession["reliable"] = window_possession.get("reliable", False)

        possession_for_progress = dict(display_possession)
        pressure = self.pressure.calculate(frame, display_possession)
        progression = self.progression.calculate(medium_window, possession_for_progress)
        transition = self.transitions.calculate(short_window, self.possession, progression)
        reliability = self.reliability.calculate(frame, teams)
        alerts = self.alerts.generate(frame, teams, display_possession, pressure, progression, transition, reliability)

        output = self.schema.build(frame, teams, formations, heatmaps, display_possession, progression, pressure, transition, alerts, reliability)
        self.schema.validate_minimal(output)
        return output

    def process_ndjson(self, path):
        outputs = []
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                outputs.append(self.process_raw_frame(json.loads(line)))
        return outputs
