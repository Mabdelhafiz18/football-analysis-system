# src/main.py
from src.redis_consumer import RedisConsumer
from src.frame_parser import parse_frame
from src.window_buffer import TemporalWindowBuffer
from src.candidate_generator import generate_candidates
from src.scorer import score_candidate
from src.redis_writer import RedisWriter


def main():
    consumer = RedisConsumer()
    writer = RedisWriter()
    window = TemporalWindowBuffer()

    print("[FOUL DEMO MODE] Consumer started...")

    last_emitted_time = {}

    for _, packet in consumer.read_messages():
        parsed_frame = parse_frame(packet)
        window.add_frame(parsed_frame)

        frame_id = parsed_frame["frame_id"]
        players_count = len(parsed_frame["players"])
        has_ball = parsed_frame["ball"] is not None
        print(f"[FOUL DEMO] frame={frame_id} | players={players_count} | ball={has_ball}")

        candidates = generate_candidates(window)

        for candidate in candidates:
            scored_event = score_candidate(candidate)

            event_pair = (
                scored_event["offender_id"],
                scored_event["victim_id"],
            )

            now_ts = scored_event["timestamp_sec"]
            last_ts = last_emitted_time.get(event_pair)

            # cooldown بسيط
            if last_ts is not None and (now_ts - last_ts) < 0.7:
                continue

            # DEMO MODE:
            # اكتب أي candidate ثقتها 0.45 أو أعلى
            if scored_event["confidence"] >= 0.45:
                writer.write_event(scored_event)
                last_emitted_time[event_pair] = now_ts
                print("[FOUL EVENT DEMO]", scored_event)


if __name__ == "__main__":
    main()