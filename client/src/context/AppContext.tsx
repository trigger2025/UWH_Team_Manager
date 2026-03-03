import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Player, Match, AdminSettings, PoolRotationEntry, PresetTeam, GenerationWorkspace, GeneratedTeamsSnapshot, GeneratedTeam, FormationType, GenerationMode, VisibilitySettings, TwoPoolsGeneratedTeams, TeamTemplate, TeamTemplateStructure, PlayerWithAssignedFormationRole, TournamentTeam, TournamentFixture, TournamentState, TournamentHistoryEntry, PlayerSnapshot } from "@shared/schema";
import { storage, AppData, DEFAULT_GENERATION_WORKSPACE, DEFAULT_VISIBILITY_SETTINGS } from "@/lib/storage";
import { calculateRatingAdjustments, applyRatingAdjustments } from "@/lib/rating-logic";
import { generateRoundRobin } from "@/lib/team-logic";

const MAX_HISTORY_SIZE = 10;

const normalizeTag = (tag: string): string => tag.trim().toLowerCase();

const getUsedTags = (players: Player[]): Set<string> => {
  const used = new Set<string>();
  players.forEach(p => {
    (p.tags || []).forEach(t => used.add(normalizeTag(t)));
  });
  return used;
};

interface AppState extends AppData {
  addPlayer: (player: any) => void;
  updatePlayer: (id: number, updates: Partial<Player>) => void;
  deletePlayer: (id: number) => void;
  saveMatchResult: (result: Omit<Match, "id">) => number;
  completeMatch: (id: number, blackScore: number, whiteScore: number, tournamentMode?: boolean) => void;
  deleteMatchResult: (id: number) => void;
  deleteMatchResultWithReversal: (id: number) => void;
  resetAllPlayerStats: () => void;
  updateAdminSettings: (settings: AdminSettings[]) => void;
  updateAdminSetting: (key: string, value: string) => void;
  recalculatePlayerStatsFromResults: () => void;
  deleteTag: (tag: string) => boolean;
  isTagInUse: (tag: string) => boolean;
  // Visibility settings
  updateVisibilitySettings: (updates: Partial<VisibilitySettings>) => void;
  updateWorkspace: (updates: Partial<GenerationWorkspace>) => void;
  setGeneratedTeams: (teams: { black: GeneratedTeam; white: GeneratedTeam } | null) => void;
  addToHistory: (teams: { black: GeneratedTeam; white: GeneratedTeam }) => void;
  addToHistoryTwoPools: (twoPoolsTeams: TwoPoolsGeneratedTeams) => void;
  restoreFromHistory: (index: number) => void;
  lockTeams: () => void;
  unlockTeams: () => void;
  clearWorkspace: () => void;
  saveTeamTemplate: (teams: { black: GeneratedTeam; white: GeneratedTeam } | null, twoPoolsTeams: TwoPoolsGeneratedTeams | null) => void;
  loadFromTemplate: (template: TeamTemplate) => void;
  // Preset team functions
  addPresetTeam: (team: Omit<PresetTeam, "id">) => void;
  updatePresetTeam: (id: number, updates: Partial<PresetTeam>) => void;
  deletePresetTeam: (id: number) => void;
  // Tournament functions
  confirmTournament: (teams: TournamentTeam[]) => void;
  setTournamentFixtureResult: (fixtureId: number, result: "A" | "B" | "draw") => void;
  finaliseTournament: () => void;
  resetTournament: () => void;
  deleteTournamentHistory: (id: number) => void;
  tournamentHistory: TournamentHistoryEntry[];
}

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppData>(() => storage.loadAllData());

  useEffect(() => {
    storage.saveAllData(state);
  }, [state]);

  const addPlayer = useCallback((playerData: any) => {
    const playerTags = (playerData.tags || []).map((t: string) => t.trim());
    
    const newPlayer: Player = {
      ...playerData,
      id: Math.floor(Math.random() * 1000000),
      rating: playerData.rating ?? 500,
      weakHandEnabled: playerData.weakHandEnabled ?? false,
      weakHandRating: playerData.weakHandEnabled ? (playerData.weakHandRating ?? 300) : null,
      formationPreferences: playerData.formationPreferences ?? {},
      tags: playerTags,
      ratingHistory: [],
      wins: 0,
      losses: 0,
      draws: 0,
      active: true,
      createdAt: new Date(),
    };

    setState(prev => {
      const newPlayers = [...prev.players, newPlayer];
      const existingNormalized = prev.savedTags.map(normalizeTag);
      const tagsToAdd = playerTags.filter((t: string) => !existingNormalized.includes(normalizeTag(t)));
      
      return { 
        ...prev, 
        players: newPlayers,
        savedTags: [...prev.savedTags, ...tagsToAdd]
      };
    });
  }, []);

  const updatePlayer = useCallback((id: number, updates: Partial<Player>) => {
    setState(prev => {
      const updateTags = updates.tags ? updates.tags.map((t: string) => t.trim()) : undefined;
      
      const updatedPlayers = prev.players.map(p => {
        if (p.id !== id) return p;
        const updated = { ...p, ...updates };
        if (updateTags) {
          updated.tags = updateTags;
        }
        if (updates.weakHandEnabled === false) {
          updated.weakHandRating = null;
        }
        return updated;
      });

      const usedTags = getUsedTags(updatedPlayers);
      const cleanedSavedTags = prev.savedTags.filter(t => usedTags.has(normalizeTag(t)));
      
      const newTagsToAdd = updateTags 
        ? updateTags.filter((t: string) => !cleanedSavedTags.some(st => normalizeTag(st) === normalizeTag(t)))
        : [];

      return {
        ...prev,
        players: updatedPlayers,
        savedTags: [...cleanedSavedTags, ...newTagsToAdd]
      };
    });
  }, []);

  const deletePlayer = useCallback((id: number) => {
    setState(prev => {
      const newPlayers = prev.players.filter(p => p.id !== id);
      const usedTags = getUsedTags(newPlayers);
      const cleanedSavedTags = prev.savedTags.filter(t => usedTags.has(normalizeTag(t)));

      return {
        ...prev,
        players: newPlayers,
        savedTags: cleanedSavedTags
      };
    });
  }, []);

  const saveMatchResult = useCallback((resultData: any): number => {
    const newMatch: Match = {
      ...resultData,
      id: Math.floor(Math.random() * 1000000),
    };
    setState(prev => ({ ...prev, matchResults: [newMatch, ...prev.matchResults] }));
    return newMatch.id;
  }, []);

  const completeMatch = useCallback((id: number, blackScore: number, whiteScore: number, tournamentMode: boolean = false) => {
    console.log("[completeMatch] Running for match id:", id, "scores:", blackScore, "-", whiteScore);
    setState(prev => {
      const match = prev.matchResults.find(m => m.id === id);
      if (!match || match.completed) {
        console.log("[completeMatch] Match not found or already completed, skipping");
        return prev;
      }

      const teams = match.teams as any;
      const kFactorSetting = prev.adminSettings.find(s => s.key === "rating_strength");
      const kFactor = kFactorSetting ? parseInt(kFactorSetting.value as string) : 32;

      const blackTeamForCalc = {
        ...teams.black,
        players: (teams.black.players || []).map((p: any) => ({
          ...p,
          id: p.playerId ?? p.id,
        })),
      };
      const whiteTeamForCalc = {
        ...teams.white,
        players: (teams.white.players || []).map((p: any) => ({
          ...p,
          id: p.playerId ?? p.id,
        })),
      };

      const adjustments = calculateRatingAdjustments(
        blackTeamForCalc,
        whiteTeamForCalc,
        blackScore,
        whiteScore,
        kFactor,
        tournamentMode
      );

      adjustments.forEach(adj => {
        console.log("[completeMatch] ratingDelta for player", adj.playerId, ":", Math.round(adj.change), adj.usedOffHand ? "(off-hand)" : "(main)");
      });

      const blackWon = blackScore > whiteScore;
      const whiteWon = whiteScore > blackScore;
      const isDraw = blackScore === whiteScore;

      const updatedPlayers = prev.players.map(player => {
        const adj = adjustments.find(a => a.playerId === player.id);
        if (!adj) return player;

        const beforeRating = adj.usedOffHand && player.weakHandEnabled && player.weakHandRating !== null
          ? player.weakHandRating
          : player.rating;

        let won = false;
        let lost = false;
        if (adj.change > 0) {
          if (blackWon) won = true;
          else if (whiteWon) lost = true;
        } else {
          if (whiteWon) won = true;
          else if (blackWon) lost = true;
        }

        if (adj.usedOffHand && player.weakHandEnabled && player.weakHandRating !== null) {
          const newOffHandRating = Math.round(Math.min(Math.max(player.weakHandRating + adj.change, 0), 1000));
          console.log("[completeMatch] Player", player.id, player.name, "off-hand rating:", beforeRating, "->", newOffHandRating);
          return {
            ...player,
            weakHandRating: newOffHandRating,
            wins: player.wins + (won ? 1 : 0),
            losses: player.losses + (lost ? 1 : 0),
            draws: player.draws + (isDraw ? 1 : 0),
            ratingHistory: [
              ...player.ratingHistory as any[],
              { date: new Date().toISOString(), rating: player.rating, offHandRating: newOffHandRating }
            ]
          };
        }

        const newRating = Math.round(Math.min(Math.max(player.rating + adj.change, 0), 1000));
        console.log("[completeMatch] Player", player.id, player.name, "main rating:", beforeRating, "->", newRating);
        return {
          ...player,
          rating: newRating,
          wins: player.wins + (won ? 1 : 0),
          losses: player.losses + (lost ? 1 : 0),
          draws: player.draws + (isDraw ? 1 : 0),
          ratingHistory: [
            ...player.ratingHistory as any[],
            { date: new Date().toISOString(), rating: newRating }
          ]
        };
      });

      const updatedTeams = JSON.parse(JSON.stringify(teams));
      const allSnapshots = [
        ...updatedTeams.black.players,
        ...updatedTeams.white.players
      ];
      allSnapshots.forEach((snapshot: any) => {
        const adj = adjustments.find(a => a.playerId === (snapshot.playerId ?? snapshot.id));
        if (adj) {
          const roundedDelta = Math.round(adj.change);
          snapshot.ratingDelta = roundedDelta;
          snapshot.ratingFieldUsed = adj.usedOffHand ? "offHand" : "main";
        }
      });

      const updatedMatches = prev.matchResults.map(m => 
        m.id === id ? { ...m, blackScore, whiteScore, completed: true, teams: updatedTeams } : m
      );

      console.log("[completeMatch] Committing updated players and match to state");
      return {
        ...prev,
        players: updatedPlayers,
        matchResults: updatedMatches
      };
    });
  }, []);

  const deleteMatchResult = useCallback((id: number) => {
    setState(prev => ({
      ...prev,
      matchResults: prev.matchResults.filter(m => m.id !== id)
    }));
  }, []);

  const deleteMatchResultWithReversal = useCallback((id: number) => {
    setState(prev => {
      const match = prev.matchResults.find(m => m.id === id);
      if (!match) return prev;

      let updatedPlayers = [...prev.players];
      
      if (match.completed) {
        const teams = match.teams as any;
        const allPlayerSnapshots = [
          ...(teams.black?.players || []),
          ...(teams.white?.players || [])
        ];
        
        allPlayerSnapshots.forEach((snapshot: any) => {
          if (!snapshot.playerId) return;
          
          updatedPlayers = updatedPlayers.map(p => {
            if (p.id !== snapshot.playerId) return p;
            
            let newWins = p.wins;
            let newLosses = p.losses;
            let newDraws = p.draws;
            
            const blackWon = match.blackScore! > match.whiteScore!;
            const whiteWon = match.whiteScore! > match.blackScore!;
            const isDraw = match.blackScore === match.whiteScore;
            
            if (snapshot.team === "Black") {
              if (blackWon) newWins = Math.max(0, newWins - 1);
              else if (whiteWon) newLosses = Math.max(0, newLosses - 1);
              else if (isDraw) newDraws = Math.max(0, newDraws - 1);
            } else {
              if (whiteWon) newWins = Math.max(0, newWins - 1);
              else if (blackWon) newLosses = Math.max(0, newLosses - 1);
              else if (isDraw) newDraws = Math.max(0, newDraws - 1);
            }
            
            if (snapshot.ratingDelta !== undefined && snapshot.ratingDelta !== 0) {
              const reversedDelta = -snapshot.ratingDelta;
              if (snapshot.usedOffHand && p.weakHandEnabled && p.weakHandRating !== null) {
                const restored = Math.round(Math.max(0, Math.min(1000, p.weakHandRating + reversedDelta)));
                return { ...p, weakHandRating: restored, wins: newWins, losses: newLosses, draws: newDraws };
              } else {
                const restored = Math.round(Math.max(0, Math.min(1000, p.rating + reversedDelta)));
                return { ...p, rating: restored, wins: newWins, losses: newLosses, draws: newDraws };
              }
            }

            // Legacy fallback: older snapshots may have ratingBefore but no ratingDelta
            if (snapshot.ratingBefore !== undefined && snapshot.ratingAfter !== undefined) {
              const legacyDelta = snapshot.ratingBefore - snapshot.ratingAfter;
              if (snapshot.usedOffHand && p.weakHandEnabled && p.weakHandRating !== null) {
                const restored = Math.round(Math.max(0, Math.min(1000, p.weakHandRating + legacyDelta)));
                return { ...p, weakHandRating: restored, wins: newWins, losses: newLosses, draws: newDraws };
              } else {
                const restored = Math.round(Math.max(0, Math.min(1000, p.rating + legacyDelta)));
                return { ...p, rating: restored, wins: newWins, losses: newLosses, draws: newDraws };
              }
            }
            
            return { ...p, wins: newWins, losses: newLosses, draws: newDraws };
          });
        });
      }

      return {
        ...prev,
        players: updatedPlayers,
        matchResults: prev.matchResults.filter(m => m.id !== id)
      };
    });
  }, []);

  const resetAllPlayerStats = useCallback(() => {
    setState(prev => ({
      ...prev,
      players: prev.players.map(p => ({ ...p, wins: 0, losses: 0, draws: 0, ratingHistory: [] }))
    }));
  }, []);

  const updateAdminSettings = useCallback((settings: AdminSettings[]) => {
    setState(prev => ({ ...prev, adminSettings: settings }));
  }, []);

  const updateAdminSetting = useCallback((key: string, value: string) => {
    setState(prev => {
      const existing = prev.adminSettings.find(s => s.key === key);
      if (existing) {
        return {
          ...prev,
          adminSettings: prev.adminSettings.map(s => 
            s.key === key ? { ...s, value } : s
          )
        };
      } else {
        const newSetting: AdminSettings = {
          id: Math.floor(Math.random() * 1000000),
          key,
          value
        };
        return {
          ...prev,
          adminSettings: [...prev.adminSettings, newSetting]
        };
      }
    });
  }, []);

  const isTagInUse = useCallback((tag: string): boolean => {
    const normalizedTag = normalizeTag(tag);
    return state.players.some(p => 
      (p.tags || []).some(t => normalizeTag(t) === normalizedTag)
    );
  }, [state.players]);

  const deleteTag = useCallback((tag: string): boolean => {
    const normalizedTag = normalizeTag(tag);
    const inUse = state.players.some(p => 
      (p.tags || []).some(t => normalizeTag(t) === normalizedTag)
    );
    
    if (inUse) {
      return false;
    }
    
    setState(prev => ({
      ...prev,
      savedTags: prev.savedTags.filter(t => normalizeTag(t) !== normalizedTag)
    }));
    return true;
  }, [state.players]);

  const recalculatePlayerStatsFromResults = useCallback(() => {
    setState(prev => {
      const basePlayers = prev.players.map(p => ({
        ...p,
        rating: 500,
        wins: 0,
        losses: 0,
        draws: 0,
        ratingHistory: []
      }));

      const kFactorSetting = prev.adminSettings.find(s => s.key === "rating_strength");
      const kFactor = kFactorSetting ? parseInt(kFactorSetting.value as string) : 32;

      const sortedMatches = [...prev.matchResults]
        .filter(m => m.completed)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let currentPlayers = basePlayers as Player[];
      sortedMatches.forEach(match => {
        const teams = match.teams as any;
        const adjustments = calculateRatingAdjustments(
          teams.black,
          teams.white,
          match.blackScore!,
          match.whiteScore!,
          kFactor,
          false
        );

        currentPlayers = applyRatingAdjustments(
          currentPlayers,
          adjustments,
          match.blackScore! > match.whiteScore!,
          match.whiteScore! > match.blackScore!,
          match.blackScore === match.whiteScore
        );
      });

      return {
        ...prev,
        players: currentPlayers
      };
    });
  }, []);

  // --- Workspace Management ---

  const updateWorkspace = useCallback((updates: Partial<GenerationWorkspace>) => {
    setState(prev => ({
      ...prev,
      generationWorkspace: {
        ...prev.generationWorkspace,
        ...updates
      }
    }));
  }, []);

  const setGeneratedTeams = useCallback((teams: { black: GeneratedTeam; white: GeneratedTeam } | null) => {
    setState(prev => ({
      ...prev,
      generationWorkspace: {
        ...prev.generationWorkspace,
        generatedTeams: teams
      }
    }));
  }, []);

  const addToHistory = useCallback((teams: { black: GeneratedTeam; white: GeneratedTeam }) => {
    setState(prev => {
      const snapshot: GeneratedTeamsSnapshot = {
        id: Math.floor(Math.random() * 1000000),
        timestamp: new Date().toISOString(),
        teams: {
          black: { ...teams.black, players: teams.black.players.map(p => ({ ...p })) },
          white: { ...teams.white, players: teams.white.players.map(p => ({ ...p })) }
        },
        mode: prev.generationWorkspace.mode,
        teamFormations: { ...prev.generationWorkspace.teamFormations },
        playerOffHandSelections: { ...prev.generationWorkspace.playerOffHandSelections }
      };

      const newHistory = [snapshot, ...prev.generationWorkspace.history].slice(0, MAX_HISTORY_SIZE);

      return {
        ...prev,
        generationWorkspace: {
          ...prev.generationWorkspace,
          generatedTeams: teams,
          history: newHistory,
          historyIndex: 0
        }
      };
    });
  }, []);

  const restoreFromHistory = useCallback((index: number) => {
    setState(prev => {
      const snapshot = prev.generationWorkspace.history[index];
      if (!snapshot) return prev;

      return {
        ...prev,
        generationWorkspace: {
          ...prev.generationWorkspace,
          // Handle both standard and two pools mode
          generatedTeams: snapshot.teams || null,
          twoPoolsTeams: snapshot.twoPoolsTeams || null,
          poolAssignments: snapshot.poolAssignments || {},
          teamFormations: snapshot.teamFormations,
          poolAFormations: snapshot.poolAFormations || snapshot.teamFormations,
          poolBFormations: snapshot.poolBFormations || snapshot.teamFormations,
          playerOffHandSelections: snapshot.playerOffHandSelections,
          mode: snapshot.mode,
          historyIndex: index
        }
      };
    });
  }, []);

  const clearWorkspace = useCallback(() => {
    setState(prev => ({
      ...prev,
      generationWorkspace: {
        ...DEFAULT_GENERATION_WORKSPACE,
        teamTemplates: prev.generationWorkspace.teamTemplates
      }
    }));
  }, []);

  const toTemplateStructure = (team: GeneratedTeam): TeamTemplateStructure => ({
    formation: team.formation,
    players: team.players.map(p => ({
      playerId: p.id,
      assignedPosition: p.assignedPosition,
      usedOffHand: p.usedOffHand || false,
    })),
  });

  const saveTeamTemplate = useCallback((
    teams: { black: GeneratedTeam; white: GeneratedTeam } | null,
    twoPoolsTeams: TwoPoolsGeneratedTeams | null
  ) => {
    setState(prev => {
      const ws = prev.generationWorkspace;
      const template: TeamTemplate = {
        id: Math.random().toString(36).substring(2, 10),
        mode: ws.mode,
        createdAt: Date.now(),
        pools: {},
        teamFormations: { ...ws.teamFormations },
        playerOffHandSelections: { ...ws.playerOffHandSelections },
      };

      if (ws.mode === "two_pools" && twoPoolsTeams) {
        if (twoPoolsTeams.poolA) {
          template.pools.A = {
            black: toTemplateStructure(twoPoolsTeams.poolA.black),
            white: toTemplateStructure(twoPoolsTeams.poolA.white),
          };
        }
        if (twoPoolsTeams.poolB) {
          template.pools.B = {
            black: toTemplateStructure(twoPoolsTeams.poolB.black),
            white: toTemplateStructure(twoPoolsTeams.poolB.white),
          };
        }
        template.poolAFormations = { ...ws.poolAFormations };
        template.poolBFormations = { ...ws.poolBFormations };
        template.poolAssignments = { ...ws.poolAssignments };
      } else if (teams) {
        template.pools.A = {
          black: toTemplateStructure(teams.black),
          white: toTemplateStructure(teams.white),
        };
      }

      const newTemplates = [template, ...(ws.teamTemplates || [])].slice(0, MAX_HISTORY_SIZE);
      return {
        ...prev,
        generationWorkspace: {
          ...ws,
          teamTemplates: newTemplates,
        },
      };
    });
  }, []);

  const rebuildTeamFromTemplate = (
    templateTeam: TeamTemplateStructure,
    color: "Black" | "White",
    allPlayers: Player[],
    offHandSelections: Record<number, boolean>
  ): GeneratedTeam => {
    const players: PlayerWithAssignedFormationRole[] = templateTeam.players
      .map(entry => {
        const player = allPlayers.find(p => p.id === entry.playerId);
        if (!player) return null;
        const useOffHand = offHandSelections[player.id] || entry.usedOffHand || false;
        const ratingUsed = useOffHand && player.weakHandEnabled && player.weakHandRating !== null
          ? player.weakHandRating
          : player.rating;
        return {
          ...player,
          assignedPosition: entry.assignedPosition as any,
          formationRole: "main" as const,
          ratingUsed,
          usedOffHand: useOffHand,
        };
      })
      .filter((p): p is PlayerWithAssignedFormationRole => p !== null);

    return {
      color,
      formation: templateTeam.formation,
      players,
      totalRating: players.reduce((sum, p) => sum + p.ratingUsed, 0),
    };
  };

  const loadFromTemplate = useCallback((template: TeamTemplate) => {
    setState(prev => {
      const ws = prev.generationWorkspace;
      const allPlayers = prev.players;
      const offHandSelections = template.playerOffHandSelections || {};

      if (template.mode === "two_pools" || (template.pools.A && template.pools.B)) {
        const poolA = template.pools.A ? {
          black: rebuildTeamFromTemplate(template.pools.A.black, "Black", allPlayers, offHandSelections),
          white: rebuildTeamFromTemplate(template.pools.A.white, "White", allPlayers, offHandSelections),
        } : null;
        const poolB = template.pools.B ? {
          black: rebuildTeamFromTemplate(template.pools.B.black, "Black", allPlayers, offHandSelections),
          white: rebuildTeamFromTemplate(template.pools.B.white, "White", allPlayers, offHandSelections),
        } : null;

        const selectedIds = [
          ...(template.pools.A?.black.players || []),
          ...(template.pools.A?.white.players || []),
          ...(template.pools.B?.black.players || []),
          ...(template.pools.B?.white.players || []),
        ].map(p => p.playerId).filter(id => allPlayers.some(pl => pl.id === id));

        return {
          ...prev,
          generationWorkspace: {
            ...ws,
            mode: "two_pools",
            twoPoolsTeams: { poolA, poolB },
            generatedTeams: null,
            teamFormations: template.teamFormations,
            poolAFormations: template.poolAFormations || template.teamFormations,
            poolBFormations: template.poolBFormations || template.teamFormations,
            playerOffHandSelections: offHandSelections,
            poolAssignments: template.poolAssignments || {},
            selectedPlayerIds: selectedIds,
          },
        };
      } else {
        const poolData = template.pools.A;
        if (!poolData) return prev;

        const teams = {
          black: rebuildTeamFromTemplate(poolData.black, "Black", allPlayers, offHandSelections),
          white: rebuildTeamFromTemplate(poolData.white, "White", allPlayers, offHandSelections),
        };

        const selectedIds = [
          ...poolData.black.players,
          ...poolData.white.players,
        ].map(p => p.playerId).filter(id => allPlayers.some(pl => pl.id === id));

        return {
          ...prev,
          generationWorkspace: {
            ...ws,
            mode: "standard",
            generatedTeams: teams,
            twoPoolsTeams: null,
            teamFormations: template.teamFormations,
            playerOffHandSelections: offHandSelections,
            selectedPlayerIds: selectedIds,
          },
        };
      }
    });
  }, []);

  // Add to history for two pools mode
  const addToHistoryTwoPools = useCallback((twoPoolsTeams: TwoPoolsGeneratedTeams) => {
    setState(prev => {
      const snapshot: GeneratedTeamsSnapshot = {
        id: Math.floor(Math.random() * 1000000),
        timestamp: new Date().toISOString(),
        twoPoolsTeams: {
          poolA: twoPoolsTeams.poolA ? {
            black: { ...twoPoolsTeams.poolA.black, players: twoPoolsTeams.poolA.black.players.map(p => ({ ...p })) },
            white: { ...twoPoolsTeams.poolA.white, players: twoPoolsTeams.poolA.white.players.map(p => ({ ...p })) }
          } : null,
          poolB: twoPoolsTeams.poolB ? {
            black: { ...twoPoolsTeams.poolB.black, players: twoPoolsTeams.poolB.black.players.map(p => ({ ...p })) },
            white: { ...twoPoolsTeams.poolB.white, players: twoPoolsTeams.poolB.white.players.map(p => ({ ...p })) }
          } : null
        },
        poolAssignments: { ...prev.generationWorkspace.poolAssignments },
        mode: prev.generationWorkspace.mode,
        teamFormations: { ...prev.generationWorkspace.teamFormations },
        poolAFormations: { ...prev.generationWorkspace.poolAFormations },
        poolBFormations: { ...prev.generationWorkspace.poolBFormations },
        playerOffHandSelections: { ...prev.generationWorkspace.playerOffHandSelections }
      };

      const newHistory = [snapshot, ...prev.generationWorkspace.history].slice(0, MAX_HISTORY_SIZE);

      return {
        ...prev,
        generationWorkspace: {
          ...prev.generationWorkspace,
          twoPoolsTeams,
          history: newHistory,
          historyIndex: 0
        }
      };
    });
  }, []);

  // Lock/unlock teams (for Confirm behavior)
  const lockTeams = useCallback(() => {
    setState(prev => ({
      ...prev,
      generationWorkspace: {
        ...prev.generationWorkspace,
        teamsLocked: true
      }
    }));
  }, []);

  const unlockTeams = useCallback(() => {
    setState(prev => ({
      ...prev,
      generationWorkspace: {
        ...prev.generationWorkspace,
        teamsLocked: false
      }
    }));
  }, []);

  // Visibility settings
  const updateVisibilitySettings = useCallback((updates: Partial<VisibilitySettings>) => {
    setState(prev => ({
      ...prev,
      visibilitySettings: {
        ...prev.visibilitySettings,
        ...updates
      }
    }));
  }, []);

  // --- Preset Team Management ---

  const addPresetTeam = useCallback((team: Omit<PresetTeam, "id">) => {
    const newTeam: PresetTeam = {
      ...team,
      id: Math.floor(Math.random() * 1000000)
    };
    setState(prev => ({
      ...prev,
      presetTeams: [...prev.presetTeams, newTeam]
    }));
  }, []);

  const updatePresetTeam = useCallback((id: number, updates: Partial<PresetTeam>) => {
    setState(prev => ({
      ...prev,
      presetTeams: prev.presetTeams.map(t => 
        t.id === id ? { ...t, ...updates } : t
      )
    }));
  }, []);

  const deletePresetTeam = useCallback((id: number) => {
    setState(prev => ({
      ...prev,
      presetTeams: prev.presetTeams.filter(t => t.id !== id)
    }));
  }, []);

  // --- Tournament ---

  const confirmTournament = useCallback((teams: TournamentTeam[]) => {
    setState(prev => {
      const fixtures = generateRoundRobin(teams);
      // Snapshot each player's current rating before the tournament begins
      const seenIds = new Set<number>();
      const playerSnapshots: PlayerSnapshot[] = [];
      teams.forEach(team => {
        team.players.forEach(p => {
          if (!seenIds.has(p.id)) {
            seenIds.add(p.id);
            const player = prev.players.find(pl => pl.id === p.id);
            if (player) {
              playerSnapshots.push({
                playerId: player.id,
                ratingBefore: player.rating,
                weakHandRatingBefore: player.weakHandRating ?? undefined,
              });
            }
          }
        });
      });
      const tournament: TournamentState = {
        active: true,
        finalised: false,
        teams,
        fixtures,
        completedCount: 0,
        playerSnapshots,
      };
      return {
        ...prev,
        generationWorkspace: {
          ...prev.generationWorkspace,
          tournament,
        }
      };
    });
  }, []);

  const setTournamentFixtureResult = useCallback((fixtureId: number, result: "A" | "B" | "draw") => {
    setState(prev => {
      const t = prev.generationWorkspace.tournament;
      if (!t) return prev;
      const updatedFixtures = t.fixtures.map((f: TournamentFixture) =>
        f.id === fixtureId ? { ...f, result } : f
      );
      const completedCount = updatedFixtures.filter((f: TournamentFixture) => f.result !== null).length;
      return {
        ...prev,
        generationWorkspace: {
          ...prev.generationWorkspace,
          tournament: { ...t, fixtures: updatedFixtures, completedCount },
        }
      };
    });
  }, []);

  const finaliseTournament = useCallback(() => {
    setState(prev => {
      const t = prev.generationWorkspace.tournament;
      if (!t || t.finalised) return prev;
      if (t.completedCount !== t.fixtures.length) return prev;

      const kFactorSetting = prev.adminSettings.find((s: AdminSettings) => s.key === "rating_strength");
      const kFactor = kFactorSetting ? parseInt(kFactorSetting.value as string) : 32;

      let updatedPlayers = [...prev.players];

      t.fixtures.forEach((fixture: TournamentFixture) => {
        if (!fixture.result) return;

        const blackScore = fixture.result === "A" ? 1 : fixture.result === "B" ? 0 : 0;
        const whiteScore = fixture.result === "B" ? 1 : fixture.result === "A" ? 0 : 0;
        const draw = fixture.result === "draw";

        const teamAAsGenerated = {
          color: "Black" as const,
          formation: fixture.teamA.formation,
          players: fixture.teamA.players,
          totalRating: fixture.teamA.totalRating,
        };
        const teamBAsGenerated = {
          color: "White" as const,
          formation: fixture.teamB.formation,
          players: fixture.teamB.players,
          totalRating: fixture.teamB.totalRating,
        };

        const adjustments = calculateRatingAdjustments(
          teamAAsGenerated,
          teamBAsGenerated,
          blackScore,
          whiteScore,
          kFactor,
          true
        );

        updatedPlayers = updatedPlayers.map(player => {
          const adj = adjustments.find(a => a.playerId === player.id);
          if (!adj) return player;

          const aWon = fixture.result === "A";
          const bWon = fixture.result === "B";
          const won = (adj.change > 0 && aWon) || (adj.change < 0 && bWon);
          const lost = (adj.change > 0 && bWon) || (adj.change < 0 && aWon);

          if (adj.usedOffHand && player.weakHandEnabled && player.weakHandRating !== null) {
            const newRating = Math.round(Math.min(Math.max(player.weakHandRating + adj.change, 0), 1000));
            return {
              ...player,
              weakHandRating: newRating,
              wins: player.wins + (won ? 1 : 0),
              losses: player.losses + (lost ? 1 : 0),
              draws: player.draws + (draw ? 1 : 0),
              ratingHistory: [...player.ratingHistory as any[], { date: new Date().toISOString(), rating: player.rating, offHandRating: newRating }],
            };
          }

          const newRating = Math.round(Math.min(Math.max(player.rating + adj.change, 0), 1000));
          return {
            ...player,
            rating: newRating,
            wins: player.wins + (won ? 1 : 0),
            losses: player.losses + (lost ? 1 : 0),
            draws: player.draws + (draw ? 1 : 0),
            ratingHistory: [...player.ratingHistory as any[], { date: new Date().toISOString(), rating: newRating }],
          };
        });
      });

      // Enrich snapshots with ratingAfter from post-finalise player state
      const snapshotsWithAfter = (t.playerSnapshots || []).map((snap: PlayerSnapshot) => {
        const updated = updatedPlayers.find(p => p.id === snap.playerId);
        if (!updated) return snap;
        return {
          ...snap,
          ratingAfter: updated.rating,
          weakHandRatingAfter: updated.weakHandEnabled && updated.weakHandRating !== null ? updated.weakHandRating : undefined,
        };
      });

      const historyEntry: TournamentHistoryEntry = {
        id: Date.now(),
        date: new Date().toISOString(),
        teams: t.teams,
        fixtures: t.fixtures,
        playerSnapshots: snapshotsWithAfter,
      };

      return {
        ...prev,
        players: updatedPlayers,
        tournamentHistory: [historyEntry, ...(prev.tournamentHistory || [])],
        generationWorkspace: {
          ...prev.generationWorkspace,
          tournament: null,
        }
      };
    });
  }, []);

  const resetTournament = useCallback(() => {
    setState(prev => ({
      ...prev,
      generationWorkspace: {
        ...prev.generationWorkspace,
        tournament: null,
      }
    }));
  }, []);

  const deleteTournamentHistory = useCallback((id: number) => {
    setState(prev => {
      const entry = (prev.tournamentHistory || []).find(e => e.id === id);
      if (!entry) return prev;
      // Revert each player's rating to the pre-tournament snapshot
      let updatedPlayers = [...prev.players];
      (entry.playerSnapshots || []).forEach((snapshot: PlayerSnapshot) => {
        updatedPlayers = updatedPlayers.map(p => {
          if (p.id !== snapshot.playerId) return p;
          return {
            ...p,
            rating: snapshot.ratingBefore,
            ...(snapshot.weakHandRatingBefore !== undefined && p.weakHandEnabled
              ? { weakHandRating: snapshot.weakHandRatingBefore }
              : {}),
          };
        });
      });
      return {
        ...prev,
        players: updatedPlayers,
        tournamentHistory: (prev.tournamentHistory || []).filter(e => e.id !== id),
      };
    });
  }, []);

  return (
    <AppContext.Provider value={{
      ...state,
      addPlayer,
      updatePlayer,
      deletePlayer,
      saveMatchResult,
      completeMatch,
      deleteMatchResult,
      deleteMatchResultWithReversal,
      resetAllPlayerStats,
      updateAdminSettings,
      updateAdminSetting,
      recalculatePlayerStatsFromResults,
      deleteTag,
      isTagInUse,
      updateVisibilitySettings,
      updateWorkspace,
      setGeneratedTeams,
      addToHistory,
      addToHistoryTwoPools,
      restoreFromHistory,
      lockTeams,
      unlockTeams,
      clearWorkspace,
      saveTeamTemplate,
      loadFromTemplate,
      addPresetTeam,
      updatePresetTeam,
      deletePresetTeam,
      confirmTournament,
      setTournamentFixtureResult,
      finaliseTournament,
      resetTournament,
      deleteTournamentHistory,
      tournamentHistory: state.tournamentHistory || [],
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
