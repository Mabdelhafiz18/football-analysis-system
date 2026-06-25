import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { PlayerPosition, Team } from "@/types/match";

interface PitchVisualizationProps {
  positions?: PlayerPosition[];
  heatmapData?: number[][];
  showHeatmap?: boolean;
  showFormation?: boolean;
  selectedTeam?: Team | "both";
  className?: string;
}

export function PitchVisualization({
  positions = [],
  heatmapData,
  showHeatmap = false,
  showFormation = true,
  selectedTeam = "both",
  className,
}: PitchVisualizationProps) {
  // Filter positions by team
  const filteredPositions = useMemo(() => {
    if (selectedTeam === "both") return positions;
    return positions.filter((p) => p.team === selectedTeam);
  }, [positions, selectedTeam]);

  return (
    <div className={cn("relative aspect-[3/2] w-full", className)}>
      {/* Pitch SVG */}
      <svg viewBox="0 0 100 66.67" className="w-full h-full">
        {/* Pitch Background */}
        <rect
          x="0"
          y="0"
          width="100"
          height="66.67"
          fill="hsl(var(--muted))"
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

        {/* Heatmap Layer */}
        {showHeatmap && heatmapData && (
          <g opacity="0.6">
            {heatmapData.flatMap((row, rowIndex) =>
              row.map((value, colIndex) => {
                const maxValue = Math.max(...heatmapData.flat());
                const intensity = value / maxValue;
                if (intensity < 0.1) return null;

                const cellWidth = 96 / row.length;
                const cellHeight = 62.67 / heatmapData.length;
                const x = 2 + colIndex * cellWidth;
                const y = 2 + rowIndex * cellHeight;

                return (
                  <rect
                    key={`${rowIndex}-${colIndex}`}
                    x={x}
                    y={y}
                    width={cellWidth}
                    height={cellHeight}
                    fill={`hsl(var(--primary) / ${intensity * 0.8})`}
                    rx="1"
                  />
                );
              })
            )}
          </g>
        )}

        {/* Player Positions */}
        {showFormation &&
          filteredPositions.map((player, index) => {
            const x = 2 + player.x * 96;
            const y = 2 + player.y * 62.67;
            const isHome = player.team === "home";

            return (
              <motion.g
                key={player.playerId}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.03 }}
              >
                {/* Player circle */}
                <circle
                  cx={x}
                  cy={y}
                  r="2.5"
                  fill={isHome ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                  stroke="white"
                  strokeWidth="0.3"
                />
                {/* Role label */}
                <text
                  x={x}
                  y={y + 0.8}
                  textAnchor="middle"
                  fontSize="1.8"
                  fill="white"
                  fontWeight="bold"
                  className="select-none"
                >
                  {player.role}
                </text>
              </motion.g>
            );
          })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-2 left-2 flex items-center gap-4 text-xs">
        {(selectedTeam === "both" || selectedTeam === "home") && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-muted-foreground">Home</span>
          </div>
        )}
        {(selectedTeam === "both" || selectedTeam === "away") && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <span className="text-muted-foreground">Away</span>
          </div>
        )}
      </div>
    </div>
  );
}

