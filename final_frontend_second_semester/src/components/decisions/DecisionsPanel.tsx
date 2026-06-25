import { motion } from "framer-motion";
import { Flag, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { IncidentList } from "./IncidentList";
import { IncidentDetails } from "./IncidentDetails";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Incident, DecisionsSummary } from "@/types/decisions";

interface DecisionsPanelProps {
  incidents: Incident[];
  summary: DecisionsSummary;
  isLoading: boolean;
  offsidesError?: boolean;
  foulsError?: boolean;
}

export function DecisionsPanel({
  incidents,
  summary,
  isLoading,
  offsidesError,
  foulsError,
}: DecisionsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="glass-card rounded-2xl overflow-hidden h-fit sticky top-20">
      {/* Panel Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Decisions</h2>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="lg:hidden p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <SummaryCard
            icon={Flag}
            label="Offsides"
            home={summary.offsideCount.home}
            away={summary.offsideCount.away}
            color="primary"
            error={offsidesError}
          />
          <SummaryCard
            icon={AlertTriangle}
            label="Fouls"
            home={summary.foulCount.home}
            away={summary.foulCount.away}
            color="destructive"
            error={foulsError}
          />
        </div>

        {/* Cards Summary */}
        {(summary.cards.yellowHome + summary.cards.yellowAway + 
          summary.cards.redHome + summary.cards.redAway) > 0 && (
          <div className="flex items-center gap-3 mt-3 text-sm">
            {(summary.cards.yellowHome + summary.cards.yellowAway) > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-5 rounded-sm bg-yellow-500" />
                <span className="text-muted-foreground">
                  {summary.cards.yellowHome + summary.cards.yellowAway}
                </span>
              </div>
            )}
            {(summary.cards.redHome + summary.cards.redAway) > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-5 rounded-sm bg-red-500" />
                <span className="text-muted-foreground">
                  {summary.cards.redHome + summary.cards.redAway}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Collapsible Content */}
      <motion.div
        initial={false}
        animate={{ height: isExpanded ? "auto" : 0, opacity: isExpanded ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        <div className="p-4 space-y-4">
          {/* Incident List */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Incidents ({incidents.length})
            </h3>
            <IncidentList incidents={incidents} isLoading={isLoading} />
          </div>

          <Separator className="bg-border/50" />

          {/* Incident Details */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Details
            </h3>
            <IncidentDetails />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

interface SummaryCardProps {
  icon: typeof Flag;
  label: string;
  home: number;
  away: number;
  color: "primary" | "destructive";
  error?: boolean;
}

function SummaryCard({ icon: Icon, label, home, away, color, error }: SummaryCardProps) {
  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        "rounded-lg p-3 border",
        error
          ? "bg-muted/20 border-muted/50 opacity-50"
          : color === "primary"
          ? "bg-primary/5 border-primary/20"
          : "bg-destructive/5 border-destructive/20"
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon
          className={cn(
            "h-4 w-4",
            error
              ? "text-muted-foreground"
              : color === "primary"
              ? "text-primary"
              : "text-destructive"
          )}
        />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      
      {error ? (
        <p className="text-sm text-muted-foreground">Unavailable</p>
      ) : (
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono font-medium text-foreground">
            {home}
          </span>
          <span className="text-muted-foreground">H</span>
          <span className="text-muted-foreground">/</span>
          <span className="font-mono font-medium text-foreground">
            {away}
          </span>
          <span className="text-muted-foreground">A</span>
        </div>
      )}
    </motion.div>
  );
}

