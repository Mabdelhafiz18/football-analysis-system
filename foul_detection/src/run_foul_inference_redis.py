import json

import cv2
import numpy as np
import redis
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image


# =========================
# CONFIG
# =========================
REDIS_HOST = "localhost"
REDIS_PORT = 6379

JOB_ID = "match_final_001"
INPUT_STREAM = f"vc:{JOB_ID}"
OUTPUT_STREAM = f"evt:foul:{JOB_ID}"

VIDEO_PATH = r"C:\Users\Moaz Alnoby\Downloads\football-ai1\football-ai1\football-ai\sports\121364_0.mp4"
MODEL_PATH = r"foul_clip_classifier.pt"

CLASS_NAMES = ["foul", "normal_clean", "normal_hard"]

CLIP_LEN = 6
CLIP_STRIDE = 3
FOUL_THRESHOLD = 0.80

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


# =========================
# MODEL
# =========================
class ClipResNet18(nn.Module):
    def __init__(self, num_classes=3):
        super().__init__()

        backbone = models.resnet18(weights=None)

        # نفس الشكل المتوقع من الـ checkpoint:
        # feature_extractor.* + classifier.*
        self.feature_extractor = nn.Sequential(*list(backbone.children())[:-1])
        self.classifier = nn.Linear(backbone.fc.in_features, num_classes)

    def forward(self, x):
        # x shape: [B, T, C, H, W]
        b, t, c, h, w = x.shape

        # flatten temporal dimension into batch
        x = x.view(b * t, c, h, w)

        # [B*T, 512, 1, 1]
        feats = self.feature_extractor(x)

        # [B, T, 512]
        feats = feats.view(b, t, -1)

        # temporal average pooling
        feats = feats.mean(dim=1)

        # [B, num_classes]
        out = self.classifier(feats)
        return out


def build_model():
    model = ClipResNet18(num_classes=len(CLASS_NAMES))

    checkpoint = torch.load(MODEL_PATH, map_location=DEVICE)

    # checkpoint محفوظ كـ dict فيه model_state_dict
    state_dict = checkpoint["model_state_dict"]
    model.load_state_dict(state_dict)

    model.to(DEVICE)
    model.eval()
    return model


# =========================
# PREPROCESS
# =========================
frame_tf = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
])


def preprocess_frames(frames_bgr):
    frames_rgb = [cv2.cvtColor(f, cv2.COLOR_BGR2RGB) for f in frames_bgr]
    pil_frames = [Image.fromarray(f) for f in frames_rgb]
    tensor_frames = [frame_tf(img) for img in pil_frames]

    # [T, C, H, W]
    clip_tensor = torch.stack(tensor_frames, dim=0)

    # [1, T, C, H, W]
    clip_tensor = clip_tensor.unsqueeze(0).to(DEVICE)
    return clip_tensor


# =========================
# VIDEO HELPERS
# =========================
def load_video_frames(video_path):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Could not open video: {video_path}")

    frames = []
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 25.0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frames.append(frame)

    cap.release()

    if len(frames) == 0:
        raise ValueError(f"Could not read any frames from {video_path}")

    return frames, fps


# =========================
# REDIS
# =========================
def write_event(r, event):
    r.xadd(OUTPUT_STREAM, {"data": json.dumps(event)})


# =========================
# MAIN
# =========================
def main():
    print(f"Using device: {DEVICE}")
    print(f"Reading Vision stream: {INPUT_STREAM}")
    print(f"Writing foul stream:   {OUTPUT_STREAM}")

    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

    all_frames, fps = load_video_frames(VIDEO_PATH)
    print(f"Loaded video frames: {len(all_frames)} | FPS: {fps:.2f}")

    model = build_model()

    packets = r.xrange(INPUT_STREAM)
    if not packets:
        print("[ERROR] No packets found in Vision stream.")
        return

    frame_ids = []
    timestamps = []

    for _, fields in packets:
        try:
            data = json.loads(fields["data"])
            frame_ids.append(int(data["frame_id"]))
            timestamps.append(float(data["timestamp_sec"]))
        except Exception:
            continue

    if not frame_ids:
        print("[ERROR] No valid frame_ids found in stream.")
        return

    clip_counter = 0
    last_written_end_sec = -999.0

    for start_idx in range(0, len(frame_ids) - CLIP_LEN + 1, CLIP_STRIDE):
        clip_frame_ids = frame_ids[start_idx:start_idx + CLIP_LEN]
        clip_times = timestamps[start_idx:start_idx + CLIP_LEN]

        selected_frames = []
        for fid in clip_frame_ids:
            if 0 <= fid < len(all_frames):
                selected_frames.append(all_frames[fid])

        if len(selected_frames) < CLIP_LEN:
            continue

        clip_tensor = preprocess_frames(selected_frames)

        with torch.no_grad():
            logits = model(clip_tensor)
            probs = torch.softmax(logits, dim=1)[0].cpu().numpy()

        pred_idx = int(np.argmax(probs))
        pred_label = CLASS_NAMES[pred_idx]
        conf = float(probs[pred_idx])

        start_sec = float(clip_times[0])
        end_sec = float(clip_times[-1])

        print(f"[{start_sec:.2f}s - {end_sec:.2f}s] Pred: {pred_label} | Conf: {conf:.3f}")

        if pred_label == "foul" and conf >= FOUL_THRESHOLD:
            # منع كتابة events متداخلة بشكل زائد
            if start_sec - last_written_end_sec < 0.5:
                continue

            event = {
                "job_id": JOB_ID,
                "event_type": "foul",
                "frame_start": int(clip_frame_ids[0]),
                "frame_end": int(clip_frame_ids[-1]),
                "start_sec": start_sec,
                "end_sec": end_sec,
                "label": pred_label,
                "confidence": conf,
                "source": "clip_classifier",
            }

            write_event(r, event)
            last_written_end_sec = end_sec
            clip_counter += 1
            print(f"  -> WROTE FOUL EVENT #{clip_counter}")

    print("Done.")


if __name__ == "__main__":
    main()