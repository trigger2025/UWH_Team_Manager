import { Player, GeneratedTeam, Match, MatchTeamSnapshot } from "@shared/schema";

interface RatingChange {
  playerId: number;
  change: number;
  usedOffHand: boolean;
}

/**
 * Calculates rating changes for players based on match results using an Elo-style system.
 * 
 * @param blackTeam Team Black data including players and total rating
 * @param whiteTeam Team White data including players and total rating
 * @param blackScore Final score for Team Black
 * @param whiteScore Final score for Team White
 * @param kFactor Base sensitivity of rating adjustments (0-100)
 * @param tournamentMode Whether to apply the tournament modifier (default 70% of change)
 */
export function calculateRatingAdjustments(
  blackTeam: GeneratedTeam,
  whiteTeam: GeneratedTeam,
  blackScore: number,
  whiteScore: number,
  kFactor: number = 32,
  tournamentMode: boolean = false
): RatingChange[] {
  const bAvg = blackTeam.totalRating / (blackTeam.players.length || 1);
  const wAvg = whiteTeam.totalRating / (whiteTeam.players.length || 1);

  // Expected outcomes (Elo formula)
  const expectedBlack = 1 / (1 + Math.pow(10, (wAvg - bAvg) / 10));
  const expectedWhite = 1 - expectedBlack;

  // Actual outcome
  let actualBlack = 0.5;
  if (blackScore > whiteScore) actualBlack = 1;
  else if (whiteScore > blackScore) actualBlack = 0;

  // Score difference multiplier (clamped to prevent massive swings)
  const scoreDiff = Math.abs(blackScore - whiteScore);
  const multiplier = Math.log(scoreDiff + 1) / Math.log(2);
  const clampedMultiplier = Math.min(Math.max(multiplier, 1), 3);

  // Tournament modifier
  const tournamentModifier = tournamentMode ? 0.7 : 1.0;

  // Calculate base change
  const baseChange = kFactor * (actualBlack - expectedBlack) * clampedMultiplier * tournamentModifier;

  const adjustments: RatingChange[] = [];

  // Apply to black team
  blackTeam.players.forEach(p => {
    adjustments.push({ playerId: p.id, change: baseChange, usedOffHand: p.usedOffHand || false });
  });

  // Apply to white team (inverse change)
  whiteTeam.players.forEach(p => {
    adjustments.push({ playerId: p.id, change: -baseChange, usedOffHand: p.usedOffHand || false });
  });

  return adjustments;
}

/**
 * Updates player records with new rating adjustments and match stats
 */
export function applyRatingAdjustments(
  players: Player[],
  adjustments: RatingChange[],
  blackWin: boolean,
  whiteWin: boolean,
  draw: boolean
): Player[] {
  return players.map(player => {
    const adj = adjustments.find(a => a.playerId === player.id);
    if (!adj) return player;

    let won = false;
    let lost = false;
    
    if (adj.change > 0) {
      if (blackWin) won = true;
      else if (whiteWin) lost = true;
    } else {
      if (whiteWin) won = true;
      else if (blackWin) lost = true;
    }

    if (adj.usedOffHand && player.weakHandEnabled && player.weakHandRating !== null) {
      const newOffHandRating = Math.round(Math.min(Math.max(player.weakHandRating + adj.change, 0), 1000));
      return {
        ...player,
        weakHandRating: newOffHandRating,
        wins: player.wins + (won ? 1 : 0),
        losses: player.losses + (lost ? 1 : 0),
        draws: player.draws + (draw ? 1 : 0),
        ratingHistory: [
          ...player.ratingHistory as any[],
          { date: new Date().toISOString(), rating: player.rating, offHandRating: newOffHandRating }
        ]
      };
    }

    const newRating = Math.round(Math.min(Math.max(player.rating + adj.change, 0), 1000));
    
    return {
      ...player,
      rating: newRating,
      wins: player.wins + (won ? 1 : 0),
      losses: player.losses + (lost ? 1 : 0),
      draws: player.draws + (draw ? 1 : 0),
      ratingHistory: [
        ...player.ratingHistory as any[],
        { date: new Date().toISOString(), rating: newRating }
      ]
    };
  });
}
