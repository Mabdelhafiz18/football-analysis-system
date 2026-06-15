# src/redis_consumer.py
import json
from typing import Dict, Generator, Tuple

import redis

from src.config import REDIS_HOST, REDIS_PORT, INPUT_STREAM, READ_COUNT, BLOCK_MS


class RedisConsumer:
    def __init__(self, stream_key: str = INPUT_STREAM):
        self.stream_key = stream_key
        self.redis_client = redis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            decode_responses=True,
        )
        self.last_id = "0-0"

    def read_messages(self) -> Generator[Tuple[str, Dict], None, None]:
        """
        Yield:
            msg_id, decoded_packet
        """
        while True:
            messages = self.redis_client.xread(
                {self.stream_key: self.last_id},
                count=READ_COUNT,
                block=BLOCK_MS,
            )

            if not messages:
                continue

            for _, msg_list in messages:
                for msg_id, fields in msg_list:
                    self.last_id = msg_id
                    raw_data = fields.get("data")
                    if not raw_data:
                        continue

                    try:
                        packet = json.loads(raw_data)
                        yield msg_id, packet
                    except json.JSONDecodeError:
                        continue