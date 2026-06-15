"""
offside_assist.py  —  Offside Assistant Model (pass-first, production)
======================================================================
المنطق: مفيش أي حساب أوفسايد قبل ما باس حقيقي يكتمل.

Pipeline:
    packets → RingBuffer → BallFilter → PossessionTracker → PassFSM
            → (عند RECEIVED فقط) OffsideEvaluator على الـ freeze frame
            → ConfidenceGates → Dedup → Emit (Redis / JSON)

تشغيل offline (NDJSON replay):
    python offside_assist.py --ndjson match_v2.ndjson --job-id match_full_001 \
        --events-out offside_events.json [--labels labels.json]

تشغيل live (Redis stream):
    python offside_assist.py --redis redis://localhost:6379 \
        --stream vc:match_full_001:frames --job-id match_full_001

اتجاه الهجوم يدوي (لو حابب تتخطى التقدير الآلي):
    --attack-dir-override "0:+1,1:-1"     (team:dir)
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Optional

# ══════════════════════════════════════════════════════════════════════════════
# Config  —  كل الأرقام هنا، مفيش ثوابت مدفونة جوه الكود
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class Cfg:
    fps: float = 25.0

    # Pitch (مطابق للـ Vision Core: SoccerPitchConfiguration)
    pitch_x_max: float = 120.0
    pitch_y_max: float = 70.0

    # تجاهل بداية الماتش (الـ SquadIdRegistry بيقفل IDs بعد 30 ثانية)
    skip_initial_sec: float = 35.0

    # Ring buffer — لازم يغطي أطول باس محتمل + هامش
    buffer_sec: float = 8.0

    # ── Ball filter ──────────────────────────────────────────────────────────
    ball_max_speed_mps: float = 45.0
    ball_max_gap_sec: float = 1.2        # انقطاع أطول من كده = الـ track بيتقطع
    ball_speed_window: int = 4           # عينات كورة لحساب السرعة (مش raw frames)

    # ── Possession (hysteresis) ──────────────────────────────────────────────
    possession_take_radius_m: float = 1.6
    possession_keep_radius_m: float = 2.6
    possession_take_samples: int = 3     # عينات كورة متتالية لاكتساب الاستحواذ
    possession_max_ball_speed_mps: float = 8.0   # كورة أسرع من كده = طايرة، محدش "ماسكها"

    # ── Pass FSM ─────────────────────────────────────────────────────────────
    release_min_ball_speed_mps: float = 4.0
    release_speed_vs_passer: float = 2.0     # سرعة الكورة > 2x سرعة الـ passer
    release_separation_samples: int = 3      # المسافة من الـ passer تكبر كده مرات
    pass_min_dist_m: float = 3.0
    pass_max_dist_m: float = 60.0
    pass_long_threshold_m: float = 15.0
    receiver_radius_short_m: float = 4.0
    receiver_radius_long_m: float = 6.0
    receiver_touch_radius_m: float = 2.5    # لازم يقرب كده مرة واحدة على الأقل = لمسة فعلية
    receiver_stable_samples: int = 3
    receiver_min_track_history: int = 5      # ظهور اللاعيب قبل/بعد الحدث
    max_flight_sec: float = 4.0

    # ── Direction ────────────────────────────────────────────────────────────
    direction_window_sec: float = 120.0
    direction_min_samples: int = 40
    direction_min_confidence: float = 0.70

    # ── Offside gates ────────────────────────────────────────────────────────
    min_visible_defenders: int = 6       # في الـ freeze frame (شامل الحارس)
    require_gk_visible: bool = True
    gk_position_max_age_sec: float = 3.0 # لو الحارس مش في الفريم، آخر موقع له يصلح لو أحدث من كده
    max_homography_age_frames: int = 60  # -1 في الداتا = الحقل مش موجود → الـ gate يتعطل
    max_margin_m: float = 10.0
    margin_full_conf_m: float = 1.5      # margin أقل من كده الثقة فيه بتقل (noise baseline)

    # ── Emit policy ──────────────────────────────────────────────────────────
    min_emit_probability: float = 0.80
    very_high_threshold: float = 0.92
    medium_threshold: float = 0.60
    emit_medium_events: bool = False
    dedup_window_sec: float = 6.0
    clip_pad_before_sec: float = 5.0
    clip_pad_after_sec: float = 5.0

CFG = Cfg()

BALL_CLASS, GK_CLASS, PLAYER_CLASS, REF_CLASS = 0, 1, 2, 3


def dist(a, b) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


# ══════════════════════════════════════════════════════════════════════════════
# Packet parsing + Ring buffer
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class Frame:
    frame_id: int
    ts: float
    players: dict                    # id -> {"team", "cls", "xy", "conf"}
    ball_xy: Optional[list] = None
    ball_conf: Optional[float] = None
    is_detect_frame: Optional[bool] = None   # None = الحقل مش موجود في الداتا
    homography_age: int = -1
    fresh: bool = True               # محسوبة: مواقع جديدة فعلاً ولا cached


class RingBuffer:
    def __init__(self, cfg: Cfg):
        self.buf: deque[Frame] = deque()
        self.max_sec = cfg.buffer_sec

    def push(self, fr: Frame):
        self.buf.append(fr)
        while self.buf and fr.ts - self.buf[0].ts > self.max_sec:
            self.buf.popleft()

    def at_or_before(self, frame_id: int) -> Optional[Frame]:
        best = None
        for fr in self.buf:
            if fr.frame_id <= frame_id:
                best = fr
            else:
                break
        return best

    def fresh_at_or_before(self, frame_id: int) -> Optional[Frame]:
        best = None
        for fr in self.buf:
            if fr.frame_id <= frame_id and fr.fresh:
                best = fr
            elif fr.frame_id > frame_id:
                break
        return best


def parse_packet(pkt: dict, prev_positions_sig, stats) -> tuple[Frame, tuple]:
    players, ball_xy, ball_conf = {}, None, None
    for o in pkt.get("objects", []):
        cid = o.get("class_id")
        xy = o.get("pitch_xy_m") or o.get("pitch_xy")
        if xy is None:
            continue
        on = o.get("is_on_pitch", True)
        if cid == BALL_CLASS:
            if not on:
                stats["invalid_balls"] += 1
                continue
            ball_xy, ball_conf = [float(xy[0]), float(xy[1])], o.get("confidence")
        elif cid in (GK_CLASS, PLAYER_CLASS):
            if not on or o.get("id") is None:
                continue
            players[int(o["id"])] = {
                "team": o.get("team_id"),
                "cls": cid,
                "xy": [float(xy[0]), float(xy[1])],
                "conf": o.get("confidence"),
            }

    fr = Frame(
        frame_id=int(pkt["frame_id"]),
        ts=float(pkt["timestamp_sec"]),
        players=players,
        ball_xy=ball_xy,
        ball_conf=ball_conf,
        is_detect_frame=pkt.get("is_detect_frame"),
        homography_age=int(pkt.get("homography_age_frames", -1)),
    )

    # freshness: الحقل لو موجود، وإلا نكتشف الـ cached frames بتطابق المواقع
    sig = tuple(sorted((pid, p["xy"][0], p["xy"][1]) for pid, p in players.items()))
    if fr.is_detect_frame is not None:
        fr.fresh = bool(fr.is_detect_frame)
    else:
        fr.fresh = (sig != prev_positions_sig) or not players
    return fr, sig


# ══════════════════════════════════════════════════════════════════════════════
# Ball filter  —  عينات كورة نظيفة + سرعة على نافذة
# ══════════════════════════════════════════════════════════════════════════════

class BallFilter:
    """يحوّل كشوفات الكورة المتقطعة لـ track فيه سرعة. أي قفزة/انقطاع يكسر الـ track."""

    def __init__(self, cfg: Cfg, stats):
        self.cfg, self.stats = cfg, stats
        self.samples: deque = deque(maxlen=cfg.ball_speed_window + 2)  # (frame_id, ts, xy)
        self.track_broken_at: Optional[float] = None

    def update(self, fr: Frame) -> Optional[dict]:
        """يرجع {"xy","speed","ts","frame_id"} عند عينة كورة صالحة، وإلا None."""
        if fr.ball_xy is None:
            if self.samples and fr.ts - self.samples[-1][1] > self.cfg.ball_max_gap_sec:
                self._break_track(fr.ts)
            return None

        self.stats["valid_balls"] += 1
        if self.samples:
            lf, lt, lxy = self.samples[-1]
            dt = max(fr.ts - lt, 1e-3)
            if dt > self.cfg.ball_max_gap_sec:
                self._break_track(fr.ts)
            elif dist(fr.ball_xy, lxy) / dt > self.cfg.ball_max_speed_mps:
                self.stats["ball_jumps"] += 1
                self._break_track(fr.ts)

        self.samples.append((fr.frame_id, fr.ts, list(fr.ball_xy)))
        return {
            "xy": list(fr.ball_xy),
            "speed": self.speed(),
            "ts": fr.ts,
            "frame_id": fr.frame_id,
            "track_continuous": self.track_broken_at is None
                                 or fr.ts - self.track_broken_at > 0.6,
        }

    def _break_track(self, ts):
        self.samples.clear()
        self.track_broken_at = ts

    def speed(self) -> Optional[float]:
        if len(self.samples) < 2:
            return None
        pts = list(self.samples)[-self.cfg.ball_speed_window:]
        # displacement مش path-sum — الـ path-sum بيتضخم بالـ detection noise
        d = dist(pts[-1][2], pts[0][2])
        t = max(pts[-1][1] - pts[0][1], 1e-3)
        return d / t


# ══════════════════════════════════════════════════════════════════════════════
# Possession tracker  —  hysteresis
# ══════════════════════════════════════════════════════════════════════════════

class PossessionTracker:
    def __init__(self, cfg: Cfg):
        self.cfg = cfg
        self.holder_id: Optional[int] = None
        self.holder_team: Optional[int] = None
        self._candidate: Optional[int] = None
        self._candidate_count = 0

    def update(self, fr: Frame, ball: dict) -> dict:
        """يتنده بس عند عينة كورة صالحة."""
        closest_id, closest_d, closest_team = None, 1e9, None
        for pid, p in fr.players.items():
            d = dist(p["xy"], ball["xy"])
            if d < closest_d:
                closest_id, closest_d, closest_team = pid, d, p["team"]

        event = {"closest_id": closest_id, "closest_d": closest_d,
                 "closest_team": closest_team, "changed": False, "released": False,
                 "ball_flying": (ball["speed"] is not None
                                 and ball["speed"] > self.cfg.possession_max_ball_speed_mps)}

        if self.holder_id is not None:
            hp = fr.players.get(self.holder_id)
            hd = dist(hp["xy"], ball["xy"]) if hp else 1e9
            if hd > self.cfg.possession_keep_radius_m:
                event["released"] = True   # الكورة سابت صاحبها — الـ FSM يقرر باس ولا ضياع

        # اكتساب الاستحواذ ممنوع والكورة طايرة — كورة سريعة جنب لاعيب مش معناها إنه ماسكها
        if (not event["ball_flying"] and closest_id is not None
                and closest_d <= self.cfg.possession_take_radius_m):
            if closest_id == self._candidate:
                self._candidate_count += 1
            else:
                self._candidate, self._candidate_count = closest_id, 1
            if (self._candidate_count >= self.cfg.possession_take_samples
                    and closest_id != self.holder_id):
                self.holder_id, self.holder_team = closest_id, closest_team
                event["changed"] = True
        else:
            self._candidate, self._candidate_count = None, 0

        return event


# ══════════════════════════════════════════════════════════════════════════════
# Direction estimator  —  GK voting على نافذة منزلقة (بيتقلب مع الشوط التاني تلقائياً)
# ══════════════════════════════════════════════════════════════════════════════

class DirectionEstimator:
    def __init__(self, cfg: Cfg, override: Optional[dict] = None):
        self.cfg = cfg
        self.override = override or {}
        self.gk_x: dict[int, deque] = {0: deque(), 1: deque()}   # (ts, x)

    def observe(self, fr: Frame):
        for pid, p in fr.players.items():
            if p["cls"] == GK_CLASS and p["team"] in (0, 1):
                dq = self.gk_x[p["team"]]
                dq.append((fr.ts, p["xy"][0]))
                while dq and fr.ts - dq[0][0] > self.cfg.direction_window_sec:
                    dq.popleft()

    def get(self, team: int) -> tuple[Optional[int], float, str]:
        """(dir, confidence, source) — dir=+1 هجوم ناحية x الكبيرة."""
        if team in self.override:
            return self.override[team], 1.0, "manual"
        dq = self.gk_x.get(team)
        if dq and len(dq) >= self.cfg.direction_min_samples:
            mean_x = sum(x for _, x in dq) / len(dq)
            half = self.cfg.pitch_x_max / 2.0
            conf = min(abs(mean_x - half) / (self.cfg.pitch_x_max / 3.0), 1.0)
            d = 1 if mean_x < half else -1   # الحارس في النص الواطي → الهجوم ناحية العالي
            return d, conf, "gk"
        # fallback: الفريق التاني (اتجاهه المعاكس)
        other = 1 - team
        dq2 = self.gk_x.get(other)
        if dq2 and len(dq2) >= self.cfg.direction_min_samples:
            mean_x = sum(x for _, x in dq2) / len(dq2)
            half = self.cfg.pitch_x_max / 2.0
            conf = min(abs(mean_x - half) / (self.cfg.pitch_x_max / 3.0), 1.0) * 0.9
            d = -1 if mean_x < half else 1
            return d, conf, "gk_opponent"
        return None, 0.0, "unknown"


# ══════════════════════════════════════════════════════════════════════════════
# Pass FSM  —  قلب السيستم
# ══════════════════════════════════════════════════════════════════════════════

IDLE, POSSESSION, RELEASE, IN_FLIGHT = "IDLE", "POSSESSION", "RELEASE", "IN_FLIGHT"

class PassFSM:
    """
    IDLE → POSSESSION → RELEASE → IN_FLIGHT → received / rejected (يرجع IDLE)
    عند release مؤكد: freeze frame بيتسجل فوراً.
    """

    def __init__(self, cfg: Cfg, stats):
        self.cfg, self.stats = cfg, stats
        self.state = IDLE
        self.passer_id: Optional[int] = None
        self.passer_team: Optional[int] = None
        self.passer_xy: Optional[list] = None
        self.passer_speed: float = 0.0
        self._passer_prev: Optional[tuple] = None        # (ts, xy)
        self.freeze: Optional[dict] = None               # snapshot معلومات الـ release
        self.release_xy: Optional[list] = None
        self.release_ts: float = 0.0
        self._sep_count = 0
        self._last_sep_d = 0.0
        self._recv_candidate: Optional[int] = None
        self._recv_count = 0
        self._recv_min_d = 1e9

    def reset(self, reason: Optional[str] = None):
        if reason:
            self.stats[reason] += 1
            self.stats["rejected_passes"] += 1
        self.state = IDLE
        self.passer_id = self.passer_team = self.passer_xy = None
        self.freeze = self.release_xy = None
        self._sep_count = 0
        self._recv_candidate, self._recv_count = None, 0
        self._recv_min_d = 1e9
        self._passer_prev = None

    def update(self, fr: Frame, ball: dict, poss: dict) -> Optional[dict]:
        """يرجع confirmed pass dict عند الاكتمال، وإلا None. يتنده عند عينة كورة صالحة."""
        cfg = self.cfg

        # تتبع سرعة الـ passer
        if self.passer_id is not None:
            p = fr.players.get(self.passer_id)
            if p is not None:
                if self._passer_prev is not None:
                    pt, pxy = self._passer_prev
                    dt = fr.ts - pt
                    if dt > 0.05:
                        self.passer_speed = dist(p["xy"], pxy) / dt
                        self._passer_prev = (fr.ts, list(p["xy"]))
                else:
                    self._passer_prev = (fr.ts, list(p["xy"]))
                self.passer_xy = list(p["xy"])

        # ── IDLE / POSSESSION: استنى استحواذ واضح ─────────────────────────────
        if self.state in (IDLE, POSSESSION):
            if poss["changed"] or (self.state == IDLE
                                   and not poss["ball_flying"]
                                   and poss["closest_d"] is not None
                                   and poss["closest_d"] <= cfg.possession_take_radius_m
                                   and poss["closest_team"] in (0, 1)):
                self.passer_id = poss["closest_id"]
                self.passer_team = poss["closest_team"]
                p = fr.players.get(self.passer_id)
                self.passer_xy = list(p["xy"]) if p else None
                self._passer_prev = (fr.ts, list(p["xy"])) if p else None
                self.state = POSSESSION
            if self.state != POSSESSION or self.passer_team not in (0, 1):
                return None

            # release candidate: سرعة كورة عالية + بتبعد عن الـ passer
            bs = ball["speed"]
            if (poss["released"] and bs is not None
                    and bs >= max(cfg.release_min_ball_speed_mps,
                                  cfg.release_speed_vs_passer * self.passer_speed)
                    and ball.get("track_continuous", True)):
                self.stats["pass_candidates"] += 1
                self.state = RELEASE
                self.release_xy = list(ball["xy"])
                self.release_ts = ball["ts"]
                self._sep_count = 0
                self._last_sep_d = dist(ball["xy"], self.passer_xy) if self.passer_xy else 0.0
                self.freeze = {
                    "frame_id": ball["frame_id"],
                    "ts": ball["ts"],
                    "ball_xy": list(ball["xy"]),
                    "ball_speed": bs,
                }
            return None

        # ── RELEASE: تأكيد إن الكورة فعلاً سايبة الـ passer ───────────────────
        if self.state == RELEASE:
            if self.passer_xy is None:
                self.reset("rejected_no_ball_release"); return None
            d = dist(ball["xy"], self.passer_xy)
            if d > self._last_sep_d + 0.15:
                self._sep_count += 1
            elif d < self._last_sep_d - 1.0:
                # الكورة رجعت فعلاً للـ passer (مش مجرد noise) = dribble/touch مش باس
                self.reset("rejected_same_player_still_in_possession"); return None
            self._last_sep_d = d
            if self._sep_count >= self.cfg.release_separation_samples:
                # الانفصال اتأكد — الـ passer ممكن يفضل الأقرب لحظياً وده طبيعي
                self.state = IN_FLIGHT
            elif ball["ts"] - self.release_ts > 1.0:
                self.reset("rejected_no_ball_release")
            return None

        # ── IN_FLIGHT: استنى receiver مؤكد ────────────────────────────────────
        if self.state == IN_FLIGHT:
            if ball["ts"] - self.release_ts > self.cfg.max_flight_sec:
                self.reset("rejected_pass_too_long_without_receiver"); return None
            if not ball.get("track_continuous", True):
                self.reset("rejected_ball_jump"); return None

            cid, cd, cteam = poss["closest_id"], poss["closest_d"], poss["closest_team"]
            if cid is None or cid == self.passer_id:
                if cid == self.passer_id and cd <= self.cfg.possession_take_radius_m:
                    self.reset("rejected_same_player_still_in_possession")
                return None

            pass_d = dist(ball["xy"], self.release_xy)
            radius = (self.cfg.receiver_radius_long_m
                      if pass_d >= self.cfg.pass_long_threshold_m
                      else self.cfg.receiver_radius_short_m)

            if cd <= radius:
                if cid == self._recv_candidate:
                    self._recv_count += 1
                    self._recv_min_d = min(self._recv_min_d, cd)
                else:
                    self._recv_candidate, self._recv_count = cid, 1
                    self._recv_min_d = cd

                touch_ok = self._recv_min_d <= self.cfg.receiver_touch_radius_m
                # لمسة حقيقية لازم تغيّر حركة الكورة — كورة لسه طايرة بنفس السرعة = عدّت جنبه بس
                ball_settled = (ball["speed"] is not None
                                and ball["speed"] <= self.cfg.possession_max_ball_speed_mps)

                if (self._recv_count >= self.cfg.receiver_stable_samples
                        and not (touch_ok and ball_settled)):
                    # قريب بس عمره ما لمس فعلياً (كورة عدّت جنبه) — استنى أكتر
                    if ball["ts"] - self.release_ts > self.cfg.max_flight_sec:
                        self.reset("rejected_no_confirmed_receiver_touch")
                    return None

                if (self._recv_count >= self.cfg.receiver_stable_samples
                        and touch_ok and ball_settled):
                    # interception؟
                    if cteam != self.passer_team:
                        self.reset("rejected_not_real_pass"); return None
                    if pass_d < self.cfg.pass_min_dist_m:
                        self.reset("rejected_not_real_pass"); return None
                    if pass_d > self.cfg.pass_max_dist_m:
                        self.reset("rejected_pass_too_long_without_receiver"); return None
                    confirmed = {
                        "passer_id": self.passer_id,
                        "passer_team": self.passer_team,
                        "receiver_id": cid,
                        "receiver_d_to_ball": cd,
                        "freeze": dict(self.freeze),
                        "event_frame_id": ball["frame_id"],
                        "event_ts": ball["ts"],
                        "pass_dist": pass_d,
                        "pass_speed": (pass_d / max(ball["ts"] - self.release_ts, 1e-3)),
                        "receiver_stable_samples": self._recv_count,
                    }
                    self.stats["confirmed_passes"] += 1
                    # الـ receiver بيبقى الـ passer الجديد للهجمة الجاية
                    self.reset()
                    self.passer_id, self.passer_team = cid, cteam
                    p = fr.players.get(cid)
                    self.passer_xy = list(p["xy"]) if p else None
                    self.state = POSSESSION
                    return confirmed
            else:
                self._recv_candidate, self._recv_count = None, 0
            return None

        return None


# ══════════════════════════════════════════════════════════════════════════════
# Offside evaluator  —  كل الحسابات على الـ freeze frame
# ══════════════════════════════════════════════════════════════════════════════

class OffsideEvaluator:
    def __init__(self, cfg: Cfg, buffer: RingBuffer, direction: DirectionEstimator,
                 stats, track_history: dict):
        self.cfg, self.buf, self.dir = cfg, buffer, direction
        self.stats = stats
        self.track_history = track_history   # pid -> عدد الفريمات اللي اتشاف فيها

    def evaluate(self, p: dict) -> Optional[dict]:
        cfg = self.cfg
        atk = p["passer_team"]
        dfn = 1 - atk

        # ── Gate: receiver track history ─────────────────────────────────────
        if self.track_history.get(p["receiver_id"], 0) < cfg.receiver_min_track_history:
            self.stats["rejected_receiver_unstable"] += 1
            return None
        self.stats["receiver_found"] += 1

        # ── Freeze frame snapshot ─────────────────────────────────────────────
        fz = self.buf.fresh_at_or_before(p["freeze"]["frame_id"])
        if fz is None:
            self.stats["insufficient_data"] += 1
            return None

        # ── Gate: homography quality عند لحظة الـ freeze ──────────────────────
        if 0 <= cfg.max_homography_age_frames and fz.homography_age >= 0 \
                and fz.homography_age > cfg.max_homography_age_frames:
            self.stats["rejected_stale_homography"] += 1
            return None

        # ── Gate: direction ───────────────────────────────────────────────────
        adir, dconf, dsrc = self.dir.get(atk)
        if adir is None or dconf < cfg.direction_min_confidence:
            self.stats["unknown_direction"] += 1
            return None

        depth = (lambda x: x if adir == 1 else cfg.pitch_x_max - x)

        # ── Gate: receiver/ball موجودين في الـ freeze frame ───────────────────
        recv = fz.players.get(p["receiver_id"])
        if recv is None:
            self.stats["receiver_missing"] += 1
            self.stats["insufficient_data"] += 1
            return None
        ball_xy = fz.ball_xy or p["freeze"]["ball_xy"]

        # ── Defender line: المدافعين المرئيين + gate العدد + الحارس ───────────
        defenders = [(pid, pl) for pid, pl in fz.players.items() if pl["team"] == dfn]
        if len(defenders) < cfg.min_visible_defenders:
            self.stats["rejected_too_few_visible_defenders"] += 1
            return None

        gk_visible = any(pl["cls"] == GK_CLASS for _, pl in defenders)
        if cfg.require_gk_visible and not gk_visible:
            # broadcast camera: الحارس كتير برة الكادر — من غيره الـ line مش موثوق
            self.stats["rejected_gk_not_visible"] += 1
            return None

        depths = sorted((depth(pl["xy"][0]) for _, pl in defenders), reverse=True)
        second_last_depth = depths[1] if len(depths) >= 2 else depths[0]
        # penultimate_x بإحداثيات الملعب الحقيقية
        penultimate_x = (second_last_depth if adir == 1
                         else cfg.pitch_x_max - second_last_depth)

        r_depth = depth(recv["xy"][0])
        b_depth = depth(ball_xy[0])
        half_depth = cfg.pitch_x_max / 2.0

        in_opp_half = r_depth > half_depth
        ahead_of_ball = r_depth > b_depth
        ahead_of_line = r_depth > second_last_depth
        offside_position = in_opp_half and ahead_of_ball and ahead_of_line

        if not offside_position:
            self.stats["onside_skipped"] += 1
            return None

        margin = r_depth - second_last_depth
        if margin > cfg.max_margin_m:
            self.stats["rejected_unrealistic_margin"] += 1
            return None

        # ── Confidence breakdown ──────────────────────────────────────────────
        def clamp(v): return max(0.0, min(1.0, v))
        n_def_total = 11
        breakdown = {
            "ball": clamp(fz.ball_conf if fz.ball_conf is not None else 0.7),
            "pass": clamp(0.7 + 0.1 * min(p["receiver_stable_samples"], 3)),
            "receiver": clamp(1.0 - p["receiver_d_to_ball"] / 8.0),
            "direction": clamp(dconf),
            "defender_line": clamp(len(defenders) / n_def_total + (0.15 if gk_visible else -0.2)),
            "tracking_quality": clamp(self.track_history.get(p["receiver_id"], 0) / 50.0),
            "margin": clamp(margin / cfg.margin_full_conf_m),
            "possession_change": 0.95,
            "receiver_touch": clamp(1.0 - p["receiver_d_to_ball"] / 6.0),
        }
        weights = {
            "ball": 0.08, "pass": 0.16, "receiver": 0.16, "direction": 0.10,
            "defender_line": 0.18, "tracking_quality": 0.08, "margin": 0.14,
            "possession_change": 0.05, "receiver_touch": 0.05,
        }
        log_p = sum(w * math.log(max(breakdown[k], 1e-3)) for k, w in weights.items())
        probability = round(math.exp(log_p / sum(weights.values())), 3)

        if probability >= cfg.very_high_threshold:
            risk = "VERY_HIGH"
        elif probability >= cfg.min_emit_probability:
            risk = "HIGH"
        elif probability >= cfg.medium_threshold:
            risk = "MEDIUM"
        else:
            risk = "LOW"
        self.stats[f"risk_{risk}"] += 1

        if probability < cfg.min_emit_probability:
            if risk == "MEDIUM":
                self.stats["medium_risk_skipped"] += 1
            else:
                self.stats["low_risk_skipped"] += 1
            return None

        return {
            "probability": probability,
            "risk": risk,
            "margin": round(margin, 2),
            "penultimate_x": round(penultimate_x, 2),
            "ball_xy": [round(ball_xy[0], 2), round(ball_xy[1], 2)],
            "receiver_xy": [round(recv["xy"][0], 2), round(recv["xy"][1], 2)],
            "receiver_conf": recv.get("conf"),
            "attack_dir": adir,
            "dir_source": dsrc,
            "breakdown": breakdown,
            "freeze_frame_id": fz.frame_id,
            "freeze_ts": fz.ts,
            "n_visible_defenders": len(defenders),
            "gk_visible": gk_visible,
        }


# ══════════════════════════════════════════════════════════════════════════════
# Dedup + Emitter
# ══════════════════════════════════════════════════════════════════════════════

RISK_ORDER = {"HIGH": 1, "VERY_HIGH": 2}

class Emitter:
    def __init__(self, cfg: Cfg, job_id: str, stats, redis_client=None,
                 events_out: Optional[str] = None):
        self.cfg, self.job_id, self.stats = cfg, job_id, stats
        self.r = redis_client
        self.events_out = events_out
        self.events: list[dict] = []
        self._recent: list[dict] = []    # للـ dedup

    def emit(self, p: dict, ev: dict):
        # ── Dedup: نفس الفريق + نفس الـ receiver (أو نفس الهجمة) جوه النافذة ──
        key_team, key_recv, ts = p["passer_team"], p["receiver_id"], p["event_ts"]
        for old in self._recent:
            # هجمة واحدة (نفس الفريق جوه النافذة) = event واحد، حتى لو الـ receiver اتغير
            if (ts - old["ts"] <= self.cfg.dedup_window_sec
                    and old["team"] == key_team):
                if (RISK_ORDER[ev["risk"]], ev["probability"]) > (RISK_ORDER[old["risk"]], old["prob"]):
                    self.events.remove(old["event"])    # الأقوى يفوز
                    self._recent.remove(old)
                    break
                else:
                    self.stats["events_deduped"] += 1
                    return

        event = self._build(p, ev)
        self.events.append(event)
        self._recent.append({"ts": ts, "team": key_team, "receiver": key_recv,
                             "risk": ev["risk"], "prob": ev["probability"], "event": event})
        self._recent = [o for o in self._recent if ts - o["ts"] <= self.cfg.dedup_window_sec]
        self.stats["events_emitted"] += 1

        if self.r is not None:
            try:
                self.r.xadd(f"events:{self.job_id}:offside",
                            {"data": json.dumps(event)})
            except Exception as e:
                print(f"[OFFSIDE] Redis emit failed: {e}", file=sys.stderr)
        print(f"[OFFSIDE_ASSIST] frame={event['frame_id']} "
              f"t={event['timestamp_sec']:.2f}s prob={event['offside_probability']} "
              f"risk={event['risk_level']} margin={event['margin_m']}m "
              f"passer={event['passer_id']} receiver={event['receiver_id']}")

    def _build(self, p: dict, ev: dict) -> dict:
        cfg = self.cfg
        recv_conf = ev.get("receiver_conf") or 0.75
        return {
            "job_id": self.job_id,
            "type": "offside_assist",
            "frame_id": p["event_frame_id"],
            "timestamp_sec": p["event_ts"],
            "attacking_team": p["passer_team"],
            "defending_team": 1 - p["passer_team"],
            "passer_id": p["passer_id"],
            "receiver_id": p["receiver_id"],
            "offside_position": True,
            "offside_probability": ev["probability"],
            "risk_level": ev["risk"],
            "recommendation": ("REVIEW_REQUIRED" if ev["risk"] == "VERY_HIGH" else "REVIEW"),
            "not_final_decision": True,
            "margin_m": ev["margin"],
            "penultimate_x": ev["penultimate_x"],
            "ball_xy_m": ev["ball_xy"],
            "receiver_xy_m": ev["receiver_xy"],
            "attack_dir": ev["attack_dir"],
            "confidence_breakdown": {k: round(v, 3) for k, v in ev["breakdown"].items()},
            "reason": (f"receiver ahead of ball and second-last defender "
                       f"by {ev['margin']}m"),
            "display_label": "Possible Offside",
            "display_confidence": f"{int(ev['probability'] * 100)}%",
            "review_priority": ev["risk"],
            "freeze_frame_id": ev["freeze_frame_id"],
            "freeze_timestamp_sec": round(ev["freeze_ts"], 2),
            "event_frame_id": p["event_frame_id"],
            "event_timestamp_sec": p["event_ts"],
            "clip_start_sec": round(max(ev["freeze_ts"] - cfg.clip_pad_before_sec, 0), 2),
            "clip_end_sec": round(p["event_ts"] + cfg.clip_pad_after_sec, 2),
            "suggested_clip_name": f"possible_offside_{p['event_frame_id']}.mp4",
            # ── backward compatibility مع الـ visualizer ──────────────────────
            "is_offside": True,
            "players": [{
                "id": p["receiver_id"],
                "pitch_xy_m": ev["receiver_xy"],
                "defender_line_x": ev["penultimate_x"],
                "margin_m": ev["margin"],
                "confidence": round(recv_conf, 3),
            }],
            "confidence": round(recv_conf, 3),
            "debug": {
                "attack_dir_source": ev["dir_source"],
                "pass_speed_mps": round(p["pass_speed"], 2),
                "pass_dist_m": round(p["pass_dist"], 2),
                "n_visible_defenders": ev["n_visible_defenders"],
                "gk_visible": ev["gk_visible"],
                "decision_reason": "assist_confidence_scoring",
                "raw_is_offside_boolean": True,
                "pass_validation": {
                    "passer_released_ball": True,
                    "receiver_became_closest": True,
                    "receiver_touch_confirmed": True,
                    "same_team_receiver": True,
                    "receiver_stable_frames": p["receiver_stable_samples"],
                },
            },
        }

    def flush(self):
        if self.events_out:
            with open(self.events_out, "w", encoding="utf-8") as f:
                json.dump(self.events, f, ensure_ascii=False, indent=2)
            print(f"[OFFSIDE] {len(self.events)} events → {self.events_out}")


# ══════════════════════════════════════════════════════════════════════════════
# Engine  —  بيربط كل حاجة
# ══════════════════════════════════════════════════════════════════════════════

class OffsideEngine:
    def __init__(self, cfg: Cfg, job_id: str, redis_client=None,
                 events_out: Optional[str] = None,
                 dir_override: Optional[dict] = None):
        self.cfg = cfg
        self.stats = defaultdict(int)
        self.buffer = RingBuffer(cfg)
        self.ball = BallFilter(cfg, self.stats)
        self.poss = PossessionTracker(cfg)
        self.direction = DirectionEstimator(cfg, dir_override)
        self.fsm = PassFSM(cfg, self.stats)
        self.track_history: dict[int, int] = defaultdict(int)
        self.evaluator = OffsideEvaluator(
            cfg, self.buffer, self.direction, self.stats, self.track_history)
        self.emitter = Emitter(cfg, job_id, self.stats, redis_client, events_out)
        self._prev_sig: tuple = ()

    def process_packet(self, pkt: dict):
        self.stats["frames_read"] += 1
        try:
            fr, sig = parse_packet(pkt, self._prev_sig, self.stats)
        except (KeyError, TypeError, ValueError):
            self.stats["bad_packets"] += 1
            return
        self._prev_sig = sig

        if fr.ts < self.cfg.skip_initial_sec:
            self.stats["skipped_init_window"] += 1
            return

        self.buffer.push(fr)
        if fr.fresh:
            for pid in fr.players:
                self.track_history[pid] += 1
            self.direction.observe(fr)

        ball = self.ball.update(fr)
        if ball is None:
            return

        poss_event = self.poss.update(fr, ball)
        confirmed = self.fsm.update(fr, ball, poss_event)
        if confirmed is None:
            return

        result = self.evaluator.evaluate(confirmed)
        if result is not None:
            self.emitter.emit(confirmed, result)

    def print_eval(self):
        order = [
            "frames_read", "bad_packets", "skipped_init_window",
            "valid_balls", "invalid_balls", "ball_jumps",
            "pass_candidates", "confirmed_passes", "rejected_passes",
            "receiver_found", "receiver_missing", "onside_skipped",
            "risk_LOW", "risk_MEDIUM", "risk_HIGH", "risk_VERY_HIGH",
            "events_emitted", "events_deduped",
            "unknown_direction", "insufficient_data",
            "rejected_unrealistic_margin", "medium_risk_skipped", "low_risk_skipped",
            "rejected_not_real_pass", "rejected_same_player_still_in_possession",
            "rejected_no_ball_release", "rejected_no_confirmed_receiver_touch",
            "rejected_receiver_not_closest", "rejected_receiver_unstable",
            "rejected_ball_jump", "rejected_pass_too_long_without_receiver",
            "rejected_stale_homography", "rejected_too_few_visible_defenders",
            "rejected_gk_not_visible",
        ]
        for k in order:
            print(f"[OFFSIDE][EVAL] {k}={self.stats.get(k, 0)}")
        for k in sorted(self.stats):
            if k not in order:
                print(f"[OFFSIDE][EVAL] {k}={self.stats[k]}")


# ══════════════════════════════════════════════════════════════════════════════
# Ground-truth comparison (offline)
# ══════════════════════════════════════════════════════════════════════════════

def compare_labels(events: list[dict], labels_path: str, tol_sec: float = 5.0):
    with open(labels_path, encoding="utf-8") as f:
        labels = json.load(f)
    truths = [l for l in labels if l.get("label") is True]
    falses = [l for l in labels if l.get("label") is False]

    def near(ts, items):
        return any(abs(ts - l["timestamp_sec"]) <= tol_sec for l in items)

    tp = sum(1 for l in truths if any(abs(e["event_timestamp_sec"] - l["timestamp_sec"]) <= tol_sec for e in events))
    fn = len(truths) - tp
    fp_known = sum(1 for e in events if near(e["event_timestamp_sec"], falses))
    unmatched = sum(1 for e in events
                    if not near(e["event_timestamp_sec"], truths)
                    and not near(e["event_timestamp_sec"], falses))

    print("\n[OFFSIDE][GT] ════════ Ground-truth comparison ════════")
    print(f"[OFFSIDE][GT] true offsides labeled : {len(truths)}")
    print(f"[OFFSIDE][GT] detected (TP)         : {tp}")
    print(f"[OFFSIDE][GT] missed   (FN)         : {fn}")
    print(f"[OFFSIDE][GT] known-FP re-emitted   : {fp_known}   ← لازم تبقى 0")
    print(f"[OFFSIDE][GT] new unlabeled events  : {unmatched}  ← راجعهم بصرياً وضيفهم للـ labels")
    if truths:
        print(f"[OFFSIDE][GT] recall               : {tp / len(truths):.2f}")


# ══════════════════════════════════════════════════════════════════════════════
# Entry point
# ══════════════════════════════════════════════════════════════════════════════

def parse_override(s: Optional[str]) -> Optional[dict]:
    if not s:
        return None
    out = {}
    for part in s.split(","):
        team, d = part.split(":")
        out[int(team)] = int(d)
    return out


def main():
    ap = argparse.ArgumentParser(description="Offside Assistant Model (pass-first)")
    ap.add_argument("--ndjson", help="Offline replay من ملف NDJSON")
    ap.add_argument("--redis", help="Live mode: redis://host:port")
    ap.add_argument("--stream", help="اسم الـ Redis stream للقراءة")
    ap.add_argument("--job-id", default="job_001")
    ap.add_argument("--events-out", default="offside_events.json")
    ap.add_argument("--labels", help="ملف ground truth للمقارنة (offline)")
    ap.add_argument("--attack-dir-override", help='مثال: "0:+1,1:-1"')
    ap.add_argument("--skip-initial-sec", type=float, default=None,
                    help="تجاهل أول N ثانية (default 35 للماتش الكامل، حُط 0 للقطات المقصوصة)")
    ap.add_argument("--fps", type=float, default=25.0)
    args = ap.parse_args()

    CFG.fps = args.fps
    if args.skip_initial_sec is not None:
        CFG.skip_initial_sec = args.skip_initial_sec
    redis_client = None
    if args.redis:
        import redis as redis_lib
        redis_client = redis_lib.from_url(args.redis)

    engine = OffsideEngine(
        CFG, args.job_id,
        redis_client=redis_client,
        events_out=args.events_out,
        dir_override=parse_override(args.attack_dir_override),
    )

    if args.ndjson:
        t0 = time.perf_counter()
        with open(args.ndjson, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    pkt = json.loads(line)
                except json.JSONDecodeError:
                    engine.stats["bad_packets"] += 1
                    continue
                engine.process_packet(pkt)
        engine.emitter.flush()
        engine.print_eval()
        print(f"[OFFSIDE] processed in {time.perf_counter() - t0:.1f}s")
        if args.labels:
            compare_labels(engine.emitter.events, args.labels)

    elif args.redis and args.stream:
        last_id = "$"
        print(f"[OFFSIDE] Live mode — reading {args.stream}")
        while True:
            resp = redis_client.xread({args.stream: last_id}, block=2000, count=200)
            if not resp:
                continue
            for _, entries in resp:
                for entry_id, fields in entries:
                    last_id = entry_id
                    raw = fields.get(b"data") or fields.get("data")
                    if raw is None:
                        continue
                    try:
                        pkt = json.loads(raw)
                    except (json.JSONDecodeError, TypeError):
                        engine.stats["bad_packets"] += 1
                        continue
                    engine.process_packet(pkt)
    else:
        ap.error("لازم --ndjson أو (--redis مع --stream)")


if __name__ == "__main__":
    main()
