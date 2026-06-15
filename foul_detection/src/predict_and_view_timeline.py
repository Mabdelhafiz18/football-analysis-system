import cv2
import torch
from pathlib import Path
from typing import List, Tuple
from collections import deque
from torchvision import transforms
import torch.nn as nn
from torchvision import models


# =========================
# CONFIG
# =========================
MODEL_PATH = r"foul_clip_classifier.pt"
VIDEO_PATH = r"C:\Users\Moaz Alnoby\Downloads\football-ai1\football-ai1\football-ai\sports\121364_0.mp4"

CLIP_STRIDE = 8
ALERT_HOLD_SECONDS = 10
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


# =========================
# MODEL
# =========================
class ClipClassifier(nn.Module):
    def __init__(self, num_classes=3):
        super().__init__()
        backbone = models.resnet18(weights=None)
        self.feature_extractor = nn.Sequential(*list(backbone.children())[:-1])
        self.feature_dim = 512
        self.classifier = nn.Linear(self.feature_dim, num_classes)

    def forward(self, x):
        # x: [B, T, C, H, W]
        b, t, c, h, w = x.shape
        x = x.view(b * t, c, h, w)
        feats = self.feature_extractor(x)
        feats = feats.view(b, t, self.feature_dim)
        feats = feats.mean(dim=1)
        return self.classifier(feats)


# =========================
# VIDEO UTILS
# =========================
def get_video_info(video_path: str) -> Tuple[int, float]:
    cap = cv2.VideoCapture(video_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    cap.release()
    fps = fps if fps and fps > 0 else 25.0
    return total_frames, fps


def load_clip_frames(video_path: str, start_frame: int, clip_len: int) -> List:
    cap = cv2.VideoCapture(video_path)
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

    frames = []
    while len(frames) < clip_len:
        ret, frame = cap.read()
        if not ret:
            break
        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        frames.append(frame)

    cap.release()

    if len(frames) == 0:
        raise ValueError(f"Could not read frames from {video_path}")

    while len(frames) < clip_len:
        frames.append(frames[-1].copy())

    return frames


# =========================
# DRAW HELPERS
# =========================
def draw_text_block(frame, lines, x, y, bg_color=(0, 0, 0), text_color=(255, 255, 255), scale=0.7):
    font = cv2.FONT_HERSHEY_SIMPLEX
    thickness = 2
    line_height = 28

    widths = []
    for line in lines:
        (w, h), _ = cv2.getTextSize(line, font, scale, thickness)
        widths.append(w)

    box_w = max(widths) + 20
    box_h = line_height * len(lines) + 10

    cv2.rectangle(frame, (x, y), (x + box_w, y + box_h), bg_color, -1)

    for i, line in enumerate(lines):
        cv2.putText(
            frame,
            line,
            (x + 10, y + 25 + i * line_height),
            font,
            scale,
            text_color,
            thickness,
            cv2.LINE_AA,
        )


def draw_alert_banner(frame, label: str, confidence: float):
    lines = [
        "FOUL ALERT",
        f"Predicted class: {label}",
        f"Confidence: {confidence:.2f}",
    ]
    draw_text_block(
        frame,
        lines,
        x=20,
        y=20,
        bg_color=(0, 0, 180),
        text_color=(255, 255, 255),
        scale=0.9,
    )


def draw_status_panel(frame, clip_label: str, confidence: float, clip_start_sec: float, clip_end_sec: float):
    lines = [
        f"Clip prediction: {clip_label}",
        f"Confidence: {confidence:.2f}",
        f"Segment: {clip_start_sec:.2f}s -> {clip_end_sec:.2f}s",
    ]
    draw_text_block(
        frame,
        lines,
        x=20,
        y=130,
        bg_color=(30, 30, 30),
        text_color=(255, 255, 255),
        scale=0.7,
    )


# =========================
# MAIN
# =========================
def main():
    model_path = Path(MODEL_PATH)
    video_path = Path(VIDEO_PATH)

    if not model_path.exists():
        print(f"[ERROR] Model not found: {model_path}")
        return

    if not video_path.exists():
        print(f"[ERROR] Video not found: {video_path}")
        return

    checkpoint = torch.load(model_path, map_location=DEVICE)
    class_names = checkpoint["class_names"]
    clip_len = checkpoint["clip_len"]
    img_size = checkpoint["img_size"]

    model = ClipClassifier(num_classes=len(class_names)).to(DEVICE)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    transform = transforms.Compose([
        transforms.ToPILImage(),
        transforms.Resize((img_size, img_size)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        ),
    ])

    total_frames, fps = get_video_info(str(video_path))
    print(f"[INFO] Video: {video_path}")
    print(f"[INFO] Frames: {total_frames}, FPS: {fps:.2f}")

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print("[ERROR] Could not open video")
        return

    delay = int(1000 / fps)
    window_name = "Foul Classification V3 Viewer"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

    frame_index = 0
    next_prediction_frame = 0

    current_label = "loading..."
    current_confidence = 0.0
    current_clip_start = 0.0
    current_clip_end = 0.0

    alert_until_frame = -1

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[INFO] End of video")
            break

        # اعمل prediction كل CLIP_STRIDE frames
        if frame_index >= next_prediction_frame:
            try:
                clip_frames = load_clip_frames(str(video_path), frame_index, clip_len)
                clip_tensor = torch.stack([transform(f) for f in clip_frames], dim=0).unsqueeze(0).to(DEVICE)

                with torch.no_grad():
                    logits = model(clip_tensor)
                    probs = torch.softmax(logits, dim=1)[0]
                    pred_idx = probs.argmax().item()
                    pred_conf = probs[pred_idx].item()

                current_label = class_names[pred_idx]
                current_confidence = pred_conf
                current_clip_start = frame_index / fps
                current_clip_end = (frame_index + clip_len) / fps

                if current_label == "foul":
                    alert_until_frame = frame_index + int(ALERT_HOLD_SECONDS * fps)

                next_prediction_frame = frame_index + CLIP_STRIDE

            except Exception as e:
                print(f"[WARN] Prediction failed at frame {frame_index}: {e}")

        # header
        cv2.putText(
            frame,
            f"frame={frame_index} | time={frame_index / fps:.2f}s",
            (20, frame.shape[0] - 20),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (255, 255, 255),
            2,
            cv2.LINE_AA,
        )

        # status panel
        draw_status_panel(
            frame,
            current_label,
            current_confidence,
            current_clip_start,
            current_clip_end,
        )

        # foul alert
        if frame_index <= alert_until_frame:
            draw_alert_banner(frame, current_label, current_confidence)

        cv2.imshow(window_name, frame)

        key = cv2.waitKey(delay) & 0xFF
        if key == 27:  # ESC
            break
        elif key == ord(" "):  # pause / resume
            while True:
                pause_key = cv2.waitKey(0) & 0xFF
                if pause_key == ord(" "):
                    break
                if pause_key == 27:
                    cap.release()
                    cv2.destroyAllWindows()
                    return

        frame_index += 1

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()