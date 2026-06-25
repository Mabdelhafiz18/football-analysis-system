import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  FileVideo,
  Loader2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { AppLayout } from "@/components/layout";
import { useUploadVideo } from "@/hooks/useMatches";
import { useUpload } from "@/contexts/UploadContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024;

export default function Upload() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadVideo();
  const { startBackgroundUpload } = useUpload();
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [form, setForm] = useState({ homeTeam: "", awayTeam: "", date: "", league: "" });

  const acceptFile = useCallback((candidate?: File) => {
    if (!candidate) return;
    if (!candidate.type.startsWith("video/")) {
      setError("The selected file is not a video.");
      return;
    }
    if (candidate.size > MAX_FILE_SIZE) {
      setError("The maximum upload size is 5 GB.");
      return;
    }
    setFile(candidate);
    setUploadProgress(0);
    setError(null);
  }, []);

  const submit = async () => {
    if (!file || !form.homeTeam || !form.awayTeam || !form.date || !form.league) {
      setError("Video, teams, date and league are required.");
      return;
    }
    try {
      setError(null);
      setUploadProgress(0);
      const response = await uploadMutation.mutateAsync({
        file,
        metadata: form,
        onProgress: setUploadProgress,
      });
      startBackgroundUpload(response.match_id, form.homeTeam, form.awayTeam);
      navigate(`/match/${response.match_id}/live`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
    }
  };

  return (
    <AppLayout title="Start AI Match Analysis">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/10 p-6 md:p-8">
          <div className="flex items-start gap-4"><div className="rounded-2xl bg-primary/15 p-3"><Sparkles className="h-7 w-7 text-primary" /></div><div><p className="text-xs font-bold uppercase tracking-[.22em] text-primary">KoraVision AI Pipeline</p><h1 className="mt-2 text-4xl font-black">Upload once. Watch every model live.</h1><p className="mt-3 max-w-3xl text-muted-foreground">The frontend sends the video only to the backend. The backend runs Vision and downstream Tactical, xG, Offside and Foul services, saves PostgreSQL results and streams live updates.</p></div></div>
        </section>

        {error && <Alert variant="destructive"><AlertTitle>Cannot start analysis</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

        <div className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
          <Card className="border-border/70 bg-card/65">
            <CardHeader><CardTitle>1. Match video</CardTitle></CardHeader>
            <CardContent>
              <div
                className={cn("flex min-h-80 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 text-center transition", dragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50")}
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files[0]); }}
              >
                <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(event) => acceptFile(event.target.files?.[0])} />
                {file ? <><div className="rounded-2xl bg-primary/15 p-4"><FileVideo className="h-10 w-10 text-primary" /></div><p className="mt-5 max-w-full truncate text-lg font-bold">{file.name}</p><p className="mt-1 text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p><Button type="button" variant="ghost" className="mt-4 gap-2" onClick={(event) => { event.stopPropagation(); setFile(null); setUploadProgress(0); }}><X className="h-4 w-4" />Remove</Button></> : <><div className="rounded-2xl bg-primary/15 p-4"><UploadCloud className="h-10 w-10 text-primary" /></div><h3 className="mt-5 text-xl font-black">Drop the original match video</h3><p className="mt-2 text-sm text-muted-foreground">MP4, MOV or AVI Ã‚Â· maximum 5 GB</p><Button type="button" variant="outline" className="mt-5">Browse video</Button></>}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/65">
            <CardHeader><CardTitle>2. Match identity</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Home team</Label><Input value={form.homeTeam} onChange={(e) => setForm({ ...form, homeTeam: e.target.value })} placeholder="Home team" /></div><div className="space-y-2"><Label>Away team</Label><Input value={form.awayTeam} onChange={(e) => setForm({ ...form, awayTeam: e.target.value })} placeholder="Away team" /></div></div>
              <div className="space-y-2"><Label>League / competition</Label><Input value={form.league} onChange={(e) => setForm({ ...form, league: e.target.value })} placeholder="Competition name" /></div>
              <div className="space-y-2"><Label>Match date</Label><div className="relative"><CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input type="datetime-local" className="pl-9" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div></div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-500" /><div><p className="font-bold">No synthetic results</p><p className="mt-1 text-xs leading-5 text-muted-foreground">The live workspace displays only fields returned by your models. Missing outputs remain marked unavailable.</p></div></div></div>
              <Button onClick={submit} disabled={uploadMutation.isPending} className="h-12 w-full gap-2 text-base font-bold">{uploadMutation.isPending ? <><Loader2 className="h-5 w-5 animate-spin" />Uploading to backend {uploadProgress > 0 ? `${uploadProgress}%` : ""}</> : <><UploadCloud className="h-5 w-5" />Start live analysis</>}</Button>
              {uploadMutation.isPending && <Progress value={uploadProgress} />}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
