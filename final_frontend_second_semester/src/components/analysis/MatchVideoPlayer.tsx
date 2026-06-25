import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Maximize2, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMatchTime } from "@/utils/modelReaders";

export interface ReplayRange {
  start: number;
  end?: number;
  label?: string;
}

export interface MatchVideoPlayerHandle {
  playRange: (range: ReplayRange) => void;
  seekTo: (seconds: number) => void;
}

interface MatchVideoPlayerProps {
  src: string;
  title?: string;
  onTimeChange?: (seconds: number) => void;
}

export const MatchVideoPlayer = forwardRef<MatchVideoPlayerHandle, MatchVideoPlayerProps>(
  ({ src, title = "Match Video", onTimeChange }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [activeRange, setActiveRange] = useState<ReplayRange | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [playing, setPlaying] = useState(false);

    useImperativeHandle(ref, () => ({
      playRange(range) {
        const video = videoRef.current;
        if (!video) return;
        setActiveRange(range);
        video.currentTime = Math.max(0, range.start);
        void video.play();
      },
      seekTo(seconds) {
        const video = videoRef.current;
        if (!video) return;
        setActiveRange(null);
        video.currentTime = Math.max(0, seconds);
        void video.play();
      },
    }));

    const togglePlayback = () => {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) void video.play();
      else video.pause();
    };

    return (
      <Card className="overflow-hidden border-border/70 bg-card/70">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {activeRange?.label ? `${activeRange.label} · ` : ""}{formatMatchTime(currentTime)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" onClick={() => {
              const video = videoRef.current;
              if (!video) return;
              video.currentTime = activeRange?.start ?? 0;
            }}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button size="icon" onClick={togglePlayback}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="outline" onClick={() => videoRef.current?.requestFullscreen()}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <video
            ref={videoRef}
            src={src}
            controls
            preload="metadata"
            className="aspect-video w-full bg-black object-contain"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={() => {
              const video = videoRef.current;
              if (!video) return;
              setCurrentTime(video.currentTime);
              onTimeChange?.(video.currentTime);
              if (activeRange?.end !== undefined && video.currentTime >= activeRange.end) {
                video.pause();
                video.currentTime = activeRange.start;
              }
            }}
          />
        </CardContent>
      </Card>
    );
  },
);

MatchVideoPlayer.displayName = "MatchVideoPlayer";
