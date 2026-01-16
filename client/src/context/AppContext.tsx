import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Player, Match, AdminSettings, PoolRotationEntry, PresetTeam, GenerationWorkspace, GeneratedTeamsSnapshot, GeneratedTeam, FormationType, GenerationMode } from "@shared/schema";
import { storage, AppData, DEFAULT_GENERATION_WORKSPACE } from "@/lib/storage";
import { calculateRatingAdjustments, applyRatingAdjustments } from "@/lib/rating-logic";

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
  saveMatchResult: (result: Omit<Match, "id">) => void;
  completeMatch: (id: number, blackScore: number, whiteScore: number, tournamentMode?: boolean) => void;
  deleteMatchResult: (id: number) => void;
  resetAllPlayerStats: () => void;
  updateAdminSettings: (settings: AdminSettings[]) => void;
  updateAdminSetting: (key: string, value: string) => void;
  recalculatePlayerStatsFromResults: () => void;
  deleteTag: (tag: string) => boolean;
  isTagInUse: (tag: string) => boolean;
  // Workspace functions
  updateWorkspace: (updates: Partial<GenerationWorkspace>) => void;
  setGeneratedTeams: (teams: { black: GeneratedTeam; white: GeneratedTeam } | null) => void;
  addToHistory: (teams: { black: GeneratedTeam; white: GeneratedTeam }) => void;
  restoreFromHistory: (index: number) => void;
  clearWorkspace: () => void;
  // Preset team functions
  addPresetTeam: (team: Omit<PresetTeam, "id">) => void;
  updatePresetTeam: (id: number, updates: Partial<PresetTeam>) => void;
  deletePresetTeam: (id: number) => void;
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

  const saveMatchResult = useCallback((resultData: any) => {
    const newMatch: Match = {
      ...resultData,
      id: Math.floor(Math.random() * 1000000),
    };
    setState(prev => ({ ...prev, matchResults: [newMatch, ...prev.matchResults] }));
  }, []);

  const completeMatch = useCallback((id: number, blackScore: number, whiteScore: number, tournamentMode: boolean = false) => {
    setState(prev => {
      const match = prev.matchResults.find(m => m.id === id);
      if (!match || match.completed) return prev;

      const teams = match.teams as any;
      const kFactorSetting = prev.adminSettings.find(s => s.key === "rating_strength");
      const kFactor = kFactorSetting ? parseInt(kFactorSetting.value as string) : 32;

      const adjustments = calculateRatingAdjustments(
        teams.black,
        teams.white,
        blackScore,
        whiteScore,
        kFactor,
        tournamentMode
      );

      const updatedPlayers = applyRatingAdjustments(
        prev.players,
        adjustments,
        blackScore > whiteScore,
        whiteScore > blackScore,
        blackScore === whiteScore
      );

      const updatedMatches = prev.matchResults.map(m => 
        m.id === id ? { ...m, blackScore, whiteScore, completed: true } : m
      );

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
        formation: prev.generationWorkspace.formation,
        useOffHandRatings: prev.generationWorkspace.useOffHandRatings
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
          generatedTeams: snapshot.teams,
          formation: snapshot.formation,
          useOffHandRatings: snapshot.useOffHandRatings,
          historyIndex: index
        }
      };
    });
  }, []);

  const clearWorkspace = useCallback(() => {
    setState(prev => ({
      ...prev,
      generationWorkspace: { ...DEFAULT_GENERATION_WORKSPACE }
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

  return (
    <AppContext.Provider value={{
      ...state,
      addPlayer,
      updatePlayer,
      deletePlayer,
      saveMatchResult,
      completeMatch,
      deleteMatchResult,
      resetAllPlayerStats,
      updateAdminSettings,
      updateAdminSetting,
      recalculatePlayerStatsFromResults,
      deleteTag,
      isTagInUse,
      updateWorkspace,
      setGeneratedTeams,
      addToHistory,
      restoreFromHistory,
      clearWorkspace,
      addPresetTeam,
      updatePresetTeam,
      deletePresetTeam
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
