import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Player, Match, AdminSettings, PoolRotationEntry, PresetTeam } from "@shared/schema";
import { storage, AppData } from "@/lib/storage";

interface AppState extends AppData {
  addPlayer: (player: Omit<Player, "id" | "createdAt" | "rating" | "weakHandRating" | "formationPreferences" | "tags" | "ratingHistory" | "wins" | "losses" | "draws" | "active">) => void;
  updatePlayer: (id: number, updates: Partial<Player>) => void;
  deletePlayer: (id: number) => void;
  saveMatchResult: (result: Omit<Match, "id">) => void;
  deleteMatchResult: (id: number) => void;
  resetAllPlayerStats: () => void;
  updateAdminSettings: (settings: AdminSettings[]) => void;
  recalculatePlayerStatsFromResults: () => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppData>(() => storage.loadAllData());

  // Auto-persist to localStorage when state changes
  useEffect(() => {
    storage.saveAllData(state);
  }, [state]);

  const addPlayer = useCallback((playerData: any) => {
    const newPlayer: Player = {
      ...playerData,
      id: Math.floor(Math.random() * 1000000),
      rating: 5.0,
      weakHandRating: 3.0,
      formationPreferences: {},
      tags: [],
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

  const deleteMatchResult = useCallback((id: number) => {
    setState(prev => ({
      ...prev,
      matchResults: prev.matchResults.filter(m => m.id !== id)
    }));
  }, []);

  const resetAllPlayerStats = useCallback(() => {
    setState(prev => ({
      ...prev,
      players: prev.players.map(p => ({ ...p, wins: 0, losses: 0, draws: 0 }))
    }));
  }, []);

  const updateAdminSettings = useCallback((settings: AdminSettings[]) => {
    setState(prev => ({ ...prev, adminSettings: settings }));
  }, []);

  const recalculatePlayerStatsFromResults = useCallback(() => {
    setState(prev => {
      const playerStats = new Map<number, { wins: number; losses: number; draws: number }>();
      
      prev.players.forEach(p => playerStats.set(p.id, { wins: 0, losses: 0, draws: 0 }));

      prev.matchResults.forEach(match => {
        if (!match.completed || match.blackScore === null || match.whiteScore === null) return;

        const teams = match.teams as any;
        const blackPlayerIds = teams.black.players.map((p: any) => p.playerId);
        const whitePlayerIds = teams.white.players.map((p: any) => p.playerId);

        if (match.blackScore > match.whiteScore) {
          blackPlayerIds.forEach((id: number) => {
            const stats = playerStats.get(id);
            if (stats) stats.wins++;
          });
          whitePlayerIds.forEach((id: number) => {
            const stats = playerStats.get(id);
            if (stats) stats.losses++;
          });
        } else if (match.whiteScore > match.blackScore) {
          whitePlayerIds.forEach((id: number) => {
            const stats = playerStats.get(id);
            if (stats) stats.wins++;
          });
          blackPlayerIds.forEach((id: number) => {
            const stats = playerStats.get(id);
            if (stats) stats.losses++;
          });
        } else {
          [...blackPlayerIds, ...whitePlayerIds].forEach((id: number) => {
            const stats = playerStats.get(id);
            if (stats) stats.draws++;
          });
        }
      });

      return {
        ...prev,
        players: prev.players.map(p => {
          const stats = playerStats.get(p.id);
          return stats ? { ...p, ...stats } : p;
        })
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
