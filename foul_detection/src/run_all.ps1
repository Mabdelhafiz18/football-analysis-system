#.\run_all.ps1
# 🔹 Activate Environment
cd "C:\Users\Moaz Alnoby\Downloads\football-ai1\football-ai1\football-ai\sports"
.\.venv\Scripts\Activate.ps1

cd foul_detection\src

# 🔹 Start Redis (لو مش شغال)
Start-Process powershell -ArgumentList "redis-server"

Start-Sleep -Seconds 3

# 🔹 Run Vision Core
Start-Process powershell -ArgumentList "python examples\soccer\Vision_core_rt.py --source_video_path `"121364_0.mp4`" --job_id match_final_001 --device cpu --redis_host localhost --redis_port 6379"

Start-Sleep -Seconds 5

# 🔹 Run Foul Detection V1
Start-Process powershell -ArgumentList "python run_foul_inference_redis.py"

Start-Sleep -Seconds 5

# 🔹 Run V2 Aggregation
Start-Process powershell -ArgumentList "python run_foul_inference_redis_v2.py"

Start-Sleep -Seconds 3

# 🔹 Run Context Layer
Start-Process powershell -ArgumentList "python run_foul_context_v2.py"

Start-Sleep -Seconds 3

# 🔹 Run Viewer
python view_with_redis_events.py