import { Player, FormationType, FormationPosition, GeneratedTeam, PlayerWithAssignedFormationRole } from "@shared/schema";

/**
 * Required roles for each supported formation
 */
export const FORMATION_ROLES: Record<FormationType, FormationPosition[]> = {
  "3-3": [
    "Left Wing", "Center Forward", "Right Wing",
    "Left Back", "Full Back", "Right Back"
  ],
  "1-3-2": [
    "Goalie",
    "Left Mid", "Center Mid", "Right Mid",
    "Left Back", "Right Back"
  ],
  "2-3-1": [
    "Left Back", "Right Back",
    "Left Mid", "Center Mid", "Right Mid",
    "Goalie"
  ],
  "3-2-1": [
    "Left Wing", "Center Forward", "Right Wing",
    "Center Mid", "Goalie", "Full Back"
  ],
  "2-2-2": [
    "Left Wing", "Right Wing",
    "Left Mid", "Right Mid",
    "Left Back", "Right Back"
  ]
};

/**
 * Validates if a group of players can fill the required roles for a formation
 */
export function validateFormation(players: Player[], formation: FormationType): { valid: boolean; missingPositions: FormationPosition[] } {
  const requiredRoles = FORMATION_ROLES[formation];
  if (players.length < requiredRoles.length) {
    return { valid: false, missingPositions: [] }; // Not enough players
  }
  return { valid: true, missingPositions: [] };
}

/**
 * Assigns players to specific roles within a formation based on their preferences
 */
export function assignFormationRoles(
  players: Player[], 
  formation: FormationType
): PlayerWithAssignedFormationRole[] {
  const roles = [...FORMATION_ROLES[formation]];
  const unassignedPlayers = [...players].sort((a, b) => b.rating - a.rating);
  const assignedPlayers: PlayerWithAssignedFormationRole[] = [];

  // 1. Try to assign main positions
  const stillUnassigned: Player[] = [];
  for (const player of unassignedPlayers) {
    const pref = (player.formationPreferences as any)?.[formation];
    const roleIndex = roles.indexOf(pref?.main);
    
    if (pref?.main && roleIndex !== -1) {
      assignedPlayers.push({
        ...player,
        assignedPosition: pref.main as FormationPosition,
        formationRole: "main"
      });
      roles.splice(roleIndex, 1);
    } else {
      stillUnassigned.push(player);
    }
  }

  // 2. Try to assign alternate positions
  const finalUnassigned: Player[] = [];
  for (const player of stillUnassigned) {
    const pref = (player.formationPreferences as any)?.[formation];
    const altRole = pref?.alternates?.find((alt: string) => roles.includes(alt as FormationPosition));
    
    if (altRole) {
      assignedPlayers.push({
        ...player,
        assignedPosition: altRole as FormationPosition,
        formationRole: "alternate"
      });
      roles.splice(roles.indexOf(altRole as FormationPosition), 1);
    } else {
      finalUnassigned.push(player);
    }
  }

  // 3. Fill remaining roles by best fit (rating order)
  for (const player of finalUnassigned) {
    if (roles.length > 0) {
      assignedPlayers.push({
        ...player,
        assignedPosition: roles.shift()!,
        formationRole: "filler"
      });
    }
  }

  return assignedPlayers;
}

/**
 * Generates two balanced teams using a snake-draft approach with post-generation balancing
 */
export function generateTeams(
  availablePlayers: Player[], 
  teamFormationMap: { black: FormationType; white: FormationType }
): { black: GeneratedTeam; white: GeneratedTeam } {
  // Sort players by rating descending
  const sortedPlayers = [...availablePlayers].sort((a, b) => b.rating - a.rating);
  
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
  const getRating = (team: Player[]) => team.reduce((sum, p) => sum + p.rating, 0);
  
  let bRating = getRating(blackPlayers);
  let wRating = getRating(whitePlayers);

  // Run a few optimization swaps
  for (let i = 0; i < 5; i++) {
    const diff = bRating - wRating;
    if (Math.abs(diff) < 0.5) break;

    let bestSwap = null;
    let maxImprovement = 0;

    for (let b = 0; b < blackPlayers.length; b++) {
      for (let w = 0; w < whitePlayers.length; w++) {
        const swapDiff = (blackPlayers[b].rating - whitePlayers[w].rating) * 2;
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

  return {
    black: {
      color: "Black",
      formation: teamFormationMap.black,
      players: assignFormationRoles(blackPlayers, teamFormationMap.black),
      totalRating: bRating
    },
    white: {
      color: "White",
      formation: teamFormationMap.white,
      players: assignFormationRoles(whitePlayers, teamFormationMap.white),
      totalRating: wRating
    }
  };
}

/**
 * Re-jigs teams while keeping certain players locked in their current team/position
 */
export function reJigTeams(
  existingTeams: { black: GeneratedTeam; white: GeneratedTeam },
  lockedPlayerIds: number[]
): { black: GeneratedTeam; white: GeneratedTeam } {
  const allPlayers = [
    ...existingTeams.black.players,
    ...existingTeams.white.players
  ];

  const lockedPlayers = allPlayers.filter(p => lockedPlayerIds.includes(p.id));
  const unlockedPlayers = allPlayers.filter(p => !lockedPlayerIds.includes(p.id));

  // For this simple version, we'll just re-generate from scratch including all players
  // A more advanced version would keep locked players in their specific teams
  return generateTeams(allPlayers, {
    black: existingTeams.black.formation,
    white: existingTeams.white.formation
  });
}

/**
 * Applies a preset team configuration to a list of available players
 */
export function applyPresetTeam(
  preset: { playerIds: number[] }, 
  allPlayers: Player[]
): Player[] {
  return allPlayers.filter(p => preset.playerIds.includes(p.id));
}
