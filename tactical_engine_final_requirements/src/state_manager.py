from collections import defaultdict, deque
from config import WINDOWS


class StateManager:
    def __init__(self, max_seconds=None):
        self.max_seconds = max_seconds or max(WINDOWS.values())
        self.frames_by_job = defaultdict(deque)

    def add_frame(self, frame):
        job_id = frame.get("job_id") or "default"
        frames = self.frames_by_job[job_id]
        frames.append(frame)
        current_time = frame["timestamp_sec"]
        while frames and current_time - frames[0]["timestamp_sec"] > self.max_seconds:
            frames.popleft()

    def get_latest_frame(self, job_id="default"):
        frames = self.frames_by_job.get(job_id) or []
        return frames[-1] if frames else None

    def get_window(self, job_id, seconds):
        frames = self.frames_by_job.get(job_id) or []
        if not frames:
            return []
        current_time = frames[-1]["timestamp_sec"]
        return [f for f in frames if current_time - f["timestamp_sec"] <= seconds]
