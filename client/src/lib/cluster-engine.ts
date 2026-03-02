import { Player, FormationType, PlayerWithAssignedFormationRole, PlayerOffHandSelection, AdminSettings } from "@shared/schema";
import { getEffectiveRating, getPositionBonusSettings } from "./team-logic";

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

const CORE_SLOTS: Record<FormationType, Record<string, number>> = {
  "3-3": { Forward: 2, Centre: 1, "Half Back": 2, "Centre Back": 1 },
  "1-3-2": { Forward: 1, Wing: 2, Centre: 1, Back: 2 },
};

const AVOIDANCE_PAIRS: Record<FormationType, string[][]> = {
  "3-3": [
    ["Forward", "Half Back"],
    ["Forward", "Centre Back"],
  ],
  "1-3-2": [
    ["Forward", "Back"],
  ],
};

const HEAVY_PENALTY = -1000;
const SOFT_MISFIT = -15;

interface ClusteredPlayer {
  player: Player;
  corePosition: string | null;
  clusterLabel: string | null;
  bestPos: string;
  rating: number;
  usedOffHand: boolean;
}

function getPlayerScore(
  mainPos: string | undefined,
  alts: string[] | undefined,
  slot: string,
  formation: FormationType,
  mainBonus: number,
  altBonus: number,
  rating: number
): number {
  const base = mainPos ? (FORMATION_COMPATIBILITY[formation][mainPos]?.[slot] ?? 0) : 0;
  let bonus = 0;
  if (slot === mainPos) bonus += mainBonus;
  if (alts?.includes(slot)) bonus += altBonus;
  return base + bonus + (rating / 100);
}

function getPlayerPrefs(player: Player, formation: FormationType): { mainPos: string | undefined; alts: string[] | undefined } {
  const pref = (player.formationPreferences as any)?.[formation];
  return {
    mainPos: pref?.main as string | undefined,
    alts: pref?.alternates as string[] | undefined,
  };
}

function getBestPositionForPlayer(
  player: Player,
  formation: FormationType,
  mainBonus: number,
  altBonus: number,
  offHandSelections: PlayerOffHandSelection
): string {
  const { mainPos, alts } = getPlayerPrefs(player, formation);
  const { rating } = getEffectiveRating(player, offHandSelections);
  const positions = Object.keys(CORE_SLOTS[formation]);
  let best: { pos: string; score: number } | null = null;

  for (const pos of positions) {
    const score = getPlayerScore(mainPos, alts, pos, formation, mainBonus, altBonus, rating);
    if (!best || score > best.score) {
      best = { pos, score };
    }
  }

  return best?.pos || positions[0];
}

function assignCorePositions(
  players: Player[],
  formation: FormationType,
  offHandSelections: PlayerOffHandSelection,
  mainBonus: number,
  altBonus: number
): ClusteredPlayer[] {
  const slots = { ...CORE_SLOTS[formation] };
  const totalSlots = Object.values(slots).reduce((s, v) => s + v, 0);
  const corePlayers: ClusteredPlayer[] = [];
  const remaining = [...players];

  const coreCount = Math.min(remaining.length, totalSlots);

  for (let assigned = 0; assigned < coreCount; assigned++) {
    let best: { idx: number; slot: string; score: number } | null = null;

    for (let i = 0; i < remaining.length; i++) {
      const p = remaining[i];
      const { mainPos, alts } = getPlayerPrefs(p, formation);
      const { rating } = getEffectiveRating(p, offHandSelections);

      for (const slot in slots) {
        if (slots[slot] <= 0) continue;
        const score = getPlayerScore(mainPos, alts, slot, formation, mainBonus, altBonus, rating);
        if (!best || score > best.score) {
          best = { idx: i, slot, score };
        }
      }
    }

    if (!best) break;

    const p = remaining[best.idx];
    const { rating, usedOffHand } = getEffectiveRating(p, offHandSelections);
    const bestPos = getBestPositionForPlayer(p, formation, mainBonus, altBonus, offHandSelections);
    corePlayers.push({ player: p, corePosition: best.slot, clusterLabel: null, bestPos, rating, usedOffHand });
    slots[best.slot]--;
    remaining.splice(best.idx, 1);
  }

  applyFallbacks(corePlayers, formation);

  const extras = remaining.map(p => {
    const { rating, usedOffHand } = getEffectiveRating(p, offHandSelections);
    const bestPos = getBestPositionForPlayer(p, formation, mainBonus, altBonus, offHandSelections);
    return { player: p, corePosition: null, clusterLabel: null, bestPos, rating, usedOffHand } as ClusteredPlayer;
  });

  return [...corePlayers, ...extras];
}

function applyFallbacks(corePlayers: ClusteredPlayer[], formation: FormationType): void {
  if (formation === "3-3") {
    const hasCentre = corePlayers.some(p => p.corePosition === "Centre");
    const hasCB = corePlayers.some(p => p.corePosition === "Centre Back");

    if (!hasCentre && !hasCB && corePlayers.length >= 2) {
      const sorted = [...corePlayers].sort((a, b) => b.rating - a.rating);
      sorted[0].corePosition = "Centre Back";
      const next = sorted.find(p => p !== sorted[0]);
      if (next) next.corePosition = "Centre";
    } else {
      if (!hasCentre) {
        const forwards = corePlayers.filter(p => p.corePosition === "Forward").sort((a, b) => b.rating - a.rating);
        if (forwards.length > 0) forwards[0].corePosition = "Centre";
      }
      if (!hasCB) {
        const halfBacks = corePlayers.filter(p => p.corePosition === "Half Back").sort((a, b) => b.rating - a.rating);
        if (halfBacks.length > 0) halfBacks[0].corePosition = "Centre Back";
      }
    }
  } else if (formation === "1-3-2") {
    const backCount = corePlayers.filter(p => p.corePosition === "Back").length;
    if (backCount < 2) {
      const sorted = corePlayers.filter(p => p.corePosition !== "Back").sort((a, b) => b.rating - a.rating);
      let needed = 2 - backCount;
      for (const p of sorted) {
        if (needed <= 0) break;
        p.corePosition = "Back";
        needed--;
      }
    }
  }
}

function hasAvoidancePair(positions: string[], formation: FormationType): boolean {
  for (const pair of AVOIDANCE_PAIRS[formation]) {
    if (pair.every(pos => positions.includes(pos))) return true;
  }
  return false;
}

function scoreCluster(playerPositions: string[], formation: FormationType): number {
  let score = 0;

  for (let i = 0; i < playerPositions.length; i++) {
    for (let j = i + 1; j < playerPositions.length; j++) {
      const pos1 = playerPositions[i];
      const pos2 = playerPositions[j];
      score += FORMATION_COMPATIBILITY[formation][pos1]?.[pos2] ?? 0;
      score += FORMATION_COMPATIBILITY[formation][pos2]?.[pos1] ?? 0;
    }
  }

  if (hasAvoidancePair(playerPositions, formation)) {
    score += HEAVY_PENALTY;
  }

  for (const pos of playerPositions) {
    let maxCompat = 0;
    for (const other of playerPositions) {
      if (other === pos) continue;
      maxCompat = Math.max(maxCompat, FORMATION_COMPATIBILITY[formation][pos]?.[other] ?? 0);
    }
    if (maxCompat <= 1) score += SOFT_MISFIT;
  }

  return score;
}

function buildClusterLabel(positions: string[], formation: FormationType): string {
  const uniquePositions = [...new Set(positions)];
  const positionOrder = Object.keys(CORE_SLOTS[formation]);
  uniquePositions.sort((a, b) => positionOrder.indexOf(a) - positionOrder.indexOf(b));

  const clusterSize = positions.length;
  const slotsFilledBy = Math.max(clusterSize - 1, 1);

  return `${uniquePositions.join("/")} (${clusterSize}-for-${slotsFilledBy})`;
}

function getCombinations(n: number, k: number): number[][] {
  const result: number[][] = [];
  const combo: number[] = [];

  function backtrack(start: number) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < n; i++) {
      combo.push(i);
      backtrack(i + 1);
      combo.pop();
    }
  }

  backtrack(0);
  return result;
}

function isFrontlinePosition(pos: string, formation: FormationType): boolean {
  if (formation === "3-3") return pos === "Forward" || pos === "Centre";
  return pos === "Forward" || pos === "Wing";
}

function isBacklinePosition(pos: string, formation: FormationType): boolean {
  if (formation === "3-3") return pos === "Half Back" || pos === "Centre Back";
  return pos === "Back" || pos === "Centre";
}

function buildClusters(
  extras: ClusteredPlayer[],
  formation: FormationType,
  mainBonus: number,
  altBonus: number,
  offHandSelections: PlayerOffHandSelection,
  teamSize: number
): ClusteredPlayer[] {
  if (extras.length === 0) return [];

  if (extras.length === 1) {
    extras[0].clusterLabel = "Super-Sub";
    return extras;
  }

  const remaining = [...extras];
  const result: ClusteredPlayer[] = [];

  if (teamSize === 8 && formation === "3-3") {
    const frontPlayers = remaining.filter(p => isFrontlinePosition(p.bestPos, formation));
    const backPlayers = remaining.filter(p => isBacklinePosition(p.bestPos, formation));

    if (frontPlayers.length >= 2 && backPlayers.length >= 2) {
      return buildConstrainedPairClusters(frontPlayers.slice(0, 2), backPlayers.slice(0, 2), remaining, formation);
    }
    if (frontPlayers.length >= 2) {
      const label = buildClusterLabel(frontPlayers.slice(0, 2).map(p => p.bestPos), formation);
      frontPlayers.slice(0, 2).forEach(p => { p.clusterLabel = label; result.push(p); });
      const leftover = remaining.filter(p => !result.includes(p));
      if (leftover.length > 0) {
        const backLabel = buildClusterLabel(leftover.map(p => p.bestPos), formation);
        leftover.forEach(p => { p.clusterLabel = backLabel; result.push(p); });
      }
      return result;
    }
  }

  if (teamSize === 8 && formation === "1-3-2") {
    return buildBestScoringClusters(remaining, formation, 4);
  }

  if (teamSize === 9 && formation === "3-3") {
    return buildBestScoringClusters(remaining, formation, 3);
  }

  if (teamSize === 9 && formation === "1-3-2") {
    const backPlayers = remaining.filter(p => isBacklinePosition(p.bestPos, formation));
    if (backPlayers.length >= 3) {
      const label = buildClusterLabel(backPlayers.slice(0, 3).map(p => p.bestPos), formation);
      backPlayers.slice(0, 3).forEach(p => { p.clusterLabel = label; result.push(p); });
    }
  }

  const leftover = remaining.filter(p => !result.includes(p));
  if (leftover.length > 0) {
    const genericClusters = buildGenericClusters(leftover, formation);
    result.push(...genericClusters);
  }

  return result;
}

function buildConstrainedPairClusters(
  front: ClusteredPlayer[],
  back: ClusteredPlayer[],
  allExtras: ClusteredPlayer[],
  formation: FormationType
): ClusteredPlayer[] {
  const result: ClusteredPlayer[] = [];
  const frontLabel = buildClusterLabel(front.map(p => p.bestPos), formation);
  front.forEach(p => { p.clusterLabel = frontLabel; result.push(p); });
  const backLabel = buildClusterLabel(back.map(p => p.bestPos), formation);
  back.forEach(p => { p.clusterLabel = backLabel; result.push(p); });

  const leftover = allExtras.filter(p => !front.includes(p) && !back.includes(p));
  if (leftover.length === 1) {
    leftover[0].clusterLabel = "Super-Sub";
    result.push(leftover[0]);
  } else if (leftover.length > 1) {
    const genericClusters = buildGenericClusters(leftover, formation);
    result.push(...genericClusters);
  }

  return result;
}

function buildBestScoringClusters(
  extras: ClusteredPlayer[],
  formation: FormationType,
  maxClusterSize: number
): ClusteredPlayer[] {
  const remaining = [...extras];
  const result: ClusteredPlayer[] = [];

  while (remaining.length > 0) {
    if (remaining.length === 1) {
      remaining[0].clusterLabel = "Super-Sub";
      result.push(remaining[0]);
      break;
    }

    let bestCluster: { indices: number[]; score: number; positions: string[] } | null = null;
    const maxSize = Math.min(maxClusterSize, remaining.length);
    const minSize = 2;

    for (let size = minSize; size <= maxSize; size++) {
      if (remaining.length - size === 1 && size < maxSize) continue;

      const combos = getCombinations(remaining.length, size);
      for (const combo of combos) {
        const positions = combo.map(i => remaining[i].bestPos);
        const score = scoreCluster(positions, formation);
        if (!bestCluster || score > bestCluster.score) {
          bestCluster = { indices: combo, score, positions };
        }
      }
    }

    if (!bestCluster) break;

    const label = buildClusterLabel(bestCluster.positions, formation);
    for (const idx of bestCluster.indices.sort((a, b) => b - a)) {
      const p = remaining.splice(idx, 1)[0];
      p.clusterLabel = label;
      result.push(p);
    }
  }

  return result;
}

function buildGenericClusters(extras: ClusteredPlayer[], formation: FormationType): ClusteredPlayer[] {
  return buildBestScoringClusters(extras, formation, 3);
}

function enforceTeamSymmetry(
  blackPlayers: ClusteredPlayer[],
  whitePlayers: ClusteredPlayer[],
  formation: FormationType
): void {
  const defPositions = formation === "3-3" ? ["Half Back", "Centre Back"] : ["Back"];

  const getDefensiveCount = (players: ClusteredPlayer[]): number => {
    return players.filter(p => {
      if (p.corePosition) return defPositions.includes(p.corePosition);
      if (p.clusterLabel && p.clusterLabel !== "Super-Sub") {
        return defPositions.some(d => p.clusterLabel!.includes(d));
      }
      return false;
    }).length;
  };

  const blackDef = getDefensiveCount(blackPlayers);
  const whiteDef = getDefensiveCount(whitePlayers);
  const imbalance = Math.abs(blackDef - whiteDef);

  if (imbalance <= 2) return;

  const heavyTeam = blackDef > whiteDef ? blackPlayers : whitePlayers;
  const lightTeam = blackDef > whiteDef ? whitePlayers : blackPlayers;

  let bestSwap: { heavyIdx: number; lightIdx: number; impact: number } | null = null;

  for (let h = 0; h < heavyTeam.length; h++) {
    const hp = heavyTeam[h];
    if (hp.corePosition || !hp.clusterLabel || hp.clusterLabel === "Super-Sub") continue;
    if (!defPositions.some(d => hp.clusterLabel!.includes(d))) continue;

    for (let l = 0; l < lightTeam.length; l++) {
      const lp = lightTeam[l];
      if (lp.corePosition || !lp.clusterLabel || lp.clusterLabel === "Super-Sub") continue;
      if (defPositions.some(d => lp.clusterLabel!.includes(d))) continue;

      const impact = Math.abs(hp.rating - lp.rating);
      if (!bestSwap || impact < bestSwap.impact) {
        bestSwap = { heavyIdx: h, lightIdx: l, impact };
      }
    }
  }

  if (!bestSwap) return;

  const temp = heavyTeam[bestSwap.heavyIdx];
  heavyTeam[bestSwap.heavyIdx] = lightTeam[bestSwap.lightIdx];
  lightTeam[bestSwap.lightIdx] = temp;
}

export function assignWithClusterEngine(
  players: Player[],
  formation: FormationType,
  offHandSelections: PlayerOffHandSelection,
  adminSettings: AdminSettings[]
): PlayerWithAssignedFormationRole[] {
  const { mainPositionBonus, alternatePositionBonus } = getPositionBonusSettings(adminSettings);

  const clustered = assignCorePositions(players, formation, offHandSelections, mainPositionBonus, alternatePositionBonus);

  const corePlayers = clustered.filter(p => p.corePosition !== null);
  const extras = clustered.filter(p => p.corePosition === null);

  const clusteredExtras = buildClusters(extras, formation, mainPositionBonus, alternatePositionBonus, offHandSelections, players.length);

  const allPlayers = [...corePlayers, ...clusteredExtras];

  return allPlayers.map(cp => ({
    ...cp.player,
    assignedPosition: cp.clusterLabel || cp.corePosition || "Super-Sub",
    formationRole: cp.corePosition ? "main" as const : "filler" as const,
    ratingUsed: cp.rating,
    usedOffHand: cp.usedOffHand,
  }));
}

export function assignTeamsWithClusterEngine(
  blackPlayers: Player[],
  whitePlayers: Player[],
  blackFormation: FormationType,
  whiteFormation: FormationType,
  offHandSelections: PlayerOffHandSelection,
  adminSettings: AdminSettings[]
): { black: PlayerWithAssignedFormationRole[]; white: PlayerWithAssignedFormationRole[] } {
  const { mainPositionBonus, alternatePositionBonus } = getPositionBonusSettings(adminSettings);

  const blackClustered = assignCorePositions(blackPlayers, blackFormation, offHandSelections, mainPositionBonus, alternatePositionBonus);
  const whiteClustered = assignCorePositions(whitePlayers, whiteFormation, offHandSelections, mainPositionBonus, alternatePositionBonus);

  const blackCore = blackClustered.filter(p => p.corePosition !== null);
  const blackExtras = blackClustered.filter(p => p.corePosition === null);
  const whiteCore = whiteClustered.filter(p => p.corePosition !== null);
  const whiteExtras = whiteClustered.filter(p => p.corePosition === null);

  const blackClusteredExtras = buildClusters(blackExtras, blackFormation, mainPositionBonus, alternatePositionBonus, offHandSelections, blackPlayers.length);
  const whiteClusteredExtras = buildClusters(whiteExtras, whiteFormation, mainPositionBonus, alternatePositionBonus, offHandSelections, whitePlayers.length);

  const allBlack = [...blackCore, ...blackClusteredExtras];
  const allWhite = [...whiteCore, ...whiteClusteredExtras];

  if (blackFormation === whiteFormation) {
    enforceTeamSymmetry(allBlack, allWhite, blackFormation);
  }

  const toResult = (cp: ClusteredPlayer): PlayerWithAssignedFormationRole => ({
    ...cp.player,
    assignedPosition: cp.clusterLabel || cp.corePosition || "Super-Sub",
    formationRole: cp.corePosition ? "main" as const : "filler" as const,
    ratingUsed: cp.rating,
    usedOffHand: cp.usedOffHand,
  });

  return {
    black: allBlack.map(toResult),
    white: allWhite.map(toResult),
  };
}

export function isAdvancedClusterEnabled(adminSettings: AdminSettings[]): boolean {
  const setting = adminSettings.find(s => s.key === "advanced_cluster_engine");
  return setting ? setting.value === "true" || setting.value === true : false;
}
