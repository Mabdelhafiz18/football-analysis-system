import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload as UploadIcon,
  Video,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileVideo,
} from "lucide-react";
import { AppLayout } from "@/components/layout";
import { useUploadVideo, useMatchStatus } from "@/hooks/useMatches";
import { useUpload } from "@/contexts/UploadContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type UploadStatus = "idle" | "selected" | "uploading" | "processing" | "success" | "error";

export default function Upload() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadVideo();
  const { currentUpload, startBackgroundUpload, clearUpload } = useUpload();

  const [status, setStatus] = useState<UploadStatus>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchId, setMatchId] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    homeTeam: "",
    awayTeam: "",
    date: "",
    league: "",
  });

  // Poll match status when we have a matchId
  const { data: matchStatus } = useMatchStatus(matchId, {
    enabled: status === "processing" && !!matchId,
  });

  // React to status changes from server
  useEffect(() => {
    if (!matchStatus) return;

    // Update progress from server
    setProgress(matchStatus.progress);

    if (matchStatus.status === "completed") {
      setStatus("success");
    } else if (matchStatus.status === "failed") {
      setStatus("error");
      setError(matchStatus.error || "Processing failed");
    }
  }, [matchStatus]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith("video/")) {
      setFile(droppedFile);
      setStatus("selected");
      setError(null);
    } else {
      setError("Please upload a video file (MP4, MOV, AVI)");
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type.startsWith("video/")) {
        setFile(selectedFile);
        setStatus("selected");
        setError(null);
      } else {
        setError("Please upload a video file (MP4, MOV, AVI)");
      }
    }
  }, []);

  const handleRemoveFile = () => {
    setFile(null);
    setStatus("idle");
    setProgress(0);
    setMatchId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!file) return;

    // Validate form
    if (!formData.homeTeam || !formData.awayTeam || !formData.date || !formData.league) {
      setError("Please fill in all match details");
      return;
    }

    setStatus("uploading");
    setError(null);
    setProgress(0);

    try {
      const response = await uploadMutation.mutateAsync({
        file,
        metadata: formData,
      });

      // Store match_id and start polling (both local and background)
      setMatchId(response.match_id);
      startBackgroundUpload(response.match_id, formData.homeTeam, formData.awayTeam);
      setStatus("processing");
    } catch (err) {
      setStatus("error");
      setError("Upload failed. Please try again.");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <AppLayout title="Upload Video">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Upload Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "relative border-2 border-dashed rounded-2xl p-8 transition-all duration-200",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50",
            (status === "uploading" || status === "processing") && "pointer-events-none opacity-60"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <AnimatePresence mode="wait">
            {status === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <UploadIcon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Upload Match Video
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Drag & drop your video here, or click to browse
                </p>
                <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                  Select Video
                </Button>
                <p className="text-xs text-muted-foreground mt-4">
                  Supports: MP4, MOV, AVI (max 2GB)
                </p>
              </motion.div>
            )}

            {status === "selected" && file && (
              <motion.div
                key="selected"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-4"
              >
                <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FileVideo className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(file.size)} • {file.type}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRemoveFile}
                  className="flex-shrink-0"
                >
                  <X className="h-5 w-5" />
                </Button>
              </motion.div>
            )}

            {(status === "uploading" || status === "processing") && (
              <motion.div
                key="progress"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {status === "uploading" ? "Uploading..." : "Processing with AI..."}
                </h3>
                <Progress value={progress} className="w-full max-w-xs mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{progress}%</p>
              </motion.div>
            )}

            {status === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Upload Complete!
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Your match has been analyzed successfully
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      clearUpload();
                      navigate("/dashboard");
                    }}
                  >
                    Go to Dashboard
                  </Button>
                  <Button
                    onClick={() => {
                      clearUpload();
                      handleRemoveFile();
                      setFormData({ homeTeam: "", awayTeam: "", date: "", league: "" });
                    }}
                  >
                    Upload Another
                  </Button>
                </div>
              </motion.div>
            )}

            {status === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Upload Failed</h3>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <Button onClick={handleRemoveFile}>Try Again</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Error Message */}
        {error && status !== "error" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm"
          >
            {error}
          </motion.div>
        )}

        {/* Match Details Form */}
        <AnimatePresence>
          {status === "selected" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass-card rounded-xl p-6 space-y-4"
            >
              <h3 className="text-lg font-semibold text-foreground">Match Details</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="homeTeam">Home Team</Label>
                  <Input
                    id="homeTeam"
                    placeholder="e.g., Manchester United"
                    value={formData.homeTeam}
                    onChange={(e) => setFormData({ ...formData, homeTeam: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="awayTeam">Away Team</Label>
                  <Input
                    id="awayTeam"
                    placeholder="e.g., Liverpool"
                    value={formData.awayTeam}
                    onChange={(e) => setFormData({ ...formData, awayTeam: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Match Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="league">League / Competition</Label>
                  <Input
                    id="league"
                    placeholder="e.g., Premier League"
                    value={formData.league}
                    onChange={(e) => setFormData({ ...formData, league: e.target.value })}
                  />
                </div>
              </div>

              <Button onClick={handleSubmit} className="w-full gap-2 lime-glow">
                <Video className="h-4 w-4" />
                Start AI Analysis
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}

