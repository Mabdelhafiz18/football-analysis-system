import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { Incident, FilterType, OverlayState } from "@/types/decisions";

interface IncidentContextType {
  // Selected incident
  selectedIncident: Incident | null;
  setSelectedIncident: (incident: Incident | null) => void;
  
  // Filter state
  filter: FilterType;
  setFilter: (filter: FilterType) => void;
  
  // Video state
  currentTime: number;
  setCurrentTime: (time: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
  
  // Overlay state
  overlays: OverlayState;
  toggleOverlay: (overlay: keyof OverlayState) => void;
  setOverlays: (overlays: OverlayState) => void;
  
  // Navigation helpers
  selectIncidentAndSeek: (incident: Incident) => void;
}

const IncidentContext = createContext<IncidentContextType | undefined>(undefined);

interface IncidentProviderProps {
  children: ReactNode;
}

export function IncidentProvider({ children }: IncidentProviderProps) {
  // Selected incident state
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  
  // Filter state
  const [filter, setFilter] = useState<FilterType>("all");
  
  // Video state
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  
  // Overlay state
  const [overlays, setOverlays] = useState<OverlayState>({
    showPlayers: true,
    showBall: true,
    showOffsideLine: true,
    showFoulHighlight: true,
  });

  const toggleOverlay = useCallback((overlay: keyof OverlayState) => {
    setOverlays((prev) => ({
      ...prev,
      [overlay]: !prev[overlay],
    }));
  }, []);

  // Select incident and seek video to that time
  const selectIncidentAndSeek = useCallback((incident: Incident) => {
    setSelectedIncident(incident);
    setCurrentTime(incident.timestamp);
    setIsPlaying(false); // Pause on incident selection
    
    // Auto-configure overlays based on incident type
    setOverlays((prev) => ({
      ...prev,
      showOffsideLine: incident.type === "offside",
      showFoulHighlight: incident.type === "foul",
    }));
  }, []);

  const value: IncidentContextType = {
    selectedIncident,
    setSelectedIncident,
    filter,
    setFilter,
    currentTime,
    setCurrentTime,
    isPlaying,
    setIsPlaying,
    playbackRate,
    setPlaybackRate,
    overlays,
    toggleOverlay,
    setOverlays,
    selectIncidentAndSeek,
  };

  return (
    <IncidentContext.Provider value={value}>
      {children}
    </IncidentContext.Provider>
  );
}

export function useIncidentContext() {
  const context = useContext(IncidentContext);
  if (context === undefined) {
    throw new Error("useIncidentContext must be used within an IncidentProvider");
  }
  return context;
}

