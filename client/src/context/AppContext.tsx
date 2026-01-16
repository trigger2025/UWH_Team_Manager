import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Player, Match, AdminSettings, PoolRotationEntry, PresetTeam } from "@shared/schema";
import { storage, AppData } from "@/lib/storage";
import { calculateRatingAdjustments, applyRatingAdjustments } from "@/lib/rating-logic";

const normalizeTag = (tag: string): string => tag.trim().toLowerCase();
const formatTag = (tag: string): string => {
  const trimmed = tag.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

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
  recalculatePlayerStatsFromResults: () => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppData>(() => storage.loadAllData());

  useEffect(() => {
    storage.saveAllData(state);
  }, [state]);

  const addPlayer = useCallback((playerData: any) => {
    const normalizedTags = (playerData.tags || []).map(formatTag);
    
    const newPlayer: Player = {
      ...playerData,
      id: Math.floor(Math.random() * 1000000),
      rating: playerData.rating ?? 500,
      weakHandEnabled: playerData.weakHandEnabled ?? false,
      weakHandRating: playerData.weakHandEnabled ? (playerData.weakHandRating ?? 300) : null,
      formationPreferences: playerData.formationPreferences ?? {},
      tags: normalizedTags,
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
      const tagsToAdd = normalizedTags.filter((t: string) => !existingNormalized.includes(normalizeTag(t)));
      
      return { 
        ...prev, 
        players: newPlayers,
        savedTags: [...prev.savedTags, ...tagsToAdd]
      };
    });
  }, []);

  const updatePlayer = useCallback((id: number, updates: Partial<Player>) => {
    setState(prev => {
      const normalizedUpdateTags = updates.tags ? updates.tags.map(formatTag) : undefined;
      
      const updatedPlayers = prev.players.map(p => {
        if (p.id !== id) return p;
        const updated = { ...p, ...updates };
        if (normalizedUpdateTags) {
          updated.tags = normalizedUpdateTags;
        }
        if (updates.weakHandEnabled === false) {
          updated.weakHandRating = null;
        }
        return updated;
      });

      const usedTags = getUsedTags(updatedPlayers);
      const cleanedSavedTags = prev.savedTags.filter(t => usedTags.has(normalizeTag(t)));
      
      const newTagsToAdd = normalizedUpdateTags 
        ? normalizedUpdateTags.filter((t: string) => !cleanedSavedTags.some(st => normalizeTag(st) === normalizeTag(t)))
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
      recalculatePlayerStatsFromResults
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
