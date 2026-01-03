import { motion } from "framer-motion";
import { Flag, AlertTriangle, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIncidentContext } from "@/contexts/IncidentContext";
import { cn } from "@/lib/utils";
import type { Incident, FoulIncident } from "@/types/decisions";

interface IncidentListProps {
  incidents: Incident[];
  isLoading: boolean;
}

export function IncidentList({ incidents, isLoading }: IncidentListProps) {
  const { selectedIncident, selectIncidentAndSeek } = useIncidentContext();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-16 bg-muted/30 rounded-lg animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>
    );
  }

  if (incidents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
          <Flag className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">No incidents match the current filter</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-2">
      <div className="space-y-2">
        {incidents.map((incident, index) => {
          const isSelected = selectedIncident?.id === incident.id;
          const isOffside = incident.type === "offside";
          const foulIncident = incident as FoulIncident;

          return (
            <motion.button
              key={incident.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => selectIncidentAndSeek(incident)}
              className={cn(
                "w-full p-3 rounded-lg text-left transition-all duration-200",
                "border border-border/50 hover:border-primary/50",
                "focus:outline-none focus:ring-2 focus:ring-primary/50",
                isSelected
                  ? "bg-primary/10 border-primary"
                  : "bg-muted/20 hover:bg-muted/40"
              )}
            >
              <div className="flex items-center gap-3">
                {/* Type Icon */}
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                    isOffside
                      ? "bg-primary/20 text-primary"
                      : "bg-destructive/20 text-destructive"
                  )}
                >
                  {isOffside ? (
                    <Flag className="h-5 w-5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {/* Type Badge */}
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-xs font-medium uppercase",
                        isOffside
                          ? "bg-primary/20 text-primary"
                          : "bg-destructive/20 text-destructive"
                      )}
                    >
                      {incident.type}
                    </span>

                    {/* Card Badge (for fouls) */}
                    {!isOffside && foulIncident.card !== "none" && (
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-xs font-medium",
                          foulIncident.card === "yellow"
                            ? "bg-yellow-500/20 text-yellow-500"
                            : "bg-red-500/20 text-red-500"
                        )}
                      >
                        {foulIncident.card.toUpperCase()}
                      </span>
                    )}

                    {/* Key Decision Indicator */}
                    {incident.isKeyDecision && (
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-primary/20 text-primary">
                        KEY
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <div>
                      <span className="text-sm font-medium text-foreground truncate">
                        {incident.player}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({incident.team === "home" ? "H" : "A"})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {/* Timestamp */}
                    <span className="font-mono">
                      {incident.minute}'{incident.second.toString().padStart(2, "0")}"
                    </span>

                    {/* Confidence */}
                    <span className="w-px h-3 bg-border" />
                    <span className={cn(
                      incident.confidence >= 0.9 ? "text-green-500" :
                      incident.confidence >= 0.8 ? "text-yellow-500" : "text-orange-500"
                    )}>
                      {Math.round(incident.confidence * 100)}% conf
                    </span>
                  </div>
                </div>

                {/* Arrow */}
                <ChevronRight
                  className={cn(
                    "h-5 w-5 text-muted-foreground transition-transform",
                    isSelected && "text-primary rotate-90"
                  )}
                />
              </div>
            </motion.button>
          );
        })}
      </div>
    </ScrollArea>
  );
}

