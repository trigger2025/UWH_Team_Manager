import { useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { generateTeams, cloneTeams, movePlayerBetweenTeams, FORMATION_ROLES, createMatchTeamSnapshot } from "@/lib/team-logic";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Users, 
  Swords, 
  RefreshCw, 
  UserCheck,
  History,
  Hand,
  Layers,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
  CheckCircle2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GeneratedTeam, FormationType, GenerationMode, PlayerWithAssignedFormationRole, PoolAssignment, TwoPoolsGeneratedTeams } from "@shared/schema";
import { useLocation } from "wouter";

const MODE_LABELS: Record<GenerationMode, string> = {
  standard: "Standard",
  two_pools: "Two Pools", 
  preset_teams: "Preset Teams",
  tournament: "Tournament"
};

const FORMATION_LABELS: Record<FormationType, string> = {
  "3-3": "3-3 Formation",
  "1-3-2": "1-3-2 Formation"
};

export default function GeneratePage() {
  const { 
    players, 
    generationWorkspace,
    updateWorkspace,
    addToHistory,
    restoreFromHistory,
    clearWorkspace,
    saveMatchResult
  } = useApp();
  const [, navigate] = useLocation();

  const { 
    mode, 
    formation, 
    selectedPlayerIds, 
    useOffHandRatings, 
    generatedTeams,
    poolAssignments,
    twoPoolsTeams,
    history,
    historyIndex
  } = generationWorkspace;

  // Filter to only show players (no "active" filter during generation per requirements)
  const allPlayers = players;

  const togglePlayer = (id: number) => {
    const newIds = selectedPlayerIds.includes(id) 
      ? selectedPlayerIds.filter(i => i !== id) 
      : [...selectedPlayerIds, id];
    updateWorkspace({ selectedPlayerIds: newIds });
  };

  const selectAll = () => {
    updateWorkspace({ selectedPlayerIds: allPlayers.map(p => p.id) });
  };

  const selectNone = () => {
    updateWorkspace({ selectedPlayerIds: [] });
  };

  // Pool assignment functions for Two Pools mode
  const setPlayerPool = (playerId: number, pool: PoolAssignment | null) => {
    const newAssignments = { ...poolAssignments };
    if (pool === null) {
      delete newAssignments[playerId];
    } else {
      newAssignments[playerId] = pool;
    }
    updateWorkspace({ poolAssignments: newAssignments });
  };

  const assignAllToPool = (pool: PoolAssignment) => {
    const newAssignments: Record<number, PoolAssignment> = {};
    selectedPlayerIds.forEach(id => {
      newAssignments[id] = pool;
    });
    updateWorkspace({ poolAssignments: newAssignments });
  };

  const clearPoolAssignments = () => {
    updateWorkspace({ poolAssignments: {} });
  };

  // Calculate pool stats for Two Pools mode
  const poolAPlayers = selectedPlayerIds.filter(id => poolAssignments[id] === "A");
  const poolBPlayers = selectedPlayerIds.filter(id => poolAssignments[id] === "B");
  const unassignedPlayers = selectedPlayerIds.filter(id => !poolAssignments[id]);
  
  const poolAWarning = poolAPlayers.length > 0 && poolAPlayers.length < 2 
    ? "Need at least 2 players" 
    : poolAPlayers.length % 2 !== 0 
    ? "Odd number of players" 
    : null;
    
  const poolBWarning = poolBPlayers.length > 0 && poolBPlayers.length < 2 
    ? "Need at least 2 players" 
    : poolBPlayers.length % 2 !== 0 
    ? "Odd number of players" 
    : null;

  const handleGenerate = () => {
    if (mode === "two_pools") {
      // Generate teams for each pool separately
      if (unassignedPlayers.length > 0) return; // Block if any unassigned
      
      const poolAPlayerObjs = players.filter(p => poolAssignments[p.id] === "A");
      const poolBPlayerObjs = players.filter(p => poolAssignments[p.id] === "B");
      
      let poolATeams: { black: GeneratedTeam; white: GeneratedTeam } | null = null;
      let poolBTeams: { black: GeneratedTeam; white: GeneratedTeam } | null = null;
      
      if (poolAPlayerObjs.length >= 2) {
        poolATeams = generateTeams(
          poolAPlayerObjs,
          { black: formation, white: formation },
          { useOffHand: useOffHandRatings }
        );
      }
      
      if (poolBPlayerObjs.length >= 2) {
        poolBTeams = generateTeams(
          poolBPlayerObjs,
          { black: formation, white: formation },
          { useOffHand: useOffHandRatings }
        );
      }
      
      updateWorkspace({ 
        twoPoolsTeams: { poolA: poolATeams, poolB: poolBTeams }
      });
    } else {
      // Standard mode
      const selectedPlayers = players.filter(p => selectedPlayerIds.includes(p.id));
      if (selectedPlayers.length < 2) return;

      const result = generateTeams(
        selectedPlayers, 
        { black: formation, white: formation },
        { useOffHand: useOffHandRatings }
      );
      addToHistory(result);
    }
  };

  const handleReroll = () => {
    handleGenerate(); // Same as generate, creates new history entry
  };

  const handleMovePlayer = (playerId: number, toTeam: "Black" | "White") => {
    if (!generatedTeams) return;
    
    // Clone current teams and move player
    const cloned = cloneTeams(generatedTeams);
    const updated = movePlayerBetweenTeams(cloned, playerId, toTeam);
    
    // Update without adding to history (manual edit)
    updateWorkspace({ generatedTeams: updated });
  };

  const handleConfirm = () => {
    if (!generatedTeams) return;
    
    // Create snapshot with rating information
    const teamSnapshot = createMatchTeamSnapshot(generatedTeams, players, useOffHandRatings);
    
    // Save match result with team snapshots
    saveMatchResult({
      date: new Date(),
      teams: teamSnapshot,
      completed: false,
      poolId: null,
      formation: formation,
      blackScore: null,
      whiteScore: null,
      tournamentId: null,
    });
    
    // Clear workspace teams after confirming
    updateWorkspace({ generatedTeams: null });
    
    // Navigate to results
    navigate("/results");
  };

  const handleConfirmTwoPools = () => {
    if (!twoPoolsTeams) return;
    
    const now = new Date();
    
    // Create and save matches for each pool with teams
    if (twoPoolsTeams.poolA) {
      const snapshotA = createMatchTeamSnapshot(twoPoolsTeams.poolA, players, useOffHandRatings);
      saveMatchResult({
        date: now,
        teams: snapshotA,
        completed: false,
        poolId: null,
        formation: formation,
        blackScore: null,
        whiteScore: null,
        tournamentId: null,
      });
    }
    
    if (twoPoolsTeams.poolB) {
      const snapshotB = createMatchTeamSnapshot(twoPoolsTeams.poolB, players, useOffHandRatings);
      saveMatchResult({
        date: new Date(now.getTime() + 1), // Slight offset so they sort correctly
        teams: snapshotB,
        completed: false,
        poolId: null,
        formation: formation,
        blackScore: null,
        whiteScore: null,
        tournamentId: null,
      });
    }
    
    // Clear workspace
    updateWorkspace({ twoPoolsTeams: null, poolAssignments: {} });
    
    // Navigate to results
    navigate("/results");
  };

  const handleClearTeams = () => {
    updateWorkspace({ generatedTeams: null });
  };

  const positionCount = FORMATION_ROLES[formation].length;
  
  // Calculate if generation is possible
  const canGenerateStandard = selectedPlayerIds.length >= 2;
  const canGenerateTwoPools = mode === "two_pools" 
    && unassignedPlayers.length === 0 
    && selectedPlayerIds.length > 0
    && (poolAPlayers.length >= 2 || poolBPlayers.length >= 2);
  
  const canGenerate = mode === "two_pools" ? canGenerateTwoPools : canGenerateStandard;
  
  // Check if we have generated teams to show
  const hasGeneratedTeams = mode === "two_pools" 
    ? (twoPoolsTeams?.poolA || twoPoolsTeams?.poolB) 
    : generatedTeams;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50 px-4 py-3">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Swords className="h-5 w-5 text-primary" />
          Generate Teams
        </h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Mode Selector - Currently only Standard is fully implemented */}
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Layers className="h-3 w-3" />
              Mode
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="flex flex-wrap gap-2">
              {(["standard", "two_pools", "preset_teams", "tournament"] as GenerationMode[]).map(m => (
                <Button
                  key={m}
                  variant={mode === m ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateWorkspace({ 
                    mode: m, 
                    generatedTeams: null, 
                    twoPoolsTeams: null,
                    poolAssignments: {} 
                  })}
                  disabled={m === "preset_teams" || m === "tournament"}
                  className="text-xs"
                  data-testid={`button-mode-${m}`}
                >
                  {MODE_LABELS[m]}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Formation Selector */}
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Formation
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="flex gap-2">
              {(["3-3", "1-3-2"] as FormationType[]).map(f => (
                <Button
                  key={f}
                  variant={formation === f ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateWorkspace({ formation: f, generatedTeams: null })}
                  className="text-xs flex-1"
                  data-testid={`button-formation-${f}`}
                >
                  {FORMATION_LABELS[f]}
                </Button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Positions: {FORMATION_ROLES[formation].filter((v, i, a) => a.indexOf(v) === i).join(", ")}
            </p>
          </CardContent>
        </Card>

        {/* Off-hand Toggle */}
        <Card className="border-border/50">
          <CardContent className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hand className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="offhand-toggle" className="text-sm">Use off-hand ratings</Label>
              </div>
              <Switch
                id="offhand-toggle"
                checked={useOffHandRatings}
                onCheckedChange={(checked) => updateWorkspace({ useOffHandRatings: checked })}
                data-testid="switch-offhand"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 pl-6">
              When enabled, uses off-hand rating for players who have it enabled.
            </p>
          </CardContent>
        </Card>

        <AnimatePresence mode="wait">
          {!hasGeneratedTeams ? (
            <motion.div
              key="selection"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              {/* Player Selection */}
              <Card className="border-border/50">
                <CardHeader className="pb-2 pt-3 px-4">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <Users className="h-3 w-3" />
                      Select Players ({selectedPlayerIds.length})
                    </CardTitle>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={selectAll}
                        className="text-[10px] h-6 px-2"
                        data-testid="button-select-all"
                      >
                        All
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={selectNone}
                        className="text-[10px] h-6 px-2"
                        data-testid="button-select-none"
                      >
                        None
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-3 max-h-[40vh] overflow-y-auto">
                  <div className="space-y-1">
                    {allPlayers.map(player => {
                      const isSelected = selectedPlayerIds.includes(player.id);
                      const hasOffHand = player.weakHandEnabled && player.weakHandRating !== null;
                      const playerPool = poolAssignments[player.id];
                      
                      return (
                        <div 
                          key={player.id}
                          className={`
                            flex items-center justify-between p-2.5 rounded-lg border transition-all
                            ${isSelected 
                              ? 'bg-primary/10 border-primary/30' 
                              : 'bg-background/50 border-transparent hover:border-border/50'}
                          `}
                          data-testid={`player-select-${player.id}`}
                        >
                          <div 
                            className="flex items-center gap-2 flex-1 cursor-pointer"
                            onClick={() => togglePlayer(player.id)}
                          >
                            <div className={`
                              h-7 w-7 rounded-md flex items-center justify-center font-bold text-[10px]
                              ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                            `}>
                              {player.rating}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{player.name}</span>
                              {hasOffHand && useOffHandRatings && (
                                <span className="text-[9px] text-cyan-500 flex items-center gap-0.5">
                                  <Hand className="h-2.5 w-2.5" />
                                  {player.weakHandRating}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {mode === "two_pools" && isSelected && (
                              <div className="flex gap-0.5" onClick={e => e.stopPropagation()}>
                                <Button
                                  variant={playerPool === "A" ? "default" : "outline"}
                                  size="sm"
                                  className={`h-6 w-6 p-0 text-[10px] font-bold ${playerPool === "A" ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}`}
                                  onClick={() => setPlayerPool(player.id, playerPool === "A" ? null : "A")}
                                  data-testid={`button-pool-a-${player.id}`}
                                >
                                  A
                                </Button>
                                <Button
                                  variant={playerPool === "B" ? "default" : "outline"}
                                  size="sm"
                                  className={`h-6 w-6 p-0 text-[10px] font-bold ${playerPool === "B" ? 'bg-violet-500 hover:bg-violet-600 text-white' : ''}`}
                                  onClick={() => setPlayerPool(player.id, playerPool === "B" ? null : "B")}
                                  data-testid={`button-pool-b-${player.id}`}
                                >
                                  B
                                </Button>
                              </div>
                            )}
                            <div className="cursor-pointer" onClick={() => togglePlayer(player.id)}>
                              <Checkbox checked={isSelected} data-testid={`checkbox-player-${player.id}`} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {allPlayers.length === 0 && (
                      <div className="text-center py-6 text-muted-foreground">
                        <p className="text-sm">No players in roster.</p>
                        <p className="text-xs">Add players first.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Pool Stats for Two Pools Mode */}
              {mode === "two_pools" && selectedPlayerIds.length > 0 && (
                <Card className="border-border/50">
                  <CardContent className="px-4 py-3 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">
                            Pool A: {poolAPlayers.length}
                          </Badge>
                          {poolAWarning && (
                            <span className="text-[10px] text-amber-500">{poolAWarning}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-violet-500/20 text-violet-500 border-violet-500/30">
                            Pool B: {poolBPlayers.length}
                          </Badge>
                          {poolBWarning && (
                            <span className="text-[10px] text-violet-500">{poolBWarning}</span>
                          )}
                        </div>
                      </div>
                      {unassignedPlayers.length > 0 && (
                        <Badge variant="destructive" className="text-[10px]">
                          {unassignedPlayers.length} unassigned
                        </Badge>
                      )}
                    </div>
                    {unassignedPlayers.length > 0 && (
                      <p className="text-[10px] text-destructive">
                        All selected players must be assigned to a pool before generating.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Generate Button */}
              <Button 
                className="w-full h-12 rounded-xl text-base font-bold gap-2 shadow-lg shadow-primary/20"
                disabled={!canGenerate}
                onClick={handleGenerate}
                data-testid="button-generate"
              >
                <RefreshCw className="h-4 w-4" />
                Generate Teams ({selectedPlayerIds.length} players)
              </Button>
            </motion.div>
          ) : mode === "two_pools" && twoPoolsTeams ? (
            <motion.div
              key="results-two-pools"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              {/* Pool A Teams */}
              {twoPoolsTeams.poolA && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 font-bold">
                      Pool A
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <TeamCard
                      team={twoPoolsTeams.poolA.black}
                      colorClass="primary"
                      onMovePlayer={(playerId) => handleMovePlayer(playerId, "White")}
                    />
                    <div className="flex items-center justify-center">
                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-[8px] font-bold text-muted-foreground">VS</span>
                      </div>
                    </div>
                    <TeamCard
                      team={twoPoolsTeams.poolA.white}
                      colorClass="cyan-400"
                      onMovePlayer={(playerId) => handleMovePlayer(playerId, "Black")}
                    />
                  </div>
                </div>
              )}

              {/* Pool B Teams */}
              {twoPoolsTeams.poolB && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <Badge className="bg-violet-500/20 text-violet-500 border-violet-500/30 font-bold">
                      Pool B
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <TeamCard
                      team={twoPoolsTeams.poolB.black}
                      colorClass="primary"
                      onMovePlayer={(playerId) => handleMovePlayer(playerId, "White")}
                    />
                    <div className="flex items-center justify-center">
                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-[8px] font-bold text-muted-foreground">VS</span>
                      </div>
                    </div>
                    <TeamCard
                      team={twoPoolsTeams.poolB.white}
                      colorClass="cyan-400"
                      onMovePlayer={(playerId) => handleMovePlayer(playerId, "Black")}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                <Button 
                  variant="outline" 
                  className="w-full h-10 rounded-xl gap-2 text-sm"
                  onClick={() => updateWorkspace({ twoPoolsTeams: null })}
                  data-testid="button-reselect"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Reselect Players
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="secondary"
                    className="h-10 rounded-xl gap-2 text-sm"
                    onClick={handleReroll}
                    data-testid="button-reroll"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Re-roll
                  </Button>
                  <Button 
                    className="h-10 rounded-xl gap-2 text-sm"
                    onClick={handleConfirmTwoPools}
                    data-testid="button-confirm"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm All
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : generatedTeams ? (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              {/* History Navigation */}
              {history.length > 1 && (
                <div className="flex items-center justify-between px-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={historyIndex >= history.length - 1}
                    onClick={() => restoreFromHistory(historyIndex + 1)}
                    className="text-xs gap-1 h-7"
                    data-testid="button-history-prev"
                  >
                    <ChevronLeft className="h-3 w-3" />
                    Older
                  </Button>
                  <div className="flex items-center gap-1.5">
                    <History className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {historyIndex + 1} / {history.length}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={historyIndex <= 0}
                    onClick={() => restoreFromHistory(historyIndex - 1)}
                    className="text-xs gap-1 h-7"
                    data-testid="button-history-next"
                  >
                    Newer
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {/* Team Cards */}
              <div className="grid grid-cols-1 gap-3">
                {/* Black Team */}
                <TeamCard
                  team={generatedTeams.black}
                  colorClass="primary"
                  onMovePlayer={(playerId) => handleMovePlayer(playerId, "White")}
                />

                <div className="flex items-center justify-center">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-[10px] font-bold text-muted-foreground">VS</span>
                  </div>
                </div>

                {/* White Team */}
                <TeamCard
                  team={generatedTeams.white}
                  colorClass="cyan-400"
                  onMovePlayer={(playerId) => handleMovePlayer(playerId, "Black")}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                <Button 
                  variant="outline" 
                  className="w-full h-10 rounded-xl gap-2 text-sm"
                  onClick={handleClearTeams}
                  data-testid="button-reselect"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Reselect Players
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="secondary"
                    className="h-10 rounded-xl gap-2 text-sm"
                    onClick={handleReroll}
                    data-testid="button-reroll"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Re-roll
                  </Button>
                  <Button 
                    className="h-10 rounded-xl gap-2 text-sm"
                    onClick={handleConfirm}
                    data-testid="button-confirm"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <BottomNav />
    </div>
  );
}

interface TeamCardProps {
  team: GeneratedTeam;
  colorClass: string;
  onMovePlayer: (playerId: number) => void;
}

function TeamCard({ team, colorClass, onMovePlayer }: TeamCardProps) {
  const isBlack = team.color === "Black";
  const bgColor = isBlack ? "bg-primary/10" : "bg-cyan-400/10";
  const borderColor = isBlack ? "border-primary/20" : "border-cyan-400/20";
  const textColor = isBlack ? "text-primary" : "text-cyan-400";
  const dotColor = isBlack ? "bg-primary" : "bg-cyan-400";
  
  const avgRating = team.players.length > 0 
    ? (team.totalRating / team.players.length).toFixed(0) 
    : 0;

  return (
    <Card className={`${borderColor} bg-card overflow-hidden`} data-testid={`team-card-${team.color.toLowerCase()}`}>
      <div className={`${bgColor} px-3 py-2.5 flex justify-between items-center border-b ${borderColor}`}>
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
          <h3 className={`font-bold text-sm ${textColor}`}>Team {team.color}</h3>
        </div>
        <Badge variant="outline" className="bg-background/50 text-[10px]">
          Avg: {avgRating}
        </Badge>
      </div>
      <CardContent className="p-0">
        {team.players.map((player, i) => (
          <PlayerRow 
            key={player.id} 
            player={player} 
            index={i}
            isLast={i === team.players.length - 1}
            onMove={() => onMovePlayer(player.id)}
          />
        ))}
        {team.players.length === 0 && (
          <div className="py-4 text-center text-xs text-muted-foreground">
            No players
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface PlayerRowProps {
  player: PlayerWithAssignedFormationRole;
  index: number;
  isLast: boolean;
  onMove: () => void;
}

function PlayerRow({ player, index, isLast, onMove }: PlayerRowProps) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 ${!isLast ? 'border-b border-border/30' : ''}`}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-[10px] font-mono text-muted-foreground/60 w-4">#{index+1}</span>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium truncate">{player.name}</span>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground">{player.ratingUsed}</span>
            {player.usedOffHand && (
              <Hand className="h-2.5 w-2.5 text-cyan-500" />
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-tight">
          {player.assignedPosition}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            onMove();
          }}
          data-testid={`button-move-player-${player.id}`}
        >
          <ArrowLeftRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
