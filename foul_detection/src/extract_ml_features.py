import cv2
import csv
import os
import numpy as np

DATASET_DIR = r"C:\Users\Moaz Alnoby\Desktop\foul_project\dataset"
OUTPUT_CSV = "ml_foul_dataset.csv"

CLIP_SECONDS = 1.0
rows = []

def frame_difference(frame1, frame2):
    gray1 = cv2.cvtColor(frame1, cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(frame2, cv2.COLOR_BGR2GRAY)
    diff = cv2.absdiff(gray1, gray2)
    return np.mean(diff)

for split in ["train", "val", "test"]:
    split_path = os.path.join(DATASET_DIR, split)

    for label in ["foul", "normal_clean", "normal_hard"]:
        label_path = os.path.join(split_path, label)

        if not os.path.exists(label_path):
            print("Missing folder:", label_path)
            continue

        for video_name in os.listdir(label_path):
            if not video_name.lower().endswith((".mp4", ".avi", ".mov", ".mkv")):
                continue

            video_path = os.path.join(label_path, video_name)
            print("Processing:", split, label, video_name)

            cap = cv2.VideoCapture(video_path)

            if not cap.isOpened():
                print("Could not open:", video_path)
                continue

            fps = cap.get(cv2.CAP_PROP_FPS)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

            if fps <= 0 or total_frames <= 0:
                print("Invalid video:", video_path)
                cap.release()
                continue

            clip_size = int(fps * CLIP_SECONDS)
            clip_num = 1

            for start_frame in range(0, total_frames, clip_size):
                end_frame = min(start_frame + clip_size, total_frames)
                cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

                diffs = []
                prev_frame = None

                for _ in range(start_frame, end_frame):
                    ret, frame = cap.read()
                    if not ret:
                        break

                    if prev_frame is not None:
                        diffs.append(frame_difference(prev_frame, frame))

                    prev_frame = frame

                if len(diffs) == 0:
                    continue

                avg_diff = float(np.mean(diffs))
                max_diff = float(np.max(diffs))
                std_diff = float(np.std(diffs))

                mid = len(diffs) // 2
                first_half = diffs[:mid]
                second_half = diffs[mid:]

                motion_first_half = float(np.mean(first_half)) if len(first_half) > 0 else 0.0
                motion_second_half = float(np.mean(second_half)) if len(second_half) > 0 else 0.0
                motion_change = motion_second_half - motion_first_half

                peak_index = int(np.argmax(diffs))
                motion_peak_position = peak_index / len(diffs)

                rows.append([
                    split,
                    label,
                    video_name,
                    clip_num,
                    round(start_frame / fps, 2),
                    round(end_frame / fps, 2),
                    round(avg_diff, 2),
                    round(max_diff, 2),
                    round(std_diff, 2),
                    round(motion_first_half, 2),
                    round(motion_second_half, 2),
                    round(motion_change, 2),
                    round(motion_peak_position, 2)
                ])

                clip_num += 1

            cap.release()

with open(OUTPUT_CSV, "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow([
        "split",
        "label",
        "video_name",
        "clip_num",
        "start_sec",
        "end_sec",
        "avg_motion",
        "max_motion",
        "std_motion",
        "motion_first_half",
        "motion_second_half",
        "motion_change",
        "motion_peak_position"
    ])
    writer.writerows(rows)

print("Saved:", OUTPUT_CSV)
print("Total clips:", len(rows))