# src/redis_writer.py
import json
import redis

from src.config import REDIS_HOST, REDIS_PORT, OUTPUT_STREAM


class RedisWriter:
    def __init__(self, stream_key: str = OUTPUT_STREAM):
        self.stream_key = stream_key
        self.redis_client = redis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            decode_responses=True,
        )

    def write_event(self, event: dict) -> str:
        return self.redis_client.xadd(
            self.stream_key,
            {"data": json.dumps(event)},
        )