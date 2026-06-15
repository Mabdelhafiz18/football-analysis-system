from pathlib import Path
import os
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

load_dotenv(ENV_PATH)

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))

INPUT_STREAM = os.getenv("INPUT_STREAM", "vc:match_final_001")
OUTPUT_STREAM = os.getenv("OUTPUT_STREAM", "evt:foul:match_final_001")

VIDEO_PATH = os.getenv("VIDEO_PATH", "")
NDJSON_PATH = os.getenv("NDJSON_PATH", "")

WINDOW_SIZE_SEC = float(os.getenv("WINDOW_SIZE_SEC", "2.0"))

DISTANCE_THRESHOLD = float(os.getenv("DISTANCE_THRESHOLD", "2.0"))
CONTACT_THRESHOLD = float(os.getenv("CONTACT_THRESHOLD", "1.5"))
SUDDEN_STOP_THRESHOLD = float(os.getenv("SUDDEN_STOP_THRESHOLD", "2.5"))
DIRECTION_CHANGE_THRESHOLD_DEG = float(os.getenv("DIRECTION_CHANGE_THRESHOLD_DEG", "45.0"))
BALL_POSSESSION_RADIUS = float(os.getenv("BALL_POSSESSION_RADIUS", "2.0"))

READ_COUNT = int(os.getenv("READ_COUNT", "10"))
BLOCK_MS = int(os.getenv("BLOCK_MS", "5000"))

EVENT_COOLDOWN_SEC = float(os.getenv("EVENT_COOLDOWN_SEC", "0.8"))
MIN_CONFIDENCE_TO_WRITE = float(os.getenv("MIN_CONFIDENCE_TO_WRITE", "0.20"))
EVENT_DISPLAY_SECONDS = float(os.getenv("EVENT_DISPLAY_SECONDS", "10"))

DEBUG = os.getenv("DEBUG", "true").lower() == "true"