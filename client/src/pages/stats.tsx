import { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart2, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";
import { PlayerFilterBar, FilterState, defaultFilterState, applyPlayerFilter } from "@/components/player-filter-bar";
import { Player, Match } from "@shared/schema";

// ── Types ──────────────────────────────────────────────────────────────────────

interface MatchResult {
  matchId: number;
  date: string;
  outcome: "win" | "loss" | "draw";
  ratingDelta: number;
  ratingBefore: number;
  ratingAfter: number;
  team: "Black" | "White";
}

interface PlayerStats {
  playerId: number;
  playerName: string;
  currentRating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  totalRatingChange: number;
  ratingTrend: number;
  currentWinStreak: number;
  currentLossStreak: number;
  bestWinStreak: number;
  worstLossStreak: number;
  matchResults: MatchResult[];
  ratingHistory: number[];
}

// ── Stat Computation ───────────────────────────────────────────────────────────

function computeStats(players: Player[], matches: Match[]): PlayerStats[] {
  const completedMatches = matches.filter(m => m.completed && m.blackScore !== null && m.whiteScore !== null);

  const playerResultsMap = new Map<number, MatchResult[]>();
  players.forEach(p => playerResultsMap.set(p.id, []));

  for (const match of completedMatches) {
    const teams = match.teams as any;
    if (!teams?.black?.players || !teams?.white?.players) continue;

    const bScore = match.blackScore as number;
    const wScore = match.whiteScore as number;

    const processTeam = (teamPlayers: any[], teamName: "Black" | "White") => {
      const won = teamName === "Black" ? bScore > wScore : wScore > bScore;
      const drew = bScore === wScore;
      const outcome: "win" | "loss" | "draw" = drew ? "draw" : won ? "win" : "loss";

      for (const snap of teamPlayers) {
        const pid = snap.playerId ?? snap.id;
        if (!pid || !playerResultsMap.has(pid)) continue;
        const delta = snap.ratingDelta ?? 0;
        playerResultsMap.get(pid)!.push({
          matchId: match.id,
          date: String(match.date),
          outcome,
          ratingDelta: delta,
          ratingBefore: snap.ratingBefore ?? 0,
          ratingAfter: snap.ratingAfter ?? 0,
          team: teamName,
        });
      }
    };

    processTeam(teams.black.players, "Black");
    processTeam(teams.white.players, "White");
  }

  return players.map(player => {
    const results = (playerResultsMap.get(player.id) ?? []).sort(
      (a, b) => new Date(String(a.date)).getTime() - new Date(String(b.date)).getTime()
    );

    const gamesPlayed = results.length;
    const wins = results.filter(r => r.outcome === "win").length;
    const losses = results.filter(r => r.outcome === "loss").length;
    const draws = results.filter(r => r.outcome === "draw").length;
    const winRate = gamesPlayed > 0 ? wins / gamesPlayed : 0;
    const totalRatingChange = results.reduce((sum, r) => sum + r.ratingDelta, 0);

    // Build rating history from ratingBefore of first match + cumulative deltas
    let ratingHistory: number[] = [];
    if (results.length > 0) {
      let running = results[0].ratingBefore;
      ratingHistory.push(running);
      for (const r of results) {
        running += r.ratingDelta;
        ratingHistory.push(running);
      }
    }

    // 5-match trend: compare current rating to rating before last 5 matches
    let ratingTrend = 0;
    if (ratingHistory.length >= 2) {
      const current = ratingHistory[ratingHistory.length - 1];
      const fiveAgo = ratingHistory.length >= 6
        ? ratingHistory[ratingHistory.length - 6]
        : ratingHistory[0];
      ratingTrend = current - fiveAgo;
    }

    let currentWinStreak = 0;
    let currentLossStreak = 0;
    for (let i = results.length - 1; i >= 0; i--) {
      if (results[i].outcome === "win") {
        if (i === results.length - 1 || results[i + 1].outcome === "win") currentWinStreak++;
        else break;
      } else break;
    }
    if (currentWinStreak === 0) {
      for (let i = results.length - 1; i >= 0; i--) {
        if (results[i].outcome === "loss") {
          if (i === results.length - 1 || results[i + 1].outcome === "loss") currentLossStreak++;
          else break;
        } else break;
      }
    }

    let bestWinStreak = 0;
    let worstLossStreak = 0;
    let ws = 0;
    let ls = 0;
    for (const r of results) {
      if (r.outcome === "win") { ws++; ls = 0; bestWinStreak = Math.max(bestWinStreak, ws); }
      else if (r.outcome === "loss") { ls++; ws = 0; worstLossStreak = Math.max(worstLossStreak, ls); }
      else { ws = 0; ls = 0; }
    }

    return {
      playerId: player.id,
      playerName: player.name,
      currentRating: player.rating,
      gamesPlayed,
      wins,
      losses,
      draws,
      winRate,
      totalRatingChange,
      ratingTrend,
      currentWinStreak,
      currentLossStreak,
      bestWinStreak,
      worstLossStreak,
      matchResults: results,
      ratingHistory,
    };
  });
}

// ── Sparkline SVG ──────────────────────────────────────────────────────────────

function Sparkline({ history }: { history: number[] }) {
  if (history.length < 2) return <span className="text-xs text-muted-foreground">–</span>;

  const minY = Math.min(...history);
  const maxY = Math.max(...history);
  const rangeY = maxY - minY || 1;
  const W = 80;
  const H = 28;
  const pad = 2;

  const points = history.map((y, i) => {
    const x = pad + (i / (history.length - 1)) * (W - pad * 2);
    const py = H - pad - ((y - minY) / rangeY) * (H - pad * 2);
    return `${x.toFixed(1)},${py.toFixed(1)}`;
  }).join(" ");

  const color = history[history.length - 1] >= history[0] ? "#22c55e" : "#ef4444";

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Leaderboard configs ────────────────────────────────────────────────────────

const LEADERBOARDS = [
  { value: "sharks", label: "🏆 The Sharks", desc: "Top 10 Highest Rated" },
  { value: "on-fire", label: "🔥 On Fire", desc: "Top 10 Win Streak (current)" },
  { value: "rising", label: "📈 Rising Stars", desc: "Top 10 Rating Growth (last 20 games)" },
  { value: "serial-winners", label: "🎯 Serial Winners", desc: "Most Total Wins" },
  { value: "cold-spell", label: "🧊 Cold Spell Club", desc: "Longest Current Losing Streak" },
  { value: "rebuild", label: "📉 Rebuild Season", desc: "Largest Rating Drop (last 20 games)" },
  { value: "unlucky", label: "🐢 Unlucky Legends", desc: "Most Losses" },
];

function getLeaderboardEntries(
  allStats: PlayerStats[],
  board: string
): PlayerStats[] {
  const withGames = allStats.filter(s => s.gamesPlayed > 0);
  switch (board) {
    case "sharks":
      return [...allStats].sort((a, b) => b.currentRating - a.currentRating).slice(0, 10);
    case "on-fire":
      return withGames.filter(s => s.currentWinStreak > 0)
        .sort((a, b) => b.currentWinStreak - a.currentWinStreak).slice(0, 10);
    case "rising":
      return withGames.sort((a, b) => {
        const ratingGainA = a.matchResults.slice(-20).reduce((s, r) => s + r.ratingDelta, 0);
        const ratingGainB = b.matchResults.slice(-20).reduce((s, r) => s + r.ratingDelta, 0);
        return ratingGainB - ratingGainA;
      }).slice(0, 10);
    case "serial-winners":
      return withGames.sort((a, b) => b.wins - a.wins).slice(0, 10);
    case "cold-spell":
      return withGames.filter(s => s.currentLossStreak > 0)
        .sort((a, b) => b.currentLossStreak - a.currentLossStreak).slice(0, 10);
    case "rebuild":
      return withGames.sort((a, b) => {
        const dropA = a.matchResults.slice(-20).reduce((s, r) => s + r.ratingDelta, 0);
        const dropB = b.matchResults.slice(-20).reduce((s, r) => s + r.ratingDelta, 0);
        return dropA - dropB;
      }).slice(0, 10);
    case "unlucky":
      return withGames.sort((a, b) => b.losses - a.losses).slice(0, 10);
    default:
      return [];
  }
}

// ── Streak badge ───────────────────────────────────────────────────────────────

function StreakBadge({ wins, losses }: { wins: number; losses: number }) {
  if (wins > 0) return <span className="text-green-400 font-bold text-xs">W{wins}</span>;
  if (losses > 0) return <span className="text-red-400 font-bold text-xs">L{losses}</span>;
  return <span className="text-muted-foreground text-xs">–</span>;
}

// ── Main component ──────────────────────────────────────────────────────────────

const STATS_SORT_EXTRAS = [
  { value: "most-wins", label: "Most Wins" },
  { value: "win-rate", label: "Highest Win %" },
  { value: "rating-gain", label: "Biggest Rating Gain" },
  { value: "win-streak", label: "Longest Win Streak" },
  { value: "loss-streak", label: "Longest Losing Streak" },
];

export default function StatsPage() {
  const { players, matchResults, savedTags, visibilitySettings } = useApp();
  const { showRatings = true } = visibilitySettings || {};

  const [filter, setFilter] = useState<FilterState>(defaultFilterState("rating-desc"));
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<string | null>(null);
  const [lbMenuOpen, setLbMenuOpen] = useState(false);

  const allStats = useMemo(() => computeStats(players, (matchResults || []) as Match[]), [players, matchResults]);

  const statsMap = useMemo(() => {
    const m = new Map<number, { wins: number; winRate: number; totalRatingChange: number; currentWinStreak: number; currentLossStreak: number }>();
    allStats.forEach(s => m.set(s.playerId, {
      wins: s.wins,
      winRate: s.winRate,
      totalRatingChange: s.totalRatingChange,
      currentWinStreak: s.currentWinStreak,
      currentLossStreak: s.currentLossStreak,
    }));
    return m;
  }, [allStats]);

  const filteredPlayers = useMemo(() =>
    applyPlayerFilter(players, filter, statsMap),
    [players, filter, statsMap]
  );

  const displayStats = useMemo(() =>
    filteredPlayers.map(p => allStats.find(s => s.playerId === p.id)!).filter(Boolean),
    [filteredPlayers, allStats]
  );

  const leaderboardStats = useMemo(() =>
    leaderboard ? getLeaderboardEntries(allStats, leaderboard) : [],
    [allStats, leaderboard]
  );

  const leaderboardInfo = LEADERBOARDS.find(l => l.value === leaderboard);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 className="h-5 w-5 text-primary" />
          <h1 className="font-bold text-lg">Statistics</h1>
        </div>
        <PlayerFilterBar
          filter={filter}
          onChange={setFilter}
          availableTags={savedTags || []}
          extraSortOptions={STATS_SORT_EXTRAS}
          placeholder="Search players..."
          data-testid="stats-filter"
        />
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* Leaderboard selector */}
        <div>
          <div className="relative">
            <button
              onClick={() => setLbMenuOpen(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-card border border-border/50 text-sm hover:border-primary/40 transition-colors"
              data-testid="button-leaderboard-selector"
            >
              <span className={leaderboard ? "text-foreground" : "text-muted-foreground"}>
                {leaderboardInfo ? leaderboardInfo.label : "View Leaderboard"}
              </span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${lbMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {lbMenuOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border/50 rounded-lg shadow-xl z-20 overflow-hidden">
                {LEADERBOARDS.map(lb => (
                  <button
                    key={lb.value}
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-primary/10 transition-colors ${leaderboard === lb.value ? "bg-primary/15 text-primary" : ""}`}
                    onClick={() => { setLeaderboard(lb.value === leaderboard ? null : lb.value); setLbMenuOpen(false); }}
                    data-testid={`leaderboard-option-${lb.value}`}
                  >
                    <span className="font-medium">{lb.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{lb.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Leaderboard table */}
        {leaderboard && leaderboardStats.length > 0 && (
          <Card className="border-border/50">
            <CardContent className="px-0 py-0">
              <div className="px-4 pt-3 pb-1">
                <p className="text-[11px] font-semibold text-primary uppercase tracking-wider">{leaderboardInfo?.desc}</p>
              </div>
              {leaderboardStats.map((s, idx) => (
                <div key={s.playerId} className="px-4 py-2 flex items-center gap-3 border-t border-border/30 first:border-0">
                  <span className="text-sm font-bold text-muted-foreground w-5 shrink-0">#{idx + 1}</span>
                  <span className="text-sm font-medium flex-1 truncate">{s.playerName}</span>
                  {leaderboard === "sharks" && showRatings && (
                    <span className="text-sm font-bold text-primary">{s.currentRating}</span>
                  )}
                  {leaderboard === "on-fire" && (
                    <span className="text-green-400 text-sm font-bold">W{s.currentWinStreak}</span>
                  )}
                  {leaderboard === "rising" && (
                    <span className={`text-sm font-bold ${s.ratingTrend >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {s.ratingTrend >= 0 ? "+" : ""}{s.matchResults.slice(-20).reduce((sum, r) => sum + r.ratingDelta, 0)}
                    </span>
                  )}
                  {leaderboard === "serial-winners" && (
                    <span className="text-sm font-bold text-primary">{s.wins}W</span>
                  )}
                  {leaderboard === "cold-spell" && (
                    <span className="text-red-400 text-sm font-bold">L{s.currentLossStreak}</span>
                  )}
                  {leaderboard === "rebuild" && (
                    <span className="text-red-400 text-sm font-bold">
                      {s.matchResults.slice(-20).reduce((sum, r) => sum + r.ratingDelta, 0)}
                    </span>
                  )}
                  {leaderboard === "unlucky" && (
                    <span className="text-sm font-bold text-muted-foreground">{s.losses}L</span>
                  )}
                </div>
              ))}
              {leaderboardStats.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">No data yet.</div>
              )}
            </CardContent>
          </Card>
        )}
        {leaderboard && leaderboardStats.length === 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">No data yet for this leaderboard.</div>
        )}

        {/* Main stats table */}
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Player Stats</p>
          {displayStats.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No players found.</p>
          )}
          <div className="space-y-1.5">
            {displayStats.map(stat => {
              const expanded = expandedId === stat.playerId;
              const netDelta = stat.totalRatingChange;
              return (
                <div key={stat.playerId} className="rounded-xl border border-border/50 bg-card overflow-hidden">
                  {/* Main row */}
                  <button
                    className="w-full px-3 py-2.5 flex items-center gap-2 text-left hover:bg-primary/5 transition-colors"
                    onClick={() => setExpandedId(expanded ? null : stat.playerId)}
                    data-testid={`stats-row-${stat.playerId}`}
                  >
                    {/* Name */}
                    <span className="text-sm font-medium flex-1 min-w-0 truncate">{stat.playerName}</span>

                    {/* Rating */}
                    {showRatings && (
                      <span className="text-xs font-bold text-primary w-10 text-right shrink-0">{stat.currentRating}</span>
                    )}

                    {/* G W D L */}
                    <div className="flex gap-1 shrink-0 text-[10px] font-mono">
                      <span className="text-muted-foreground w-6 text-right">{stat.gamesPlayed}</span>
                      <span className="text-green-400 w-5 text-right">{stat.wins}</span>
                      <span className="text-amber-400 w-5 text-right">{stat.draws}</span>
                      <span className="text-red-400 w-5 text-right">{stat.losses}</span>
                    </div>

                    {/* Win % */}
                    <span className="text-[10px] text-muted-foreground w-9 text-right shrink-0">
                      {stat.gamesPlayed > 0 ? `${(stat.winRate * 100).toFixed(0)}%` : "–"}
                    </span>

                    {/* Net Δ */}
                    {showRatings && (
                      <span className={`text-[10px] font-bold w-9 text-right shrink-0 ${netDelta > 0 ? "text-green-400" : netDelta < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                        {netDelta > 0 ? "+" : ""}{netDelta}
                      </span>
                    )}

                    {/* Streak */}
                    <span className="w-8 text-right shrink-0">
                      <StreakBadge wins={stat.currentWinStreak} losses={stat.currentLossStreak} />
                    </span>

                    {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  </button>

                  {/* Expanded row */}
                  {expanded && (
                    <div className="border-t border-border/30 px-3 py-3 space-y-3 bg-background/40">
                      {/* Sparkline */}
                      {stat.ratingHistory.length >= 2 && (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-muted-foreground mb-1">Rating over time</p>
                            <Sparkline history={stat.ratingHistory} />
                          </div>
                          {showRatings && (
                            <div className="text-right">
                              <p className="text-[10px] text-muted-foreground">Form (Last 5)</p>
                              <span className={`text-sm font-bold ${stat.ratingTrend > 0 ? "text-green-400" : stat.ratingTrend < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                                {stat.ratingTrend > 0 ? <TrendingUp className="inline h-3.5 w-3.5 mr-0.5" /> : stat.ratingTrend < 0 ? <TrendingDown className="inline h-3.5 w-3.5 mr-0.5" /> : <Minus className="inline h-3.5 w-3.5 mr-0.5" />}
                                {stat.ratingTrend > 0 ? "+" : ""}{stat.ratingTrend}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Last 5 results */}
                      {stat.matchResults.length > 0 && (
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1.5">Last 5 results</p>
                          <div className="flex gap-1">
                            {stat.matchResults.slice(-5).map((r, i) => (
                              <div
                                key={i}
                                className={`h-7 w-7 rounded-md flex items-center justify-center text-[11px] font-bold
                                  ${r.outcome === "win" ? "bg-green-500/20 text-green-400 border border-green-500/30" :
                                    r.outcome === "loss" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                                    "bg-amber-500/20 text-amber-400 border border-amber-500/30"}`}
                                title={r.outcome}
                              >
                                {r.outcome === "win" ? "W" : r.outcome === "loss" ? "L" : "D"}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Streak records */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-green-500/10 rounded-lg px-3 py-2 border border-green-500/20">
                          <p className="text-[9px] text-green-400 uppercase tracking-wide">Best Win Streak</p>
                          <p className="text-lg font-bold text-green-400">{stat.bestWinStreak}</p>
                        </div>
                        <div className="bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
                          <p className="text-[9px] text-red-400 uppercase tracking-wide">Worst Loss Streak</p>
                          <p className="text-lg font-bold text-red-400">{stat.worstLossStreak}</p>
                        </div>
                      </div>

                      {/* No games message */}
                      {stat.gamesPlayed === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-2">No completed matches yet.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Column header hint */}
        {displayStats.length > 0 && (
          <div className="flex items-center gap-2 px-3 text-[9px] text-muted-foreground/60">
            <span className="flex-1">Name</span>
            {showRatings && <span className="w-10 text-right">Rtg</span>}
            <span className="w-6 text-right">G</span>
            <span className="w-5 text-right text-green-400/60">W</span>
            <span className="w-5 text-right text-amber-400/60">D</span>
            <span className="w-5 text-right text-red-400/60">L</span>
            <span className="w-9 text-right">W%</span>
            {showRatings && <span className="w-9 text-right">Δ</span>}
            <span className="w-8 text-right">Str</span>
            <span className="w-3.5" />
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
