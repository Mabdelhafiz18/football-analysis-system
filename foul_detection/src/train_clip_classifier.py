import os
import cv2
import torch
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
CLIP_LEN = 16
CLIP_STRIDE = 8
BATCH_SIZE = 4
NUM_EPOCHS = 10
LR = 1e-4
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
MODEL_SAVE_PATH = "foul_clip_classifier.pt"

CLASS_NAMES = ["foul", "normal_clean", "normal_hard"]
CLASS_TO_IDX = {name: i for i, name in enumerate(CLASS_NAMES)}


# =========================
# Video utils
# =========================
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


# =========================
# Dataset
# =========================
class ClipFolderDataset(Dataset):
    def __init__(self, root_dir: str, transform=None, clip_len: int = 16, clip_stride: int = 8):
        self.root_dir = Path(root_dir)
        self.transform = transform
        self.clip_len = clip_len
        self.clip_stride = clip_stride
        self.samples: List[Tuple[str, int, int]] = []  # (video_path, label, start_frame)

        for class_name in CLASS_NAMES:
            class_dir = self.root_dir / class_name
            if not class_dir.exists():
                continue

            for file_path in class_dir.iterdir():
                if file_path.suffix.lower() not in [".mp4", ".avi", ".mov", ".mkv"]:
                    continue

                total_frames = get_video_total_frames(str(file_path))
                if total_frames <= 0:
                    continue

                if total_frames <= clip_len:
                    self.samples.append((str(file_path), CLASS_TO_IDX[class_name], 0))
                else:
                    for start in range(0, total_frames - clip_len + 1, clip_stride):
                        self.samples.append((str(file_path), CLASS_TO_IDX[class_name], start))

        if len(self.samples) == 0:
            raise ValueError(f"No valid clips found in {root_dir}")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        video_path, label, start_frame = self.samples[idx]
        frames = load_clip_frames(video_path, start_frame, self.clip_len)

        processed_frames = []
        for frame in frames:
            if self.transform:
                frame = self.transform(frame)
            processed_frames.append(frame)

        clip_tensor = torch.stack(processed_frames, dim=0)  # [T, C, H, W]
        return clip_tensor, torch.tensor(label, dtype=torch.long)


# =========================
# Model
# =========================
class ClipClassifier(nn.Module):
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
        feats = feats.mean(dim=1)  # temporal average
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

    for clips, labels in loader:
        clips = clips.to(DEVICE)
        labels = labels.to(DEVICE)

        optimizer.zero_grad()
        outputs = model(clips)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        total_loss += loss.item() * labels.size(0)
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

    for clips, labels in loader:
        clips = clips.to(DEVICE)
        labels = labels.to(DEVICE)

        outputs = model(clips)
        loss = criterion(outputs, labels)

        total_loss += loss.item() * labels.size(0)
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

    train_dataset = ClipFolderDataset(
        root_dir=os.path.join(DATASET_ROOT, "train"),
        transform=transform,
        clip_len=CLIP_LEN,
        clip_stride=CLIP_STRIDE,
    )
    val_dataset = ClipFolderDataset(
        root_dir=os.path.join(DATASET_ROOT, "val"),
        transform=transform,
        clip_len=CLIP_LEN,
        clip_stride=CLIP_STRIDE,
    )
    test_dataset = ClipFolderDataset(
        root_dir=os.path.join(DATASET_ROOT, "test"),
        transform=transform,
        clip_len=CLIP_LEN,
        clip_stride=CLIP_STRIDE,
    )

    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)
    test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

    model = ClipClassifier(num_classes=len(CLASS_NAMES)).to(DEVICE)
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
                    "clip_len": CLIP_LEN,
                    "img_size": IMG_SIZE,
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