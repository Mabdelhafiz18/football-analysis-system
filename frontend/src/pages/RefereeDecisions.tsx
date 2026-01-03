import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PanelRightOpen, X } from "lucide-react";
import { IncidentProvider, useIncidentContext } from "@/contexts/IncidentContext";
import { useDecisions, useMatchInfo } from "@/hooks/useDecisions";
import { DecisionsHeader } from "@/components/decisions/DecisionsHeader";
import { VideoPlayerWithOverlays } from "@/components/decisions/VideoPlayerWithOverlays";
import { UnifiedTimeline } from "@/components/decisions/UnifiedTimeline";
import { DecisionsPanel } from "@/components/decisions/DecisionsPanel";
import { Button } from "@/components/ui/button";

function RefereeDecisionsContent() {
  const { id, analysisId } = useParams<{ id?: string; analysisId?: string }>();
  const matchId = id || analysisId || "1";
  const { incidents, summary, isLoading, isError, offsidesError, foulsError } = useDecisions(matchId);
  const { data: matchInfo, isLoading: matchLoading } = useMatchInfo(matchId);
  const { selectedIncident, selectIncidentAndSeek, filter } = useIncidentContext();
  
  // Mobile panel state
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);

  // Auto-select first incident on load
  useEffect(() => {
    if (incidents.length > 0 && !selectedIncident) {
      selectIncidentAndSeek(incidents[0]);
    }
  }, [incidents, selectedIncident, selectIncidentAndSeek]);

  // Filter incidents based on current filter
  const filteredIncidents = incidents.filter((incident) => {
    if (filter === "all") return true;
    return incident.type === filter;
  });

  // Handle filter change - select nearest incident if current is filtered out
  useEffect(() => {
    if (selectedIncident && filter !== "all" && selectedIncident.type !== filter) {
      const nearestIncident = filteredIncidents.reduce((nearest, incident) => {
        if (!nearest) return incident;
        const currentDiff = Math.abs(incident.timestamp - selectedIncident.timestamp);
        const nearestDiff = Math.abs(nearest.timestamp - selectedIncident.timestamp);
        return currentDiff < nearestDiff ? incident : nearest;
      }, filteredIncidents[0]);
      
      if (nearestIncident) {
        selectIncidentAndSeek(nearestIncident);
      }
    }
  }, [filter, selectedIncident, filteredIncidents, selectIncidentAndSeek]);

  // Close mobile panel when incident is selected
  useEffect(() => {
    if (selectedIncident && window.innerWidth < 1024) {
      // Small delay to show the selection before closing
      const timer = setTimeout(() => setIsMobilePanelOpen(false), 300);
      return () => clearTimeout(timer);
    }
  }, [selectedIncident]);

  return (
    <div className="relative min-h-screen bg-background">
      {/* Grid Background */}
      <div className="pointer-events-none fixed inset-0 grid-background opacity-30" />

      {/* Header */}
      <DecisionsHeader 
        matchInfo={matchInfo} 
        summary={summary} 
        isLoading={matchLoading} 
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4 pb-20 lg:pb-4">
        {/* Error States */}
        {isError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive"
          >
            Failed to load decision data. Please try again.
          </motion.div>
        )}

        {/* Partial Error States */}
        {(offsidesError || foulsError) && !isError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-400 text-sm"
          >
            {offsidesError && "Offside data unavailable. "}
            {foulsError && "Foul data unavailable. "}
            Showing available data.
          </motion.div>
        )}

        {/* Desktop Layout: Video + Panel side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
          {/* Left Column: Video Player */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            <VideoPlayerWithOverlays isLoading={isLoading} />
            
            {/* Timeline - Below video */}
            <UnifiedTimeline 
              incidents={filteredIncidents} 
              isLoading={isLoading} 
            />
          </motion.div>

          {/* Right Column: Decisions Panel - Hidden on mobile */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="hidden lg:block"
          >
            <DecisionsPanel 
              incidents={filteredIncidents}
              summary={summary}
              isLoading={isLoading}
              offsidesError={offsidesError}
              foulsError={foulsError}
            />
          </motion.div>
        </div>

        {/* Mobile Floating Button */}
        <div className="fixed bottom-4 right-4 lg:hidden z-40">
          <Button
            onClick={() => setIsMobilePanelOpen(true)}
            size="lg"
            className="rounded-full shadow-lg lime-glow h-14 w-14"
          >
            <PanelRightOpen className="h-6 w-6" />
          </Button>
        </div>

        {/* Mobile Bottom Sheet */}
        <AnimatePresence>
          {isMobilePanelOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobilePanelOpen(false)}
                className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              />

              {/* Bottom Sheet */}
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed inset-x-0 bottom-0 z-50 lg:hidden max-h-[85vh] overflow-hidden"
              >
                <div className="bg-card rounded-t-3xl shadow-2xl overflow-hidden">
                  {/* Handle */}
                  <div className="flex items-center justify-center py-3 border-b border-border/50">
                    <div className="w-12 h-1.5 bg-muted rounded-full" />
                  </div>

                  {/* Close Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsMobilePanelOpen(false)}
                    className="absolute top-3 right-3"
                  >
                    <X className="h-5 w-5" />
                  </Button>

                  {/* Panel Content */}
                  <div className="overflow-y-auto max-h-[calc(85vh-48px)]">
                    <DecisionsPanel 
                      incidents={filteredIncidents}
                      summary={summary}
                      isLoading={isLoading}
                      offsidesError={offsidesError}
                      foulsError={foulsError}
                    />
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// Wrapper with context provider
export default function RefereeDecisions() {
  return (
    <IncidentProvider>
      <RefereeDecisionsContent />
    </IncidentProvider>
  );
}

