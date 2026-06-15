# 🧠 AI VAR – Intelligent Foul Detection System (Version 2)

## 📌 Overview
This project presents a **hybrid AI-based VAR (Video Assistant Referee) system** for detecting football fouls from video streams.

It combines:
- 🎥 Computer Vision (Vision Core tracking)
- 🤖 Deep Learning (clip-based classifier)
- 📊 Machine Learning (motion-based baseline)
- ⚡ Redis Streams (real-time pipeline)
- 🧩 Context-aware reasoning (Version 2)

---

## ⚙️ System Architecture

### 🔹 Version 1 (Baseline)
Video → Deep Learning → Redis (evt:foul:{job_id}) → Viewer

❌ Problems:
- Noisy detections
- Frame-based decisions
- Multiple alerts per foul

---

### 🔹 Version 2 (Final System)

Video  
→ Vision Core (tracking) → Redis (vc:{job_id})  
→ Deep Learning → Redis (evt:foul:{job_id})  
→ Event Aggregation → Redis (evt:foul:v2:{job_id})  
→ Context Layer → Redis (evt:foul:final:{job_id})  
→ Viewer / Dashboard  

---

## 🚀 Core Features

### ✅ Deep Learning Detection
- Clip-based foul detection
- Outputs confidence + time range

### ✅ Redis Streaming
| Stream | Purpose |
|--------|--------|
| vc:{job_id} | Tracking data |
| evt:foul:{job_id} | Raw detections |
| evt:foul:v2:{job_id} | Aggregated events |
| evt:foul:final:{job_id} | Final intelligent events |

---

### ✅ Event Aggregation (Key Upgrade)
Converts:
Multiple detections → Single event

Each event contains:
- start time
- peak time
- end time
- confidence

---

### ✅ Context Layer (V2 Core)

Adds intelligence using Vision Core:

- 👤 offender_id / victim_id
- ⚽ ball_related detection
- 🔄 motion_conflict detection
- 🤝 duel_type classification
- 📊 severity scoring

---

## 📊 Final Output Example

```json
{
  "event_type": "foul",
  "start_sec": 0.01,
  "peak_sec": 0.22,
  "end_sec": 0.43,
  "offender_id": 5,
  "victim_id": 14,
  "team_id": 0,
  "duel_type": "normal_duel",
  "severity": "medium",
  "ball_related": false,
  "motion_conflict": false,
  "confidence": 0.856
}
```

---

## 📈 Improvements Over V1

| Feature | V1 | V2 |
|--------|----|----|
| Noise reduction | ❌ | ✅ |
| Event-based output | ❌ | ✅ |
| Player context | ❌ | ✅ |
| Ball awareness | ❌ | ✅ |
| Severity scoring | ❌ | ✅ |
| Dashboard-ready | ❌ | ✅ |

---

## 🎯 Why Version 2?

Version 1 was:
- Noisy
- Unrealistic
- Not usable in analysis

Version 2:
- Produces clean events
- Uses context (players + ball)
- Mimics real VAR decision flow

---

## ⚠️ Future Work

- Turnover detection
- Ball possession tracking
- Advanced duel classification
- Real-time optimization

---

## 🏁 Conclusion

This system evolved into a **Hybrid AI VAR System**:

Deep Learning + ML + Redis + Context Logic

It successfully transforms:
Noisy detections → Intelligent foul events

---

## 💬 Summary

Version 2 converts frame-level detections into structured, context-aware foul events suitable for real-world football analytics.
