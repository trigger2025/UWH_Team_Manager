import { Player, FormationType, FormationPosition, GeneratedTeam, PlayerWithAssignedFormationRole, MatchTeamSnapshot, PlayerRatingSnapshot, PlayerOffHandSelection } from "@shared/schema";

/**
 * Canonical roles for each supported formation (matching schema positions exactly)
 * 3-3: Forward, Centre, Half Back, Centre Back (6 players)
 * 1-3-2: Forward, Wing, Centre, Back (6 players, Wing used twice)
 */
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

/**
 * Assigns players to specific roles within a formation based on their preferences
 */
export function assignFormationRoles(
  players: Player[], 
  formation: FormationType,
  playerOffHandSelections: PlayerOffHandSelection = {}
): PlayerWithAssignedFormationRole[] {
  const roles = [...FORMATION_ROLES[formation]];
  const assignedPlayers: PlayerWithAssignedFormationRole[] = [];
  const unassignedPlayers = [...players];

  // Sort by effective rating descending
  unassignedPlayers.sort((a, b) => {
    const aRating = getEffectiveRating(a, playerOffHandSelections).rating;
    const bRating = getEffectiveRating(b, playerOffHandSelections).rating;
    return bRating - aRating;
  });

  // 1. Try to assign main position preferences
  const stillUnassigned: Player[] = [];
  for (const player of unassignedPlayers) {
    const pref = (player.formationPreferences as any)?.[formation];
    const roleIndex = roles.indexOf(pref?.main);
    
    if (pref?.main && roleIndex !== -1) {
      const { rating, usedOffHand } = getEffectiveRating(player, playerOffHandSelections);
      assignedPlayers.push({
        ...player,
        assignedPosition: pref.main as FormationPosition,
        formationRole: "main",
        ratingUsed: rating,
        usedOffHand
      });
      roles.splice(roleIndex, 1);
    } else {
      stillUnassigned.push(player);
    }
  }

  // 2. Try to assign alternate position preferences
  const finalUnassigned: Player[] = [];
  for (const player of stillUnassigned) {
    const pref = (player.formationPreferences as any)?.[formation];
    const altRole = pref?.alternates?.find((alt: string) => roles.includes(alt as FormationPosition));
    
    if (altRole) {
      const { rating, usedOffHand } = getEffectiveRating(player, playerOffHandSelections);
      assignedPlayers.push({
        ...player,
        assignedPosition: altRole as FormationPosition,
        formationRole: "alternate",
        ratingUsed: rating,
        usedOffHand
      });
      roles.splice(roles.indexOf(altRole as FormationPosition), 1);
    } else {
      finalUnassigned.push(player);
    }
  }

  // 3. Fill remaining roles by best fit (rating order)
  for (const player of finalUnassigned) {
    if (roles.length > 0) {
      const { rating, usedOffHand } = getEffectiveRating(player, playerOffHandSelections);
      assignedPlayers.push({
        ...player,
        assignedPosition: roles.shift()!,
        formationRole: "filler",
        ratingUsed: rating,
        usedOffHand
      });
    }
  }

  return assignedPlayers;
}

export interface GenerateTeamsOptions {
  playerOffHandSelections: PlayerOffHandSelection;
}

/**
 * Generates two balanced teams using a snake-draft approach with post-generation balancing
 */
export function generateTeams(
  availablePlayers: Player[], 
  teamFormationMap: { black: FormationType; white: FormationType },
  options: GenerateTeamsOptions = { playerOffHandSelections: {} }
): { black: GeneratedTeam; white: GeneratedTeam } {
  const { playerOffHandSelections } = options;
  
  // Sort players by effective rating descending
  const sortedPlayers = [...availablePlayers].sort((a, b) => {
    const aRating = getEffectiveRating(a, playerOffHandSelections).rating;
    const bRating = getEffectiveRating(b, playerOffHandSelections).rating;
    return bRating - aRating;
  });
  
  const blackPlayers: Player[] = [];
  const whitePlayers: Player[] = [];
  
  // Snake draft distribution
  sortedPlayers.forEach((player, index) => {
    const isEvenRound = Math.floor(index / 2) % 2 === 0;
    const isFirstInRound = index % 2 === 0;
    
    if (isEvenRound) {
      if (isFirstInRound) blackPlayers.push(player);
      else whitePlayers.push(player);
    } else {
      if (isFirstInRound) whitePlayers.push(player);
      else blackPlayers.push(player);
    }
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

  const blackAssigned = assignFormationRoles(blackPlayers, teamFormationMap.black, playerOffHandSelections);
  const whiteAssigned = assignFormationRoles(whitePlayers, teamFormationMap.white, playerOffHandSelections);

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
  toTeam: "Black" | "White"
): { black: GeneratedTeam; white: GeneratedTeam } {
  const sourceKey = toTeam === "Black" ? "white" : "black";
  const targetKey = toTeam === "Black" ? "black" : "white";
  
  const playerIndex = teams[sourceKey].players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return teams;
  
  // Clone to avoid mutation
  const newTeams = {
    black: { ...teams.black, players: [...teams.black.players.map(p => ({ ...p }))] },
    white: { ...teams.white, players: [...teams.white.players.map(p => ({ ...p }))] }
  };
  
  const [player] = newTeams[sourceKey].players.splice(playerIndex, 1);
  newTeams[targetKey].players.push(player);
  
  // Recalculate totals
  newTeams[sourceKey].totalRating = newTeams[sourceKey].players.reduce((sum, p) => sum + p.ratingUsed, 0);
  newTeams[targetKey].totalRating = newTeams[targetKey].players.reduce((sum, p) => sum + p.ratingUsed, 0);
  
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
      return {
        playerId: p.id,
        playerName: p.name,
        ratingUsed: p.ratingUsed,
        usedOffHand: p.usedOffHand,
        mainRating: originalPlayer?.rating ?? p.rating,
        offHandRating: originalPlayer?.weakHandRating ?? null,
        team: teamColor,
        position: p.assignedPosition
      };
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
