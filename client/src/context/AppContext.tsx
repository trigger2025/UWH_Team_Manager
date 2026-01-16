import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Player, Match, AdminSettings, PoolRotationEntry, PresetTeam, FormationType, FormationPosition } from "@shared/schema";
import { storage, AppData } from "@/lib/storage";
import { calculateRatingAdjustments, applyRatingAdjustments } from "@/lib/rating-logic";

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
    const newPlayer: Player = {
      ...playerData,
      id: Math.floor(Math.random() * 1000000),
      rating: playerData.rating ?? 5.0,
      weakHandRating: playerData.weakHandRating ?? 3.0,
      formationPreferences: playerData.formationPreferences ?? {},
      tags: playerData.tags ?? [],
      ratingHistory: [],
      wins: 0,
      losses: 0,
      draws: 0,
      active: true,
      createdAt: new Date(),
    };
    setState(prev => ({ ...prev, players: [...prev.players, newPlayer] }));
  }, []);

  const updatePlayer = useCallback((id: number, updates: Partial<Player>) => {
    setState(prev => ({
      ...prev,
      players: prev.players.map(p => p.id === id ? { ...p, ...updates } : p)
    }));
  }, []);

  const deletePlayer = useCallback((id: number) => {
    setState(prev => ({
      ...prev,
      players: prev.players.filter(p => p.id !== id)
    }));
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
      const kFactor = kFactorSetting ? parseInt(kFactorSetting.value) : 32;

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
      // 1. Reset all players to base state
      const basePlayers = prev.players.map(p => ({
        ...p,
        rating: 5.0,
        wins: 0,
        losses: 0,
        draws: 0,
        ratingHistory: []
      }));

      const kFactorSetting = prev.adminSettings.find(s => s.key === "rating_strength");
      const kFactor = kFactorSetting ? parseInt(kFactorSetting.value) : 32;

      // 2. Sort matches chronologically
      const sortedMatches = [...prev.matchResults]
        .filter(m => m.completed)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // 3. Re-apply each match
      let currentPlayers = basePlayers;
      sortedMatches.forEach(match => {
        const teams = match.teams as any;
        const adjustments = calculateRatingAdjustments(
          teams.black,
          teams.white,
          match.blackScore!,
          match.whiteScore!,
          kFactor,
          false // Recalculation assumes stored state or default
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
