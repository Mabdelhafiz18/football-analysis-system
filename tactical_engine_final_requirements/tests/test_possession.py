import sys
sys.path.append("src")
from possession import PossessionModule


def test_possession_nearest_player():
    frame = {"ball":{"x":10,"y":10}, "players":[{"id":5,"team_id":0,"x":11,"y":10,"confidence":0.9}]}
    result = PossessionModule().calculate_frame(frame)
    assert result["team_id"] == 0
    assert result["player_id"] == 5
    assert result["reliable"] is True
