import { Database, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function RealDataNotice() {
  return (
    <Alert className="border-emerald-500/25 bg-emerald-500/5">
      <ShieldCheck className="h-4 w-4 text-emerald-500" />
      <AlertTitle>Real model data only</AlertTitle>
      <AlertDescription className="flex items-center gap-2 text-xs text-muted-foreground">
        <Database className="h-3.5 w-3.5" />
        Values are read from PostgreSQL model windows and live SSE updates. Missing fields stay unavailable; the UI never fabricates values.
      </AlertDescription>
    </Alert>
  );
}
