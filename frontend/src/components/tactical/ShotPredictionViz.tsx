import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ShotPrediction, Team } from "@/types/match";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ShotPredictionVizProps {
  shots: ShotPrediction[];
  selectedTeam?: Team | "both";
  className?: string;
}

export function ShotPredictionViz({
  shots = [],
  selectedTeam = "both",
  className,
}: ShotPredictionVizProps) {
  const filteredShots = useMemo(() => {
    if (selectedTeam === "both") return shots;
    return shots.filter((s) => s.team === selectedTeam);
  }, [shots, selectedTeam]);

  return (
    <div className={cn("relative aspect-[3/2] w-full", className)}>
      <svg viewBox="0 0 100 66.67" className="w-full h-full">
        {/* Pitch Background */}
        <rect
          x="0"
          y="0"
          width="100"
          height="66.67"
          fill="hsl(var(--muted)/0.3)"
          rx="2"
        />

        {/* Field Lines */}
        <g stroke="hsl(var(--border))" strokeWidth="0.3" fill="none">
          {/* Outer boundary */}
          <rect x="2" y="2" width="96" height="62.67" rx="1" />

          {/* Center line */}
          <line x1="50" y1="2" x2="50" y2="64.67" />

          {/* Center circle */}
          <circle cx="50" cy="33.33" r="9" />
          <circle cx="50" cy="33.33" r="0.5" fill="hsl(var(--border))" />

          {/* Left penalty area */}
          <rect x="2" y="16.67" width="16" height="33.33" />
          <rect x="2" y="22.22" width="6" height="22.22" />
          <circle cx="13" cy="33.33" r="0.5" fill="hsl(var(--border))" />
          <path d="M 18 27.33 A 9 9 0 0 1 18 39.33" />

          {/* Right penalty area */}
          <rect x="82" y="16.67" width="16" height="33.33" />
          <rect x="92" y="22.22" width="6" height="22.22" />
          <circle cx="87" cy="33.33" r="0.5" fill="hsl(var(--border))" />
          <path d="M 82 27.33 A 9 9 0 0 0 82 39.33" />

          {/* Goals */}
          <rect x="0" y="28.33" width="2" height="10" strokeWidth="0.5" />
          <rect x="98" y="28.33" width="2" height="10" strokeWidth="0.5" />
        </g>

        {/* Shots */}
        <TooltipProvider>
          {filteredShots.map((shot, index) => {
            const x = 2 + shot.x * 96;
            const y = 2 + shot.y * 62.67;
            const size = 1.2 + shot.xg * 2.5;
            const isGoal = shot.outcome === "goal";
            
            return (
              <Tooltip key={shot.id}>
                <TooltipTrigger asChild>
                  <motion.g
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="cursor-pointer"
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r={size}
                      fill={isGoal ? "hsl(var(--primary))" : "transparent"}
                      stroke={isGoal ? "white" : shot.team === "home" ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                      strokeWidth="0.4"
                      className={cn(isGoal && "drop-shadow-[0_0_2px_rgba(255,255,255,0.8)]")}
                    />
                    {!isGoal && (
                      <g stroke={shot.team === "home" ? "hsl(var(--primary))" : "hsl(var(--destructive))"} strokeWidth="0.3">
                        <line x1={x - size/1.4} y1={y - size/1.4} x2={x + size/1.4} y2={y + size/1.4} />
                        <line x1={x + size/1.4} y1={y - size/1.4} x2={x - size/1.4} y2={y + size/1.4} />
                      </g>
                    )}
                  </motion.g>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-foreground">{shot.player}</p>
                    <p className="text-muted-foreground">{shot.minute}' - {shot.outcome.replace('_', ' ')}</p>
                    <p className="text-primary font-mono font-bold">xG: {shot.xg.toFixed(2)}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </svg>

      {/* Legend */}
      <div className="absolute bottom-2 left-2 flex flex-col gap-1.5 text-[9px] bg-background/90 backdrop-blur-sm p-2 rounded-lg border border-border shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-primary border border-white" />
            <span className="text-muted-foreground">Goal</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 border border-muted-foreground relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-[0.5px] bg-muted-foreground rotate-45" />
                <div className="w-full h-[0.5px] bg-muted-foreground -rotate-45" />
              </div>
            </div>
            <span className="text-muted-foreground">Miss/Saved</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">xG value:</span>
          <div className="flex items-center gap-0.5">
            <div className="w-1 h-1 rounded-full bg-muted-foreground/50" />
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground" />
          </div>
          <span className="text-muted-foreground ml-0.5">High xG</span>
        </div>
      </div>
    </div>
  );
}






