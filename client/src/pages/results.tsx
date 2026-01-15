import { useMatches, useDeleteMatch } from "@/hooks/use-matches";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, CalendarDays, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Match, Player } from "@shared/schema";

// Type guard or manual typing because JSONB comes back as 'any' usually
type TeamData = {
  name: string;
  color: string;
  players: Player[];
  avgRating: number;
};

export default function ResultsPage() {
  const { data: matches, isLoading } = useMatches();
  const deleteMutation = useDeleteMatch();

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading history...</div>;

  return (
    <div className="min-h-screen bg-background pb-24 pt-6 px-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-display mb-6">Match History</h1>

        <div className="space-y-4">
          {matches?.length === 0 ? (
            <div className="text-center py-12 opacity-50">
              <HistoryEmptyState />
              <p className="mt-4">No matches recorded yet.</p>
            </div>
          ) : (
            matches?.map((match) => (
              <MatchHistoryCard 
                key={match.id} 
                match={match} 
                onDelete={() => deleteMutation.mutate(match.id)}
              />
            ))
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

function MatchHistoryCard({ match, onDelete }: { match: Match, onDelete: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const teams = match.teams as unknown as [TeamData, TeamData]; // Cast JSONB
  const date = new Date(match.date);

  return (
    <Card className="bg-card border-white/5 overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="p-4 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono uppercase tracking-wider">
              <CalendarDays className="h-3 w-3" />
              {format(date, "MMM d, h:mm a")}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {teams[0].players.slice(0,3).map((p, i) => (
                  <div key={i} className="h-6 w-6 rounded-full bg-slate-200 border-2 border-card z-10" />
                ))}
              </div>
              <span className="text-sm font-medium text-foreground">vs</span>
              <div className="flex -space-x-2">
                {teams[1].players.slice(0,3).map((p, i) => (
                  <div key={i} className="h-6 w-6 rounded-full bg-slate-800 border-2 border-card z-10" />
                ))}
              </div>
            </div>
          </div>

          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/5">
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="px-4 pb-4 pt-0 border-t border-white/5 bg-black/20">
            <div className="grid grid-cols-2 gap-4 py-3">
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">White Team</h4>
                <ul className="text-sm space-y-1">
                  {teams[0].players.map(p => (
                    <li key={p.id} className="opacity-80">{p.name}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Black Team</h4>
                <ul className="text-sm space-y-1">
                  {teams[1].players.map(p => (
                    <li key={p.id} className="opacity-80">{p.name}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex justify-end mt-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onDelete}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 text-xs"
              >
                <Trash2 className="mr-2 h-3 w-3" /> Delete Record
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function HistoryEmptyState() {
  return (
    <svg 
      className="w-16 h-16 mx-auto text-muted-foreground/30" 
      fill="none" viewBox="0 0 24 24" stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
