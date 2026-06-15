param(
    [Parameter(Mandatory=$true)]
    [string]$VideoPath,

    [string]$VisionNdjson = "sample_data/vision_sample.ndjson",
    [string]$OutputVideo = "outputs/tactical_overlay.mp4"
)

$env:PYTHONPATH="src"
python src/video_demo.py --video $VideoPath --vision $VisionNdjson --output-video $OutputVideo --output-json outputs/latest_tactical_output.json
