import { useState, useEffect, useRef, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { generateTeams, cloneTeams, movePlayerBetweenTeams, assignFormationRoles, FORMATION_ROLES, createMatchTeamSnapshot, generateMultipleTeams, getEffectiveRating } from "@/lib/team-logic";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  CheckCircle2,
  Clock,
  Trophy,
  Minus,
  Plus,
  Download
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GeneratedTeam, FormationType, FormationPosition, GenerationMode, PlayerWithAssignedFormationRole, PlayerOffHandSelection, PoolAssignment, TwoPoolsGeneratedTeams, TeamTemplate, Player, TournamentTeam } from "@shared/schema";
import { useLocation } from "wouter";
import { PlayerFilterBar, FilterState, defaultFilterState, applyPlayerFilter } from "@/components/player-filter-bar";
import { exportTeamSections, ExportOptions } from "@/lib/export-image";
import { ExportModal } from "@/components/export-modal";

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
    savedTags,
    generationWorkspace,
    updateWorkspace,
    clearWorkspace,
    saveMatchResult,
    lockTeams,
    unlockTeams,
    visibilitySettings,
    saveTeamTemplate,
    loadFromTemplate,
    adminSettings,
    confirmTournament
  } = useApp();
  
  const { showRatings = true, showPositions = true } = visibilitySettings || {};
  const [, navigate] = useLocation();
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportTarget, setExportTarget] = useState<"standard" | "twopools" | "tournament">("standard");
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showGenerated, setShowGenerated] = useState(false);
  const [tournamentTeams, setTournamentTeams] = useState<TournamentTeam[] | null>(null);

  // Preset mode state
  const [presetPlayerIds, setPresetPlayerIds] = useState<number[]>([]);
  const [presetTwoPool, setPresetTwoPool] = useState(false);
  const [presetPoolTarget, setPresetPoolTarget] = useState<"A" | "B">("A");
  const [presetLeftoverCount, setPresetLeftoverCount] = useState(0);

  // Filter state (local to tab, visual only)
  const [attendFilter, setAttendFilter] = useState<FilterState>(defaultFilterState("name-asc"));
  const [presetFilter, setPresetFilter] = useState<FilterState>(defaultFilterState("name-asc"));

  const { 
    mode, 
    teamFormations,
    poolAFormations,
    poolBFormations,
    selectedPlayerIds, 
    playerOffHandSelections, 
    generatedTeams,
    poolAssignments,
    twoPoolsTeams,
    teamTemplates,
    teamsLocked,
    tournamentTeamCount = 3,
    tournament
  } = generationWorkspace;

  const teamsRef = useRef<HTMLDivElement>(null);
  const twoPoolsRef = useRef<HTMLDivElement>(null);
  const tournamentTeamsRef = useRef<HTMLDivElement>(null);

  function openExportModal(target: "standard" | "twopools" | "tournament") {
    setExportTarget(target);
    setExportModalOpen(true);
  }

  function teamToExport(team: GeneratedTeam) {
    const avg = team.players.length ? Math.round(team.totalRating / team.players.length) : 0;
    return {
      name: `Team ${team.color}`,
      avg,
      color: team.color,
      players: team.players.map((p) => ({
        name: p.name,
        position: p.assignedPosition,
        rating: p.ratingUsed,
      })),
    };
  }

  async function handleExportConfirm(opts: ExportOptions) {
    setExportModalOpen(false);

    if (exportTarget === "twopools" && twoPoolsTeams) {
      const sections = [];
      if (twoPoolsTeams.poolA) {
        sections.push({ label: "Pool A", teams: [teamToExport(twoPoolsTeams.poolA.black), teamToExport(twoPoolsTeams.poolA.white)] });
      }
      if (twoPoolsTeams.poolB) {
        sections.push({ label: "Pool B", teams: [teamToExport(twoPoolsTeams.poolB.black), teamToExport(twoPoolsTeams.poolB.white)] });
      }
      await exportTeamSections(sections, "pool-teams.png", opts, "Pool Teams");

    } else if (exportTarget === "tournament" && tournamentTeams) {
      const teams = tournamentTeams.map((t) => ({
        name: t.label,
        avg: t.players.length ? Math.round(t.totalRating / t.players.length) : 0,
        color: t.label,
        players: t.players.map((p) => ({
          name: p.name,
          position: p.assignedPosition,
          rating: p.ratingUsed ?? p.rating,
        })),
      }));
      await exportTeamSections([{ teams }], "tournament-teams.png", opts, "Tournament Teams");

    } else if (generatedTeams) {
      const sections = [{ teams: [teamToExport(generatedTeams.black), teamToExport(generatedTeams.white)] }];
      await exportTeamSections(sections, "generated-teams.png", opts, "Generated Teams");
    }
  }

  // Filter to only show players (no "active" filter during generation per requirements)
  const allPlayers = players;

  // Visual filter for attending selection (does not affect actual selection state)
  const displayPlayers = useMemo(() => applyPlayerFilter(allPlayers, attendFilter), [allPlayers, attendFilter]);
  // Visual filter for preset selector (does not affect actual preset state)
  const displayPresetPlayers = useMemo(() => applyPlayerFilter(
    allPlayers.filter(p => selectedPlayerIds.includes(p.id)),
    presetFilter
  ), [allPlayers, selectedPlayerIds, presetFilter]);

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

  // Per-player off-hand toggle
  const togglePlayerOffHand = (playerId: number) => {
    const newSelections = { ...playerOffHandSelections };
    if (newSelections[playerId]) {
      delete newSelections[playerId];
    } else {
      newSelections[playerId] = true;
    }
    updateWorkspace({ playerOffHandSelections: newSelections });
  };

  // Update team formation (standard mode)
  const setTeamFormation = (team: "black" | "white", formation: FormationType) => {
    updateWorkspace({ 
      teamFormations: { ...teamFormations, [team]: formation },
      generatedTeams: null 
    });
  };

  // Update pool formations (two pools mode)
  const setPoolFormation = (pool: "A" | "B", team: "black" | "white", formation: FormationType) => {
    if (pool === "A") {
      updateWorkspace({
        poolAFormations: { ...poolAFormations, [team]: formation },
        twoPoolsTeams: null
      });
    } else {
      updateWorkspace({
        poolBFormations: { ...poolBFormations, [team]: formation },
        twoPoolsTeams: null
      });
    }
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

  const handleGenerateTournament = () => {
    const selectedPlayers = players.filter(p => selectedPlayerIds.includes(p.id));
    if (selectedPlayers.length < tournamentTeamCount) return;
    const formation = teamFormations.black;
    const teams = generateMultipleTeams(selectedPlayers, tournamentTeamCount, formation, { playerOffHandSelections, adminSettings });
    setTournamentTeams(teams);
    setShowGenerated(true);
  };

  const togglePresetPlayer = (id: number) => {
    setPresetPlayerIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : prev.length < 12 ? [...prev, id] : prev
    );
  };

  const handleGeneratePreset = () => {
    const selectedPlayers = players.filter(p => selectedPlayerIds.includes(p.id));
    const presetPlayers = selectedPlayers.filter(p => presetPlayerIds.includes(p.id));
    if (presetPlayers.length === 0) return;

    const remainingPlayers = selectedPlayers.filter(p => !presetPlayerIds.includes(p.id));
    const targetSize = Math.min(presetPlayers.length, remainingPlayers.length);

    // Build opposition greedily: pick players that minimise |opp avg – preset avg|
    const presetAvg = presetPlayers.reduce((s, p) => s + getEffectiveRating(p, playerOffHandSelections).rating, 0) / presetPlayers.length;
    const pool = [...remainingPlayers];
    const oppositionPlayers: Player[] = [];

    for (let i = 0; i < targetSize; i++) {
      let bestIdx = 0;
      let bestDiff = Infinity;
      for (let j = 0; j < pool.length; j++) {
        const temp = [...oppositionPlayers, pool[j]];
        const avg = temp.reduce((s, p) => s + getEffectiveRating(p, playerOffHandSelections).rating, 0) / temp.length;
        const diff = Math.abs(avg - presetAvg);
        if (diff < bestDiff) { bestDiff = diff; bestIdx = j; }
      }
      oppositionPlayers.push(pool[bestIdx]);
      pool.splice(bestIdx, 1);
    }

    const presetAssigned = assignFormationRoles(presetPlayers, teamFormations.black, playerOffHandSelections, adminSettings);
    const oppAssigned    = assignFormationRoles(oppositionPlayers, teamFormations.white, playerOffHandSelections, adminSettings);

    const presetTeam: GeneratedTeam = {
      color: "Black",
      formation: teamFormations.black,
      players: presetAssigned,
      totalRating: presetAssigned.reduce((s, p) => s + p.ratingUsed, 0),
    };
    const oppTeam: GeneratedTeam = {
      color: "White",
      formation: teamFormations.white,
      players: oppAssigned,
      totalRating: oppAssigned.reduce((s, p) => s + p.ratingUsed, 0),
    };

    const usedIds = new Set([...presetPlayers.map(p => p.id), ...oppositionPlayers.map(p => p.id)]);
    const leftoverPlayers = selectedPlayers.filter(p => !usedIds.has(p.id));
    setPresetLeftoverCount(leftoverPlayers.length);

    if (!presetTwoPool) {
      updateWorkspace({ generatedTeams: { black: presetTeam, white: oppTeam } });
      setShowGenerated(true);
    } else {
      let otherPoolTeams: { black: GeneratedTeam; white: GeneratedTeam } | null = null;
      const otherFormations = presetPoolTarget === "A" ? poolBFormations : poolAFormations;
      if (leftoverPlayers.length >= 2) {
        otherPoolTeams = generateTeams(leftoverPlayers, otherFormations, { playerOffHandSelections, adminSettings });
      }
      const presetPair = { black: presetTeam, white: oppTeam };
      updateWorkspace({
        twoPoolsTeams: presetPoolTarget === "A"
          ? { poolA: presetPair, poolB: otherPoolTeams }
          : { poolA: otherPoolTeams, poolB: presetPair },
      });
      setShowGenerated(true);
    }
  };

  const handleConfirmTournament = () => {
    if (!tournamentTeams) return;
    confirmTournament(tournamentTeams);
    navigate("/tournament");
  };

  const handleGenerate = () => {
    if (mode === "tournament") {
      handleGenerateTournament();
      return;
    }
    if (mode === "preset_teams") {
      handleGeneratePreset();
      return;
    }
    if (mode === "two_pools") {
      // Generate teams for each pool separately using pool-specific formations
      if (unassignedPlayers.length > 0) return; // Block if any unassigned
      
      const poolAPlayerObjs = players.filter(p => poolAssignments[p.id] === "A");
      const poolBPlayerObjs = players.filter(p => poolAssignments[p.id] === "B");
      
      let poolATeams: { black: GeneratedTeam; white: GeneratedTeam } | null = null;
      let poolBTeams: { black: GeneratedTeam; white: GeneratedTeam } | null = null;
      
      if (poolAPlayerObjs.length >= 2) {
        poolATeams = generateTeams(
          poolAPlayerObjs,
          poolAFormations,
          { playerOffHandSelections, adminSettings }
        );
      }
      
      if (poolBPlayerObjs.length >= 2) {
        poolBTeams = generateTeams(
          poolBPlayerObjs,
          poolBFormations,
          { playerOffHandSelections, adminSettings }
        );
      }
      
      const newTwoPoolsTeams = { poolA: poolATeams, poolB: poolBTeams };
      updateWorkspace({ twoPoolsTeams: newTwoPoolsTeams });
      setShowGenerated(true);
    } else {
      // Standard mode
      const selectedPlayers = players.filter(p => selectedPlayerIds.includes(p.id));
      if (selectedPlayers.length < 2) return;

      const result = generateTeams(
        selectedPlayers, 
        teamFormations,
        { playerOffHandSelections, adminSettings }
      );
      updateWorkspace({ generatedTeams: result });
      setShowGenerated(true);
    }
  };

  const handleReroll = () => {
    handleGenerate(); // Same as generate, creates new history entry
  };

  const handleMovePlayer = (playerId: number, toTeam: "Black" | "White") => {
    if (!generatedTeams) return;
    
    const cloned = cloneTeams(generatedTeams);
    const updated = movePlayerBetweenTeams(cloned, playerId, toTeam, adminSettings);
    
    updateWorkspace({ generatedTeams: updated });
  };

  const handleMovePlayerTwoPools = (playerId: number, toTeam: "Black" | "White", pool: "A" | "B") => {
    if (!twoPoolsTeams) return;
    const poolTeams = pool === "A" ? twoPoolsTeams.poolA : twoPoolsTeams.poolB;
    if (!poolTeams) return;
    
    const cloned = cloneTeams(poolTeams);
    const updated = movePlayerBetweenTeams(cloned, playerId, toTeam, adminSettings);
    
    if (pool === "A") {
      updateWorkspace({ twoPoolsTeams: { ...twoPoolsTeams, poolA: updated } });
    } else {
      updateWorkspace({ twoPoolsTeams: { ...twoPoolsTeams, poolB: updated } });
    }
  };

  const handleSwapPlayerPool = (playerId: number, fromPool: "A" | "B") => {
    if (!twoPoolsTeams) return;
    const toPool = fromPool === "A" ? "B" : "A";
    
    const sourceTeams = fromPool === "A" ? twoPoolsTeams.poolA : twoPoolsTeams.poolB;
    const targetTeams = toPool === "A" ? twoPoolsTeams.poolA : twoPoolsTeams.poolB;
    if (!sourceTeams) return;
    
    let playerData: PlayerWithAssignedFormationRole | null = null;
    let sourceTeamKey: "black" | "white" | null = null;
    
    const bIdx = sourceTeams.black.players.findIndex(p => p.id === playerId);
    if (bIdx !== -1) {
      playerData = { ...sourceTeams.black.players[bIdx] };
      sourceTeamKey = "black";
    } else {
      const wIdx = sourceTeams.white.players.findIndex(p => p.id === playerId);
      if (wIdx !== -1) {
        playerData = { ...sourceTeams.white.players[wIdx] };
        sourceTeamKey = "white";
      }
    }
    
    if (!playerData || !sourceTeamKey) return;
    
    const newSource = cloneTeams(sourceTeams);
    newSource[sourceTeamKey].players = newSource[sourceTeamKey].players.filter(p => p.id !== playerId);

    const sourceOffHandMap: PlayerOffHandSelection = {};
    for (const p of [...newSource.black.players, ...newSource.white.players]) {
      if (p.usedOffHand) sourceOffHandMap[p.id] = true;
    }
    const sourceReassigned = assignFormationRoles(
      newSource[sourceTeamKey].players.map(p => p as Player),
      newSource[sourceTeamKey].formation,
      sourceOffHandMap,
      adminSettings
    );
    newSource[sourceTeamKey].players = sourceReassigned;
    newSource[sourceTeamKey].totalRating = sourceReassigned.reduce((s, p) => s + p.ratingUsed, 0);
    
    let newTarget: { black: GeneratedTeam; white: GeneratedTeam };
    if (targetTeams) {
      newTarget = cloneTeams(targetTeams);
    } else {
      newTarget = {
        black: { color: "Black", formation: sourceTeams.black.formation, players: [], totalRating: 0 },
        white: { color: "White", formation: sourceTeams.white.formation, players: [], totalRating: 0 }
      };
    }
    
    const targetTeamKey = sourceTeamKey;
    newTarget[targetTeamKey].players.push(playerData);

    const offHandMap: PlayerOffHandSelection = {};
    for (const p of [...newTarget.black.players, ...newTarget.white.players]) {
      if (p.usedOffHand) offHandMap[p.id] = true;
    }
    const reassigned = assignFormationRoles(
      newTarget[targetTeamKey].players.map(p => p as Player),
      newTarget[targetTeamKey].formation,
      offHandMap,
      adminSettings
    );
    newTarget[targetTeamKey].players = reassigned;
    newTarget[targetTeamKey].totalRating = reassigned.reduce((s, p) => s + p.ratingUsed, 0);
    
    const newPoolAssignments: Record<number, PoolAssignment> = { ...poolAssignments, [playerId]: toPool as PoolAssignment };
    
    if (fromPool === "A") {
      updateWorkspace({
        twoPoolsTeams: { poolA: newSource, poolB: newTarget },
        poolAssignments: newPoolAssignments
      });
    } else {
      updateWorkspace({
        twoPoolsTeams: { poolA: newTarget, poolB: newSource },
        poolAssignments: newPoolAssignments
      });
    }
  };

  const handleConfirm = () => {
    if (!generatedTeams) return;
    saveTeamTemplate(generatedTeams, null);
    lockTeams();
    navigate("/results");
  };

  const handleConfirmTwoPools = () => {
    if (!twoPoolsTeams) return;
    saveTeamTemplate(null, twoPoolsTeams);
    lockTeams();
    navigate("/results");
  };

  const handleLoadTemplate = (template: TeamTemplate) => {
    loadFromTemplate(template);
    setShowTemplateDialog(false);
    setShowGenerated(true);
  };

  const handleClearTeams = () => {
    updateWorkspace({ generatedTeams: null, twoPoolsTeams: null });
    setShowGenerated(false);
  };

  // Get unique positions for display (using black team formation as default)
  const getUniquePositions = (formation: FormationType) => 
    FORMATION_ROLES[formation].filter((v: FormationPosition, i: number, a: FormationPosition[]) => a.indexOf(v) === i);
  
  // Calculate if generation is possible
  const canGenerateStandard = selectedPlayerIds.length >= 2;
  const canGenerateTwoPools = mode === "two_pools" 
    && unassignedPlayers.length === 0 
    && selectedPlayerIds.length > 0
    && (poolAPlayers.length >= 2 || poolBPlayers.length >= 2);
  const canGenerateTournament = mode === "tournament" && selectedPlayerIds.length >= tournamentTeamCount;
  const canGeneratePreset = mode === "preset_teams"
    && presetPlayerIds.length >= 1
    && presetPlayerIds.every(id => selectedPlayerIds.includes(id));
  
  const canGenerate = mode === "two_pools" ? canGenerateTwoPools
    : mode === "tournament" ? canGenerateTournament
    : mode === "preset_teams" ? canGeneratePreset
    : canGenerateStandard;
  
  const hasGeneratedTeams = showGenerated && (
    (mode === "two_pools" || (mode === "preset_teams" && presetTwoPool)) ? (twoPoolsTeams?.poolA || twoPoolsTeams?.poolB) :
    mode === "tournament" ? (tournamentTeams && tournamentTeams.length > 0) :
    generatedTeams
  );

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
                  className="text-xs"
                  data-testid={`button-mode-${m}`}
                >
                  {MODE_LABELS[m]}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Per-Team Formation Selectors */}
        {mode === "tournament" ? (
          /* Tournament Mode: Single Formation + Team Count */
          <Card className="border-border/50">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Tournament Setup
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Formation (all teams)</Label>
                <div className="flex gap-2">
                  {(["3-3", "1-3-2"] as FormationType[]).map(f => (
                    <Button
                      key={f}
                      variant={teamFormations.black === f ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTeamFormation("black", f)}
                      className="text-xs flex-1"
                      data-testid={`button-tournament-formation-${f}`}
                    >
                      {FORMATION_LABELS[f]}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Number of Teams</Label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-lg"
                    onClick={() => updateWorkspace({ tournamentTeamCount: Math.max(2, tournamentTeamCount - 1) })}
                    disabled={tournamentTeamCount <= 2}
                    data-testid="button-tournament-teams-minus"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="font-mono font-bold text-lg w-8 text-center" data-testid="text-tournament-team-count">{tournamentTeamCount}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-lg"
                    onClick={() => updateWorkspace({ tournamentTeamCount: Math.min(6, tournamentTeamCount + 1) })}
                    disabled={tournamentTeamCount >= 6}
                    data-testid="button-tournament-teams-plus"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {tournamentTeamCount * (tournamentTeamCount - 1) / 2} fixtures
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">Select at least {tournamentTeamCount} players.</p>
              </div>
              {tournament?.active && !tournament.finalised && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <Trophy className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span className="text-[10px] text-amber-300">
                    Tournament in progress ({tournament.completedCount}/{tournament.fixtures.length} fixtures done)
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-6 px-2 text-[10px] text-amber-300 hover:text-amber-200"
                    onClick={() => navigate("/tournament")}
                    data-testid="button-goto-tournament"
                  >
                    View →
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : mode === "two_pools" ? (
          /* Two Pools Mode: Per-Pool Formations */
          <Card className="border-border/50">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Pool Formations
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-4">
              {/* Pool A Formations */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-amber-500/20 border-amber-500 text-amber-300 text-[9px]">Pool A</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 pl-2">
                  {/* Pool A Black */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      <span className="text-[10px] text-muted-foreground">Black</span>
                    </div>
                    <div className="flex gap-1">
                      {(["3-3", "1-3-2"] as FormationType[]).map(f => (
                        <Button
                          key={f}
                          variant={poolAFormations.black === f ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPoolFormation("A", "black", f)}
                          className="text-[9px] flex-1 h-7 px-1"
                          data-testid={`button-formation-poolA-black-${f}`}
                        >
                          {f}
                        </Button>
                      ))}
                    </div>
                  </div>
                  {/* Pool A White */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                      <span className="text-[10px] text-muted-foreground">White</span>
                    </div>
                    <div className="flex gap-1">
                      {(["3-3", "1-3-2"] as FormationType[]).map(f => (
                        <Button
                          key={f}
                          variant={poolAFormations.white === f ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPoolFormation("A", "white", f)}
                          className="text-[9px] flex-1 h-7 px-1"
                          data-testid={`button-formation-poolA-white-${f}`}
                        >
                          {f}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Pool B Formations */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-violet-500/20 border-violet-500 text-violet-300 text-[9px]">Pool B</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 pl-2">
                  {/* Pool B Black */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      <span className="text-[10px] text-muted-foreground">Black</span>
                    </div>
                    <div className="flex gap-1">
                      {(["3-3", "1-3-2"] as FormationType[]).map(f => (
                        <Button
                          key={f}
                          variant={poolBFormations.black === f ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPoolFormation("B", "black", f)}
                          className="text-[9px] flex-1 h-7 px-1"
                          data-testid={`button-formation-poolB-black-${f}`}
                        >
                          {f}
                        </Button>
                      ))}
                    </div>
                  </div>
                  {/* Pool B White */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                      <span className="text-[10px] text-muted-foreground">White</span>
                    </div>
                    <div className="flex gap-1">
                      {(["3-3", "1-3-2"] as FormationType[]).map(f => (
                        <Button
                          key={f}
                          variant={poolBFormations.white === f ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPoolFormation("B", "white", f)}
                          className="text-[9px] flex-1 h-7 px-1"
                          data-testid={`button-formation-poolB-white-${f}`}
                        >
                          {f}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : mode === "preset_teams" ? (
          /* Preset Mode: Config + Formations */
          <div className="space-y-3">
            <Card className="border-border/50">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <UserCheck className="h-3 w-3" />
                  Preset Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Pool Setup</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={!presetTwoPool ? "default" : "outline"}
                      size="sm"
                      className="text-xs flex-1"
                      onClick={() => { setPresetTwoPool(false); updateWorkspace({ generatedTeams: null, twoPoolsTeams: null }); setShowGenerated(false); }}
                      data-testid="button-preset-1pool"
                    >
                      1 Pool
                    </Button>
                    <Button
                      variant={presetTwoPool ? "default" : "outline"}
                      size="sm"
                      className="text-xs flex-1"
                      onClick={() => { setPresetTwoPool(true); updateWorkspace({ generatedTeams: null, twoPoolsTeams: null }); setShowGenerated(false); }}
                      data-testid="button-preset-2pool"
                    >
                      2 Pools
                    </Button>
                  </div>
                </div>
                {presetTwoPool && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Preset match pool</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={presetPoolTarget === "A" ? "default" : "outline"}
                        size="sm"
                        className={`text-xs flex-1 ${presetPoolTarget === "A" ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}`}
                        onClick={() => setPresetPoolTarget("A")}
                        data-testid="button-preset-pool-a"
                      >
                        Pool A
                      </Button>
                      <Button
                        variant={presetPoolTarget === "B" ? "default" : "outline"}
                        size="sm"
                        className={`text-xs flex-1 ${presetPoolTarget === "B" ? "bg-violet-500 hover:bg-violet-600 text-white" : ""}`}
                        onClick={() => setPresetPoolTarget("B")}
                        data-testid="button-preset-pool-b"
                      >
                        Pool B
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Team Formations
                </CardTitle>
              </CardHeader>
            <CardContent className="px-4 pb-3 space-y-3">
              {/* Black Team Formation */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-xs font-medium">Black Team</span>
                </div>
                <div className="flex gap-2">
                  {(["3-3", "1-3-2"] as FormationType[]).map(f => (
                    <Button
                      key={f}
                      variant={teamFormations.black === f ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTeamFormation("black", f)}
                      className="text-xs flex-1"
                      data-testid={`button-formation-black-${f}`}
                    >
                      {FORMATION_LABELS[f]}
                    </Button>
                  ))}
                </div>
                <p className="text-[9px] text-muted-foreground">
                  Positions: {getUniquePositions(teamFormations.black).join(", ")}
                </p>
              </div>
              
              {/* White Team Formation */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-cyan-400" />
                  <span className="text-xs font-medium">White Team</span>
                </div>
                <div className="flex gap-2">
                  {(["3-3", "1-3-2"] as FormationType[]).map(f => (
                    <Button
                      key={f}
                      variant={teamFormations.white === f ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTeamFormation("white", f)}
                      className="text-xs flex-1"
                      data-testid={`button-formation-white-${f}`}
                    >
                      {FORMATION_LABELS[f]}
                    </Button>
                  ))}
                </div>
                <p className="text-[9px] text-muted-foreground">
                  Positions: {getUniquePositions(teamFormations.white).join(", ")}
                </p>
              </div>
            </CardContent>
          </Card>
          {/* close preset wrapper */}
          </div>
        ) : (
          /* Standard Mode: Per-Team Formations */
          <Card className="border-border/50">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Team Formations
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-xs font-medium">Black Team</span>
                </div>
                <div className="flex gap-2">
                  {(["3-3", "1-3-2"] as FormationType[]).map(f => (
                    <Button
                      key={f}
                      variant={teamFormations.black === f ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTeamFormation("black", f)}
                      className="text-xs flex-1"
                      data-testid={`button-formation-black-${f}`}
                    >
                      {FORMATION_LABELS[f]}
                    </Button>
                  ))}
                </div>
                <p className="text-[9px] text-muted-foreground">
                  Positions: {getUniquePositions(teamFormations.black).join(", ")}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-cyan-400" />
                  <span className="text-xs font-medium">White Team</span>
                </div>
                <div className="flex gap-2">
                  {(["3-3", "1-3-2"] as FormationType[]).map(f => (
                    <Button
                      key={f}
                      variant={teamFormations.white === f ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTeamFormation("white", f)}
                      className="text-xs flex-1"
                      data-testid={`button-formation-white-${f}`}
                    >
                      {FORMATION_LABELS[f]}
                    </Button>
                  ))}
                </div>
                <p className="text-[9px] text-muted-foreground">
                  Positions: {getUniquePositions(teamFormations.white).join(", ")}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

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
                <div className="px-4 pb-2">
                  <PlayerFilterBar
                    filter={attendFilter}
                    onChange={setAttendFilter}
                    availableTags={savedTags || []}
                    placeholder="Search players..."
                    data-testid="attend-filter"
                  />
                </div>
                <CardContent className="px-4 pb-3 max-h-[40vh] overflow-y-auto">
                  <div className="space-y-1">
                    {displayPlayers.map(player => {
                      const isSelected = selectedPlayerIds.includes(player.id);
                      const hasOffHand = player.weakHandEnabled && player.weakHandRating !== null;
                      const playerPool = poolAssignments[player.id];
                      const usingOffHand = playerOffHandSelections[player.id] === true;
                      
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
                            {showRatings && (
                              <div className={`
                                h-7 w-7 rounded-md flex items-center justify-center font-bold text-[10px]
                                ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                              `}>
                                {usingOffHand ? player.weakHandRating : player.rating}
                              </div>
                            )}
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{player.name}</span>
                              {showRatings && hasOffHand && isSelected && (
                                <span className="text-[9px] text-muted-foreground">
                                  Using: {usingOffHand ? 'Off-hand' : 'Main'} ({usingOffHand ? player.weakHandRating : player.rating})
                                </span>
                              )}
                              {showRatings && hasOffHand && !isSelected && (
                                <span className="text-[9px] text-muted-foreground">
                                  Main: {player.rating} / Off: {player.weakHandRating}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {/* Per-player off-hand toggle - only visible for selected players with off-hand enabled */}
                            {hasOffHand && isSelected && (
                              <Button
                                variant={usingOffHand ? "default" : "outline"}
                                size="sm"
                                className={`h-6 px-2 text-[10px] gap-1 ${usingOffHand ? 'bg-cyan-500 hover:bg-cyan-600 text-white' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePlayerOffHand(player.id);
                                }}
                                data-testid={`button-offhand-${player.id}`}
                              >
                                {usingOffHand ? 'Off-hand' : 'Main'}
                              </Button>
                            )}
                            
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
                    {displayPlayers.length === 0 && allPlayers.length === 0 && (
                      <div className="text-center py-6 text-muted-foreground">
                        <p className="text-sm">No players in roster.</p>
                        <p className="text-xs">Add players first.</p>
                      </div>
                    )}
                    {displayPlayers.length === 0 && allPlayers.length > 0 && (
                      <div className="text-center py-4 text-muted-foreground">
                        <p className="text-sm">No players match filters.</p>
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

              {/* Preset Player Selector */}
              {mode === "preset_teams" && selectedPlayerIds.length > 0 && (
                <Card className="border-border/50 border-purple-500/30">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <UserCheck className="h-3 w-3 text-purple-400" />
                        Select Preset Team Players ({presetPlayerIds.length}/12)
                      </CardTitle>
                      {presetPlayerIds.length > 0 && presetPlayerIds.length < 4 && (
                        <span className="text-[10px] text-amber-400">Recommend 4+</span>
                      )}
                    </div>
                  </CardHeader>
                  <div className="px-4 pb-2">
                    <PlayerFilterBar
                      filter={presetFilter}
                      onChange={setPresetFilter}
                      availableTags={savedTags || []}
                      placeholder="Search selected players..."
                      data-testid="preset-filter"
                    />
                  </div>
                  <CardContent className="px-4 pb-3 max-h-[30vh] overflow-y-auto">
                    <div className="space-y-1">
                      {displayPresetPlayers.map(player => {
                        const isPreset = presetPlayerIds.includes(player.id);
                        return (
                          <div
                            key={player.id}
                            className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                              isPreset ? "bg-purple-500/10 border-purple-500/30" : "bg-background/50 border-transparent hover:border-border/50"
                            }`}
                            onClick={() => togglePresetPlayer(player.id)}
                            data-testid={`preset-player-${player.id}`}
                          >
                            <div className="flex items-center gap-2 flex-1">
                              {showRatings && (
                                <div className={`h-7 w-7 rounded-md flex items-center justify-center font-bold text-[10px] ${
                                  isPreset ? "bg-purple-500 text-white" : "bg-muted text-muted-foreground"
                                }`}>
                                  {player.rating}
                                </div>
                              )}
                              <span className="text-sm font-medium">{player.name}</span>
                            </div>
                            <Checkbox
                              checked={isPreset}
                              data-testid={`checkbox-preset-player-${player.id}`}
                              className="pointer-events-none"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Load Previous Teams + Generate Button */}
              {(teamTemplates || []).length > 0 && (
                <Button
                  variant="outline"
                  className="w-full h-10 rounded-xl gap-2 text-sm"
                  onClick={() => setShowTemplateDialog(true)}
                  data-testid="button-load-previous"
                >
                  <History className="h-4 w-4" />
                  Load Previous Teams
                </Button>
              )}
              <Button 
                className="w-full h-12 rounded-xl text-base font-bold gap-2 shadow-lg shadow-primary/20"
                disabled={!canGenerate}
                onClick={handleGenerate}
                data-testid="button-generate"
              >
                {mode === "tournament" ? <Trophy className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                {mode === "tournament"
                  ? `Generate Tournament Teams (${selectedPlayerIds.length}/${tournamentTeamCount} players min)`
                  : mode === "preset_teams"
                  ? `Generate (Preset: ${presetPlayerIds.length} players)`
                  : `Generate Teams (${selectedPlayerIds.length} players)`}
              </Button>
            </motion.div>
          ) : (mode === "two_pools" || (mode === "preset_teams" && presetTwoPool)) && twoPoolsTeams ? (
            <motion.div
              key="results-two-pools"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              {/* Pool A + B Teams (wrapped for export) */}
              <div ref={twoPoolsRef} className="space-y-4 bg-background p-1">
                {/* Pool A Teams */}
                {twoPoolsTeams.poolA && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                      <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 font-bold">
                        Pool A
                      </Badge>
                      {mode === "preset_teams" && presetPoolTarget === "A" && (
                        <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[9px]">Preset Match</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <TeamCard
                        team={twoPoolsTeams.poolA.black}
                        colorClass="primary"
                        onMovePlayer={(playerId) => handleMovePlayerTwoPools(playerId, "White", "A")}
                        onSwapPool={(playerId) => handleSwapPlayerPool(playerId, "A")}
                        poolLabel="A"
                        showRatings={showRatings}
                        showPositions={showPositions}
                      />
                      <div className="flex items-center justify-center">
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-[8px] font-bold text-muted-foreground">VS</span>
                        </div>
                      </div>
                      <TeamCard
                        team={twoPoolsTeams.poolA.white}
                        colorClass="cyan-400"
                        onMovePlayer={(playerId) => handleMovePlayerTwoPools(playerId, "Black", "A")}
                        onSwapPool={(playerId) => handleSwapPlayerPool(playerId, "A")}
                        poolLabel="A"
                        showRatings={showRatings}
                        showPositions={showPositions}
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
                      {mode === "preset_teams" && presetPoolTarget === "B" && (
                        <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[9px]">Preset Match</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <TeamCard
                        team={twoPoolsTeams.poolB.black}
                        colorClass="primary"
                        onMovePlayer={(playerId) => handleMovePlayerTwoPools(playerId, "White", "B")}
                        onSwapPool={(playerId) => handleSwapPlayerPool(playerId, "B")}
                        poolLabel="B"
                        showRatings={showRatings}
                        showPositions={showPositions}
                      />
                      <div className="flex items-center justify-center">
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-[8px] font-bold text-muted-foreground">VS</span>
                        </div>
                      </div>
                      <TeamCard
                        team={twoPoolsTeams.poolB.white}
                        colorClass="cyan-400"
                        onMovePlayer={(playerId) => handleMovePlayerTwoPools(playerId, "Black", "B")}
                        onSwapPool={(playerId) => handleSwapPlayerPool(playerId, "B")}
                        poolLabel="B"
                        showRatings={showRatings}
                        showPositions={showPositions}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                <Button 
                  variant="outline" 
                  className="w-full h-10 rounded-xl gap-2 text-sm"
                  onClick={() => { updateWorkspace({ twoPoolsTeams: null }); setShowGenerated(false); }}
                  data-testid="button-reselect"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Reselect Players
                </Button>
                <div className="grid grid-cols-3 gap-2">
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
                    variant="outline"
                    className="h-10 rounded-xl gap-1 text-sm"
                    onClick={() => openExportModal("twopools")}
                    data-testid="button-export-pool-teams"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                  <Button 
                    className="h-10 rounded-xl gap-2 text-sm"
                    onClick={handleConfirmTwoPools}
                    data-testid="button-confirm"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : (mode === "tournament" && tournamentTeams && tournamentTeams.length > 0) ? (
            <motion.div
              key="tournament-preview"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div ref={tournamentTeamsRef} className="space-y-3">
                {tournamentTeams.map((team) => (
                  <Card key={team.label} className="border-border/50">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-amber-400" />
                        {team.label}
                        {showRatings && (
                          <Badge variant="outline" className="player-rating ml-auto text-[10px]">
                            Avg {Math.round(team.players.reduce((s, p) => s + (p.ratingUsed ?? p.rating), 0) / Math.max(team.players.length, 1))}
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <div className="space-y-1">
                        {team.players.map((player) => (
                          <div key={player.id} className="flex items-center gap-2 py-1 border-b border-border/30 last:border-0">
                            <span className="text-sm flex-1">{player.name}</span>
                            {showPositions && player.position && (
                              <Badge variant="secondary" className="player-position text-[9px] py-0 px-1.5">{player.position}</Badge>
                            )}
                            {showRatings && (
                              <span className="player-rating text-xs text-muted-foreground font-mono">{player.ratingUsed ?? player.rating}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <Button 
                  variant="outline" 
                  className="w-full h-10 rounded-xl gap-2 text-sm"
                  onClick={() => { setTournamentTeams(null); setShowGenerated(false); }}
                  data-testid="button-reselect-tournament"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Reselect Players
                </Button>
                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    variant="secondary"
                    className="h-10 rounded-xl gap-2 text-sm"
                    onClick={handleGenerateTournament}
                    data-testid="button-reroll-tournament"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Re-roll
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl gap-1 text-sm"
                    onClick={() => openExportModal("tournament")}
                    data-testid="button-export-tournament-teams"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                  <Button 
                    className="h-10 rounded-xl gap-2 text-sm bg-amber-600 hover:bg-amber-500"
                    onClick={handleConfirmTournament}
                    data-testid="button-confirm-tournament"
                  >
                    <Trophy className="h-4 w-4" />
                    Start
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
              {/* Team Cards */}
              <div ref={teamsRef} className="grid grid-cols-1 gap-3">
                {/* Black Team (Preset in preset mode) */}
                {mode === "preset_teams" && (
                  <div className="flex items-center gap-2 px-1">
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 font-bold">Preset</Badge>
                  </div>
                )}
                <TeamCard
                  team={generatedTeams.black}
                  colorClass="primary"
                  onMovePlayer={(playerId) => handleMovePlayer(playerId, "White")}
                  showRatings={showRatings}
                  showPositions={showPositions}
                />

                <div className="flex items-center justify-center">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-[10px] font-bold text-muted-foreground">VS</span>
                  </div>
                </div>

                {/* White Team (Opposition in preset mode) */}
                {mode === "preset_teams" && (
                  <div className="flex items-center gap-2 px-1">
                    <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 font-bold">Opposition</Badge>
                  </div>
                )}
                <TeamCard
                  team={generatedTeams.white}
                  colorClass="cyan-400"
                  onMovePlayer={(playerId) => handleMovePlayer(playerId, "Black")}
                  showRatings={showRatings}
                  showPositions={showPositions}
                />

                {/* Leftover warning for preset 1-pool mode */}
                {mode === "preset_teams" && presetLeftoverCount > 0 && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <span className="text-[10px] text-amber-300">
                      {presetLeftoverCount} player{presetLeftoverCount !== 1 ? "s" : ""} not included (1-pool mode only generates Preset vs Opposition)
                    </span>
                  </div>
                )}
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
                <div className="grid grid-cols-3 gap-2">
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
                    variant="outline"
                    className="h-10 rounded-xl gap-1 text-sm"
                    onClick={() => openExportModal("standard")}
                    data-testid="button-export-teams"
                  >
                    <Download className="h-4 w-4" />
                    Export
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

      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onConfirm={handleExportConfirm}
        showOptions={true}
      />

      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-sm max-h-[70vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Previous Teams
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {(teamTemplates || []).map((template) => {
              const poolKeys = Object.keys(template.pools);
              const playerCount = poolKeys.reduce((sum, key) => {
                const pool = template.pools[key as "A" | "B"];
                return sum + (pool?.black.players.length || 0) + (pool?.white.players.length || 0);
              }, 0);
              const date = new Date(template.createdAt);
              const isTwoPools = template.mode === "two_pools" || (template.pools.A && template.pools.B);
              return (
                <Card
                  key={template.id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors border-border/50"
                  onClick={() => handleLoadTemplate(template)}
                  data-testid={`template-${template.id}`}
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium flex items-center gap-1.5">
                        {isTwoPools ? (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0">2 Pools</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0">Standard</Badge>
                        )}
                        <span className="text-muted-foreground text-xs">{playerCount} players</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              );
            })}
            {(teamTemplates || []).length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">No previous teams saved.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}

interface TeamCardProps {
  team: GeneratedTeam;
  colorClass: string;
  onMovePlayer: (playerId: number) => void;
  onSwapPool?: (playerId: number) => void;
  poolLabel?: "A" | "B";
  showRatings?: boolean;
  showPositions?: boolean;
}

function TeamCard({ team, colorClass, onMovePlayer, onSwapPool, poolLabel, showRatings = true, showPositions = true }: TeamCardProps) {
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
        {showRatings && (
          <Badge variant="outline" className="player-rating bg-background/50 text-[10px]">
            Avg: {avgRating}
          </Badge>
        )}
      </div>
      <CardContent className="p-0">
        {team.players.map((player, i) => (
          <PlayerRow 
            key={player.id} 
            player={player} 
            index={i}
            isLast={i === team.players.length - 1}
            onMove={() => onMovePlayer(player.id)}
            onSwapPool={onSwapPool ? () => onSwapPool(player.id) : undefined}
            poolLabel={poolLabel}
            showRatings={showRatings}
            showPositions={showPositions}
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
  onSwapPool?: () => void;
  poolLabel?: "A" | "B";
  showRatings?: boolean;
  showPositions?: boolean;
}

function PlayerRow({ player, index, isLast, onMove, onSwapPool, poolLabel, showRatings = true, showPositions = true }: PlayerRowProps) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 ${!isLast ? 'border-b border-border/30' : ''}`}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-[10px] font-mono text-muted-foreground/60 w-4">#{index+1}</span>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium truncate">{player.name}</span>
          {showRatings && (
            <span className="player-rating text-[9px] text-muted-foreground">
              Rating: {player.ratingUsed} {player.usedOffHand ? '(Off-hand)' : '(Main)'}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {showPositions && (
          <Badge variant="secondary" className="player-position text-[9px] font-bold uppercase tracking-tight">
            {player.assignedPosition}
          </Badge>
        )}
        {onSwapPool && poolLabel && (
          <Button
            variant="outline"
            size="sm"
            className={`h-6 px-1.5 text-[9px] font-bold ${poolLabel === "A" ? 'text-violet-400 border-violet-400/30' : 'text-amber-400 border-amber-400/30'}`}
            onClick={(e) => {
              e.stopPropagation();
              onSwapPool();
            }}
            data-testid={`button-swap-pool-${player.id}`}
          >
            {poolLabel === "A" ? "B" : "A"}
          </Button>
        )}
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
