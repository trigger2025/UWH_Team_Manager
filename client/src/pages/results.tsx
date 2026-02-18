import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Trophy, 
  History, 
  Trash2, 
  CheckCircle2, 
  Timer,
  LayoutGrid,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Match, Player, GeneratedTeam } from "@shared/schema";
import { createMatchTeamSnapshot } from "@/lib/team-logic";
import { useLocation } from "wouter";

export default function ResultsPage() {
  const { 
    matchResults, 
    completeMatch, 
    deleteMatchResultWithReversal, 
    players,
    generationWorkspace,
    saveMatchResult,
    unlockTeams,
    updateWorkspace,
    visibilitySettings
  } = useApp();
  const [, navigate] = useLocation();
  
  const { showRatings = true, showPositions = true } = visibilitySettings || {};
  
  const { teamsLocked, generatedTeams, twoPoolsTeams, mode } = generationWorkspace;
  const [scoringMatchId, setScoringMatchId] = useState<number | null>(null);
  const [blackScore, setBlackScore] = useState("");
  const [whiteScore, setWhiteScore] = useState("");
  
  // Pending match scores (for locked teams from Generate page)
  const [pendingBlackScore, setPendingBlackScore] = useState("");
  const [pendingWhiteScore, setPendingWhiteScore] = useState("");
  const [pendingPoolABlackScore, setPendingPoolABlackScore] = useState("");
  const [pendingPoolAWhiteScore, setPendingPoolAWhiteScore] = useState("");
  const [pendingPoolBBlackScore, setPendingPoolBBlackScore] = useState("");
  const [pendingPoolBWhiteScore, setPendingPoolBWhiteScore] = useState("");

  // Handle saving a pending match (standard mode)
  const handleSavePendingMatch = () => {
    if (!generatedTeams) return;
    
    const b = parseInt(pendingBlackScore);
    const w = parseInt(pendingWhiteScore);
    if (isNaN(b) || isNaN(w)) return;
    
    // Create snapshot and save match
    const teamSnapshot = createMatchTeamSnapshot(generatedTeams, players);
    const matchId = saveMatchResult({
      date: new Date(),
      teams: teamSnapshot,
      completed: false,
      poolId: null,
      formation: generatedTeams.black.formation,
      blackScore: null,
      whiteScore: null,
      tournamentId: null,
    });
    
    // Complete the match immediately with the returned ID
    completeMatch(matchId, b, w, false);
    
    // Clear pending state
    unlockTeams();
    updateWorkspace({ generatedTeams: null });
    setPendingBlackScore("");
    setPendingWhiteScore("");
  };

  // Handle saving pending two pools matches
  const handleSavePendingPoolMatch = (pool: "A" | "B") => {
    if (!twoPoolsTeams) return;
    
    const teams = pool === "A" ? twoPoolsTeams.poolA : twoPoolsTeams.poolB;
    if (!teams) return;
    
    const bScore = pool === "A" ? pendingPoolABlackScore : pendingPoolBBlackScore;
    const wScore = pool === "A" ? pendingPoolAWhiteScore : pendingPoolBWhiteScore;
    const b = parseInt(bScore);
    const w = parseInt(wScore);
    if (isNaN(b) || isNaN(w)) return;
    
    // Create snapshot and save match
    const teamSnapshot = createMatchTeamSnapshot(teams, players);
    const matchId = saveMatchResult({
      date: new Date(),
      teams: teamSnapshot,
      completed: false,
      poolId: null,
      formation: teams.black.formation,
      blackScore: null,
      whiteScore: null,
      tournamentId: null,
    });
    
    // Complete the match immediately with the returned ID
    completeMatch(matchId, b, w, false);
    
    // Clear that pool's teams
    if (pool === "A") {
      updateWorkspace({ twoPoolsTeams: { ...twoPoolsTeams, poolA: null } });
      setPendingPoolABlackScore("");
      setPendingPoolAWhiteScore("");
    } else {
      updateWorkspace({ twoPoolsTeams: { ...twoPoolsTeams, poolB: null } });
      setPendingPoolBBlackScore("");
      setPendingPoolBWhiteScore("");
    }
    
    // If both pools are now cleared, unlock teams
    const otherPool = pool === "A" ? twoPoolsTeams.poolB : twoPoolsTeams.poolA;
    if (!otherPool) {
      unlockTeams();
      updateWorkspace({ twoPoolsTeams: null, poolAssignments: {} });
    }
  };

  // Handle canceling pending match
  const handleCancelPending = () => {
    unlockTeams();
    navigate("/generate");
  };

  const handleComplete = (id: number) => {
    const b = parseInt(blackScore);
    const w = parseInt(whiteScore);
    if (isNaN(b) || isNaN(w)) return;

    completeMatch(id, b, w, false); // Tournament mode disabled
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

        {/* Pending Matches from Generate page */}
        {teamsLocked && (
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 px-1 flex items-center gap-2">
              <Clock className="h-3 w-3" />
              Pending Matches - Enter Scores
            </h3>
            
            {mode === "two_pools" && twoPoolsTeams ? (
              <>
                {/* Pool A Pending */}
                {twoPoolsTeams.poolA && (
                  <Card className="border-amber-500/30 bg-amber-500/5">
                    <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">Pool A</Badge>
                        <span className="text-xs text-muted-foreground">
                          {twoPoolsTeams.poolA.black.players.length} vs {twoPoolsTeams.poolA.white.players.length} players
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <Label className="text-[10px] text-muted-foreground">Black</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={pendingPoolABlackScore}
                            onChange={(e) => setPendingPoolABlackScore(e.target.value)}
                            className="h-10 text-center text-lg font-bold"
                            data-testid="input-pending-pool-a-black"
                          />
                        </div>
                        <span className="text-muted-foreground font-bold">-</span>
                        <div className="flex-1">
                          <Label className="text-[10px] text-muted-foreground">White</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={pendingPoolAWhiteScore}
                            onChange={(e) => setPendingPoolAWhiteScore(e.target.value)}
                            className="h-10 text-center text-lg font-bold"
                            data-testid="input-pending-pool-a-white"
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleSavePendingPoolMatch("A")}
                          disabled={!pendingPoolABlackScore || !pendingPoolAWhiteScore}
                          className="h-10"
                          data-testid="button-save-pool-a"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* Pool B Pending */}
                {twoPoolsTeams.poolB && (
                  <Card className="border-violet-500/30 bg-violet-500/5">
                    <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-violet-500/20 text-violet-500 border-violet-500/30">Pool B</Badge>
                        <span className="text-xs text-muted-foreground">
                          {twoPoolsTeams.poolB.black.players.length} vs {twoPoolsTeams.poolB.white.players.length} players
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <Label className="text-[10px] text-muted-foreground">Black</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={pendingPoolBBlackScore}
                            onChange={(e) => setPendingPoolBBlackScore(e.target.value)}
                            className="h-10 text-center text-lg font-bold"
                            data-testid="input-pending-pool-b-black"
                          />
                        </div>
                        <span className="text-muted-foreground font-bold">-</span>
                        <div className="flex-1">
                          <Label className="text-[10px] text-muted-foreground">White</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={pendingPoolBWhiteScore}
                            onChange={(e) => setPendingPoolBWhiteScore(e.target.value)}
                            className="h-10 text-center text-lg font-bold"
                            data-testid="input-pending-pool-b-white"
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleSavePendingPoolMatch("B")}
                          disabled={!pendingPoolBBlackScore || !pendingPoolBWhiteScore}
                          className="h-10"
                          data-testid="button-save-pool-b"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : generatedTeams ? (
              /* Standard Mode Pending Match */
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">Pending</Badge>
                    <span className="text-xs text-muted-foreground">
                      {generatedTeams.black.players.length} vs {generatedTeams.white.players.length} players
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <Label className="text-[10px] text-muted-foreground">Black</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={pendingBlackScore}
                        onChange={(e) => setPendingBlackScore(e.target.value)}
                        className="h-10 text-center text-lg font-bold"
                        data-testid="input-pending-black"
                      />
                    </div>
                    <span className="text-muted-foreground font-bold">-</span>
                    <div className="flex-1">
                      <Label className="text-[10px] text-muted-foreground">White</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={pendingWhiteScore}
                        onChange={(e) => setPendingWhiteScore(e.target.value)}
                        className="h-10 text-center text-lg font-bold"
                        data-testid="input-pending-white"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={handleSavePendingMatch}
                      disabled={!pendingBlackScore || !pendingWhiteScore}
                      className="h-10"
                      data-testid="button-save-pending"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
            
            {/* Cancel button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={handleCancelPending}
              data-testid="button-cancel-pending"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel and Return to Generate
            </Button>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {matchResults.length === 0 && !teamsLocked ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 border border-dashed border-border rounded-2xl bg-card/30"
            >
              <div className="bg-muted rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                <Timer className="h-8 w-8 opacity-20" />
              </div>
              <p className="text-muted-foreground">No matches recorded yet.</p>
              <Button variant="ghost" onClick={() => window.location.href='/generate'}>
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
                      onScoreClick={() => setScoringMatchId(match.id)}
                      onCancelScoring={() => setScoringMatchId(null)}
                      onBlackScoreChange={setBlackScore}
                      onWhiteScoreChange={setWhiteScore}
                      onComplete={() => handleComplete(match.id)}
                      onDelete={() => deleteMatchResultWithReversal(match.id)}
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
  match, isScoring, blackScore, whiteScore,
  onScoreClick, onCancelScoring, onBlackScoreChange, onWhiteScoreChange, 
  onComplete, onDelete 
}: any) {
  const { visibilitySettings } = useApp();
  const { showRatings = true, showPositions = true } = visibilitySettings || {};
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
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-[10px] font-bold uppercase text-primary">Black</h4>
                  {teams.black.formation && (
                    <Badge variant="outline" className="text-[8px] px-1 py-0">{teams.black.formation}</Badge>
                  )}
                </div>
                <ul className="text-xs space-y-1.5">
                  {teams.black.players.map((p: any, idx: number) => (
                    <li key={p.playerId ?? p.id ?? idx} className="flex flex-col gap-0.5">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{p.playerName ?? p.name}</span>
                        {showPositions && (
                          <Badge variant="secondary" className="text-[7px] px-1 py-0">{p.position ?? p.assignedPosition}</Badge>
                        )}
                      </div>
                      {showRatings && (
                        <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                          <span>{p.ratingUsed || p.rating}</span>
                          {p.usedOffHand && <span className="text-cyan-400">(Off-hand)</span>}
                          {p.ratingDelta !== undefined && p.ratingDelta !== 0 && (
                            <span className={p.ratingDelta > 0 ? 'text-green-400' : 'text-red-400'}>
                              {p.ratingDelta > 0 ? '+' : ''}{p.ratingDelta}
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-[10px] font-bold uppercase text-cyan-400">White</h4>
                  {teams.white.formation && (
                    <Badge variant="outline" className="text-[8px] px-1 py-0">{teams.white.formation}</Badge>
                  )}
                </div>
                <ul className="text-xs space-y-1.5">
                  {teams.white.players.map((p: any, idx: number) => (
                    <li key={p.playerId ?? p.id ?? idx} className="flex flex-col gap-0.5">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{p.playerName ?? p.name}</span>
                        {showPositions && (
                          <Badge variant="secondary" className="text-[7px] px-1 py-0">{p.position ?? p.assignedPosition}</Badge>
                        )}
                      </div>
                      {showRatings && (
                        <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                          <span>{p.ratingUsed || p.rating}</span>
                          {p.usedOffHand && <span className="text-cyan-400">(Off-hand)</span>}
                          {p.ratingDelta !== undefined && p.ratingDelta !== 0 && (
                            <span className={p.ratingDelta > 0 ? 'text-green-400' : 'text-red-400'}>
                              {p.ratingDelta > 0 ? '+' : ''}{p.ratingDelta}
                            </span>
                          )}
                        </div>
                      )}
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
                      data-testid="input-black-score"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">White Score</Label>
                    <Input 
                      type="number" 
                      value={whiteScore} 
                      onChange={(e) => onWhiteScoreChange(e.target.value)}
                      className="text-center font-bold text-lg h-12"
                      data-testid="input-white-score"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-10" onClick={onCancelScoring} data-testid="button-cancel-scoring">Cancel</Button>
                  <Button className="flex-1 h-10" onClick={onComplete} data-testid="button-submit-score">Submit Result</Button>
                </div>
              </div>
            ) : (
              <Button className="w-full h-11 gap-2 rounded-xl" onClick={onScoreClick} data-testid="button-enter-score">
                <CheckCircle2 className="h-4 w-4" />
                Enter Final Score
              </Button>
            )
          ) : (
            <div className="flex justify-between items-center pt-2 border-t border-border/30">
               <div className="flex gap-1">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/50 hover:text-destructive" data-testid="button-delete-match">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Match</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this match? All rating changes from this match will be reversed, and player win/loss/draw stats will be updated accordingly.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
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
