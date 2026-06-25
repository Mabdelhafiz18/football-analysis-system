import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flag, AlertTriangle, Clock, Target, ChevronDown, ChevronUp, Play } from "lucide-react";
import { useIncidentContext } from "@/contexts/IncidentContext";
import { cn } from "@/lib/utils";
import type { Incident } from "@/types/decisions";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface UnifiedTimelineProps {
  incidents: Incident[];
  isLoading: boolean;
}

// Match duration in seconds (90 minutes)
const MATCH_DURATION = 90 * 60;

// Format time helper
const formatMatchTime = (minute: number, second: number) => {
  return `${minute}'${second.toString().padStart(2, "0")}"`;
};

export function UnifiedTimeline({ incidents, isLoading }: UnifiedTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [showEventList, setShowEventList] = useState(true);
  const { currentTime, selectedIncident, selectIncidentAndSeek, setCurrentTime, filter, setFilter } = useIncidentContext();

  // Auto-scroll to keep current time marker visible
  useEffect(() => {
    if (timelineRef.current) {
      const scrollPosition = (currentTime / MATCH_DURATION) * timelineRef.current.scrollWidth;
      const containerWidth = timelineRef.current.clientWidth;
      
      // Only scroll if marker is near edges
      if (scrollPosition < timelineRef.current.scrollLeft || 
          scrollPosition > timelineRef.current.scrollLeft + containerWidth - 50) {
        timelineRef.current.scrollTo({
          left: scrollPosition - containerWidth / 2,
          behavior: "smooth",
        });
      }
    }
  }, [currentTime]);

  // Handle timeline click for seeking
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + timelineRef.current.scrollLeft;
    const percentage = clickX / timelineRef.current.scrollWidth;
    const newTime = percentage * MATCH_DURATION;
    setCurrentTime(Math.max(0, Math.min(newTime, MATCH_DURATION)));
  };

  // Filter buttons
  const filterOptions = [
    { value: "all" as const, label: "All", count: incidents.length },
    { value: "offside" as const, label: "Offside", icon: Flag, color: "text-primary" },
    { value: "foul" as const, label: "Fouls", icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="glass-card rounded-xl p-4">
      {/* Filter Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
                "border border-border/50 hover:border-primary/50",
                filter === option.value
                  ? "bg-primary text-primary-foreground border-primary shadow-[0_0_15px_rgba(163,230,53,0.3)]"
                  : "bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <span className="flex items-center gap-1.5">
                {option.icon && <option.icon className={cn("h-3.5 w-3.5", option.color)} />}
                {option.label}
                {option.value === "all" && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-background/50 text-[10px]">
                    {option.count}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* Selected Incident Info */}
        <AnimatePresence mode="wait">
          {selectedIncident ? (
            <motion.div
              key={selectedIncident.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/20"
            >
              <div className={cn(
                "w-2 h-2 rounded-full animate-pulse",
                selectedIncident.type === "offside" ? "bg-primary" : "bg-destructive"
              )} />
              <span className="text-xs font-bold text-foreground truncate max-w-[150px]">
                Player #{selectedIncident.playerNumber}
              </span>
              <span className="text-[10px] text-muted-foreground">
                ({selectedIncident.minute}')
              </span>
            </motion.div>
          ) : (
            <div className="text-sm font-mono text-muted-foreground">
              {Math.floor(currentTime / 60)}'{Math.floor(currentTime % 60).toString().padStart(2, "0")}"
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Timeline Container */}
      <div className="relative">
        {isLoading ? (
          <div className="h-24 bg-muted/30 rounded-lg animate-pulse" />
        ) : (
          <>
            {/* Scrollable Timeline */}
            <div
              ref={timelineRef}
              onClick={handleTimelineClick}
              className="horizontal-scroll h-28 cursor-pointer relative pt-6"
              style={{ minWidth: "100%" }}
            >
              {/* Timeline Track */}
              <div 
                className="absolute inset-y-0 bg-gradient-to-b from-muted/5 to-muted/20 rounded-lg"
                style={{ width: `${Math.max(100, (MATCH_DURATION / 60) * 12)}%` }}
              >
                {/* Minute Ticks */}
                {Array.from({ length: 91 }).map((_, i) => {
                  const minute = i;
                  const position = (minute * 60 / MATCH_DURATION) * 100;
                  const isMajor = minute % 15 === 0;
                  const isMedium = minute % 5 === 0 && !isMajor;

                  return (
                    <div
                      key={minute}
                      className={cn(
                        "absolute bottom-0 w-px transition-colors",
                        isMajor ? "h-8 bg-border" : isMedium ? "h-5 bg-border/50" : "h-2 bg-border/20"
                      )}
                      style={{ left: `${position}%` }}
                    >
                      {isMajor && (
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-muted-foreground bg-background/80 px-1 rounded">
                          {minute}'
                        </span>
                      )}
                    </div>
                  );
                })}

                {/* Half-time marker */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-gradient-to-b from-primary/60 to-primary/20"
                  style={{ left: "50%" }}
                >
                  <div className="absolute top-1 left-1/2 -translate-x-1/2 px-2 py-1 bg-primary/20 border border-primary/50 rounded-lg text-[10px] font-bold text-primary backdrop-blur-sm">
                    HALF TIME
                  </div>
                </div>

                {/* Incident Markers with Time Labels */}
                <TooltipProvider delayDuration={100}>
                  <AnimatePresence mode="popLayout">
                    {incidents.map((incident, index) => {
                      const position = (incident.timestamp / MATCH_DURATION) * 100;
                      const isSelected = selectedIncident?.id === incident.id;
                      const isOffside = incident.type === "offside";
                      // Alternate label position to avoid overlap
                      const labelAbove = index % 2 === 0;

                      return (
                        <Tooltip key={incident.id}>
                          <TooltipTrigger asChild>
                            <motion.button
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ 
                                scale: isSelected ? 1.15 : 1, 
                                opacity: 1,
                                y: isSelected ? -4 : 0
                              }}
                              exit={{ scale: 0, opacity: 0 }}
                              whileHover={{ scale: 1.25, zIndex: 30 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                selectIncidentAndSeek(incident);
                              }}
                              className={cn(
                                "absolute top-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5",
                                "transition-all duration-200 z-10"
                              )}
                              style={{ left: `calc(${position}% - 18px)` }}
                            >
                              {/* Time Label Above (for alternating markers) */}
                              {labelAbove && (
                                <motion.span
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: isSelected ? 1 : 0.8, y: 0 }}
                                  className={cn(
                                    "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded whitespace-nowrap",
                                    isSelected
                                      ? isOffside
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-destructive text-white"
                                      : "bg-muted/80 text-muted-foreground"
                                  )}
                                >
                                  {incident.minute}'
                                </motion.span>
                              )}

                              {/* Marker Circle */}
                              <div
                                className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center shadow-lg",
                                  "transition-all duration-200",
                                  isSelected
                                    ? isOffside
                                      ? "bg-primary lime-glow border-2 border-white"
                                      : "bg-destructive shadow-[0_0_15px_rgba(239,68,68,0.5)] border-2 border-white"
                                    : isOffside
                                    ? "bg-primary/80 hover:bg-primary border border-primary-foreground/20"
                                    : "bg-destructive/80 hover:bg-destructive border border-white/20"
                                )}
                              >
                                {isOffside ? (
                                  <Flag className="h-4 w-4 text-primary-foreground" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-white" />
                                )}

                                {/* Selection pulse */}
                                {isSelected && (
                                  <motion.div
                                    className="absolute inset-0 rounded-full border-2 border-white/50"
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: [0, 0.8, 0], scale: [1, 1.5, 1] }}
                                    transition={{ repeat: Infinity, duration: 1.5 }}
                                  />
                                )}
                              </div>

                              {/* Time Label Below (for alternating markers) */}
                              {!labelAbove && (
                                <motion.span
                                  initial={{ opacity: 0, y: -5 }}
                                  animate={{ opacity: isSelected ? 1 : 0.8, y: 0 }}
                                  className={cn(
                                    "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded whitespace-nowrap",
                                    isSelected
                                      ? isOffside
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-destructive text-white"
                                      : "bg-muted/80 text-muted-foreground"
                                  )}
                                >
                                  {incident.minute}'
                                </motion.span>
                              )}
                            </motion.button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="p-0 overflow-hidden border-none shadow-2xl">
                            <div className={cn(
                              "px-3 py-2.5 flex flex-col gap-1.5 min-w-[160px]",
                              isOffside ? "bg-card border-l-4 border-primary" : "bg-card border-l-4 border-destructive"
                            )}>
                              <div className="flex items-center justify-between gap-4">
                                <span className={cn(
                                  "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                                  isOffside ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"
                                )}>
                                  {incident.type}
                                </span>
                                <span className="text-xs font-mono font-bold bg-muted px-2 py-0.5 rounded">
                                  {formatMatchTime(incident.minute, incident.second)}
                                </span>
                              </div>
                              <p className="text-sm font-bold text-foreground truncate">
                                Player #{incident.playerNumber}
                              </p>
                              <div className="flex items-center justify-between pt-1 border-t border-border/50">
                                <div className="flex items-center gap-1">
                                  <Target className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-[10px] text-muted-foreground">
                                    {Math.round(incident.confidence * 100)}% confidence
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground uppercase">
                                  {incident.team}
                                </span>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </AnimatePresence>
                </TooltipProvider>

                {/* Current Time Playhead */}
                <motion.div
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)] z-20"
                  style={{ left: `${(currentTime / MATCH_DURATION) * 100}%` }}
                  initial={false}
                  animate={{ left: `${(currentTime / MATCH_DURATION) * 100}%` }}
                  transition={{ type: "tween", duration: 0.1 }}
                >
                  {/* Playhead handle */}
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white border-2 border-primary shadow-[0_0_10px_rgba(163,230,53,0.5)] flex items-center justify-center">
                    <Play className="h-2.5 w-2.5 text-primary fill-primary ml-0.5" />
                  </div>
                  
                  {/* Floating time display above playhead */}
                  <motion.div 
                    className="absolute -top-12 left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-white text-background text-xs font-mono font-bold rounded-lg shadow-lg whitespace-nowrap"
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                  >
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, "0")}
                    </div>
                  </motion.div>
                </motion.div>
              </div>
            </div>

            {/* Gradient overlays for scroll indication */}
            <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-card via-card/80 to-transparent pointer-events-none rounded-l-lg" />
            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-card via-card/80 to-transparent pointer-events-none rounded-r-lg" />
          </>
        )}
      </div>

      {/* Event List Toggle */}
      <button
        onClick={() => setShowEventList(!showEventList)}
        className="w-full mt-4 flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors border-t border-border/30"
      >
        {showEventList ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        {showEventList ? "Hide" : "Show"} Event List ({incidents.length} events)
      </button>

      {/* Scrollable Event List */}
      <AnimatePresence>
        {showEventList && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 max-h-48 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
              {incidents.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">No events to display</p>
              ) : (
                incidents
                  .sort((a, b) => a.timestamp - b.timestamp)
                  .map((incident, index) => {
                    const isSelected = selectedIncident?.id === incident.id;
                    const isOffside = incident.type === "offside";

                    return (
                      <motion.button
                        key={incident.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.03 }}
                        onClick={() => selectIncidentAndSeek(incident)}
                        className={cn(
                          "w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all",
                          "hover:bg-muted/50 group",
                          isSelected && (isOffside ? "bg-primary/10 border border-primary/30" : "bg-destructive/10 border border-destructive/30")
                        )}
                      >
                        {/* Time Badge */}
                        <div className={cn(
                          "flex-shrink-0 w-14 text-center py-1.5 rounded-md font-mono text-xs font-bold",
                          isSelected
                            ? isOffside
                              ? "bg-primary text-primary-foreground"
                              : "bg-destructive text-white"
                            : "bg-muted text-muted-foreground group-hover:bg-muted/80"
                        )}>
                          {incident.minute}'{incident.second.toString().padStart(2, "0")}"
                        </div>

                        {/* Icon */}
                        <div className={cn(
                          "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
                          isOffside ? "bg-primary/20" : "bg-destructive/20"
                        )}>
                          {isOffside ? (
                            <Flag className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground truncate">
                              Player #{incident.playerNumber}
                            </span>
                            <span className={cn(
                              "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
                              isOffside ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                            )}>
                              {incident.type}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className="uppercase">{incident.team}</span>
                            <span>•</span>
                            <span>{Math.round(incident.confidence * 100)}% confidence</span>
                          </div>
                        </div>

                        {/* Play indicator */}
                        <div className={cn(
                          "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-opacity",
                          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-50"
                        )}>
                          <Play className={cn(
                            "h-3 w-3 ml-0.5",
                            isOffside ? "text-primary fill-primary" : "text-destructive fill-destructive"
                          )} />
                        </div>
                      </motion.button>
                    );
                  })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Incident count footer */}
      <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-center gap-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-primary/80" />
          <Flag className="h-3 w-3 text-primary" />
          <span className="font-medium">{incidents.filter((i) => i.type === "offside").length}</span> offsides
        </span>
        <span className="w-px h-4 bg-border" />
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-destructive/80" />
          <AlertTriangle className="h-3 w-3 text-destructive" />
          <span className="font-medium">{incidents.filter((i) => i.type === "foul").length}</span> fouls
        </span>
      </div>
    </div>
  );
}

