import { useState, useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trophy, Swords, CheckCircle2, ChevronLeft, RotateCcw, CalendarClock } from "lucide-react";
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

interface ScheduleSlot {
  time: string;
  poolA: string;
  poolB: string;
  bye: string;
}

function parseTime(str: string): number {
  const [h, m] = str.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function buildScheduleRounds(teamList: TournamentTeam[]): Array<{
  games: Array<{ teamA: TournamentTeam; teamB: TournamentTeam }>;
  bye?: TournamentTeam;
}> {
  const list: (TournamentTeam | null)[] = [...teamList];
  if (list.length % 2 !== 0) list.push(null);
  const n = list.length;
  const rounds = [];

  for (let round = 0; round < n - 1; round++) {
    const games: Array<{ teamA: TournamentTeam; teamB: TournamentTeam }> = [];
    let bye: TournamentTeam | undefined;

    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (!a) { if (b) bye = b; }
      else if (!b) { bye = a; }
      else { games.push({ teamA: a, teamB: b }); }
    }

    rounds.push({ games, bye });
    // rotate: remove last, insert at index 1
    list.splice(1, 0, list.pop()!);
  }

  return rounds;
}

const SCHEDULE_STORAGE_KEY = "activeTournamentSchedule";
const OPTIONS_STORAGE_KEY = "tournamentScheduleOptions";

export default function TournamentPage() {
  const { generationWorkspace, setTournamentFixtureResult, finaliseTournament, resetTournament } = useApp();
  const [, navigate] = useLocation();
  const tournament = generationWorkspace.tournament;

  const [scheduleStartTime, setScheduleStartTime] = useState("18:00");
  const [scheduleDuration, setScheduleDuration] = useState(12);
  const [scheduleTurnover, setScheduleTurnover] = useState(3);
  const [schedulePools, setSchedulePools] = useState<1 | 2>(1);
  const [generatedSchedule, setGeneratedSchedule] = useState<ScheduleSlot[] | null>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);

  // Load persisted schedule and options on mount
  useEffect(() => {
    try {
      const savedSchedule = localStorage.getItem(SCHEDULE_STORAGE_KEY);
      if (savedSchedule) setGeneratedSchedule(JSON.parse(savedSchedule));

      const savedOptions = localStorage.getItem(OPTIONS_STORAGE_KEY);
      if (savedOptions) {
        const opts = JSON.parse(savedOptions);
        if (opts.startTime) setScheduleStartTime(opts.startTime);
        if (opts.duration) setScheduleDuration(opts.duration);
        if (opts.turnover !== undefined) setScheduleTurnover(opts.turnover);
        if (opts.pools) setSchedulePools(opts.pools);
      }
    } catch {}
  }, []);

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

  function generateSchedule() {
    const rounds = buildScheduleRounds(teams);
    const slotLen = scheduleDuration + scheduleTurnover;
    // Pool balance counters: track A/B play count per team
    const poolCounts: Record<string, { A: number; B: number }> = {};
    teams.forEach(t => { poolCounts[t.id] = { A: 0, B: 0 }; });

    let t = parseTime(scheduleStartTime);
    const slots: ScheduleSlot[] = [];

    if (schedulePools === 1) {
      // Each game is its own time slot; BYE noted in the round's first slot
      rounds.forEach(round => {
        round.games.forEach((game, gi) => {
          slots.push({
            time: formatTime(t),
            poolA: `${game.teamA.label} vs ${game.teamB.label}`,
            poolB: "–",
            bye: gi === 0 && round.bye ? round.bye.label : "–",
          });
          t += slotLen;
        });
      });
    } else {
      // Each ROUND is one time slot; balance games across Pool A and Pool B
      rounds.forEach(round => {
        let poolA = "";
        let poolB = "";

        round.games.forEach(game => {
          if (poolB) return; // already filled both pools
          const aCount = (poolCounts[game.teamA.id]?.A ?? 0) + (poolCounts[game.teamB.id]?.A ?? 0);
          const bCount = (poolCounts[game.teamA.id]?.B ?? 0) + (poolCounts[game.teamB.id]?.B ?? 0);
          const assignToA = !poolA && aCount <= bCount;

          if (assignToA) {
            poolA = `${game.teamA.label} vs ${game.teamB.label}`;
            poolCounts[game.teamA.id].A++;
            poolCounts[game.teamB.id].A++;
          } else if (!poolB) {
            poolB = `${game.teamA.label} vs ${game.teamB.label}`;
            poolCounts[game.teamA.id].B++;
            poolCounts[game.teamB.id].B++;
          }
        });

        slots.push({
          time: formatTime(t),
          poolA: poolA || "–",
          poolB: poolB || "–",
          bye: round.bye ? round.bye.label : "–",
        });
        t += slotLen;
      });
    }

    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(slots));
    localStorage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify({
      startTime: scheduleStartTime,
      duration: scheduleDuration,
      turnover: scheduleTurnover,
      pools: schedulePools,
    }));
    setGeneratedSchedule(slots);
  }

  async function exportSchedule() {
    if (!scheduleRef.current) return;
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(scheduleRef.current, { backgroundColor: "#0a0f1e", scale: 2 });
    const link = document.createElement("a");
    link.download = "tournament-schedule.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

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
              <AlertDialogAction onClick={() => { resetTournament(); localStorage.removeItem(SCHEDULE_STORAGE_KEY); localStorage.removeItem(OPTIONS_STORAGE_KEY); setGeneratedSchedule(null); navigate("/generate"); }}>
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
                <AlertDialogAction onClick={() => { finaliseTournament(); navigate("/results"); }}>
                  Finalise
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Schedule Generator */}
        <div className="space-y-3">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" />
            Schedule
          </h2>
          <Card className="border-border/50">
            <CardContent className="px-4 py-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Start Time</label>
                  <input
                    type="time"
                    value={scheduleStartTime}
                    onChange={e => { setScheduleStartTime(e.target.value); setGeneratedSchedule(null); }}
                    className="w-full h-8 rounded border border-border bg-background px-2 text-sm text-foreground"
                    data-testid="input-schedule-start-time"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Concurrent</label>
                  <div className="flex gap-1 h-8">
                    {([1, 2] as const).map(n => (
                      <Button
                        key={n}
                        size="sm"
                        variant={schedulePools === n ? "default" : "outline"}
                        className="flex-1 h-8 text-xs"
                        onClick={() => { setSchedulePools(n); setGeneratedSchedule(null); }}
                        data-testid={`button-schedule-pools-${n}`}
                      >
                        {n === 1 ? "1 Pool" : "2 Pools"}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Game (min)</label>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => { setScheduleDuration(d => Math.max(1, d - 1)); setGeneratedSchedule(null); }}>−</Button>
                    <span className="flex-1 text-center text-sm font-mono font-bold">{scheduleDuration}</span>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => { setScheduleDuration(d => d + 1); setGeneratedSchedule(null); }}>+</Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Turnover (min)</label>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => { setScheduleTurnover(t => Math.max(0, t - 1)); setGeneratedSchedule(null); }}>−</Button>
                    <span className="flex-1 text-center text-sm font-mono font-bold">{scheduleTurnover}</span>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => { setScheduleTurnover(t => t + 1); setGeneratedSchedule(null); }}>+</Button>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={generateSchedule}
                data-testid="button-generate-schedule"
              >
                <CalendarClock className="h-3.5 w-3.5" />
                Generate Schedule
              </Button>
              {generatedSchedule && (
                <>
                  <div ref={scheduleRef} className="rounded border border-border/40 overflow-hidden text-[10px]">
                    {/* Header */}
                    <div className={`grid bg-muted/30 border-b border-border/40 ${schedulePools === 2 ? "grid-cols-[48px_1fr_1fr_56px]" : "grid-cols-[48px_1fr_56px]"}`}>
                      <span className="px-2 py-1.5 font-bold text-muted-foreground uppercase tracking-wide">Time</span>
                      <span className="px-2 py-1.5 font-bold text-amber-400 uppercase tracking-wide">Pool A</span>
                      {schedulePools === 2 && (
                        <span className="px-2 py-1.5 font-bold text-violet-400 uppercase tracking-wide">Pool B</span>
                      )}
                      <span className="px-2 py-1.5 font-bold text-muted-foreground/60 uppercase tracking-wide">Bye</span>
                    </div>
                    {/* Rows */}
                    {generatedSchedule.map((slot, i) => (
                      <div
                        key={i}
                        className={`grid border-b border-border/20 last:border-0 ${schedulePools === 2 ? "grid-cols-[48px_1fr_1fr_56px]" : "grid-cols-[48px_1fr_56px]"} ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                        data-testid={`row-schedule-${i}`}
                      >
                        <span className="px-2 py-2 font-mono text-muted-foreground">{slot.time}</span>
                        <span className="px-2 py-2 text-foreground leading-tight">{slot.poolA}</span>
                        {schedulePools === 2 && (
                          <span className="px-2 py-2 text-foreground leading-tight">{slot.poolB}</span>
                        )}
                        <span className="px-2 py-2 text-muted-foreground/60 leading-tight truncate">
                          {slot.bye !== "–" ? slot.bye : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full gap-2 text-muted-foreground text-xs"
                    onClick={exportSchedule}
                    data-testid="button-export-schedule"
                  >
                    Export as Image
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
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
