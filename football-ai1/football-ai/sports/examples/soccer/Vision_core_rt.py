"""
vision_core_rt.py  —  Real-Time Vision Core
============================================
Boot phase  : warm-up + team classifier fit من أول N ثواني
Live phase  : detection كل N frames + tracking كل frame
Output      : NDJSON minimal schema → downstream services

تشغيل:
    python vision_core_rt.py \
        --source_video_path input.mp4 \
        --output_ndjson     output.ndjson \
        --device            cuda \
        --fps               25.0

Schema (minimal — analytics تتعمل في downstream):
{
  "frame_id":      int,
  "timestamp_sec": float,
  "is_detect_frame":       bool,   ← مواقع جديدة (True) ولا cached (False)
  "homography_age_frames": int,    ← كام frame من آخر تحديث homography (-1 = مفيش)
  "ball_gap_frames":       int,    ← كام frame من آخر كرة صالحة (-1 = مفيش)
  "objects": [
    {
      "id":         int | null,
      "class_id":   0=ball | 1=gk | 2=player | 3=ref,
      "team_id":    0 | 1 | null,
      "pitch_xy":   [X, Y],        ← metres on pitch
      "anchor_xy":  [px, py],      ← pixel foot / center
      "bbox_xyxy":  [x1,y1,x2,y2],
      "confidence": float | null
    }
  ]
}
"""

import argparse
import json
import os
import time
import threading
import queue
from collections import defaultdict

import cv2
import numpy as np
import redis
import supervision as sv
from tqdm import tqdm
from ultralytics import YOLO

try:
    import orjson
    _dumps = lambda obj: orjson.dumps(obj).decode()
    print("[INIT] orjson active — faster JSON serialization")
except ImportError:
    _dumps = json.dumps

from sports.common.ball import BallTracker
from sports.common.view import ViewTransformer
from sports.configs.soccer import SoccerPitchConfiguration


# ── Paths ─────────────────────────────────────────────────────────────────────
PARENT_DIR             = os.path.dirname(os.path.abspath(__file__))
PLAYER_MODEL_PATH      = os.path.join(PARENT_DIR, 'data/football-player-detection.pt')
PITCH_MODEL_PATH       = os.path.join(PARENT_DIR, 'data/football-pitch-detection.pt')
BALL_MODEL_PATH        = os.path.join(PARENT_DIR, 'data/football-ball-detection.pt')

# ── Class IDs ─────────────────────────────────────────────────────────────────
BALL_CLASS_ID       = 0
GOALKEEPER_CLASS_ID = 1
PLAYER_CLASS_ID     = 2
REFEREE_CLASS_ID    = 3

# ── Config ────────────────────────────────────────────────────────────────────
CONFIG = SoccerPitchConfiguration()

# ── Pitch bounds (shared everywhere — لا تعمل hardcode لـ 105/68) ───────────────
PITCH_X_MAX = CONFIG.length / 100.0   # 120.0 m
PITCH_Y_MAX = CONFIG.width  / 100.0   # 70.0  m

# ── Tuning knobs ──────────────────────────────────────────────────────────────
IMGSZ                     = 640    # أسرع على CPU
DETECT_EVERY              = 2      # detection كل فريمين (كان 3) — IDs أثبت + أسرع من 3؟ لأ، 3 أسرع
BALL_DETECT_EVERY         = 2      # نفس تردد اللاعيبة — مزامنة الكشف
# ── Real-time knobs ────────────────────────────────────────────────────────
# آلية التخطّي موجودة عبر DETECT_EVERY: الفريمات اللي مش detect بتعيد استخدام
# آخر مواقع (cached) وبتتكتب للـ Redis عادي → الـ stream يفضل 25fps، الحمل أقل.
PLAYER_IMGSZ              = 640    # دقة كشف اللاعيبة
BALL_ROI_IMGSZ            = 640    # الكورة في ROI صغير → 640 يكفي ويسرّع (كان 1280)
# ── Ball detection resolution (إصلاح: الكورة 13px كانت تبقى 4px على imgsz=640) ──
BALL_IMGSZ                = 1280   # دقة كشف الكورة (أعلى من اللاعيبة)
BALL_USE_SLICING          = True   # قسّم الفريم مربعات وكشف كل واحد بدقته الكاملة
BALL_SLICE_ROWS           = 1      # صف واحد (الكورة بتتحرك أفقي أكتر من رأسي)
BALL_SLICE_COLS           = 2      # عمودين = استدعائين بدل 4 → ~2x أسرع
BALL_SLICE_OVERLAP        = 0.18   # تداخل بين المربعات عشان كورة على الحد ما تتقصش
BALL_CONF_THRESH          = 0.25   # ثقة دنيا (موديلك بيطلع 0.3-0.9)
HOMOGRAPHY_DIFF_THRESHOLD = 12.0   # كاميرا broadcast بتتحرك → update أكثر (كان 20.0)
HOMOGRAPHY_MAX_AGE_FRAMES = 50     # حدّث الـ homography كل 50 فريم على الأقل حتى لو الكاميرا ثابتة
BOOT_SECONDS              = 8.0    # أطول عشان نضمن لقطة wide فيها الفريقين
WRITER_QUEUE_SIZE         = 128    # حجم الـ queue بين processor والـ writer


# ══════════════════════════════════════════════════════════════════════════════
# Stabilization config  —  internal only, لا يغيّر schema الإخراج
# ══════════════════════════════════════════════════════════════════════════════

# ── (1) Stable squad player IDs ────────────────────────────────────────────────
INIT_WINDOW_FRAMES    = 750     # 30s @ 25fps — نافذة قفل التشكيلة الأساسية
MIN_INIT_TRACK_FRAMES = 25      # أقل عدد frames يخلّي الـ track مرشّح صالح
MIN_INIT_MEAN_CONF    = 0.65    # متوسط ثقة المرشّح خلال نافذة الـ init
MIN_ON_PITCH_RATIO    = 0.70    # نسبة الـ frames اللي يكون فيها داخل الملعب

# Re-ID (ربط raw track جديد بلاعب stable موجود)
MAX_REID_GAP_FRAMES   = 125     # ID-only: نحافظ على الربط بعد اختفاء مؤقت بدون تغيير أداء الموديل
BASE_REID_DISTANCE_M  = 6.0     # ID-only: أقل شوية عشان نقلل ربط لاعب غلط
MAX_REID_DISTANCE_M   = 10.0    # ID-only: كان 12m؛ تقليل بسيط للـ false re-id
MIN_REID_CONF         = 0.50    # ID-only: كان 0.40؛ نربط بس detection أوثق
REID_AMBIGUITY_MARGIN_M = 2.5   # ID-only: لازم أفضل مرشح يكون واضح عن الثاني

# Stable ID ranges (system IDs — مش أرقام القمصان الحقيقية)
TEAM0_BASE      = 1      # 1 .. 11
TEAM1_BASE      = 101    # 101 .. 111
TEAM0_NEW_BASE  = 12     # 12, 13, 14 ...
TEAM1_NEW_BASE  = 112    # 112, 113, 114 ...
UNKNOWN_BASE    = 1000   # team غير معروف

# ── (2) Stable team smoothing ──────────────────────────────────────────────────
MIN_TEAM_VOTES        = 15      # أقل عدد أصوات قبل ما نثق بالـ stable team
TEAM_CONFIDENCE_RATIO = 0.60    # نسبة الأغلبية المطلوبة للثقة

# ── (3) Ball quality gate ──────────────────────────────────────────────────────
MIN_BALL_CONF     = 0.35
MAX_BALL_JUMP_M   = 35.0
MAX_BALL_SPEED_MPS = 45.0
BALL_HARD_RESET_GAP_FRAMES = 50    # غياب أطول من كده = اقبل أول كرة كويسة كـ reset
BALL_JUMP_GROWTH_M_PER_F   = 0.6   # توسيع الـ jump allowance مع الغياب (~15 m/s)

# ── (4) Ball recovery mode ─────────────────────────────────────────────────────
BALL_MISSING_TRIGGER_FRAMES = 25
BALL_RECOVERY_WINDOW_FRAMES = 75

# ── (5) Goalkeeper stabilization ───────────────────────────────────────────────
GK_STABILIZATION_WINDOW = 100   # كم frame كـ"أعمق لاعب" قبل ما نثبّته GK
GK_SWITCH_MARGIN_VOTES  = 80    # ID-only: لا تغيّر الـ GK إلا لو المرشح الجديد كسب بفارق واضح
GK_MIN_CONF             = 0.50

# ── (6) Low-confidence quality guards ──────────────────────────────────────────
MIN_PLAYER_CONF = 0.45
MIN_REF_CONF    = 0.45
MIN_GK_CONF     = 0.45
# MIN_BALL_CONF معرّف فوق (0.35)


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

def get_crops(frame: np.ndarray, detections: sv.Detections) -> list[np.ndarray]:
    return [sv.crop_image(frame, xyxy) for xyxy in detections.xyxy]


def frame_changed(prev_gray: np.ndarray, curr_gray: np.ndarray) -> bool:
    return float(cv2.absdiff(prev_gray, curr_gray).mean()) > HOMOGRAPHY_DIFF_THRESHOLD


def resolve_goalkeepers_team_id(
    players: sv.Detections,
    players_team_id: np.ndarray,
    goalkeepers: sv.Detections,
) -> np.ndarray:
    if len(goalkeepers) == 0:
        return np.array([], dtype=int)

    if len(players) == 0 or players_team_id is None or len(players_team_id) == 0:
        return np.full(len(goalkeepers), -1, dtype=int)

    gk_xy = goalkeepers.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)
    pl_xy = players.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)

    has_t0 = (players_team_id == 0).any()
    has_t1 = (players_team_id == 1).any()

    if not has_t0 and not has_t1:
        return np.full(len(goalkeepers), -1, dtype=int)

    c0 = pl_xy[players_team_id == 0].mean(axis=0) if has_t0 else None
    c1 = pl_xy[players_team_id == 1].mean(axis=0) if has_t1 else None

    out = []
    for xy in gk_xy:
        if c0 is not None and c1 is not None:
            out.append(0 if np.linalg.norm(xy - c0) < np.linalg.norm(xy - c1) else 1)
        elif c0 is not None:
            out.append(0)
        elif c1 is not None:
            out.append(1)
        else:
            out.append(-1)

    return np.array(out, dtype=int)


# ══════════════════════════════════════════════════════════════════════════════
# Async NDJSON writer  —  كتابة على thread منفصل عشان ما تبطئش الـ main loop
# ══════════════════════════════════════════════════════════════════════════════

class DualWriter:
    """
    يكتب كل packet في:
      1) NDJSON file  (للـ debug والـ replay)
      2) Redis Stream  (للـ live downstream models)

    Redis Stream key  →  "vc:{job_id}"
    كل entry فيه field واحد: "data" = JSON string

    الـ event models تقرأ بـ:
        XREAD COUNT 1 BLOCK 0 STREAMS vc:{job_id} $
    """

    _SENTINEL = object()

    def __init__(
        self,
        path: str,
        job_id: str,
        redis_host: str = "localhost",
        redis_port: int = 6379,
        maxsize: int = WRITER_QUEUE_SIZE,
        stream_maxlen: int = 2000,     # احتفظ بآخر 2000 packet ≈ 80 ثانية
    ):
        self._q          = queue.Queue(maxsize=maxsize)
        self._file       = open(path, "w", encoding="utf-8")
        self._stream_key = f"vc:{job_id}"
        self._maxlen     = stream_maxlen

        # Redis connection — لو مش شغال نكمل بـ file فقط
        try:
            self._redis = redis.Redis(
                host=redis_host, port=redis_port,
                socket_connect_timeout=2, decode_responses=True,
            )
            self._redis.ping()
            self._redis_ok = True
            print(f"[WRITER] Redis connected → stream key: {self._stream_key}")
        except Exception as e:
            self._redis    = None
            self._redis_ok = False
            print(f"[WRITER] Redis unavailable ({e}) — file-only mode")

        self._t = threading.Thread(target=self._worker, daemon=True)
        self._t.start()

    def _worker(self):
        while True:
            item = self._q.get()
            if item is self._SENTINEL:
                break
            line = _dumps(item)

            # 1) NDJSON
            self._file.write(line + "\n")

            # 2) Redis Stream
            if self._redis_ok:
                try:
                    self._redis.xadd(
                        self._stream_key,
                        {"data": line},
                        maxlen=self._maxlen,
                        approximate=True,
                    )
                except Exception:
                    pass   # مش هنوقف الـ pipeline لو Redis انقطع

    def write(self, obj: dict):
        self._q.put(obj)

    def close(self):
        self._q.put(self._SENTINEL)
        self._t.join()
        self._file.close()
        if self._redis_ok:
            print(f"[WRITER] Redis stream closed: {self._stream_key}")


# ══════════════════════════════════════════════════════════════════════════════
# Jersey Color Classifier  —  KMeans على dominant color بدل embeddings
# ══════════════════════════════════════════════════════════════════════════════

class JerseyClassifier:
    """
    يصنف اللاعبين على 2 فريق عن طريق لون التيشيرت.

    الفكرة:
      1) لكل crop يستخرج dominant color من الجزء العلوي (التيشيرت)
      2) بعد جمع كل الـ crops في boot_phase يعمل KMeans(n=2)
      3) في predict كل crop يتحول لـ dominant color ثم يتصنف للـ cluster الأقرب
    """

    def __init__(self):
        self._centers: np.ndarray | None = None   # (2, 3) — مركز كل فريق في LAB

    @staticmethod
    def _dominant_color(crop: np.ndarray) -> np.ndarray:
        """
        يرجع dominant color للجزء العلوي من الـ crop (منطقة التيشيرت).
        يشتغل في LAB color space عشان أدق في clustering.
        """
        h, w = crop.shape[:2]
        # خد الثلث العلوي من الصورة (التيشيرت مش الأرجل)
        torso = crop[h // 6 : h // 2, w // 6 : w * 5 // 6]
        if torso.size == 0:
            torso = crop

        # حوّل لـ LAB
        lab   = cv2.cvtColor(torso, cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)

        # صغّر عينة عشان يبقى سريع
        if len(lab) > 200:
            idx = np.random.choice(len(lab), 200, replace=False)
            lab = lab[idx]

        # KMeans (k=1) عشان نجيب الـ dominant cluster
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
        _, _, centers = cv2.kmeans(
            lab, 1, None, criteria, 3, cv2.KMEANS_RANDOM_CENTERS
        )
        return centers[0]   # (3,) — dominant LAB color

    def fit(self, crops: list[np.ndarray]) -> None:
        """
        يجمع dominant colors من كل الـ crops ويعمل KMeans(n=2).
        """
        if len(crops) < 4:
            print("[JERSEY] Not enough crops to fit — team_id will be unknown")
            self._centers = None
            return

        colors = []
        for crop in crops:
            try:
                colors.append(self._dominant_color(crop))
            except Exception:
                pass

        if len(colors) < 4:
            self._centers = None
            return

        data     = np.array(colors, dtype=np.float32)
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5)
        _, labels, centers = cv2.kmeans(
            data, 2, None, criteria, 10, cv2.KMEANS_PP_CENTERS
        )
        self._centers = centers   # (2, 3)

        c0 = int((labels == 0).sum())
        c1 = int((labels == 1).sum())
        print(f"[JERSEY] Fit done — cluster 0: {c0} crops | cluster 1: {c1} crops")

    def predict(self, crops: list[np.ndarray]) -> np.ndarray:
        """
        يرجع array من 0/1 بحجم len(crops).
        لو مش fitted يرجع None لكل crop.
        """
        if self._centers is None or len(crops) == 0:
            return np.full(len(crops), -1, dtype=int)

        labels = []
        for crop in crops:
            try:
                color = self._dominant_color(crop).reshape(1, 3)
                d0    = float(np.linalg.norm(color - self._centers[0]))
                d1    = float(np.linalg.norm(color - self._centers[1]))
                labels.append(0 if d0 < d1 else 1)
            except Exception:
                labels.append(-1)
        return np.array(labels, dtype=int)
 

def boot_phase(
    source_video_path: str,
    player_model: YOLO,
    device: str,
    fps: float,
    boot_seconds: float = BOOT_SECONDS,
) -> JerseyClassifier:
    """
    يأخذ أول N ثواني من الفيديو، يجمع crops، يبني JerseyClassifier.
    يرجع classifier جاهز.
    """
    use_half    = device != "cpu"
    boot_frames = int(fps * boot_seconds)
    crops: list = []

    print(f"[BOOT] Collecting crops from first {boot_seconds}s ({boot_frames} frames)…")

    for i, frame in enumerate(tqdm(
        sv.get_video_frames_generator(source_path=source_video_path, stride=1),
        desc="boot crops", total=boot_frames,
    )):
        if i >= boot_frames:
            break
        res  = player_model(frame, imgsz=IMGSZ, device=device, half=use_half, verbose=False)[0]
        dets = sv.Detections.from_ultralytics(res)
        crops += get_crops(frame, dets[dets.class_id == PLAYER_CLASS_ID])

    print(f"[BOOT] Fitting jersey classifier on {len(crops)} crops…")

    MAX_BOOT_CROPS = 400
    if len(crops) > MAX_BOOT_CROPS:
        step  = max(1, len(crops) // MAX_BOOT_CROPS)
        crops = crops[::step][:MAX_BOOT_CROPS]

    jc = JerseyClassifier()
    jc.fit(crops)
    print("[BOOT] Jersey classifier ready.")
    return jc


def warmup_models(*models, device: str, dummy_shape=(480, 640, 3)):
    """يشغّل inference وهمية عشان يسخّن الـ CUDA kernels."""
    if device == "cpu":
        return
    dummy = np.zeros(dummy_shape, dtype=np.uint8)
    print("[BOOT] Warming up models…")
    for m in models:
        m(dummy, device=device, half=True, verbose=False)
    print("[BOOT] Warm-up done.")


# ══════════════════════════════════════════════════════════════════════════════
# SquadIdRegistry  —  IDs مستقرة للاعبين + team smoothing + GK stabilization
# ══════════════════════════════════════════════════════════════════════════════

def _euclid(a, b) -> float:
    return float(((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5)


def _majority(votes: dict):
    """يرجع المفتاح صاحب أعلى صوت، أو None لو فاضي."""
    if not votes:
        return None
    return max(votes.items(), key=lambda kv: kv[1])[0]


class SquadIdRegistry:
    """
    مكوّن داخلي (لا يضيف أي حقل للإخراج):
      1. يراقب أول INIT_WINDOW_FRAMES لبناء تشكيلة أساسية مستقرة.
      2. يعطي IDs ثابتة لأول 11 لاعب/حارس لكل فريق.
      3. يربط raw tracker IDs الجديدة بالـ stable IDs (re-ID محافظ).
      4. يصوّت على team_id لكل stable ID (team smoothing).
      5. يثبّت class_id لحارس المرمى عبر منطق "أعمق لاعب" للفريق.

    كل ده ينعكس فقط على القيم المكتوبة في الحقول الموجودة: id / team_id / class_id.
    """

    def __init__(self, fps: float):
        self.fps          = fps
        self.initialized  = False

        # init window accumulators: raw_id -> dict
        self.init_candidates: dict[int, dict] = {}

        # post-init state
        self.raw_to_stable: dict[int, int] = {}
        self.stable_players: dict[int, dict] = {}            # stable_id -> state
        self.stable_team_votes: dict[int, dict] = defaultdict(lambda: defaultdict(int))

        # new-id counters
        self._next_t0 = TEAM0_NEW_BASE
        self._next_t1 = TEAM1_NEW_BASE
        self._next_unknown = UNKNOWN_BASE

        # GK stabilization: team -> {'min': {sid:count}, 'max': {sid:count}}
        self._gk_extreme = {
            0: {"min": defaultdict(int), "max": defaultdict(int)},
            1: {"min": defaultdict(int), "max": defaultdict(int)},
        }
        self.team_gk_stable_id: dict[int, int] = {}

        # debug counters
        self.stats = defaultdict(int)

    # ── Init-window observation ────────────────────────────────────────────────
    def _observe_init(self, raw_id, class_id, team_id, pitch_xy_m,
                      bbox_xyxy, confidence, is_on_pitch, frame_id):
        c = self.init_candidates.get(raw_id)
        if c is None:
            c = {
                "raw_id":        raw_id,
                "class_votes":   defaultdict(int),
                "team_votes":    defaultdict(int),
                "frames_seen":   0,
                "conf_sum":      0.0,
                "on_pitch_count": 0,
                "pos_sum":       [0.0, 0.0],
                "last_pitch_xy": None,
                "last_bbox":     None,
                "last_seen_frame": frame_id,
            }
            self.init_candidates[raw_id] = c

        c["class_votes"][int(class_id)] += 1
        if team_id in (0, 1):
            c["team_votes"][int(team_id)] += 1
        c["frames_seen"] += 1
        c["conf_sum"]    += float(confidence or 0.0)
        if is_on_pitch:
            c["on_pitch_count"] += 1
        c["pos_sum"][0]      += float(pitch_xy_m[0])
        c["pos_sum"][1]      += float(pitch_xy_m[1])
        c["last_pitch_xy"]    = [float(pitch_xy_m[0]), float(pitch_xy_m[1])]
        c["last_bbox"]        = [float(v) for v in bbox_xyxy]
        c["last_seen_frame"]  = frame_id

    def _lock_team(self, entries, base, team):
        """يخصّص IDs ثابتة لأفضل المرشّحين لفريق واحد."""
        locked = 0
        for offset, (_, raw_id, c, mean_conf) in enumerate(entries):
            sid = base + offset
            self.raw_to_stable[raw_id] = sid
            self.stable_players[sid] = {
                "stable_id":       sid,
                "team_id":         team,
                "class_votes":     dict(c["class_votes"]),
                "last_pitch_xy":   c["last_pitch_xy"],
                "last_bbox":       c["last_bbox"],
                "last_seen_frame": c["last_seen_frame"],
            }
            # seed team votes from init observations
            for t, n in c["team_votes"].items():
                self.stable_team_votes[sid][t] += n
            locked += 1
        return locked

    def _lock_squad(self, frame_id):
        valid_t0, valid_t1 = [], []
        for raw_id, c in self.init_candidates.items():
            frames = c["frames_seen"]
            if frames < MIN_INIT_TRACK_FRAMES:
                continue
            mean_conf = c["conf_sum"] / max(frames, 1)
            if mean_conf < MIN_INIT_MEAN_CONF:
                continue
            on_ratio = c["on_pitch_count"] / max(frames, 1)
            if on_ratio < MIN_ON_PITCH_RATIO:
                continue
            team = _majority(c["team_votes"])
            if team not in (0, 1):
                continue                         # غير معروف الفريق → مش ضمن التشكيلة الأساسية
            score = frames * mean_conf
            entry = (score, raw_id, c, mean_conf)
            (valid_t0 if team == 0 else valid_t1).append(entry)

        valid_t0.sort(key=lambda e: e[0], reverse=True)
        valid_t1.sort(key=lambda e: e[0], reverse=True)

        print(f"[SQUAD] Initializing from first {INIT_WINDOW_FRAMES} frames…")
        n0 = self._lock_team(valid_t0[:11], TEAM0_BASE, 0)
        n1 = self._lock_team(valid_t1[:11], TEAM1_BASE, 1)
        print(f"[SQUAD] Locked team 0 stable players: {n0}")
        print(f"[SQUAD] Locked team 1 stable players: {n1}")

        self.initialized = True
        # نظّف الـ accumulators لتوفير الذاكرة
        self.init_candidates.clear()

    # ── Stable team / class resolution ─────────────────────────────────────────
    def _stable_team(self, sid, frame_team):
        votes = self.stable_team_votes.get(sid)
        if votes:
            total = sum(votes.values())
            best_team, best_c = max(votes.items(), key=lambda kv: kv[1])
            if total >= MIN_TEAM_VOTES and best_c / total >= TEAM_CONFIDENCE_RATIO:
                return best_team
        # غير واثق بعد → استخدم الـ frame-level team كما هو
        return frame_team if frame_team in (0, 1) else None

    def _stable_class(self, sid, class_id, confidence, team):
        if (team in (0, 1)
                and self.team_gk_stable_id.get(team) == sid
                and confidence is not None
                and confidence >= GK_MIN_CONF):
            return GOALKEEPER_CLASS_ID
        return class_id

    def _update_stable(self, sid, team_id, class_id, pitch_xy_m, bbox_xyxy, frame_id):
        p = self.stable_players[sid]
        p["last_pitch_xy"]   = [float(pitch_xy_m[0]), float(pitch_xy_m[1])]
        p["last_bbox"]       = [float(v) for v in bbox_xyxy]
        p["last_seen_frame"] = frame_id
        p.setdefault("class_votes", {})
        p["class_votes"][int(class_id)] = p["class_votes"].get(int(class_id), 0) + 1
        if team_id in (0, 1):
            self.stable_team_votes[sid][int(team_id)] += 1

    # ── Re-ID لمحاولة ربط raw جديد بلاعب stable ────────────────────────────────
    def _try_reid(self, class_id, team_id, pitch_xy_m, confidence, is_on_pitch, frame_id, blocked_sids=None):
        if not is_on_pitch:
            return None
        if confidence is None or confidence < MIN_REID_CONF:
            return None

        blocked_sids = blocked_sids or set()

        candidates = []
        for sid, p in self.stable_players.items():
            # نفس الـ stable_id ماينفعش يتستخدم مرتين في نفس الفريم
            if sid in blocked_sids:
                continue
            # نفس الفريق المستقر (لو الفريق معروف على الجانبين)
            if team_id in (0, 1) and p["team_id"] in (0, 1) and p["team_id"] != team_id:
                continue
            if p["last_pitch_xy"] is None:
                continue
            gap = frame_id - p["last_seen_frame"]
            if gap <= 0 or gap > MAX_REID_GAP_FRAMES:
                continue
            dist = _euclid(pitch_xy_m, p["last_pitch_xy"])
            allowed = min(MAX_REID_DISTANCE_M, BASE_REID_DISTANCE_M + 0.08 * gap)
            if dist > allowed:
                continue
            candidates.append((dist, sid))

        if not candidates:
            return None
        candidates.sort(key=lambda kv: kv[0])
        best_dist, best_sid = candidates[0]

        # قاعدة الغموض: لازم يكون أفضل بوضوح من الثاني
        if len(candidates) >= 2:
            second_dist = candidates[1][0]
            if not (best_dist + REID_AMBIGUITY_MARGIN_M < second_dist):
                self.stats["reid_ambiguous_skipped"] += 1
                return None
        return best_sid

    def _assign_new(self, team_id, class_id, pitch_xy_m, bbox_xyxy, frame_id):
        if team_id == 0:
            sid = self._next_t0; self._next_t0 += 1
        elif team_id == 1:
            sid = self._next_t1; self._next_t1 += 1
        else:
            sid = self._next_unknown; self._next_unknown += 1
        self.stable_players[sid] = {
            "stable_id":       sid,
            "team_id":         team_id if team_id in (0, 1) else -1,
            "class_votes":     {int(class_id): 1},
            "last_pitch_xy":   [float(pitch_xy_m[0]), float(pitch_xy_m[1])],
            "last_bbox":       [float(v) for v in bbox_xyxy],
            "last_seen_frame": frame_id,
        }
        if team_id in (0, 1):
            self.stable_team_votes[sid][int(team_id)] += 1
        self.stats["new_stable_ids"] += 1
        return sid

    # ── Public API ─────────────────────────────────────────────────────────────
    def resolve(self, raw_id, class_id, team_id, pitch_xy_m,
                bbox_xyxy, confidence, is_on_pitch, frame_id, blocked_sids=None):
        """
        يرجع (stable_id, stable_team_id, stable_class_id).
        يُستدعى للاعبين والحرّاس فقط (مش للكرة/الحكم).
        """
        # ── أثناء نافذة الـ init: راقب فقط ومرّر الـ raw id كما هو ───────────────
        if not self.initialized:
            self._observe_init(raw_id, class_id, team_id, pitch_xy_m,
                               bbox_xyxy, confidence, is_on_pitch, frame_id)
            if frame_id >= INIT_WINDOW_FRAMES:
                self._lock_squad(frame_id)
            out_team = team_id if team_id in (0, 1) else None
            return raw_id, out_team, class_id

        # ── Case 1: raw_id متعرّف عليه قبل كده ───────────────────────────────────
        if raw_id in self.raw_to_stable:
            sid = self.raw_to_stable[raw_id]
            self._update_stable(sid, team_id, class_id, pitch_xy_m, bbox_xyxy, frame_id)
            return (sid,
                    self._stable_team(sid, team_id),
                    self._stable_class(sid, class_id, confidence, self._stable_team(sid, team_id)))

        # ── Case 2: raw_id جديد → حاول re-ID محافظ ──────────────────────────────
        sid = self._try_reid(class_id, team_id, pitch_xy_m, confidence, is_on_pitch, frame_id, blocked_sids=blocked_sids)
        if sid is not None:
            gap = frame_id - self.stable_players[sid]["last_seen_frame"]
            dist = _euclid(pitch_xy_m, self.stable_players[sid]["last_pitch_xy"])
            print(f"[SQUAD] Raw ID {raw_id} linked to stable ID {sid} | "
                  f"gap={gap}f | dist={dist:.1f}m")
            self.raw_to_stable[raw_id] = sid
            self._update_stable(sid, team_id, class_id, pitch_xy_m, bbox_xyxy, frame_id)
            self.stats["reid_linked"] += 1
            return (sid,
                    self._stable_team(sid, team_id),
                    self._stable_class(sid, class_id, confidence, self._stable_team(sid, team_id)))

        # ── لا يوجد ربط آمن → ID ثابت جديد ──────────────────────────────────────
        sid = self._assign_new(team_id, class_id, pitch_xy_m, bbox_xyxy, frame_id)
        self.raw_to_stable[raw_id] = sid
        print(f"[SQUAD] New unmatched player assigned stable ID {sid}")
        return (sid,
                self._stable_team(sid, team_id),
                self._stable_class(sid, class_id, confidence, self._stable_team(sid, team_id)))

    def observe_geometry(self, frame_id, players):
        """
        players: list of (stable_id, team_id, x_m).
        يحدّث تصويت "أعمق لاعب" لكل فريق → يستنتج حارس مرمى مستقر تدريجيًا.
        يؤثّر على الـ frames التالية (lag بسيط مقبول داخل نافذة 100 frame).
        """
        for team in (0, 1):
            team_pl = [(sid, x) for sid, t, x in players if t == team]
            if len(team_pl) < 2:
                continue
            min_sid = min(team_pl, key=lambda p: p[1])[0]
            max_sid = max(team_pl, key=lambda p: p[1])[0]
            self._gk_extreme[team]["min"][min_sid] += 1
            self._gk_extreme[team]["max"][max_sid] += 1

        for team in (0, 1):
            best = None
            for end in ("min", "max"):
                votes = self._gk_extreme[team][end]
                if not votes:
                    continue
                sid, c = max(votes.items(), key=lambda kv: kv[1])
                if best is None or c > best[1]:
                    best = (sid, c)
            if best and best[1] >= GK_STABILIZATION_WINDOW:
                current = self.team_gk_stable_id.get(team)

                # أول تثبيت للـ GK: ثبّته عادي.
                if current is None:
                    print(f"[GK] Stable goalkeeper inferred for team {team}: "
                          f"stable_id={best[0]}")
                    self.team_gk_stable_id[team] = best[0]
                    continue

                # بعد التثبيت: ما تغيّرش الـ GK بسهولة عشان الأوفسايد مايتلخبطش.
                if current != best[0]:
                    current_votes = 0
                    for end in ("min", "max"):
                        current_votes += self._gk_extreme[team][end].get(current, 0)

                    if best[1] >= current_votes + GK_SWITCH_MARGIN_VOTES:
                        print(f"[GK] Stable goalkeeper switched for team {team}: "
                              f"{current} -> {best[0]}")
                        self.team_gk_stable_id[team] = best[0]

    def dump_debug(self, path):
        try:
            data = {
                "initialized":      self.initialized,
                "n_stable_players": len(self.stable_players),
                "team_gk_stable_id": self.team_gk_stable_id,
                "stats":            dict(self.stats),
                "players": {
                    str(sid): {
                        "team_id":       p["team_id"],
                        "stable_team":   self._stable_team(sid, p["team_id"]),
                        "class_votes":   p.get("class_votes", {}),
                        "last_pitch_xy": p["last_pitch_xy"],
                        "last_seen_frame": p["last_seen_frame"],
                    }
                    for sid, p in self.stable_players.items()
                },
            }
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"[SQUAD] Debug written → {path}")
        except Exception as e:
            print(f"[SQUAD] Debug dump failed: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# BallGate  —  جودة الكرة (false positives) + recovery mode
# ══════════════════════════════════════════════════════════════════════════════

class BallGate:
    """
    بوابة داخلية للكرة (لا تضيف أي حقل للإخراج، ولا تعمل interpolation):
      • ترفض false positives (off-pitch / ثقة ضعيفة / قفزة أو سرعة غير واقعية).
      • recovery mode: لو الكرة غابت طويلًا تشغّل الكشف كل frame مؤقتًا.
    """

    def __init__(self, fps: float):
        self.fps              = fps
        self.last_valid_xy    = None
        self.last_valid_frame = None
        self.in_recovery      = False
        self.recovery_until   = -1
        self.stats            = defaultdict(int)

    def should_detect(self, frame_id) -> bool:
        # دخول recovery لو الغياب تعدّى الحد
        if (not self.in_recovery
                and self.last_valid_frame is not None
                and (frame_id - self.last_valid_frame) >= BALL_MISSING_TRIGGER_FRAMES):
            self.in_recovery    = True
            self.recovery_until = frame_id + BALL_RECOVERY_WINDOW_FRAMES
            print(f"[BALL] Recovery mode ON at frame={frame_id}")

        if self.in_recovery:
            if frame_id > self.recovery_until:
                self.in_recovery = False
                print(f"[BALL] Recovery mode OFF at frame={frame_id}")
                return frame_id % BALL_DETECT_EVERY == 0
            return True   # كل frame أثناء الـ recovery

        return frame_id % BALL_DETECT_EVERY == 0

    def accept(self, xy_m, conf, is_on_pitch, frame_id) -> bool:
        """يقرّر هل نكتب هذه الكرة. يحدّث آخر موقع صالح لو تم القبول."""
        if not is_on_pitch:
            self.stats["rejected_off_pitch"] += 1
            return False
        if conf is None or conf < MIN_BALL_CONF:
            self.stats["rejected_low_conf"] += 1
            return False
        if self.last_valid_xy is not None:
            gap = frame_id - self.last_valid_frame

            # ── Hard reset: غياب طويل → ثقة في أول كشف on-pitch كويس ──────────
            #    (يكسر الـ deadlock القديم اللي كان يرفض الكرة للأبد بعد غياب طويل)
            if gap >= BALL_HARD_RESET_GAP_FRAMES:
                self.stats["accepted_after_reset"] += 1
                self.last_valid_xy    = [float(xy_m[0]), float(xy_m[1])]
                self.last_valid_frame = frame_id
                if self.in_recovery:
                    self.in_recovery, self.recovery_until = False, -1
                    print(f"[BALL] Recovery OFF at frame={frame_id} (reset accept)")
                return True

            dist = _euclid(xy_m, self.last_valid_xy)
            dt   = max(gap / self.fps, 1e-3)
            # ── Jump allowance يتوسع مع الغياب (زي re-ID بالظبط) ──────────────
            allowed_jump = MAX_BALL_JUMP_M + BALL_JUMP_GROWTH_M_PER_F * max(gap - 1, 0)
            if dist > allowed_jump:
                self.stats["rejected_jump"] += 1
                return False
            if dist / dt > MAX_BALL_SPEED_MPS:
                self.stats["rejected_speed"] += 1
                return False

        # مقبولة
        self.last_valid_xy    = [float(xy_m[0]), float(xy_m[1])]
        self.last_valid_frame = frame_id
        self.stats["accepted"] += 1
        if self.in_recovery:
            self.in_recovery    = False
            self.recovery_until = -1
            print(f"[BALL] Recovery mode OFF at frame={frame_id} (ball found)")
        return True


# ══════════════════════════════════════════════════════════════════════════════
# Ball detection via slicing (إصلاح كشف الكورة الصغيرة في لقطات broadcast)
# ══════════════════════════════════════════════════════════════════════════════

def detect_ball_sliced(ball_model, frame, *, imgsz, conf, device, half,
                       rows, cols, overlap, last_xy_px=None, roi_radius_px=320):
    """
    يكشف الكورة بتقسيم الفريم لمربعات متداخلة وكشف كل واحد بدقته الكاملة.
    لو عندنا آخر موقع معروف للكورة (last_xy_px)، نبحث أولاً في ROI حواليه فقط
    (استدعاء واحد) — أسرع بكثير. لو مالقيناهاش، نرجع للتقسيم الكامل.
    يرجع sv.Detections في إحداثيات الفريم الأصلي.
    """
    H, W = frame.shape[:2]

    # ── ROI سريع حول آخر موقع معروف ───────────────────────────────────────────
    if last_xy_px is not None:
        cx, cy = last_xy_px
        x0 = max(int(cx - roi_radius_px), 0)
        y0 = max(int(cy - roi_radius_px), 0)
        x1 = min(int(cx + roi_radius_px), W)
        y1 = min(int(cy + roi_radius_px), H)
        roi = frame[y0:y1, x0:x1]
        if roi.size > 0:
            # الكورة في ROI صغير بتبقى كبيرة نسبياً → imgsz أصغر يكفي ويسرّع
            roi_imgsz = BALL_ROI_IMGSZ if 'BALL_ROI_IMGSZ' in globals() else imgsz
            res = ball_model(roi, imgsz=roi_imgsz, conf=conf, device=device, half=half, verbose=False)[0]
            d = sv.Detections.from_ultralytics(res)
            if len(d) > 0:
                boxes = d.xyxy.copy()
                boxes[:, [0, 2]] += x0
                boxes[:, [1, 3]] += y0
                return sv.Detections(xyxy=boxes, confidence=d.confidence,
                                     class_id=d.class_id).with_nms(0.5, class_agnostic=True)
        # مالقيناهاش في الـ ROI → نكمل للتقسيم الكامل تحت

    # ── تقسيم كامل (fallback) ──────────────────────────────────────────────────
    tile_h, tile_w = int(H / rows), int(W / cols)
    ov_h, ov_w = int(tile_h * overlap), int(tile_w * overlap)
    all_xyxy, all_conf, all_cls = [], [], []
    for r in range(rows):
        for c in range(cols):
            y0 = max(r * tile_h - ov_h, 0)
            x0 = max(c * tile_w - ov_w, 0)
            y1 = min((r + 1) * tile_h + ov_h, H)
            x1 = min((c + 1) * tile_w + ov_w, W)
            tile = frame[y0:y1, x0:x1]
            if tile.size == 0:
                continue
            res = ball_model(tile, imgsz=imgsz, conf=conf, device=device, half=half, verbose=False)[0]
            d = sv.Detections.from_ultralytics(res)
            if len(d) == 0:
                continue
            boxes = d.xyxy.copy()
            boxes[:, [0, 2]] += x0
            boxes[:, [1, 3]] += y0
            all_xyxy.append(boxes)
            all_conf.append(d.confidence)
            all_cls.append(d.class_id)

    if not all_xyxy:
        return sv.Detections.empty()

    merged = sv.Detections(
        xyxy=np.vstack(all_xyxy),
        confidence=np.concatenate(all_conf),
        class_id=np.concatenate(all_cls),
    )
    return merged.with_nms(threshold=0.5, class_agnostic=True)


# ══════════════════════════════════════════════════════════════════════════════
# Live phase
# ══════════════════════════════════════════════════════════════════════════════

def live_phase(
    source_video_path: str,
    player_model:  YOLO,
    pitch_model:   YOLO,
    ball_model:    YOLO,
    team_classifier: JerseyClassifier,
    writer:        DualWriter,
    device:        str,
    fps:           float,
    job_id:        str = "job_001",
    r_kv           = None,    # Redis client للـ key-value ops
):
    use_half = device != "cpu"

    tracker       = sv.ByteTrack(
        minimum_consecutive_frames=1,
        track_activation_threshold=0.25,
        lost_track_buffer=90,          # ↑ من 60 → يقلل re-ID في full match
        frame_rate=fps,
    )
    ball_tracker  = BallTracker(buffer_size=10)
    track_team_map: dict[int, int] = {}

    # ── Stabilization components (داخلية — لا تغيّر schema) ────────────────────
    squad_registry = SquadIdRegistry(fps=fps)
    ball_gate      = BallGate(fps=fps)
    quality_stats  = defaultdict(int)

    cached_transformer = None
    cached_detections  = None   # آخر detection كاملة (للـ track-only frames)
    prev_gray          = None
    frame_id           = 0
    homography_updated_frame = -1   # آخر frame اتحدثت فيه الـ homography
    last_ball_px             = None # آخر موقع بكسل معروف للكورة (لتسريع الـ ROI search)
    start_time         = time.perf_counter()

    print("[LIVE] Starting live loop…")

    for frame in sv.get_video_frames_generator(source_path=source_video_path, stride=1):
        frame_id  += 1
        # video timestamp — مطابق لوقت الماتش الفعلي
        timestamp  = round((frame_id - 1) / fps, 3)
        is_detect_frame = (frame_id % DETECT_EVERY == 0)   # محسوبة بدري عشان الـ packet
        curr_gray  = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # ── Homography: update لو الكاميرا تحركت، أو دورياً كل HOMOGRAPHY_MAX_AGE ──
        #    (التحديث الدوري بيخلي homography_age يفضل صغير → الـ gate في الأوفسايد له معنى)
        homog_too_old = (homography_updated_frame > 0
                         and frame_id - homography_updated_frame >= HOMOGRAPHY_MAX_AGE_FRAMES)
        if (cached_transformer is None
                or prev_gray is None
                or homog_too_old
                or frame_changed(prev_gray, curr_gray)):
            pitch_res = pitch_model(frame, device=device, half=use_half, verbose=False)[0]
            keypoints = sv.KeyPoints.from_ultralytics(pitch_res)
            mask      = (keypoints.xy[0][:, 0] > 1) & (keypoints.xy[0][:, 1] > 1)
            if mask.sum() >= 4:
                cached_transformer = ViewTransformer(
                    source=keypoints.xy[0][mask].astype(np.float32),
                    target=np.array(CONFIG.vertices)[mask].astype(np.float32),
                )
                homography_updated_frame = frame_id   # ← سجّل لحظة آخر تحديث ناجح
                # ── احفظ H matrix في Redis ────────────────────────────────────
                if r_kv is not None:
                    try:
                        H = np.array(cached_transformer.m, dtype=np.float64)
                        r_kv.set(
                            f"vc:{job_id}:homography",
                            json.dumps(H.tolist()),
                        )
                    except Exception as e:
                        print(f"[LIVE] Homography save failed: {e}")

        prev_gray = curr_gray

        if cached_transformer is None:
            continue

        # ── Detection or tracking-only ────────────────────────────────────────
        if is_detect_frame:
            res      = player_model(frame, imgsz=IMGSZ, device=device, half=use_half, verbose=False)[0]
            raw_dets = sv.Detections.from_ultralytics(res)

            tracked_dets = tracker.update_with_detections(raw_dets)

            # fallback: لو ByteTrack رجع فاضي استخدم raw مباشرة
            if tracked_dets is None or len(tracked_dets) == 0:
                dets = raw_dets
            else:
                dets = tracked_dets

            cached_detections = dets
        else:
            dets = cached_detections if cached_detections is not None else sv.Detections.empty()

        if dets is None or len(dets) == 0:
            writer.write({
                "job_id":        job_id,
                "frame_id":      frame_id,
                "timestamp_sec": timestamp,
                "is_detect_frame":       is_detect_frame,
                "homography_age_frames": (frame_id - homography_updated_frame
                                          if homography_updated_frame > 0 else -1),
                "ball_gap_frames":       (frame_id - ball_gate.last_valid_frame
                                          if ball_gate.last_valid_frame is not None else -1),
                "objects":       [],
            })
            continue

        # ── Split ─────────────────────────────────────────────────────────────
        players     = dets[dets.class_id == PLAYER_CLASS_ID]
        goalkeepers = dets[dets.class_id == GOALKEEPER_CLASS_ID]
        referees    = dets[dets.class_id == REFEREE_CLASS_ID]

        # ── Team classification: بس للـ IDs الجديدة ──────────────────────────
        if is_detect_frame and players.tracker_id is not None and len(players.tracker_id) > 0:
            unknown = np.array([int(i) not in track_team_map for i in players.tracker_id])
            if unknown.any():
                unknown_players = players[unknown]
                preds = team_classifier.predict(get_crops(frame, unknown_players))
                for pid, tid in zip(unknown_players.tracker_id, preds):
                    tid = int(tid)
                    if tid in [0, 1]:              # لا تحفظ -1 (فشل التصنيف)
                        track_team_map[int(pid)] = tid

        players_team_id = np.array([
            track_team_map.get(int(pid), -1)       # -1 = unknown, مش 0
            for pid in (players.tracker_id if players.tracker_id is not None else [])
        ])
        gk_team_id = resolve_goalkeepers_team_id(players, players_team_id, goalkeepers)

        # ── Merge + project ───────────────────────────────────────────────────
        all_dets     = sv.Detections.merge([players, goalkeepers, referees])
        all_team_ids = np.array(
            players_team_id.tolist()
            + gk_team_id.tolist()
            + [-1] * len(referees)
        )

        anchors   = all_dets.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)
        pitch_xys = cached_transformer.transform_points(points=anchors)


        # ── Build objects ─────────────────────────────────────────────────────
        objects     = []
        geom_players = []   # (stable_id, stable_team, x_m) للـ GK stabilization
        used_stable_ids_this_frame = set()  # ID-only: منع تكرار نفس اللاعب مرتين في نفس الفريم
        for i in range(len(all_dets)):
            raw_tid = int(all_dets.tracker_id[i]) if all_dets.tracker_id is not None else None
            # safe indexing — all_team_ids ممكن يكون أقصر من all_dets لو merge اتغير
            raw_team = (int(all_team_ids[i]) if i < len(all_team_ids) and all_team_ids[i] >= 0
                        else -1)
            conf  = float(all_dets.confidence[i]) if all_dets.confidence is not None else None
            cid   = int(all_dets.class_id[i])

            px    = round(float(pitch_xys[i][0]) / 100.0, 2)
            py    = round(float(pitch_xys[i][1]) / 100.0, 2)
            is_on_pitch = (0.0 <= px <= PITCH_X_MAX and 0.0 <= py <= PITCH_Y_MAX)

            # ── (6) Low-confidence quality guard لكل class ────────────────────
            if cid == PLAYER_CLASS_ID and (conf is None or conf < MIN_PLAYER_CONF):
                quality_stats["dropped_low_conf_player"] += 1
                continue
            if cid == GOALKEEPER_CLASS_ID and (conf is None or conf < MIN_GK_CONF):
                quality_stats["dropped_low_conf_gk"] += 1
                continue
            if cid == REFEREE_CLASS_ID and (conf is None or conf < MIN_REF_CONF):
                quality_stats["dropped_low_conf_ref"] += 1
                continue

            # ── (1)(2)(5) IDs/team/class مستقرة للاعبين والحرّاس فقط ──────────
            if cid in (PLAYER_CLASS_ID, GOALKEEPER_CLASS_ID) and raw_tid is not None:
                stable_id, stable_team, stable_cid = squad_registry.resolve(
                    raw_id=raw_tid,
                    class_id=cid,
                    team_id=raw_team,
                    pitch_xy_m=[px, py],
                    bbox_xyxy=all_dets.xyxy[i],
                    confidence=conf,
                    is_on_pitch=is_on_pitch,
                    frame_id=frame_id,
                    blocked_sids=used_stable_ids_this_frame,
                )

                # ID-only guard: لو نفس stable_id ظهر مرتين في نفس الفريم، احذف المكرر
                # بدل ما الفيجوالايزر/الأوفسايد يشوف نفس اللاعب مرتين.
                if stable_id is not None:
                    if stable_id in used_stable_ids_this_frame:
                        quality_stats["dropped_duplicate_stable_id"] += 1
                        continue
                    used_stable_ids_this_frame.add(stable_id)

                if stable_team in (0, 1):
                    geom_players.append((stable_id, stable_team, px))
            else:
                stable_id  = raw_tid
                stable_team = raw_team if raw_team in (0, 1) else None
                stable_cid = cid

            out_team = stable_team if stable_team in (0, 1) else None
            objects.append({
                "id":           stable_id,
                "class_id":     stable_cid,
                "team_id":      out_team,
                "pitch_xy_m":   [px, py],
                "is_on_pitch":  is_on_pitch,
                "anchor_xy":    [round(float(anchors[i][0]), 2),
                                 round(float(anchors[i][1]), 2)],
                "bbox_xyxy":    [round(float(v), 2) for v in all_dets.xyxy[i]],
                "confidence":   round(conf, 3) if conf else None,
            })

        # ── (5) حدّث منطق "أعمق لاعب" → يستنتج GK مستقر للـ frames التالية ─────
        if geom_players:
            squad_registry.observe_geometry(frame_id, geom_players)

        # ── Ball (periodic + recovery mode) ───────────────────────────────────
        # (3) quality gate + (4) recovery: should_detect يقرّر تردد الكشف
        if ball_gate.should_detect(frame_id):
            # لو الكورة غابت فترة، الـ ROI القديم بقى قديم → ارجع للتقسيم الكامل
            if (ball_gate.last_valid_frame is not None
                    and frame_id - ball_gate.last_valid_frame > 25):
                last_ball_px = None
            if BALL_USE_SLICING:
                b_dets = detect_ball_sliced(
                    ball_model, frame,
                    imgsz=BALL_IMGSZ, conf=BALL_CONF_THRESH, device=device, half=use_half,
                    rows=BALL_SLICE_ROWS, cols=BALL_SLICE_COLS,
                    overlap=BALL_SLICE_OVERLAP,
                    last_xy_px=last_ball_px,
                )
            else:
                b_res  = ball_model(frame, imgsz=BALL_IMGSZ, conf=BALL_CONF_THRESH,
                                    device=device, half=use_half, verbose=False)[0]
                b_dets = sv.Detections.from_ultralytics(b_res)

            quality_stats["ball_detect_attempts"] += 1
            if len(b_dets) > 0:
                quality_stats["ball_detect_hits"] += 1
                # كورة واحدة في الملعب — لو اتكشف أكتر، خُد الأعلى ثقة
                if len(b_dets) > 1:
                    best = int(b_dets.confidence.argmax())
                    b_dets = b_dets[best:best + 1]

                b_dets    = ball_tracker.update(b_dets)
                b_anchors = b_dets.get_anchors_coordinates(sv.Position.CENTER)
                b_pitch   = cached_transformer.transform_points(b_anchors)
                for bi in range(len(b_dets)):
                    bconf = float(b_dets.confidence[bi]) if b_dets.confidence is not None else None
                    bpx   = round(float(b_pitch[bi][0]) / 100.0, 2)
                    bpy   = round(float(b_pitch[bi][1]) / 100.0, 2)
                    b_on_pitch = (0.0 <= bpx <= PITCH_X_MAX and 0.0 <= bpy <= PITCH_Y_MAX)

                    # (3) ارفض false positives — لا نكتب كرة غير صالحة
                    if not ball_gate.accept([bpx, bpy], bconf, b_on_pitch, frame_id):
                        continue

                    # سجّل موقع البكسل لتسريع الـ ROI search في الفريم الجاي
                    last_ball_px = (float(b_anchors[bi][0]), float(b_anchors[bi][1]))

                    objects.append({
                        "id":          -1,
                        "class_id":    BALL_CLASS_ID,
                        "team_id":     None,
                        "pitch_xy_m":  [bpx, bpy],
                        "is_on_pitch": b_on_pitch,
                        "anchor_xy":   [round(float(b_anchors[bi][0]), 2),
                                        round(float(b_anchors[bi][1]), 2)],
                        "bbox_xyxy":   [round(float(v), 2) for v in b_dets.xyxy[bi]],
                        "confidence":  round(bconf, 3) if bconf else None,
                    })

        # ── Publish ───────────────────────────────────────────────────────────
        writer.write({
            "job_id":        job_id,
            "frame_id":      frame_id,
            "timestamp_sec": timestamp,
            "is_detect_frame":       is_detect_frame,
            "homography_age_frames": (frame_id - homography_updated_frame
                                      if homography_updated_frame > 0 else -1),
            "ball_gap_frames":       (frame_id - ball_gate.last_valid_frame
                                      if ball_gate.last_valid_frame is not None else -1),
            "objects":       objects,
        })

        if frame_id % 100 == 0:
            elapsed = time.perf_counter() - start_time
            print(f"  [LIVE] frame={frame_id} | "
                  f"fps={round(frame_id/elapsed,1)} | "
                  f"objects={len(objects)}")

    # ── Optional debug files (خارج NDJSON الأساسي) ─────────────────────────────
    squad_registry.dump_debug(os.path.join(PARENT_DIR, "squad_id_registry_debug.json"))
    try:
        with open(os.path.join(PARENT_DIR, "vision_quality_debug.json"),
                  "w", encoding="utf-8") as f:
            json.dump({
                "frames_processed": frame_id,
                "quality_stats":    dict(quality_stats),
                "ball_stats":       dict(ball_gate.stats),
                "squad_stats":      dict(squad_registry.stats),
            }, f, ensure_ascii=False, indent=2)
        print("[QUALITY] Debug written → vision_quality_debug.json")
    except Exception as e:
        print(f"[QUALITY] Debug dump failed: {e}")

    _att = quality_stats.get("ball_detect_attempts", 0)
    _hit = quality_stats.get("ball_detect_hits", 0)
    if _att:
        print(f"[BALL] detect hit-rate: {_hit}/{_att} = {100 * _hit / _att:.0f}%")


# ══════════════════════════════════════════════════════════════════════════════
# Entry point
# ══════════════════════════════════════════════════════════════════════════════

def run(
    source_video_path: str,
    output_ndjson: str,
    device: str,
    fps: float,
    job_id: str,
    redis_host: str = "localhost",
    redis_port: int = 6379,
):
    use_half = device != "cpu"

    # ── Load models once ──────────────────────────────────────────────────────
    print(f"[INIT] job_id={job_id} | Loading models…")
    player_model = YOLO(PLAYER_MODEL_PATH).to(device=device)
    pitch_model  = YOLO(PITCH_MODEL_PATH).to(device=device)
    ball_model   = YOLO(BALL_MODEL_PATH).to(device=device)

    # ── Warm-up (GPU only) ────────────────────────────────────────────────────
    warmup_models(player_model, pitch_model, ball_model, device=device)

    # ── Boot phase ────────────────────────────────────────────────────────────
    team_classifier = boot_phase(
        source_video_path=source_video_path,
        player_model=player_model,
        device=device,
        fps=fps,
    )

    # ── Dual writer (NDJSON + Redis) ──────────────────────────────────────────
    writer = DualWriter(
        path=output_ndjson,
        job_id=job_id,
        redis_host=redis_host,
        redis_port=redis_port,
    )

    # ── Redis KV client — لحفظ الـ homography وأي key-value مستقبلًا ─────────
    try:
        r_kv = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)
        r_kv.ping()
    except Exception:
        r_kv = None
        print("[INIT] Redis KV unavailable — homography won't be stored")

    # ── Live phase ────────────────────────────────────────────────────────────
    try:
        live_phase(
            source_video_path=source_video_path,
            player_model=player_model,
            pitch_model=pitch_model,
            ball_model=ball_model,
            team_classifier=team_classifier,
            writer=writer,
            device=device,
            fps=fps,
            job_id=job_id,
            r_kv=r_kv,
        )
    finally:
        writer.close()
        print(f"[DONE] job_id={job_id} → {output_ndjson}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Football AI — Real-Time Vision Core")
    parser.add_argument("--source_video_path", required=True)
    parser.add_argument("--output_ndjson",      default="output.ndjson")
    parser.add_argument("--device",             default="cpu")
    parser.add_argument("--fps",                type=float, default=25.0)
    parser.add_argument("--job_id",             required=True,
                        help="معرّف المعالجة — يظهر في كل سطر NDJSON وRedis")
    parser.add_argument("--redis_host",         default="localhost")
    parser.add_argument("--redis_port",         type=int, default=6379)
    args = parser.parse_args()

    run(
        source_video_path=args.source_video_path,
        output_ndjson=args.output_ndjson,
        device=args.device,
        fps=args.fps,
        job_id=args.job_id,
        redis_host=args.redis_host,
        redis_port=args.redis_port,
    )