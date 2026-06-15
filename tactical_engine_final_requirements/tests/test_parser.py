import sys
sys.path.append("src")
from parser import VisionFrameParser


def test_ball_team_id_null_is_parsed():
    raw = {"job_id":"j", "frame_id":1, "timestamp_sec":0, "objects":[
        {"id":1,"class_id":0,"team_id":None,"pitch_xy_m":[10,10],"is_on_pitch":True,"confidence":0.9},
        {"id":2,"class_id":2,"team_id":0,"pitch_xy_m":[12,10],"is_on_pitch":True,"confidence":0.9},
    ]}
    parsed = VisionFrameParser().parse(raw)
    assert parsed["ball"]["x"] == 10
    assert len(parsed["players"]) == 1
