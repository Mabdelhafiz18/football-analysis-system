# src/window_buffer.py
from collections import deque
from typing import Deque, Dict, List, Optional

from src.config import WINDOW_SIZE_SEC


class TemporalWindowBuffer:
    def __init__(self, window_size_sec: float = WINDOW_SIZE_SEC):
        self.window_size_sec = window_size_sec
        self.frames: Deque[Dict] = deque()

    def add_frame(self, frame: Dict) -> None:
        self.frames.append(frame)
        self._trim()

    def _trim(self) -> None:
        if not self.frames:
            return

        latest_time = self.frames[-1]["timestamp_sec"]

        while self.frames and (latest_time - self.frames[0]["timestamp_sec"] > self.window_size_sec):
            self.frames.popleft()

    def get_frames(self) -> List[Dict]:
        return list(self.frames)

    def get_latest_frame(self) -> Optional[Dict]:
        if not self.frames:
            return None
        return self.frames[-1]

    def get_track_history(self, player_id: int) -> List[Dict]:
        history = []
        for frame in self.frames:
            for player in frame["players"] + frame["goalkeepers"]:
                if player.get("id") == player_id:
                    history.append(
                        {
                            "frame_id": frame["frame_id"],
                            "timestamp_sec": frame["timestamp_sec"],
                            "object": player,
                        }
                    )
        return history