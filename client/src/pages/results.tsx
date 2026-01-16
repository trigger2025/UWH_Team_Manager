import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Trophy, 
  History, 
  Trash2, 
  CheckCircle2, 
  Timer,
  LayoutGrid,
  CalendarDays,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Match, Player } from "@shared/schema";

export default function ResultsPage() {
  const { matchResults, completeMatch, deleteMatchResult } = useApp();
  const [scoringMatchId, setScoringMatchId] = useState<number | null>(null);
  const [blackScore, setBlackScore] = useState("");
  const [whiteScore, setWhiteScore] = useState("");
  const [isTournament, setIsTournament] = useState(false);

  const handleComplete = (id: number) => {
    const b = parseInt(blackScore);
    const w = parseInt(whiteScore);
    if (isNaN(b) || isNaN(w)) return;

    completeMatch(id, b, w, isTournament);
    setScoringMatchId(null);
    setBlackScore("");
    setWhiteScore("");
  };

  const matches = [...matchResults].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  // Group matches by session (same day within 4 hours)
  const sessions: { [key: string]: Match[] } = {};
  matches.forEach(match => {
    const date = new Date(match.date);
    const sessionKey = format(date, 'yyyy-MM-dd');
    // For simplicity, we'll group by day for now
    if (!sessions[sessionKey]) sessions[sessionKey] = [];
    sessions[sessionKey].push(match);
  });

  return (
    <div className="min-h-screen bg-background pb-24 px-4 pt-6">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            Session History
          </h1>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            {matchResults.length} Matches
          </Badge>
        </div>

        <AnimatePresence mode="popLayout">
          {matchResults.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 border border-dashed border-border rounded-2xl bg-card/30"
            >
              <div className="bg-muted rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                <Timer className="h-8 w-8 opacity-20" />
              </div>
              <p className="text-muted-foreground">No matches recorded yet.</p>
              <Button variant="link" onClick={() => window.location.href='/generate'}>
                Generate a match
              </Button>
            </motion.div>
          ) : (
            Object.entries(sessions).map(([date, sessionMatches]) => (
              <div key={date} className="space-y-3">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 px-1 flex items-center gap-2">
                  <div className="h-px flex-1 bg-border/30" />
                  {format(new Date(date), 'EEEE, MMMM do')}
                  <div className="h-px flex-1 bg-border/30" />
                </h3>
                {sessionMatches.map((match) => (
                  <motion.div
                    key={match.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <MatchCard 
                      match={match}
                      isScoring={scoringMatchId === match.id}
                      blackScore={blackScore}
                      whiteScore={whiteScore}
                      isTournament={isTournament}
                      onScoreClick={() => setScoringMatchId(match.id)}
                      onCancelScoring={() => setScoringMatchId(null)}
                      onBlackScoreChange={setBlackScore}
                      onWhiteScoreChange={setWhiteScore}
                      onTournamentChange={setIsTournament}
                      onComplete={() => handleComplete(match.id)}
                      onDelete={() => deleteMatchResult(match.id)}
                    />
                  </motion.div>
                ))}
              </div>
            ))
          )}
        </AnimatePresence>
      </div>
      <BottomNav />
    </div>
  );
}

function MatchCard({ 
  match, isScoring, blackScore, whiteScore, isTournament,
  onScoreClick, onCancelScoring, onBlackScoreChange, onWhiteScoreChange, 
  onTournamentChange, onComplete, onDelete 
}: any) {
  const [isOpen, setIsOpen] = useState(false);
  const teams = match.teams as any;

  return (
    <Card className={`relative overflow-hidden border-border/50 ${match.completed ? 'bg-card/50' : 'bg-card shadow-lg ring-1 ring-primary/20'}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {match.completed && (
          <div className={`absolute top-0 right-0 p-2 ${match.blackScore > match.whiteScore ? 'text-primary' : match.whiteScore > match.blackScore ? 'text-cyan-400' : 'text-muted-foreground'}`}>
            <Trophy className="h-4 w-4" />
          </div>
        )}
        
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              <CalendarDays className="h-3 w-3" />
              {format(new Date(match.date), 'MMM d, h:mm a')}
            </div>
            {!match.completed && (
              <Badge className="bg-primary text-primary-foreground animate-pulse text-[10px]">Active</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 text-center">
              <div className="text-xs font-bold text-primary mb-1 uppercase tracking-tight">Black</div>
              <div className="text-3xl font-display font-black">
                {match.completed ? match.blackScore : '-'}
              </div>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="px-3 py-1 rounded-full bg-muted text-[10px] font-bold text-muted-foreground hover:bg-muted/80">
                VS {isOpen ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
              </Button>
            </CollapsibleTrigger>
            <div className="flex-1 text-center">
              <div className="text-xs font-bold text-cyan-400 mb-1 uppercase tracking-tight">White</div>
              <div className="text-3xl font-display font-black">
                {match.completed ? match.whiteScore : '-'}
              </div>
            </div>
          </div>

          <CollapsibleContent>
            <div className="grid grid-cols-2 gap-4 py-2 border-t border-border/30 mt-2">
              <div>
                <h4 className="text-[10px] font-bold uppercase text-primary mb-2">Team Black</h4>
                <ul className="text-xs space-y-1">
                  {teams.black.players.map((p: any) => (
                    <li key={p.id} className="opacity-80 flex justify-between">
                      <span>{p.name}</span>
                      <span className="text-[8px] opacity-50">{p.assignedPosition}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-[10px] font-bold uppercase text-cyan-400 mb-2">Team White</h4>
                <ul className="text-xs space-y-1">
                  {teams.white.players.map((p: any) => (
                    <li key={p.id} className="opacity-80 flex justify-between">
                      <span>{p.name}</span>
                      <span className="text-[8px] opacity-50">{p.assignedPosition}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CollapsibleContent>

          {!match.completed ? (
            isScoring ? (
              <div className="space-y-4 pt-2 animate-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Black Score</Label>
                    <Input 
                      type="number" 
                      value={blackScore} 
                      onChange={(e) => onBlackScoreChange(e.target.value)}
                      className="text-center font-bold text-lg h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">White Score</Label>
                    <Input 
                      type="number" 
                      value={whiteScore} 
                      onChange={(e) => onWhiteScoreChange(e.target.value)}
                      className="text-center font-bold text-lg h-12"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2 pb-2">
                  <Checkbox 
                    id={`tournament-${match.id}`} 
                    checked={isTournament}
                    onCheckedChange={(checked) => onTournamentChange(!!checked)}
                  />
                  <Label htmlFor={`tournament-${match.id}`} className="text-xs text-muted-foreground">Tournament Mode (70% rating impact)</Label>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-10" onClick={onCancelScoring}>Cancel</Button>
                  <Button className="flex-1 h-10" onClick={onComplete}>Submit Result</Button>
                </div>
              </div>
            ) : (
              <Button className="w-full h-11 gap-2 rounded-xl" onClick={onScoreClick}>
                <CheckCircle2 className="h-4 w-4" />
                Enter Final Score
              </Button>
            )
          ) : (
            <div className="flex justify-between items-center pt-2 border-t border-border/30">
               <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/50 hover:text-destructive" onClick={onDelete}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <LayoutGrid className="h-3 w-3" />
                Formation: {match.formation}
              </div>
            </div>
          )}
        </CardContent>
      </Collapsible>
    </Card>
  );
}
