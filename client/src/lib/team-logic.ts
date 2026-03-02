import { Player, FormationType, FormationPosition, GeneratedTeam, PlayerWithAssignedFormationRole, MatchTeamSnapshot, PlayerRatingSnapshot, PlayerOffHandSelection, AdminSettings } from "@shared/schema";

export const FORMATION_ROLES: Record<FormationType, FormationPosition[]> = {
  "3-3": [
    "Forward", "Forward", "Forward",
    "Half Back", "Centre Back", "Half Back"
  ],
  "1-3-2": [
    "Forward",
    "Wing", "Centre", "Wing",
    "Back", "Back"
  ]
};

const FORMATION_COMPATIBILITY: Record<FormationType, Record<string, Record<string, number>>> = {
  "3-3": {
    Forward: { Forward: 3, Centre: 2, "Half Back": 1, "Centre Back": 0 },
    Centre: { Forward: 2, Centre: 3, "Half Back": 2, "Centre Back": 1 },
    "Half Back": { Forward: 1, Centre: 1, "Half Back": 3, "Centre Back": 2 },
    "Centre Back": { Forward: 0, Centre: 1, "Half Back": 2, "Centre Back": 3 },
  },
  "1-3-2": {
    Forward: { Forward: 3, Wing: 2, Centre: 1, Back: 0 },
    Wing: { Forward: 2, Wing: 3, Centre: 2, Back: 1 },
    Centre: { Forward: 1, Wing: 2, Centre: 3, Back: 2 },
    Back: { Forward: 0, Wing: 1, Centre: 2, Back: 3 },
  },
};

const BASE_SLOT_STRUCTURES: Record<FormationType, Record<string, number>> = {
  "3-3": { Forward: 2, Centre: 1, "Half Back": 2, "Centre Back": 1 },
  "1-3-2": { Forward: 1, Wing: 2, Centre: 1, Back: 2 },
};

const EXTRA_SLOT_PRIORITY: Record<FormationType, string[]> = {
  "3-3": ["Forward", "Half Back", "Centre", "Centre Back"],
  "1-3-2": ["Back", "Wing", "Centre", "Forward"],
};

function findCorePlayerIds(
  players: PlayerWithAssignedFormationRole[],
  formation: FormationType
): Set<number> {
  const coreSlots: string[] = [];
  for (const [pos, count] of Object.entries(BASE_SLOT_STRUCTURES[formation])) {
    for (let i = 0; i < count; i++) coreSlots.push(pos);
  }

  const remaining = [...players];
  const coreIds = new Set<number>();

  for (const slot of coreSlots) {
    let bestIdx = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const pref = (remaining[i].formationPreferences as any)?.[formation];
      const main = pref?.main as string | undefined;
      const alts = (pref?.alternates as string[]) || [];
      const score = main === slot ? 100 : alts.includes(slot) ? 40 : -1000;
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    }

    if (bestIdx !== -1) {
      coreIds.add(remaining[bestIdx].id);
      remaining.splice(bestIdx, 1);
    }
  }

  return coreIds;
}

function deriveClusterLabel(
  player: PlayerWithAssignedFormationRole,
  formation: FormationType
): string {
  const pref = (player.formationPreferences as any)?.[formation];
  const main = pref?.main as string | undefined;
  const alts = (pref?.alternates as string[]) || [];
  const all = [main, ...alts].filter(Boolean) as string[];

  if (formation === "3-3") {
    if (all.includes("Centre") && all.includes("Centre Back")) return "Centre/Centre Back 3-2";
    if (all.includes("Half Back")) return "Half Back 3-2";
    if (all.includes("Forward")) return "Forward 1-1";
  }

  if (formation === "1-3-2") {
    if (all.includes("Back")) return "Back 3-2";
    if (all.includes("Wing")) return "Wing 3-2";
    if (all.includes("Forward")) return "Forward 1-1";
  }

  return main || "Flexible";
}

export function applyClusterLabels(
  players: PlayerWithAssignedFormationRole[],
  formation: FormationType
): PlayerWithAssignedFormationRole[] {
  const size = players.length;
  if (size <= 6) return players.map(p => ({ ...p, clusterLabel: undefined }));

  const coreIds = findCorePlayerIds(players, formation);
  const extras = players.filter(p => !coreIds.has(p.id));

  if (extras.length === 0) return players.map(p => ({ ...p, clusterLabel: undefined }));

  if (extras.length === 1) {
    const extraId = extras[0].id;
    return players.map(p => ({ ...p, clusterLabel: p.id === extraId ? "super-sub" : undefined }));
  }

  const clusterMap = new Map<number, string>();
  for (const extra of extras) {
    clusterMap.set(extra.id, deriveClusterLabel(extra, formation));
  }

  return players.map(p => ({
    ...p,
    clusterLabel: coreIds.has(p.id) ? undefined : clusterMap.get(p.id),
  }));
}

export function getPositionBonusSettings(adminSettings: AdminSettings[]): { mainPositionBonus: number; alternatePositionBonus: number } {
  const mainSetting = adminSettings.find(s => s.key === "main_position_bonus");
  const altSetting = adminSettings.find(s => s.key === "alternate_position_bonus");
  return {
    mainPositionBonus: mainSetting ? parseInt(mainSetting.value as string) : 4,
    alternatePositionBonus: altSetting ? parseInt(altSetting.value as string) : 2,
  };
}

function getCompatibilityScore(
  mainPosition: string | undefined,
  alternates: string[] | undefined,
  slot: string,
  formation: FormationType,
  mainBonus: number,
  altBonus: number
): number {
  const base = mainPosition ? (FORMATION_COMPATIBILITY[formation][mainPosition]?.[slot] ?? 0) : 0;
  let bonus = 0;
  if (slot === mainPosition) bonus += mainBonus;
  if (alternates?.includes(slot)) bonus += altBonus;
  return base + bonus;
}

function buildSlotTargets(formation: FormationType, teamSize: number): Record<string, number> {
  const base = { ...BASE_SLOT_STRUCTURES[formation] };
  const totalBase = Object.values(base).reduce((s, v) => s + v, 0);
  if (teamSize <= totalBase) return base;

  const slots = { ...base };
  let remaining = teamSize - totalBase;
  const priority = EXTRA_SLOT_PRIORITY[formation];
  let index = 0;
  while (remaining > 0) {
    slots[priority[index % priority.length]] += 1;
    remaining--;
    index++;
  }
  return slots;
}

/**
 * Gets the effective rating for a player based on per-player off-hand selection
 * @param player - The player to get rating for
 * @param playerOffHandSelections - Map of playerId to whether off-hand is selected
 */
export function getEffectiveRating(
  player: Player, 
  playerOffHandSelections: PlayerOffHandSelection = {}
): { rating: number; usedOffHand: boolean } {
  const useOffHand = playerOffHandSelections[player.id] === true;
  if (useOffHand && player.weakHandEnabled && player.weakHandRating !== null) {
    return { rating: player.weakHandRating, usedOffHand: true };
  }
  return { rating: player.rating, usedOffHand: false };
}

/**
 * Validates if a group of players can fill the required roles for a formation
 */
export function validateFormation(players: Player[], formation: FormationType): { valid: boolean; minPlayers: number } {
  const requiredRoles = FORMATION_ROLES[formation];
  const minPlayers = requiredRoles.length;
  return { 
    valid: players.length >= minPlayers, 
    minPlayers 
  };
}

export function assignFormationRoles(
  players: Player[], 
  formation: FormationType,
  playerOffHandSelections: PlayerOffHandSelection = {},
  adminSettings: AdminSettings[] = []
): PlayerWithAssignedFormationRole[] {
  const { mainPositionBonus, alternatePositionBonus } = getPositionBonusSettings(adminSettings);
  const teamSize = players.length;
  const slotTargets = buildSlotTargets(formation, teamSize);

  const assigned: PlayerWithAssignedFormationRole[] = [];
  const unassigned = [...players];

  for (let i = unassigned.length - 1; i >= 0; i--) {
    const player = unassigned[i];
    const pref = (player.formationPreferences as any)?.[formation];
    const mainPos = pref?.main as string | undefined;
    const alts = pref?.alternates as string[] | undefined;

    if (!alts || alts.length === 0) {
      if (mainPos && slotTargets[mainPos] && slotTargets[mainPos] > 0) {
        const { rating, usedOffHand } = getEffectiveRating(player, playerOffHandSelections);
        assigned.push({ ...player, assignedPosition: mainPos as FormationPosition, formationRole: "main", ratingUsed: rating, usedOffHand });
        slotTargets[mainPos]--;
        unassigned.splice(i, 1);
      }
    }
  }

  while (unassigned.length > 0) {
    let bestChoice: { player: Player; slot: string; score: number; idx: number } | null = null;

    for (let i = 0; i < unassigned.length; i++) {
      const player = unassigned[i];
      const pref = (player.formationPreferences as any)?.[formation];
      const mainPos = pref?.main as string | undefined;
      const alts = pref?.alternates as string[] | undefined;

      for (const slot in slotTargets) {
        if (slotTargets[slot] <= 0) continue;
        const score = getCompatibilityScore(mainPos, alts, slot, formation, mainPositionBonus, alternatePositionBonus);
        if (!bestChoice || score > bestChoice.score) {
          bestChoice = { player, slot, score, idx: i };
        }
      }
    }

    if (!bestChoice) break;

    const { rating, usedOffHand } = getEffectiveRating(bestChoice.player, playerOffHandSelections);
    const pref = (bestChoice.player.formationPreferences as any)?.[formation];
    const mainPos = pref?.main as string | undefined;
    const alts = pref?.alternates as string[] | undefined;
    let role: "main" | "alternate" | "filler" = "filler";
    if (bestChoice.slot === mainPos) role = "main";
    else if (alts?.includes(bestChoice.slot)) role = "alternate";

    assigned.push({ ...bestChoice.player, assignedPosition: bestChoice.slot as FormationPosition, formationRole: role, ratingUsed: rating, usedOffHand });
    slotTargets[bestChoice.slot]--;
    unassigned.splice(bestChoice.idx, 1);
  }

  return assigned;
}

export interface GenerateTeamsOptions {
  playerOffHandSelections: PlayerOffHandSelection;
  adminSettings?: AdminSettings[];
}

/**
 * Generates two balanced teams using a snake-draft approach with post-generation balancing
 */
export function generateTeams(
  availablePlayers: Player[], 
  teamFormationMap: { black: FormationType; white: FormationType },
  options: GenerateTeamsOptions = { playerOffHandSelections: {} }
): { black: GeneratedTeam; white: GeneratedTeam } {
  const { playerOffHandSelections, adminSettings = [] } = options;
  
  // Sort players by effective rating descending with slight random jitter for variety
  const sortedPlayers = [...availablePlayers].sort((a, b) => {
    const aRating = getEffectiveRating(a, playerOffHandSelections).rating;
    const bRating = getEffectiveRating(b, playerOffHandSelections).rating;
    const jitter = (Math.random() - 0.5) * 20;
    return (bRating - aRating) + jitter;
  });
  
  const blackPlayers: Player[] = [];
  const whitePlayers: Player[] = [];
  
  // Snake draft distribution with random first-pick
  const blackFirst = Math.random() > 0.5;
  sortedPlayers.forEach((player, index) => {
    const isEvenRound = Math.floor(index / 2) % 2 === 0;
    const isFirstInRound = index % 2 === 0;
    
    let goesBlack: boolean;
    if (isEvenRound) {
      goesBlack = isFirstInRound;
    } else {
      goesBlack = !isFirstInRound;
    }
    if (!blackFirst) goesBlack = !goesBlack;
    
    if (goesBlack) blackPlayers.push(player);
    else whitePlayers.push(player);
  });

  // Post-generation balancing (simple swap if imbalance is high)
  const getRating = (team: Player[]) => team.reduce((sum, p) => getEffectiveRating(p, playerOffHandSelections).rating + sum, 0);
  
  let bRating = getRating(blackPlayers);
  let wRating = getRating(whitePlayers);

  // Run a few optimization swaps
  for (let i = 0; i < 5; i++) {
    const diff = bRating - wRating;
    if (Math.abs(diff) < 0.5) break;

    let bestSwap: { b: number; w: number } | null = null;
    let maxImprovement = 0;

    for (let b = 0; b < blackPlayers.length; b++) {
      for (let w = 0; w < whitePlayers.length; w++) {
        const bPlayerRating = getEffectiveRating(blackPlayers[b], playerOffHandSelections).rating;
        const wPlayerRating = getEffectiveRating(whitePlayers[w], playerOffHandSelections).rating;
        const swapDiff = (bPlayerRating - wPlayerRating) * 2;
        const newDiff = diff - swapDiff;
        const improvement = Math.abs(diff) - Math.abs(newDiff);

        if (improvement > maxImprovement) {
          maxImprovement = improvement;
          bestSwap = { b, w };
        }
      }
    }

    if (bestSwap) {
      const temp = blackPlayers[bestSwap.b];
      blackPlayers[bestSwap.b] = whitePlayers[bestSwap.w];
      whitePlayers[bestSwap.w] = temp;
      bRating = getRating(blackPlayers);
      wRating = getRating(whitePlayers);
    } else break;
  }

  const blackAssigned = applyClusterLabels(
    assignFormationRoles(blackPlayers, teamFormationMap.black, playerOffHandSelections, adminSettings),
    teamFormationMap.black
  );
  const whiteAssigned = applyClusterLabels(
    assignFormationRoles(whitePlayers, teamFormationMap.white, playerOffHandSelections, adminSettings),
    teamFormationMap.white
  );

  return {
    black: {
      color: "Black",
      formation: teamFormationMap.black,
      players: blackAssigned,
      totalRating: blackAssigned.reduce((sum, p) => sum + p.ratingUsed, 0)
    },
    white: {
      color: "White",
      formation: teamFormationMap.white,
      players: whiteAssigned,
      totalRating: whiteAssigned.reduce((sum, p) => sum + p.ratingUsed, 0)
    }
  };
}

/**
 * Re-jigs teams while keeping certain players locked in their current team/position
 */
export function reJigTeams(
  existingTeams: { black: GeneratedTeam; white: GeneratedTeam },
  lockedPlayerIds: number[],
  options: GenerateTeamsOptions = { playerOffHandSelections: {} }
): { black: GeneratedTeam; white: GeneratedTeam } {
  const allPlayers = [
    ...existingTeams.black.players,
    ...existingTeams.white.players
  ];

  // For this simple version, we'll just re-generate from scratch including all players
  return generateTeams(allPlayers, {
    black: existingTeams.black.formation,
    white: existingTeams.white.formation
  }, options);
}

/**
 * Moves a player from one team to another without rebalancing
 * Updates total ratings live but keeps player positions as-is
 */
export function movePlayerBetweenTeams(
  teams: { black: GeneratedTeam; white: GeneratedTeam },
  playerId: number,
  toTeam: "Black" | "White",
  adminSettings: AdminSettings[] = []
): { black: GeneratedTeam; white: GeneratedTeam } {
  const sourceKey = toTeam === "Black" ? "white" : "black";
  const targetKey = toTeam === "Black" ? "black" : "white";
  
  const playerIndex = teams[sourceKey].players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return teams;
  
  const newTeams = {
    black: { ...teams.black, players: [...teams.black.players.map(p => ({ ...p }))] },
    white: { ...teams.white, players: [...teams.white.players.map(p => ({ ...p }))] }
  };
  
  const [player] = newTeams[sourceKey].players.splice(playerIndex, 1);
  newTeams[targetKey].players.push(player);

  const offHandMap: PlayerOffHandSelection = {};
  for (const p of [...newTeams[sourceKey].players, ...newTeams[targetKey].players]) {
    if (p.usedOffHand) offHandMap[p.id] = true;
  }
  
  const sourceBasePlayers = newTeams[sourceKey].players.map(p => p as Player);
  const targetBasePlayers = newTeams[targetKey].players.map(p => p as Player);
  
  const sourceReassigned = applyClusterLabels(
    assignFormationRoles(sourceBasePlayers, newTeams[sourceKey].formation, offHandMap, adminSettings),
    newTeams[sourceKey].formation
  );
  const targetReassigned = applyClusterLabels(
    assignFormationRoles(targetBasePlayers, newTeams[targetKey].formation, offHandMap, adminSettings),
    newTeams[targetKey].formation
  );
  
  newTeams[sourceKey].players = sourceReassigned;
  newTeams[targetKey].players = targetReassigned;
  newTeams[sourceKey].totalRating = sourceReassigned.reduce((sum, p) => sum + p.ratingUsed, 0);
  newTeams[targetKey].totalRating = targetReassigned.reduce((sum, p) => sum + p.ratingUsed, 0);
  
  return newTeams;
}

/**
 * Creates a deep copy of teams for history
 */
export function cloneTeams(teams: { black: GeneratedTeam; white: GeneratedTeam }): { black: GeneratedTeam; white: GeneratedTeam } {
  return {
    black: {
      ...teams.black,
      players: teams.black.players.map(p => ({ ...p }))
    },
    white: {
      ...teams.white,
      players: teams.white.players.map(p => ({ ...p }))
    }
  };
}

/**
 * Creates a snapshot of teams for match result storage
 * Captures the rating used at generation time for each player
 */
export function createMatchTeamSnapshot(
  teams: { black: GeneratedTeam; white: GeneratedTeam },
  players: Player[]
): MatchTeamSnapshot {
  const createPlayerSnapshots = (team: GeneratedTeam, teamColor: "Black" | "White"): PlayerRatingSnapshot[] => {
    return team.players.map(p => {
      const originalPlayer = players.find(pl => pl.id === p.id);
      const currentMainRating = originalPlayer?.rating ?? p.rating;
      const currentOffHandRating = originalPlayer?.weakHandRating ?? null;
      return {
        playerId: p.id,
        playerName: p.name,
        ratingUsed: p.ratingUsed,
        usedOffHand: p.usedOffHand,
        mainRating: currentMainRating,
        offHandRating: currentOffHandRating,
        ratingBefore: p.usedOffHand ? (currentOffHandRating ?? currentMainRating) : currentMainRating,
        team: teamColor,
        position: p.assignedPosition
      } as PlayerRatingSnapshot;
    });
  };

  // Check if any player used off-hand rating (derived from per-player selections)
  const anyUsedOffHand = [...teams.black.players, ...teams.white.players].some(p => p.usedOffHand);

  return {
    black: {
      players: createPlayerSnapshots(teams.black, "Black"),
      totalRating: teams.black.totalRating,
      formation: teams.black.formation
    },
    white: {
      players: createPlayerSnapshots(teams.white, "White"),
      totalRating: teams.white.totalRating,
      formation: teams.white.formation
    },
    useOffHandRatings: anyUsedOffHand, // Keep for backwards compatibility
    timestamp: new Date().toISOString()
  };
}
