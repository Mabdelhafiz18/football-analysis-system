import cv2
import torch
from pathlib import Path
from typing import List
from torchvision import transforms
import torch.nn as nn
from torchvision import models


MODEL_PATH = "foul_clip_classifier.pt"
VIDEO_PATH = r"C:\Users\Moaz Alnoby\Downloads\football-ai1\football-ai1\football-ai\sports\121364_0.mp4"

CLIP_STRIDE = 8
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


def get_video_total_frames(video_path: str) -> int:
    cap = cv2.VideoCapture(video_path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()
    return total


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
        raise ValueError(f"Could not read any frames from {video_path}")

    while len(frames) < clip_len:
        frames.append(frames[-1].copy())

    return frames


class ClipClassifier(nn.Module):
    def __init__(self, num_classes=3):
        super().__init__()
        backbone = models.resnet18(weights=None)
        self.feature_extractor = nn.Sequential(*list(backbone.children())[:-1])
        self.feature_dim = 512
        self.classifier = nn.Linear(self.feature_dim, num_classes)

    def forward(self, x):
        b, t, c, h, w = x.shape
        x = x.view(b * t, c, h, w)
        feats = self.feature_extractor(x)
        feats = feats.view(b, t, self.feature_dim)
        feats = feats.mean(dim=1)
        return self.classifier(feats)


def main():
    checkpoint = torch.load(MODEL_PATH, map_location=DEVICE)
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
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                             std=[0.229, 0.224, 0.225]),
    ])

    cap = cv2.VideoCapture(VIDEO_PATH)
    fps = cap.get(cv2.CAP_PROP_FPS)
    cap.release()
    fps = fps if fps and fps > 0 else 25.0

    total_frames = get_video_total_frames(VIDEO_PATH)

    print(f"Video: {VIDEO_PATH}")
    print(f"Total frames: {total_frames}, FPS: {fps:.2f}")
    print("-" * 60)

    for start_frame in range(0, max(1, total_frames - clip_len + 1), CLIP_STRIDE):
        frames = load_clip_frames(VIDEO_PATH, start_frame, clip_len)
        frames = [transform(f) for f in frames]
        clip_tensor = torch.stack(frames, dim=0).unsqueeze(0).to(DEVICE)

        with torch.no_grad():
            logits = model(clip_tensor)
            probs = torch.softmax(logits, dim=1)[0]
            pred_idx = probs.argmax().item()

        start_sec = start_frame / fps
        end_sec = (start_frame + clip_len) / fps

        print(
            f"[{start_sec:.2f}s - {end_sec:.2f}s] "
            f"Pred: {class_names[pred_idx]} | "
            f"Probs: {probs.cpu().numpy()}"
        )


if __name__ == "__main__":
    main()