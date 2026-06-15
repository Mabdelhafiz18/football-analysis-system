import cv2
import torch
from pathlib import Path
from torchvision import transforms
import torch.nn as nn
from torchvision import models


IMG_SIZE = 224
NUM_FRAMES = 16
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
MODEL_PATH = "foul_video_classifier.pt"
VIDEO_PATH = r"C:\Users\Moaz Alnoby\Desktop\foul_project\dataset\test\normal\some_video.mp4"


def sample_frame_indices(total_frames: int, num_frames: int):
    if total_frames < num_frames:
        indices = list(range(total_frames))
        while len(indices) < num_frames:
            indices.append(indices[-1])
        return indices
    step = total_frames / num_frames
    return [min(int(i * step), total_frames - 1) for i in range(num_frames)]


def load_video_frames(video_path: str, num_frames: int):
    cap = cv2.VideoCapture(video_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_indices = sample_frame_indices(total_frames, num_frames)

    frames = []
    current_idx = 0
    target_set = set(frame_indices)
    grabbed_frames = {}

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if current_idx in target_set:
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            grabbed_frames[current_idx] = frame

        current_idx += 1
        if len(grabbed_frames) == len(target_set):
            break

    cap.release()

    for idx in frame_indices:
        if idx in grabbed_frames:
            frames.append(grabbed_frames[idx])
        else:
            frames.append(frames[-1].copy())

    return frames


class VideoClassifier(nn.Module):
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

    model = VideoClassifier(num_classes=len(class_names)).to(DEVICE)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    transform = transforms.Compose([
        transforms.ToPILImage(),
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                             std=[0.229, 0.224, 0.225]),
    ])

    frames = load_video_frames(VIDEO_PATH, NUM_FRAMES)
    frames = [transform(f) for f in frames]
    video_tensor = torch.stack(frames, dim=0).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        logits = model(video_tensor)
        probs = torch.softmax(logits, dim=1)
        pred_idx = probs.argmax(dim=1).item()

    print("Prediction:", class_names[pred_idx])
    print("Probabilities:", probs.cpu().numpy())


if __name__ == "__main__":
    main()