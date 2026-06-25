import { Match } from "@/types/match";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Trophy } from "lucide-react";

interface MatchSelectorProps {
  matches: Match[];
  selectedMatchId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export function MatchSelector({ 
  matches, 
  selectedMatchId, 
  onSelect,
  disabled 
}: MatchSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <Trophy className="h-4 w-4" />
        Select Match for Analysis
      </label>
      <Select 
        value={selectedMatchId} 
        onValueChange={onSelect}
        disabled={disabled}
      >
        <SelectTrigger className="w-full bg-muted/30 border-border/50 h-12 rounded-xl">
          <SelectValue placeholder="Choose a match..." />
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {matches.map((match) => (
            <SelectItem 
              key={match.id} 
              value={match.id.toString()}
              className="py-3"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold">{match.homeTeam} vs {match.awayTeam}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(match.date).toLocaleDateString()} • {match.league}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

