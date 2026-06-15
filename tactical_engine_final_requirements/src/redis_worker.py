from engine import TacticalIntelligenceEngine
from redis_io import RedisStreamIO


def main():
    engine = TacticalIntelligenceEngine()
    io = RedisStreamIO()
    last_id = "0-0"
    print("Listening on Redis stream vision:frames and writing tactical:insights ...")
    while True:
        messages = io.read_frames(last_id=last_id, block_ms=2000, count=10)
        for message_id, raw_frame in messages:
            last_id = message_id
            output = engine.process_raw_frame(raw_frame)
            out_id = io.write_insight(output)
            print(f"Processed frame={output['frame_id']} -> tactical:insights id={out_id}")


if __name__ == "__main__":
    main()
