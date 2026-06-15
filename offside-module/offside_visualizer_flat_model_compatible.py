"""
offside_visualizer.py  —  Professional VAR-Style Offside Overlay  v3
=====================================================================
التعديلات في النسخة دي:
  ✦ P/R/D markers — Passer/Receiver/Penultimate Defender مميزين بشكل واضح
  ✦ Ball at pass moment — مرسوم في الكاميرا والرادار والـ VAR panel
  ✦ ON-SIDE events معروضة (--show_onside)
  ✦ --always_show_panel option
  ✦ Event timeline strip في أسفل الـ panel
  ✦ margin label: `if m is not None` بدل `if m`
  ✦ Penultimate defender ID واضح في الـ VAR panel
  ✦ Unified pitch dimensions من CONFIG

تشغيل:
    python offside_visualizer.py \\
        --source_video_path match.mp4 \\
        --output_video_path offside_var.mp4 \\
        --ndjson_path       rt_output.ndjson \\
        --job_id            match_001 \\
        --show_onside \\
        --always_show_panel
"""

import argparse
import json
import math
import time
from typing import Optional

import cv2
import numpy as np
import redis
import supervision as sv

from sports.configs.soccer import SoccerPitchConfiguration

CONFIG = SoccerPitchConfiguration()
PITCH_LENGTH_M = CONFIG.length / 100   # 120.0
PITCH_WIDTH_M  = CONFIG.width  / 100   # 70.0

# ── Colors ────────────────────────────────────────────────────────────────────
LINE_COLOR      = (0, 220, 255)
OFFSIDE_RED     = (0, 0, 200)
ONSIDE_GREEN    = (50, 200, 50)
DEFENDER_WHITE  = (210, 210, 210)
PASSER_BLUE     = (220, 130, 30)
RECEIVER_PURPLE = (200, 80, 200)
DEFENDER_YELLOW = (0, 200, 220)
BALL_WHITE      = (255, 255, 255)
BALL_PASS_COLOR = (0, 255, 255)
PANEL_BG        = (14, 20, 14)

PANEL_H_RATIO   = 0.32
RADAR_W_RATIO   = 0.33
SHOW_TOTAL      = 110
FADE_IN         = 8
FADE_OUT        = 14


# ══════════════════════════════════════════════════════════════════════════════
# Homography
# ══════════════════════════════════════════════════════════════════════════════

def load_homography(r, job_id):
    raw = r.get(f"vc:{job_id}:homography")
    return np.array(json.loads(raw), dtype=np.float64) if raw else None


def pitch_cm_to_pixel(H_inv, x_cm, y_cm):
    pt  = np.array([[[x_cm, y_cm]]], dtype=np.float64)
    out = cv2.perspectiveTransform(pt, H_inv)
    return int(out[0,0,0]), int(out[0,0,1])


def build_line_pts(H_inv, x_m, n=60):
    xc = x_m * 100
    return [pitch_cm_to_pixel(H_inv, xc, (i/n)*CONFIG.width) for i in range(n+1)]


def build_zone_poly(H_inv, x_m, attack_dir, n=60):
    xc     = x_m * 100
    far_xc = CONFIG.length if attack_dir == +1 else 0.0
    top = [pitch_cm_to_pixel(H_inv, xc,     (i/n)*CONFIG.width) for i in range(n+1)]
    bot = [pitch_cm_to_pixel(H_inv, far_xc, (i/n)*CONFIG.width) for i in range(n+1)]
    return np.array(top + list(reversed(bot)), dtype=np.int32)


# ══════════════════════════════════════════════════════════════════════════════
# Camera overlay
# ══════════════════════════════════════════════════════════════════════════════

def draw_camera_overlay(frame, line_pts, zone_poly, objects, ev, alpha):
    h, w   = frame.shape[:2]
    viz    = ev.get("visualization", {})
    offids = set(viz.get("highlight_player_ids", []))
    passer = viz.get("passer_id")
    receiv = viz.get("receiver_id")
    penu_d = viz.get("penultimate_defender_id")
    ball_p = viz.get("ball_at_pass_xy_m")
    margins= {p["id"]: p.get("margin_m") for p in ev.get("offside_players", [])}
    def_team = ev.get("teams",{}).get("defending_team", 1)

    # zone
    if zone_poly is not None:
        ov = frame.copy()
        cv2.fillPoly(ov, [zone_poly], OFFSIDE_RED)
        cv2.addWeighted(ov, 0.18*alpha, frame, 1-0.18*alpha, 0, frame)

    # glow + offside line
    if line_pts:
        arr = np.array(line_pts, dtype=np.int32).reshape(-1,1,2)
        ov  = frame.copy()
        cv2.polylines(ov, [arr], False, LINE_COLOR, 14, cv2.LINE_AA)
        cv2.addWeighted(ov, 0.28*alpha, frame, 1-0.28*alpha, 0, frame)
        cv2.polylines(frame, [arr], False, LINE_COLOR, 3, cv2.LINE_AA)

    # players
    for obj in objects:
        if obj.get("class_id") not in [1, 2]:
            continue
        ax = obj.get("anchor_xy")
        if not ax:
            continue
        px, py = int(ax[0]), int(ax[1])
        oid    = obj.get("id")
        team   = obj.get("team_id")

        # pick color and role
        if oid == passer:
            color = PASSER_BLUE;   role = "P"
        elif oid == receiv:
            color = RECEIVER_PURPLE; role = "R"
        elif oid == penu_d:
            color = DEFENDER_YELLOW; role = "D"
        elif oid in offids:
            color = OFFSIDE_RED;   role = None
        elif team == def_team:
            color = DEFENDER_WHITE; role = None
        else:
            color = ONSIDE_GREEN;  role = None

        # line from offside player to line
        if line_pts and oid in offids:
            closest = min(line_pts, key=lambda p: abs(p[1]-py))
            ov2 = frame.copy()
            cv2.line(ov2, (px, py), closest, OFFSIDE_RED, 2, cv2.LINE_AA)
            cv2.addWeighted(ov2, 0.8*alpha, frame, 1-0.8*alpha, 0, frame)

        cv2.circle(frame, (px, py), 12, color, -1, cv2.LINE_AA)
        cv2.circle(frame, (px, py), 12, (255,255,255), 2, cv2.LINE_AA)

        # role label (P / R / D)
        if role:
            cv2.putText(frame, role, (px-6, py+5),
                        cv2.FONT_HERSHEY_DUPLEX, 0.5, (15,15,15), 2, cv2.LINE_AA)

        # margin label
        m = margins.get(oid)
        label = f"#{oid}"
        if m is not None:
            label += f"  {abs(m)*100:.0f}cm"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_DUPLEX, 0.48, 1)
        cv2.rectangle(frame, (px-4, py-32-th), (px+tw+4, py-24), (15,15,15), -1)
        cv2.putText(frame, label, (px, py-26),
                    cv2.FONT_HERSHEY_DUPLEX, 0.48, (255,255,255), 1, cv2.LINE_AA)

    # ball at pass moment
    if ball_p is not None:
        # project من pitch coords لـ pixels باستخدام inverse homography
        pass   # يتعمل في context ليه H_inv — نعمله في loop

    # badge
    badge = viz.get("badge", "OFFSIDE")
    bcol  = OFFSIDE_RED if badge == "OFFSIDE" else ONSIDE_GREEN
    ov    = frame.copy()
    cv2.rectangle(ov, (w//2-155, 12), (w//2+155, 72), (12,12,12), -1)
    cv2.rectangle(ov, (w//2-155, 12), (w//2+155, 72), bcol, 3)
    cv2.putText(ov, badge, (w//2-135, 58),
                cv2.FONT_HERSHEY_DUPLEX, 1.2, bcol, 2, cv2.LINE_AA)
    cv2.addWeighted(ov, alpha, frame, 1-alpha, 0, frame)

    return frame


def draw_ball_pass_on_camera(frame, H_inv, ball_xy_m, alpha):
    """يرسم مكان الكرة لحظة التمريرة بشكل مميز."""
    if ball_xy_m is None or H_inv is None:
        return
    bx_cm = ball_xy_m[0] * 100
    by_cm = ball_xy_m[1] * 100
    px, py = pitch_cm_to_pixel(H_inv, bx_cm, by_cm)
    ov = frame.copy()
    cv2.circle(ov, (px, py), 16, BALL_PASS_COLOR, 2, cv2.LINE_AA)
    cv2.circle(ov, (px, py), 8, BALL_WHITE, -1, cv2.LINE_AA)
    cv2.putText(ov, "PASS", (px+12, py-6),
                cv2.FONT_HERSHEY_DUPLEX, 0.42, BALL_PASS_COLOR, 1, cv2.LINE_AA)
    cv2.addWeighted(ov, alpha, frame, 1-alpha, 0, frame)


# ══════════════════════════════════════════════════════════════════════════════
# Mini Radar
# ══════════════════════════════════════════════════════════════════════════════

def draw_radar_panel(pw, ph, objects, ev):
    radar = np.full((ph, pw, 3), PANEL_BG, dtype=np.uint8)
    viz    = ev.get("visualization", {})
    offids = set(viz.get("highlight_player_ids", []))
    passer = viz.get("passer_id")
    receiv = viz.get("receiver_id")
    penu_d = viz.get("penultimate_defender_id")
    ball_p = viz.get("ball_at_pass_xy_m")
    def_team = ev.get("teams",{}).get("defending_team", 1)
    penu_x   = ev.get("defensive_line",{}).get("penultimate_x")
    attack_dir = ev.get("teams",{}).get("attack_dir", 1)

    pad = 20
    rw, rh = pw - 2*pad, ph - 2*pad - 22

    cv2.rectangle(radar, (pad, pad), (pad+rw, pad+rh), (24, 85, 24), -1)
    mx = pad + rw//2; my = pad + rh//2
    cv2.rectangle(radar, (pad, pad), (pad+rw, pad+rh), (55, 120, 55), 1)
    cv2.line(radar, (mx, pad), (mx, pad+rh), (55,120,55), 1)
    cv2.ellipse(radar, (mx, my), (rw//8, rh//8), 0, 0, 360, (55,120,55), 1)

    def p2r(xm, ym):
        x = int(pad + (xm/PITCH_LENGTH_M)*rw)
        y = int(pad + (ym/PITCH_WIDTH_M)*rh)
        return x, y

    # offside zone
    if penu_x is not None:
        lx = int(pad + (penu_x/PITCH_LENGTH_M)*rw)
        if attack_dir == +1:
            pts = np.array([(lx,pad),(pad+rw,pad),(pad+rw,pad+rh),(lx,pad+rh)], np.int32)
        else:
            pts = np.array([(pad,pad),(lx,pad),(lx,pad+rh),(pad,pad+rh)], np.int32)
        ov = radar.copy()
        cv2.fillPoly(ov, [pts], OFFSIDE_RED)
        cv2.addWeighted(ov, 0.25, radar, 0.75, 0, radar)
        cv2.line(radar, (lx, pad), (lx, pad+rh), LINE_COLOR, 2)

    # ball at pass moment
    if ball_p is not None:
        bx, by = p2r(ball_p[0], ball_p[1])
        cv2.circle(radar, (bx, by), 7, BALL_PASS_COLOR, 2, cv2.LINE_AA)
        cv2.circle(radar, (bx, by), 4, BALL_WHITE, -1, cv2.LINE_AA)

    # players
    for obj in objects:
        cid = obj.get("class_id")
        if cid not in [0, 1, 2]:
            continue
        xy = obj.get("pitch_xy_m")
        if not xy or not obj.get("is_on_pitch", True):
            continue
        rx, ry = p2r(xy[0], xy[1])
        oid = obj.get("id")
        if cid == 0:
            color, r, role = BALL_WHITE, 4, None
        elif oid == passer:
            color, r, role = PASSER_BLUE, 7, "P"
        elif oid == receiv:
            color, r, role = RECEIVER_PURPLE, 7, "R"
        elif oid == penu_d:
            color, r, role = DEFENDER_YELLOW, 7, "D"
        elif oid in offids:
            color, r, role = OFFSIDE_RED, 7, None
        elif obj.get("team_id") == def_team:
            color, r, role = DEFENDER_WHITE, 6, None
        else:
            color, r, role = ONSIDE_GREEN, 6, None
        cv2.circle(radar, (rx, ry), r, color, -1, cv2.LINE_AA)
        cv2.circle(radar, (rx, ry), r, (0,0,0), 1, cv2.LINE_AA)
        if role:
            cv2.putText(radar, role, (rx-4, ry+4),
                        cv2.FONT_HERSHEY_DUPLEX, 0.3, (10,10,10), 1)

    cv2.putText(radar, "RADAR", (pad, pad-5),
                cv2.FONT_HERSHEY_DUPLEX, 0.42, (100,160,100), 1)
    return radar


# ══════════════════════════════════════════════════════════════════════════════
# VAR Side-On Panel
# ══════════════════════════════════════════════════════════════════════════════

def draw_var_panel(pw, ph, objects, ev, all_events, current_frame_id):
    panel  = np.full((ph, pw, 3), PANEL_BG, dtype=np.uint8)
    viz    = ev.get("visualization", {})
    penu_x = ev.get("defensive_line",{}).get("penultimate_x")
    penu_d_id = ev.get("defensive_line",{}).get("penultimate_defender_id")
    last_d_id = ev.get("defensive_line",{}).get("last_defender_id")
    attack_dir = ev.get("teams",{}).get("attack_dir", 1)
    def_team   = ev.get("teams",{}).get("defending_team", 1)
    offids     = set(viz.get("highlight_player_ids", []))
    passer     = viz.get("passer_id")
    receiv     = viz.get("receiver_id")
    ball_p     = viz.get("ball_at_pass_xy_m")
    margins    = {p["id"]: p.get("margin_m") for p in ev.get("offside_players",[])}
    conf       = ev.get("decision",{}).get("confidence", 0)
    rel        = ev.get("reliability",{}).get("overall", 0)

    if penu_x is None:
        cv2.putText(panel, "No defender line data", (20, ph//2),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (80,80,80), 1)
        return panel

    x_range = 12.0
    x_min   = penu_x - x_range
    x_max   = penu_x + x_range

    pad_x = 44; pad_y = 32
    dw = pw - 2*pad_x
    dh = ph - pad_y - 56   # 56 for bottom info + timeline

    def px_of(xm):
        return int(pad_x + (xm - x_min) / (x_max - x_min) * dw)

    line_px = px_of(penu_x)
    mid_y   = pad_y + dh // 2

    # pitch background
    cv2.rectangle(panel, (pad_x, pad_y), (pad_x+dw, pad_y+dh), (22, 82, 22), -1)
    for i in range(1, 6):
        y = pad_y + i*dh//6
        cv2.line(panel, (pad_x, y), (pad_x+dw, y), (32, 100, 32), 1)

    # offside zone
    if attack_dir == +1:
        zpts = np.array([(line_px,pad_y),(pad_x+dw,pad_y),
                         (pad_x+dw,pad_y+dh),(line_px,pad_y+dh)], np.int32)
    else:
        zpts = np.array([(pad_x,pad_y),(line_px,pad_y),
                         (line_px,pad_y+dh),(pad_x,pad_y+dh)], np.int32)
    ov = panel.copy()
    cv2.fillPoly(ov, [zpts], (0,0,130))
    cv2.addWeighted(ov, 0.35, panel, 0.65, 0, panel)

    # glow + line
    ov = panel.copy()
    cv2.line(ov, (line_px, pad_y-4), (line_px, pad_y+dh+4), LINE_COLOR, 10)
    cv2.addWeighted(ov, 0.38, panel, 0.62, 0, panel)
    cv2.line(panel, (line_px, pad_y-4), (line_px, pad_y+dh+4), LINE_COLOR, 3)
    cv2.line(panel, (line_px, pad_y-4), (line_px, pad_y+dh+4), (255,255,210), 1)
    cv2.putText(panel, "OFFSIDE LINE", (line_px-44, pad_y-8),
                cv2.FONT_HERSHEY_DUPLEX, 0.35, LINE_COLOR, 1)

    # ball at pass moment
    if ball_p is not None:
        bpx = px_of(ball_p[0])
        if pad_x <= bpx <= pad_x+dw:
            cv2.circle(panel, (bpx, mid_y+dh//3), 8, BALL_PASS_COLOR, 2, cv2.LINE_AA)
            cv2.circle(panel, (bpx, mid_y+dh//3), 4, BALL_WHITE, -1, cv2.LINE_AA)
            cv2.putText(panel, "BALL", (bpx-12, mid_y+dh//3+20),
                        cv2.FONT_HERSHEY_DUPLEX, 0.3, BALL_PASS_COLOR, 1)

    # players
    torso_h = dh // 5
    torso_w = 11
    head_r  = 8

    for obj in objects:
        cid = obj.get("class_id")
        if cid not in [1, 2]:
            continue
        xy = obj.get("pitch_xy_m")
        if not xy or not obj.get("is_on_pitch", True):
            continue
        xm = xy[0]
        if xm < x_min - 1 or xm > x_max + 1:
            continue
        oid = obj.get("id")
        ppx = px_of(xm)

        if oid == passer:
            color, role = PASSER_BLUE, "P"
        elif oid == receiv:
            color, role = RECEIVER_PURPLE, "R"
        elif oid == penu_d_id:
            color, role = DEFENDER_YELLOW, "D2"
        elif oid == last_d_id:
            color, role = DEFENDER_WHITE, "D1"
        elif oid in offids:
            color, role = OFFSIDE_RED, None
        elif obj.get("team_id") == def_team:
            color, role = DEFENDER_WHITE, None
        else:
            color, role = ONSIDE_GREEN, None

        py_feet = mid_y + torso_h
        py_head = mid_y - torso_h//2

        # shadow
        cv2.ellipse(panel, (ppx, py_feet+4), (torso_w+2, 4), 0, 0, 360, (8,25,8), -1)
        # torso
        cv2.ellipse(panel, (ppx, mid_y), (torso_w, torso_h), 0, 0, 360,
                    color, -1, cv2.LINE_AA)
        cv2.ellipse(panel, (ppx, mid_y), (torso_w, torso_h), 0, 0, 360,
                    (255,255,255), 1, cv2.LINE_AA)
        # head
        cv2.circle(panel, (ppx, py_head-head_r), head_r, color, -1, cv2.LINE_AA)
        cv2.circle(panel, (ppx, py_head-head_r), head_r, (255,255,255), 1, cv2.LINE_AA)
        # role badge
        if role:
            cv2.putText(panel, role, (ppx-8, mid_y+5),
                        cv2.FONT_HERSHEY_DUPLEX, 0.32, (10,10,10), 1, cv2.LINE_AA)
        # ID
        lbl = f"#{oid}"
        (tw,_),_ = cv2.getTextSize(lbl, cv2.FONT_HERSHEY_DUPLEX, 0.38, 1)
        cv2.putText(panel, lbl, (ppx-tw//2, py_feet+20),
                    cv2.FONT_HERSHEY_DUPLEX, 0.38, (220,220,220), 1, cv2.LINE_AA)

        # margin arrow for offside players
        if oid in offids and oid in margins and margins[oid] is not None:
            m = margins[oid]
            ay = py_head - head_r - 16
            cv2.arrowedLine(panel, (ppx, ay), (line_px, ay),
                            LINE_COLOR, 2, cv2.LINE_AA, tipLength=0.12)
            cv2.arrowedLine(panel, (line_px, ay), (ppx, ay),
                            LINE_COLOR, 2, cv2.LINE_AA, tipLength=0.12)
            mid_arrow = (ppx + line_px)//2
            mlbl = f"{abs(m)*100:.0f}cm"
            (mw,_),_ = cv2.getTextSize(mlbl, cv2.FONT_HERSHEY_DUPLEX, 0.44, 1)
            cv2.rectangle(panel, (mid_arrow-mw//2-3, ay-16),
                          (mid_arrow+mw//2+3, ay-2), (18,18,18), -1)
            cv2.putText(panel, mlbl, (mid_arrow-mw//2, ay-4),
                        cv2.FONT_HERSHEY_DUPLEX, 0.44, LINE_COLOR, 1, cv2.LINE_AA)

    # penultimate defender label
    if penu_d_id is not None:
        cv2.putText(panel, f"2nd-last: #{penu_d_id}", (pad_x, pad_y-8),
                    cv2.FONT_HERSHEY_DUPLEX, 0.36, DEFENDER_YELLOW, 1)

    # X-axis labels
    for off in [-8, -4, 0, 4, 8]:
        xm2 = penu_x + off
        if 0 <= xm2 <= PITCH_LENGTH_M:
            lxp = px_of(xm2)
            cv2.line(panel, (lxp, pad_y+dh), (lxp, pad_y+dh+5), (70,70,70), 1)
            lt = f"{off:+d}m" if off != 0 else "LINE"
            cv2.putText(panel, lt, (lxp-12, pad_y+dh+16),
                        cv2.FONT_HERSHEY_DUPLEX, 0.30, (90,90,90), 1)

    # header
    badge = viz.get("badge","—")
    bcol  = OFFSIDE_RED if badge == "OFFSIDE" else ONSIDE_GREEN
    cv2.putText(panel, "VAR ANALYSIS", (pad_x, 22),
                cv2.FONT_HERSHEY_DUPLEX, 0.52, (130,190,130), 1)
    cv2.putText(panel, badge, (pw-155, 22),
                cv2.FONT_HERSHEY_DUPLEX, 0.64, bcol, 2)

    # info strip
    info_y = pad_y + dh + 34
    info = (f"Conf:{conf*100:.0f}%  Rel:{rel*100:.0f}%  "
            f"Pass:#{passer}  Recv:#{receiv}  "
            f"Def:#{penu_d_id}")
    cv2.putText(panel, info, (pad_x, info_y),
                cv2.FONT_HERSHEY_DUPLEX, 0.33, (120,155,120), 1)

    # event timeline
    _draw_timeline(panel, all_events, current_frame_id,
                   0, ph-18, pw, 18)

    return panel


def _draw_timeline(panel, all_events, current_fid, tx, ty, tw, th):
    """يرسم شريط events في أسفل الـ panel."""
    cv2.rectangle(panel, (tx, ty), (tx+tw, ty+th), (10,10,10), -1)
    if not all_events:
        return

    event_list = sorted(all_events.values(), key=lambda e: e["time"]["frame_id"])
    total_frames = max(e["time"]["frame_id"] for e in event_list) + 1
    if total_frames == 0:
        return

    for i, ev in enumerate(event_list):
        fid  = ev["time"]["frame_id"]
        xp   = int(tx + (fid / total_frames) * tw)
        is_off = ev.get("decision",{}).get("is_offside", False)
        col  = OFFSIDE_RED if is_off else ONSIDE_GREEN
        cv2.circle(panel, (xp, ty+th//2), 4, col, -1)
        t_sec = ev["time"].get("pass_sec", 0)
        cv2.putText(panel, f"{t_sec:.1f}s", (xp-10, ty+th-2),
                    cv2.FONT_HERSHEY_DUPLEX, 0.25, col, 1)

    # current position
    cur_x = int(tx + (current_fid / total_frames) * tw)
    cv2.line(panel, (cur_x, ty), (cur_x, ty+th), (200,200,200), 1)

    # event counter
    total_ev = len(event_list)
    cv2.putText(panel, f"Events: {total_ev}", (tx+tw-80, ty+th-2),
                cv2.FONT_HERSHEY_DUPLEX, 0.27, (120,120,120), 1)


# ══════════════════════════════════════════════════════════════════════════════
# Composite
# ══════════════════════════════════════════════════════════════════════════════

def build_composite(camera_frame, objects, ev, panel_h, all_events, frame_id):
    h, w     = camera_frame.shape[:2]
    radar_w  = int(w * RADAR_W_RATIO)
    var_w    = w - radar_w - 3

    radar = draw_radar_panel(radar_w, panel_h, objects, ev)
    var   = draw_var_panel(var_w, panel_h, objects, ev, all_events, frame_id)
    sep   = np.full((panel_h, 3, 3), (50,70,50), dtype=np.uint8)
    belt  = np.full((4, w, 3), (35,55,35), dtype=np.uint8)
    bottom = np.hstack([radar, sep, var])
    return np.vstack([camera_frame, belt, bottom])


def build_idle_composite(camera_frame, panel_h, all_events, frame_id):
    h, w = camera_frame.shape[:2]
    idle = np.full((panel_h, w, 3), (10,14,10), dtype=np.uint8)
    cv2.putText(idle, f"Frame {frame_id}  |  Events: {len(all_events)}",
                (20, panel_h//2), cv2.FONT_HERSHEY_DUPLEX, 0.48, (40,60,40), 1)
    # mini timeline even in idle
    if all_events:
        _draw_timeline(idle, all_events, frame_id, 0, panel_h-22, w, 22)
    belt = np.full((4, w, 3), (35,55,35), dtype=np.uint8)
    return np.vstack([camera_frame, belt, idle])


# ══════════════════════════════════════════════════════════════════════════════
# NDJSON
# ══════════════════════════════════════════════════════════════════════════════

def load_ndjson(path):
    result = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                pkt = json.loads(line)
                result[pkt["frame_id"]] = pkt
            except Exception:
                pass
    return result


def normalize_event(ev):
    """
    يقبل event v2 الجديد، أو event قديم flat، ويرجّع event بنفس الـ contract
    اللي الرسم محتاجه. ده fallback آمن عشان الـ visualizer ما يقعش لو consumer قديم
    بعت event ناقص.
    """
    if not isinstance(ev, dict):
        return ev

    frame_id = ev.get("frame_id", ev.get("event_frame_id", 0))
    timestamp = ev.get("timestamp_sec", ev.get("event_timestamp_sec", 0.0))
    freeze_frame_id = ev.get("freeze_frame_id", frame_id)
    freeze_ts = ev.get("freeze_timestamp_sec", timestamp)

    # time
    ev.setdefault("time", {})
    ev["time"].setdefault("frame_id", frame_id)
    ev["time"].setdefault("timestamp_sec", timestamp)
    ev["time"].setdefault("event_sec", timestamp)
    ev["time"].setdefault("pass_frame_id", freeze_frame_id)
    ev["time"].setdefault("pass_sec", freeze_ts)
    ev["time"].setdefault("freeze_frame_id", freeze_frame_id)
    ev["time"].setdefault("freeze_sec", freeze_ts)

    # decision
    is_offside = ev.get("is_offside", ev.get("offside_position", False))
    prob = ev.get("offside_probability", ev.get("confidence", 0.0))
    ev.setdefault("decision", {})
    ev["decision"].setdefault("is_offside", bool(is_offside))
    ev["decision"].setdefault("offside_position", bool(is_offside))
    ev["decision"].setdefault("confidence", prob)
    ev["decision"].setdefault("probability", prob)
    ev["decision"].setdefault("risk", ev.get("risk_level", ev.get("review_priority", "HIGH")))

    # teams
    ev.setdefault("teams", {})
    ev["teams"].setdefault("attacking_team", ev.get("attacking_team"))
    ev["teams"].setdefault("defending_team", ev.get("defending_team"))
    ev["teams"].setdefault("attack_dir", ev.get("attack_dir", 1))

    # defensive line
    ev.setdefault("defensive_line", {})
    ev["defensive_line"].setdefault("penultimate_x", ev.get("penultimate_x"))
    ev["defensive_line"].setdefault("penultimate_defender_id", ev.get("penultimate_defender_id"))
    ev["defensive_line"].setdefault("last_defender_id", ev.get("last_defender_id"))
    ev["defensive_line"].setdefault("last_defender_x", ev.get("last_defender_x"))

    # visualization
    receiver_id = ev.get("receiver_id")
    passer_id = ev.get("passer_id")
    ball_xy = ev.get("ball_xy_m")
    offside_players = ev.get("offside_players") or ev.get("players") or []
    highlight_ids = []
    for pl in offside_players:
        if isinstance(pl, dict) and pl.get("id") is not None:
            highlight_ids.append(pl.get("id"))
    if not highlight_ids and receiver_id is not None:
        highlight_ids = [receiver_id]

    ev.setdefault("visualization", {})
    ev["visualization"].setdefault("badge", "OFFSIDE" if bool(is_offside) else "ON-SIDE")
    ev["visualization"].setdefault("highlight_player_ids", highlight_ids)
    ev["visualization"].setdefault("passer_id", passer_id)
    ev["visualization"].setdefault("receiver_id", receiver_id)
    ev["visualization"].setdefault("penultimate_defender_id", ev["defensive_line"].get("penultimate_defender_id"))
    ev["visualization"].setdefault("last_defender_id", ev["defensive_line"].get("last_defender_id"))
    ev["visualization"].setdefault("ball_at_pass_xy_m", ball_xy)
    ev["visualization"].setdefault("receiver_xy_m", ev.get("receiver_xy_m"))

    # offside_players unified
    if "offside_players" not in ev:
        ev["offside_players"] = []
        for pl in offside_players:
            if not isinstance(pl, dict):
                continue
            ev["offside_players"].append({
                "id": pl.get("id"),
                "pitch_xy_m": pl.get("pitch_xy_m", ev.get("receiver_xy_m")),
                "margin_m": pl.get("margin_m", ev.get("margin_m")),
                "confidence": pl.get("confidence", prob),
            })

    ev.setdefault("reliability", {})
    ev["reliability"].setdefault("overall", prob)
    return ev


# ══════════════════════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════════════════════

def run(source_video_path, output_video_path, ndjson_path,
        job_id, redis_host="localhost", redis_port=6379,
        show_onside=False, always_show_panel=False):

    r = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)
    r.ping()
    print(f"[VIZ] Redis | job={job_id} | show_onside={show_onside}")

    # homography
    H = None
    print("[VIZ] Waiting for homography…")
    for _ in range(60):
        H = load_homography(r, job_id)
        if H is not None:
            break
        time.sleep(1.0)
    if H is None:
        raise RuntimeError("No homography — run Vision Core first")
    H_inv = np.linalg.inv(H)
    print("[VIZ] Homography ready.")

    # live events poll
    offside_key     = f"events:{job_id}:offside"
    offside_last_id = "0"
    all_events      = {}

    def poll():
        nonlocal offside_last_id
        try:
            entries = r.xread({offside_key: offside_last_id}, count=50, block=1)
            if entries:
                for _, messages in entries:
                    for mid, fields in messages:
                        offside_last_id = mid
                        ev = normalize_event(json.loads(fields["data"]))
                        fid = ev.get("time",{}).get("frame_id",
                              ev.get("frame_id", 0))
                        all_events[fid] = ev
        except Exception as e:
            print(f"[VIZ] Event poll warning: {e}")

    poll()
    print(f"[VIZ] Loaded {len(all_events)} events.")

    frames_data = load_ndjson(ndjson_path)
    print(f"[VIZ] Loaded {len(frames_data)} NDJSON frames.")

    video_info = sv.VideoInfo.from_video_path(source_video_path)
    cap        = cv2.VideoCapture(source_video_path)
    panel_h    = int(video_info.height * PANEL_H_RATIO)
    out_h      = video_info.height + 4 + panel_h
    out_w      = video_info.width

    out = cv2.VideoWriter(
        output_video_path,
        cv2.VideoWriter_fourcc(*"mp4v"),
        video_info.fps,
        (out_w, out_h),
    )
    print(f"[VIZ] Writing → {output_video_path}  ({out_w}×{out_h})")

    overlay_ctr = 0
    current_ev  = None
    line_pts    = None
    zone_poly   = None
    frame_id    = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frame_id += 1
        poll()

        # new event?
        if frame_id in all_events:
            ev = all_events[frame_id]
            is_off = ev.get("decision",{}).get("is_offside", False)
            if is_off or show_onside:
                current_ev  = ev
                overlay_ctr = SHOW_TOTAL
                penu_x = ev.get("defensive_line",{}).get("penultimate_x", 60)
                adir   = ev.get("teams",{}).get("attack_dir", 1)
                line_pts  = build_line_pts(H_inv, penu_x)
                zone_poly = build_zone_poly(H_inv, penu_x, adir) if is_off else None

        pkt     = frames_data.get(frame_id, {})
        objects = pkt.get("objects", [])

        if overlay_ctr > 0 and current_ev is not None:
            elapsed = SHOW_TOTAL - overlay_ctr
            if elapsed < FADE_IN:
                alpha = elapsed / FADE_IN
            elif overlay_ctr < FADE_OUT:
                alpha = overlay_ctr / FADE_OUT
            else:
                alpha = 1.0

            frame = draw_camera_overlay(
                frame, line_pts, zone_poly, objects, current_ev, alpha)

            # ball at pass moment on camera
            ball_p = current_ev.get("visualization",{}).get("ball_at_pass_xy_m")
            draw_ball_pass_on_camera(frame, H_inv, ball_p, alpha)

            composite = build_composite(
                frame, objects, current_ev, panel_h, all_events, frame_id)

            overlay_ctr -= 1
        elif always_show_panel:
            composite = build_idle_composite(frame, panel_h, all_events, frame_id)
        else:
            # no panel
            belt      = np.full((4, out_w, 3), (35,55,35), dtype=np.uint8)
            idle_p    = np.full((panel_h, out_w, 3), (10,14,10), dtype=np.uint8)
            composite = np.vstack([frame, belt, idle_p])

        out.write(composite)
        if frame_id % 100 == 0:
            print(f"[VIZ] frame={frame_id} | events={len(all_events)}")

    cap.release()
    out.release()
    print(f"[VIZ] Done → {output_video_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Football AI — VAR Offside Visualizer v3")
    parser.add_argument("--source_video_path", required=True)
    parser.add_argument("--output_video_path", default="offside_var.mp4")
    parser.add_argument("--ndjson_path",       required=True)
    parser.add_argument("--job_id",            required=True)
    parser.add_argument("--redis_host",        default="localhost")
    parser.add_argument("--redis_port",        type=int, default=6379)
    parser.add_argument("--show_onside",       action="store_true",
                        help="اعرض ON-SIDE events كمان")
    parser.add_argument("--always_show_panel", action="store_true",
                        help="خلي الـ panel ظاهر دايمًا")
    args = parser.parse_args()
    run(args.source_video_path, args.output_video_path,
        args.ndjson_path, args.job_id,
        args.redis_host, args.redis_port,
        args.show_onside, args.always_show_panel)