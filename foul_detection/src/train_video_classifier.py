import os
import cv2
import math
import torch
import random
from pathlib import Path
from typing import List, Tuple

import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from torchvision import models, transforms


# =========================
# Config
# =========================
DATASET_ROOT = r"C:\Users\Moaz Alnoby\Desktop\foul_project\dataset"
IMG_SIZE = 224
NUM_FRAMES = 16
BATCH_SIZE = 4
NUM_EPOCHS = 10
LR = 1e-4
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
MODEL_SAVE_PATH = "foul_video_classifier.pt"

CLASS_NAMES = ["foul", "normal_clean", "normal_hard"]
CLASS_TO_IDX = {name: i for i, name in enumerate(CLASS_NAMES)}


# =========================
# Utils
# =========================
def sample_frame_indices(total_frames: int, num_frames: int) -> List[int]:
    if total_frames <= 0:
        return [0] * num_frames

    if total_frames < num_frames:
        indices = list(range(total_frames))
        while len(indices) < num_frames:
            indices.append(indices[-1])
        return indices

    step = total_frames / num_frames
    return [min(int(i * step), total_frames - 1) for i in range(num_frames)]


def load_video_frames(video_path: str, num_frames: int) -> List:
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
            if len(frames) > 0:
                frames.append(frames[-1].copy())
            else:
                frames.append(
                    (255 * torch.zeros(IMG_SIZE, IMG_SIZE, 3).numpy()).astype("uint8")
                )

    return frames


# =========================
# Dataset
# =========================
class VideoFolderDataset(Dataset):
    def __init__(self, root_dir: str, transform=None, num_frames: int = 16):
        self.root_dir = Path(root_dir)
        self.transform = transform
        self.num_frames = num_frames
        self.samples: List[Tuple[str, int]] = []

        for class_name in CLASS_NAMES:
            class_dir = self.root_dir / class_name
            if not class_dir.exists():
                continue

            for file_path in class_dir.iterdir():
                if file_path.suffix.lower() in [".mp4", ".avi", ".mov", ".mkv"]:
                    self.samples.append((str(file_path), CLASS_TO_IDX[class_name]))

        if len(self.samples) == 0:
            raise ValueError(f"No videos found in {root_dir}")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        video_path, label = self.samples[idx]
        frames = load_video_frames(video_path, self.num_frames)

        processed_frames = []
        for frame in frames:
            if self.transform:
                frame = self.transform(frame)
            processed_frames.append(frame)

        video_tensor = torch.stack(processed_frames, dim=0)  # [T, C, H, W]
        label_tensor = torch.tensor(label, dtype=torch.long)

        return video_tensor, label_tensor


# =========================
# Model
# =========================
class VideoClassifier(nn.Module):
    def __init__(self, num_classes: int = 3):
        super().__init__()
        backbone = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
        self.feature_extractor = nn.Sequential(*list(backbone.children())[:-1])
        self.feature_dim = 512
        self.classifier = nn.Linear(self.feature_dim, num_classes)

    def forward(self, x):
        # x: [B, T, C, H, W]
        b, t, c, h, w = x.shape
        x = x.view(b * t, c, h, w)

        feats = self.feature_extractor(x)  # [B*T, 512, 1, 1]
        feats = feats.view(b, t, self.feature_dim)
        feats = feats.mean(dim=1)  # temporal average pooling

        out = self.classifier(feats)
        return out


# =========================
# Train / Eval
# =========================
def train_one_epoch(model, loader, criterion, optimizer):
    model.train()
    total_loss = 0.0
    total_correct = 0
    total_count = 0

    for videos, labels in loader:
        videos = videos.to(DEVICE)
        labels = labels.to(DEVICE)

        optimizer.zero_grad()
        outputs = model(videos)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        total_loss += loss.item() * videos.size(0)
        preds = outputs.argmax(dim=1)
        total_correct += (preds == labels).sum().item()
        total_count += labels.size(0)

    return total_loss / total_count, total_correct / total_count


@torch.no_grad()
def evaluate(model, loader, criterion):
    model.eval()
    total_loss = 0.0
    total_correct = 0
    total_count = 0

    for videos, labels in loader:
        videos = videos.to(DEVICE)
        labels = labels.to(DEVICE)

        outputs = model(videos)
        loss = criterion(outputs, labels)

        total_loss += loss.item() * videos.size(0)
        preds = outputs.argmax(dim=1)
        total_correct += (preds == labels).sum().item()
        total_count += labels.size(0)

    return total_loss / total_count, total_correct / total_count


def main():
    print(f"Using device: {DEVICE}")

    transform = transforms.Compose([
        transforms.ToPILImage(),
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                             std=[0.229, 0.224, 0.225]),
    ])

    train_dataset = VideoFolderDataset(
        root_dir=os.path.join(DATASET_ROOT, "train"),
        transform=transform,
        num_frames=NUM_FRAMES,
    )
    val_dataset = VideoFolderDataset(
        root_dir=os.path.join(DATASET_ROOT, "val"),
        transform=transform,
        num_frames=NUM_FRAMES,
    )
    test_dataset = VideoFolderDataset(
        root_dir=os.path.join(DATASET_ROOT, "test"),
        transform=transform,
        num_frames=NUM_FRAMES,
    )

    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)
    test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

    model = VideoClassifier(num_classes=len(CLASS_NAMES)).to(DEVICE)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=LR)

    best_val_acc = 0.0

    for epoch in range(NUM_EPOCHS):
        train_loss, train_acc = train_one_epoch(model, train_loader, criterion, optimizer)
        val_loss, val_acc = evaluate(model, val_loader, criterion)

        print(
            f"Epoch [{epoch+1}/{NUM_EPOCHS}] "
            f"Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.4f} | "
            f"Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.4f}"
        )

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(
                {
                    "model_state_dict": model.state_dict(),
                    "class_names": CLASS_NAMES,
                },
                MODEL_SAVE_PATH,
            )
            print(f"Saved best model to {MODEL_SAVE_PATH}")

    checkpoint = torch.load(MODEL_SAVE_PATH, map_location=DEVICE)
    model.load_state_dict(checkpoint["model_state_dict"])

    test_loss, test_acc = evaluate(model, test_loader, criterion)
    print(f"\nFinal Test Loss: {test_loss:.4f} | Final Test Acc: {test_acc:.4f}")


if __name__ == "__main__":
    main()