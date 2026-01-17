import { motion, AnimatePresence } from "framer-motion";
import { Flag, AlertTriangle, Ruler, Target, User, Clock } from "lucide-react";
import { useIncidentContext } from "@/contexts/IncidentContext";
import { cn } from "@/lib/utils";
import type { OffsideIncident, FoulIncident, isOffsideIncident } from "@/types/decisions";

export function IncidentDetails() {
  const { selectedIncident } = useIncidentContext();

  if (!selectedIncident) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mb-3">
          <Target className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          Select an incident to view details
        </p>
      </div>
    );
  }

  const isOffside = selectedIncident.type === "offside";

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={selectedIncident.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="space-y-4"
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center",
              isOffside
                ? "bg-primary/20 text-primary lime-glow-soft"
                : "bg-destructive/20 text-destructive"
            )}
          >
            {isOffside ? (
              <Flag className="h-6 w-6" />
            ) : (
              <AlertTriangle className="h-6 w-6" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {isOffside ? "Offside Decision" : "Foul Decision"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {selectedIncident.minute}'{selectedIncident.second}" • {selectedIncident.team === "home" ? "Home" : "Away"} team
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="glass-card rounded-lg p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <User className="h-4 w-4" />
              <span className="text-xs">Player</span>
            </div>
            <p className="text-sm font-medium text-foreground truncate">
              Player #{selectedIncident.playerNumber}
            </p>
          </div>

          <div className="glass-card rounded-lg p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs">Time</span>
            </div>
            <p className="text-sm font-mono font-medium text-foreground">
              {selectedIncident.minute}:{selectedIncident.second.toString().padStart(2, "0")}
            </p>
          </div>

          {isOffside ? (
            <OffsideStats incident={selectedIncident as OffsideIncident} />
          ) : (
            <FoulStats incident={selectedIncident as FoulIncident} />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function OffsideStats({ incident }: { incident: OffsideIncident }) {
  const marginCm = Math.round(incident.marginMeters * 100);
  const isOffside = incident.decision === "offside";

  return (
    <>
      <div className="glass-card rounded-lg p-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Ruler className="h-4 w-4" />
          <span className="text-xs">Margin</span>
        </div>
        <p className={cn(
          "text-sm font-mono font-medium",
          isOffside ? "text-destructive" : "text-green-500"
        )}>
          {marginCm}cm {isOffside ? "offside" : "onside"}
        </p>
      </div>

      <div className="glass-card rounded-lg p-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Target className="h-4 w-4" />
          <span className="text-xs">Confidence</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className={cn(
                "h-full rounded-full",
                incident.confidence >= 0.9 ? "bg-green-500" :
                incident.confidence >= 0.8 ? "bg-yellow-500" : "bg-orange-500"
              )}
              initial={{ width: 0 }}
              animate={{ width: `${incident.confidence * 100}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          <span className="text-xs font-mono text-foreground">
            {Math.round(incident.confidence * 100)}%
          </span>
        </div>
      </div>
    </>
  );
}

function FoulStats({ incident }: { incident: FoulIncident }) {
  const severityColors = {
    low: "text-green-500",
    medium: "text-yellow-500",
    high: "text-destructive",
  };

  const cardColors = {
    none: "bg-muted text-muted-foreground",
    yellow: "bg-yellow-500/20 text-yellow-500",
    red: "bg-red-500/20 text-red-500",
  };

  return (
    <>
      <div className="glass-card rounded-lg p-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-xs">Severity</span>
        </div>
        <p className={cn("text-sm font-medium capitalize", severityColors[incident.severity])}>
          {incident.severity}
        </p>
      </div>

      <div className="glass-card rounded-lg p-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <div className="w-4 h-4 flex items-center justify-center">
            <div className={cn(
              "w-3 h-4 rounded-sm",
              incident.card === "yellow" ? "bg-yellow-500" :
              incident.card === "red" ? "bg-red-500" : "bg-muted"
            )} />
          </div>
          <span className="text-xs">Card</span>
        </div>
        <p className={cn(
          "text-sm font-medium capitalize px-2 py-0.5 rounded w-fit",
          cardColors[incident.card]
        )}>
          {incident.card === "none" ? "No Card" : incident.card}
        </p>
      </div>
    </>
  );
}

