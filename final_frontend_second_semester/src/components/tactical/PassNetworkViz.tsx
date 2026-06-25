import { useMemo } from "react";
import { motion } from "framer-motion";
import type { PassConnection, PlayerPosition } from "@/types/match";
import { cn } from "@/lib/utils";

interface PassNetworkVizProps {
  passes: PassConnection[];
  positions: PlayerPosition[];
  className?: string;
}

export function PassNetworkViz({ passes, positions, className }: PassNetworkVizProps) {
  // Create a map of player positions
  const positionMap = useMemo(() => {
    const map = new Map<number, { x: number; y: number }>();
    positions.forEach((p) => {
      map.set(p.playerId, { x: p.x, y: p.y });
    });
    return map;
  }, [positions]);

  // Normalize pass counts for line thickness
  const maxCount = Math.max(...passes.map((p) => p.count));

  return (
    <div className={cn("relative aspect-[3/2] w-full", className)}>
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

        {/* Field Lines (simplified) */}
        <g stroke="hsl(var(--border))" strokeWidth="0.2" fill="none" opacity="0.5">
          <rect x="2" y="2" width="96" height="62.67" rx="1" />
          <line x1="50" y1="2" x2="50" y2="64.67" />
          <circle cx="50" cy="33.33" r="9" />
        </g>

        {/* Pass Lines */}
        <g>
          {passes.map((pass, index) => {
            const from = positionMap.get(pass.from);
            const to = positionMap.get(pass.to);
            if (!from || !to) return null;

            const x1 = 2 + from.x * 96;
            const y1 = 2 + from.y * 62.67;
            const x2 = 2 + to.x * 96;
            const y2 = 2 + to.y * 62.67;

            const thickness = 0.5 + (pass.count / maxCount) * 2;
            const opacity = 0.3 + (pass.count / maxCount) * 0.5;

            return (
              <motion.line
                key={`${pass.from}-${pass.to}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="hsl(var(--primary))"
                strokeWidth={thickness}
                opacity={opacity}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: index * 0.05, duration: 0.5 }}
              />
            );
          })}
        </g>

        {/* Player Nodes */}
        <g>
          {positions
            .filter((p) => p.team === "home")
            .map((player, index) => {
              const x = 2 + player.x * 96;
              const y = 2 + player.y * 62.67;

              // Count total passes for this player
              const passesMade = passes
                .filter((p) => p.from === player.playerId)
                .reduce((sum, p) => sum + p.count, 0);
              const radius = 2 + (passesMade / 50) * 2;

              return (
                <motion.g
                  key={player.playerId}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={radius}
                    fill="hsl(var(--primary))"
                    stroke="white"
                    strokeWidth="0.4"
                  />
                  <text
                    x={x}
                    y={y + radius + 3}
                    textAnchor="middle"
                    fontSize="2"
                    fill="hsl(var(--foreground))"
                    className="select-none"
                  >
                    {player.playerId}
                  </text>
                </motion.g>
              );
            })}
        </g>
      </svg>

      {/* Legend */}
      <div className="absolute bottom-2 left-2 glass-card rounded-lg px-2 py-1">
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-6 h-0.5 bg-primary/30" />
            <span className="text-muted-foreground">Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-6 h-1 bg-primary" />
            <span className="text-muted-foreground">High</span>
          </div>
        </div>
      </div>
    </div>
  );
}

