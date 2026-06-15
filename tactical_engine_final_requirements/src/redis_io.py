import json
from config import REDIS_HOST, REDIS_PORT, REDIS_DB, INPUT_STREAM, OUTPUT_STREAM


class RedisStreamIO:
    def __init__(self, host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB, input_stream=INPUT_STREAM, output_stream=OUTPUT_STREAM):
        self.input_stream = input_stream
        self.output_stream = output_stream
        try:
            import redis
        except ImportError as exc:
            raise RuntimeError("Install redis package first: pip install redis") from exc
        self.redis = redis.Redis(host=host, port=port, db=db, decode_responses=True)

    def read_frames(self, last_id="$", block_ms=1000, count=10):
        response = self.redis.xread({self.input_stream: last_id}, block=block_ms, count=count)
        frames = []
        for _stream, messages in response:
            for message_id, fields in messages:
                payload = fields.get("data") or fields.get("json") or fields.get("payload")
                if payload:
                    frames.append((message_id, json.loads(payload)))
                else:
                    frames.append((message_id, fields))
        return frames

    def write_insight(self, output):
        return self.redis.xadd(self.output_stream, {"data": json.dumps(output)})
