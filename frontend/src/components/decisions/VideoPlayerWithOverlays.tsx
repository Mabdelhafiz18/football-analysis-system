import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useIncidentContext } from "@/contexts/IncidentContext";
import { OverlayControls } from "./OverlayControls";
import { cn } from "@/lib/utils";

interface VideoPlayerWithOverlaysProps {
  isLoading: boolean;
  videoSrc?: string;
}

const FRAME_RATE = 30; // Assumed frame rate
const FRAME_DURATION = 1 / FRAME_RATE;

export function VideoPlayerWithOverlays({ 
  isLoading, 
  videoSrc = "/hero-video.mp4" 
}: VideoPlayerWithOverlaysProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    currentTime,
    setCurrentTime,
    isPlaying,
    setIsPlaying,
    playbackRate,
    setPlaybackRate,
    selectedIncident,
    overlays,
  } = useIncidentContext();

  // Sync video time with context
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.5) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  // Update context when video time changes
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, [setCurrentTime]);

  // Play/pause sync
  useEffect(() => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.play().catch(() => setIsPlaying(false));
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying, setIsPlaying]);

  // Playback rate sync
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Handle video metadata loaded
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  // Frame stepping
  const stepFrame = (direction: "forward" | "backward") => {
    if (!videoRef.current) return;
    const newTime = videoRef.current.currentTime + (direction === "forward" ? FRAME_DURATION : -FRAME_DURATION);
    videoRef.current.currentTime = Math.max(0, Math.min(newTime, duration));
    setCurrentTime(videoRef.current.currentTime);
    setIsPlaying(false);
  };

  // Skip by seconds
  const skip = (seconds: number) => {
    if (!videoRef.current) return;
    const newTime = Math.max(0, Math.min(videoRef.current.currentTime + seconds, duration));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Fullscreen toggle
  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Auto-hide controls
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  };

  // Format time display
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Playback speed options
  const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <div
      ref={containerRef}
      className="relative glass-card rounded-2xl overflow-hidden group"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video Container */}
      <div className="relative aspect-video bg-black">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Video Element */}
            <video
              ref={videoRef}
              src={videoSrc}
              className="w-full h-full object-contain"
              muted={isMuted}
              playsInline
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              onClick={() => setIsPlaying(!isPlaying)}
            />

            {/* Overlays Container */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Offside Line Overlay */}
              <AnimatePresence>
                {overlays.showOffsideLine && selectedIncident?.type === "offside" && (
                  <motion.div
                    initial={{ opacity: 0, scaleY: 0 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    exit={{ opacity: 0, scaleY: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-0 bottom-0 w-0.5 bg-primary shadow-[0_0_10px_hsl(var(--primary))]"
                    style={{ left: "45%" }}
                  >
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary text-primary-foreground text-xs font-mono rounded">
                      OFFSIDE LINE
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Player Bounding Boxes */}
              <AnimatePresence>
                {overlays.showPlayers && (
                  <>
                    {/* Example player boxes - would be dynamic in production */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 0.8, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="absolute w-16 h-24 border-2 border-red-500 rounded"
                      style={{ left: "40%", top: "40%" }}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 0.8, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="absolute w-16 h-24 border-2 border-blue-500 rounded"
                      style={{ left: "50%", top: "35%" }}
                    />
                  </>
                )}
              </AnimatePresence>

              {/* Foul Highlight */}
              <AnimatePresence>
                {overlays.showFoulHighlight && selectedIncident?.type === "foul" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    className="absolute w-20 h-20 rounded-full border-4 border-destructive bg-destructive/20"
                    style={{ left: "45%", top: "50%", transform: "translate(-50%, -50%)" }}
                  >
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-destructive text-white text-xs font-mono rounded whitespace-nowrap">
                      CONTACT POINT
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Ball Marker */}
              <AnimatePresence>
                {overlays.showBall && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0 }}
                    className="absolute w-4 h-4 rounded-full bg-white border-2 border-yellow-400 shadow-lg"
                    style={{ left: "55%", top: "60%" }}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* Incident Badge */}
            <AnimatePresence>
              {selectedIncident && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={cn(
                    "absolute top-4 left-4 px-3 py-1.5 rounded-lg font-mono text-sm font-medium",
                    selectedIncident.type === "offside"
                      ? "bg-primary/90 text-primary-foreground"
                      : "bg-destructive/90 text-white"
                  )}
                >
                  {selectedIncident.type === "offside" ? "OFFSIDE" : "FOUL"} • {selectedIncident.minute}'{selectedIncident.second}"
                </motion.div>
              )}
            </AnimatePresence>

            {/* Play/Pause Overlay */}
            <AnimatePresence>
              {!isPlaying && showControls && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => setIsPlaying(true)}
                  className="absolute inset-0 flex items-center justify-center bg-black/20"
                >
                  <div className="w-20 h-20 rounded-full bg-primary/90 flex items-center justify-center lime-glow">
                    <Play className="w-10 h-10 text-primary-foreground ml-1" />
                  </div>
                </motion.button>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Controls Bar */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent"
          >
            {/* Progress Bar */}
            <div className="mb-3">
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={0.1}
                onValueChange={([value]) => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = value;
                    setCurrentTime(value);
                  }
                }}
                className="cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              {/* Left Controls */}
              <div className="flex items-center gap-1">
                {/* Skip Back */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => skip(-10)}
                  className="h-8 w-8 text-white hover:bg-white/20"
                >
                  <SkipBack className="h-4 w-4" />
                </Button>

                {/* Frame Back */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => stepFrame("backward")}
                  className="h-8 w-8 text-white hover:bg-white/20"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {/* Play/Pause */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="h-10 w-10 text-white hover:bg-white/20"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5 ml-0.5" />
                  )}
                </Button>

                {/* Frame Forward */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => stepFrame("forward")}
                  className="h-8 w-8 text-white hover:bg-white/20"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                {/* Skip Forward */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => skip(10)}
                  className="h-8 w-8 text-white hover:bg-white/20"
                >
                  <SkipForward className="h-4 w-4" />
                </Button>

                {/* Volume */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMuted(!isMuted)}
                  className="h-8 w-8 text-white hover:bg-white/20"
                >
                  {isMuted ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </Button>

                {/* Time Display */}
                <span className="text-white text-sm font-mono ml-2">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-2">
                {/* Playback Speed */}
                <select
                  value={playbackRate}
                  onChange={(e) => setPlaybackRate(Number(e.target.value))}
                  className="h-8 px-2 bg-white/10 border border-white/20 rounded text-white text-sm font-mono cursor-pointer hover:bg-white/20 transition-colors"
                >
                  {speeds.map((speed) => (
                    <option key={speed} value={speed} className="bg-gray-900">
                      {speed}x
                    </option>
                  ))}
                </select>

                {/* Overlay Controls */}
                <OverlayControls />

                {/* Fullscreen */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleFullscreen}
                  className="h-8 w-8 text-white hover:bg-white/20"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

