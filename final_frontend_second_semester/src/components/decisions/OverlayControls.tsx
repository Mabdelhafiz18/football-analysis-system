import { motion } from "framer-motion";
import { Users, Circle, Flag, AlertTriangle, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIncidentContext } from "@/contexts/IncidentContext";

export function OverlayControls() {
  const { overlays, toggleOverlay, setOverlays } = useIncidentContext();

  const overlayItems = [
    { key: "showPlayers" as const, label: "Player Boxes", icon: Users },
    { key: "showBall" as const, label: "Ball Marker", icon: Circle },
    { key: "showOffsideLine" as const, label: "Offside Line", icon: Flag },
    { key: "showFoulHighlight" as const, label: "Foul Highlight", icon: AlertTriangle },
  ];

  const allEnabled = Object.values(overlays).every(Boolean);
  const toggleAll = () => {
    const newState = !allEnabled;
    setOverlays({
      showPlayers: newState,
      showBall: newState,
      showOffsideLine: newState,
      showFoulHighlight: newState,
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white hover:bg-white/20 relative"
        >
          <Layers className="h-4 w-4" />
          {/* Active indicator */}
          {Object.values(overlays).some(Boolean) && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary"
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 glass-card border-border/50">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Overlay Layers
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border/50" />
        
        {overlayItems.map(({ key, label, icon: Icon }) => (
          <DropdownMenuCheckboxItem
            key={key}
            checked={overlays[key]}
            onCheckedChange={() => toggleOverlay(key)}
            className="cursor-pointer"
          >
            <Icon className="h-4 w-4 mr-2 text-muted-foreground" />
            {label}
          </DropdownMenuCheckboxItem>
        ))}

        <DropdownMenuSeparator className="bg-border/50" />
        <DropdownMenuCheckboxItem
          checked={allEnabled}
          onCheckedChange={toggleAll}
          className="cursor-pointer font-medium"
        >
          <Layers className="h-4 w-4 mr-2 text-primary" />
          Toggle All
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

