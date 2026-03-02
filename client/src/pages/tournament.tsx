import { useApp } from "@/context/AppContext";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trophy, Swords, CheckCircle2, ChevronLeft, RotateCcw } from "lucide-react";
import { useLocation } from "wouter";
import { TournamentFixture, TournamentTeam } from "@shared/schema";
import { motion } from "framer-motion";

function getStandings(teams: TournamentTeam[], fixtures: TournamentFixture[]) {
  const standings: Record<string, { team: TournamentTeam; played: number; wins: number; draws: number; losses: number; points: number }> = {};
  teams.forEach(t => {
    standings[t.id] = { team: t, played: 0, wins: 0, draws: 0, losses: 0, points: 0 };
  });
  fixtures.forEach(f => {
    if (!f.result) return;
    const a = standings[f.teamA.id];
    const b = standings[f.teamB.id];
    if (!a || !b) return;
    a.played++;
    b.played++;
    if (f.result === "A") { a.wins++; a.points += 3; b.losses++; }
    else if (f.result === "B") { b.wins++; b.points += 3; a.losses++; }
    else { a.draws++; a.points++; b.draws++; b.points++; }
  });
  return Object.values(standings).sort((a, b) => b.points - a.points || b.wins - a.wins);
}

export default function TournamentPage() {
  const { generationWorkspace, setTournamentFixtureResult, finaliseTournament, resetTournament } = useApp();
  const [, navigate] = useLocation();
  const tournament = generationWorkspace.tournament;

  if (!tournament || !tournament.active) {
    return (
      <div className="min-h-screen bg-background pb-24 flex flex-col items-center justify-center gap-4 px-4">
        <Trophy className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground text-center text-sm">No active tournament. Go to Generate and start one.</p>
        <Button variant="outline" className="gap-2" onClick={() => navigate("/generate")} data-testid="button-goto-generate">
          <ChevronLeft className="h-4 w-4" />
          Go to Generate
        </Button>
        <BottomNav />
      </div>
    );
  }

  const { teams, fixtures, completedCount, finalised } = tournament;
  const totalFixtures = fixtures.length;
  const allDone = completedCount === totalFixtures;
  const progressPct = totalFixtures > 0 ? Math.round((completedCount / totalFixtures) * 100) : 0;
  const standings = getStandings(teams, fixtures);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-400" />
          <h1 className="font-bold text-lg">Tournament</h1>
          {finalised && <Badge className="bg-green-600 text-white text-[10px]">Finalised</Badge>}
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" data-testid="button-reset-tournament">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset Tournament?</AlertDialogTitle>
              <AlertDialogDescription>
                This will clear all tournament data. Rating changes from any finalised results cannot be reversed here.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { resetTournament(); navigate("/generate"); }}>
                Reset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* Progress */}
        <Card className="border-border/50">
          <CardContent className="px-4 py-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Fixtures complete</span>
              <span className="font-mono font-bold">{completedCount}/{totalFixtures}</span>
            </div>
            <Progress value={progressPct} className="h-2" data-testid="progress-tournament" />
            {!finalised && allDone && (
              <p className="text-xs text-green-400 font-medium">All fixtures complete — ready to finalise!</p>
            )}
            {finalised && (
              <p className="text-xs text-green-400 font-medium">Tournament finalised. Ratings updated.</p>
            )}
          </CardContent>
        </Card>

        {/* Fixtures */}
        <div className="space-y-3">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">Fixtures</h2>
          {fixtures.map((fixture, idx) => (
            <FixtureCard
              key={fixture.id}
              fixture={fixture}
              index={idx}
              finalised={finalised}
              onResult={finalised ? undefined : (result) => setTournamentFixtureResult(fixture.id, result)}
            />
          ))}
        </div>

        {/* Standings (always shown) */}
        {standings.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">Standings</h2>
            <Card className="border-border/50">
              <CardContent className="px-0 py-0">
                <div className="divide-y divide-border/30">
                  {standings.map((row, i) => (
                    <motion.div
                      key={row.team.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 px-4 py-2.5"
                      data-testid={`row-standing-${row.team.id}`}
                    >
                      <span className={`text-sm font-bold w-5 text-center ${i === 0 ? "text-amber-400" : "text-muted-foreground"}`}>{i + 1}</span>
                      <span className="flex-1 text-sm font-medium">{row.team.label}</span>
                      <span className="text-xs text-muted-foreground">{row.wins}W {row.draws}D {row.losses}L</span>
                      <Badge variant={i === 0 ? "default" : "secondary"} className="text-xs font-bold min-w-[32px] text-center">
                        {row.points}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Finalise Button */}
        {!finalised && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                className="w-full h-12 rounded-xl gap-2 text-base font-bold bg-amber-600 hover:bg-amber-500"
                disabled={!allDone}
                data-testid="button-finalise-tournament"
              >
                <CheckCircle2 className="h-4 w-4" />
                Finalise Tournament & Apply Ratings
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Finalise Tournament?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will apply rating changes to all players based on fixture results. Ratings use a 70% K-factor for tournament matches. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={finaliseTournament}>
                  Finalise
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

interface FixtureCardProps {
  fixture: TournamentFixture;
  index: number;
  finalised: boolean;
  onResult?: (result: "A" | "B" | "draw") => void;
}

function FixtureCard({ fixture, index, finalised, onResult }: FixtureCardProps) {
  const { result } = fixture;

  const resultBtnClass = (r: "A" | "B" | "draw") => {
    if (result === r) {
      if (r === "draw") return "bg-slate-500 hover:bg-slate-500 text-white border-slate-500";
      return "bg-primary hover:bg-primary text-primary-foreground border-primary";
    }
    return "";
  };

  return (
    <Card className={`border-border/50 ${result ? "opacity-90" : ""}`} data-testid={`card-fixture-${fixture.id}`}>
      <CardContent className="px-4 py-3 space-y-3">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Swords className="h-3 w-3" />
          <span>Fixture {index + 1}</span>
          {result && (
            <Badge className="ml-auto text-[9px] py-0 bg-green-600 text-white">
              Done
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold truncate" data-testid={`text-fixture-teamA-${fixture.id}`}>{fixture.teamA.label}</p>
            <p className="text-[10px] text-muted-foreground">{fixture.teamA.players.length} players</p>
          </div>
          <div className="text-xs font-bold text-muted-foreground shrink-0">VS</div>
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold truncate" data-testid={`text-fixture-teamB-${fixture.id}`}>{fixture.teamB.label}</p>
            <p className="text-[10px] text-muted-foreground">{fixture.teamB.players.length} players</p>
          </div>
        </div>
        {!finalised && onResult && (
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={result === "A" ? "default" : "outline"}
              size="sm"
              className={`text-xs h-8 ${resultBtnClass("A")}`}
              onClick={() => onResult("A")}
              data-testid={`button-result-A-${fixture.id}`}
            >
              {fixture.teamA.label.split(" ").slice(-1)[0]} Win
            </Button>
            <Button
              variant={result === "draw" ? "default" : "outline"}
              size="sm"
              className={`text-xs h-8 ${resultBtnClass("draw")}`}
              onClick={() => onResult("draw")}
              data-testid={`button-result-draw-${fixture.id}`}
            >
              Draw
            </Button>
            <Button
              variant={result === "B" ? "default" : "outline"}
              size="sm"
              className={`text-xs h-8 ${resultBtnClass("B")}`}
              onClick={() => onResult("B")}
              data-testid={`button-result-B-${fixture.id}`}
            >
              {fixture.teamB.label.split(" ").slice(-1)[0]} Win
            </Button>
          </div>
        )}
        {finalised && result && (
          <div className="text-center text-xs text-muted-foreground">
            Result: <span className="font-semibold text-foreground">
              {result === "draw" ? "Draw" : result === "A" ? `${fixture.teamA.label} Win` : `${fixture.teamB.label} Win`}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
