import { Player, Match, AdminSettings, PoolRotationEntry, PresetTeam, InsertPlayer } from "@shared/schema";

export const STORAGE_KEYS = {
  PLAYERS: "uwh_players",
  MATCH_RESULTS: "uwh_match_results",
  ADMIN_SETTINGS: "uwh_admin_settings",
  POOL_ROTATION_HISTORY: "uwh_pool_rotation_history",
  PRESET_TEAMS: "uwh_preset_teams",
} as const;

export interface AppData {
  players: Player[];
  matchResults: Match[];
  adminSettings: AdminSettings[];
  poolRotationHistory: PoolRotationEntry[];
  presetTeams: PresetTeam[];
}

const generateId = () => Math.floor(Math.random() * 1000000);

export const storage = {
  read<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      if (!item) return defaultValue;
      return JSON.parse(item) as T;
    } catch (error) {
      console.error(`Error reading key "${key}" from localStorage:`, error);
      return defaultValue;
    }
  },

  write<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing key "${key}" to localStorage:`, error);
    }
  },

  loadAllData(): AppData {
    return {
      players: this.read<Player[]>(STORAGE_KEYS.PLAYERS, []),
      matchResults: this.read<Match[]>(STORAGE_KEYS.MATCH_RESULTS, []),
      adminSettings: this.read<AdminSettings[]>(STORAGE_KEYS.ADMIN_SETTINGS, []),
      poolRotationHistory: this.read<PoolRotationEntry[]>(STORAGE_KEYS.POOL_ROTATION_HISTORY, []),
      presetTeams: this.read<PresetTeam[]>(STORAGE_KEYS.PRESET_TEAMS, []),
    };
  },

  saveAllData(data: Partial<AppData>): void {
    if (data.players) this.write(STORAGE_KEYS.PLAYERS, data.players);
    if (data.matchResults) this.write(STORAGE_KEYS.MATCH_RESULTS, data.matchResults);
    if (data.adminSettings) this.write(STORAGE_KEYS.ADMIN_SETTINGS, data.adminSettings);
    if (data.poolRotationHistory) this.write(STORAGE_KEYS.POOL_ROTATION_HISTORY, data.poolRotationHistory);
    if (data.presetTeams) this.write(STORAGE_KEYS.PRESET_TEAMS, data.presetTeams);
  },

  clearAllData(): void {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
  },

  getPlayers(): Player[] {
    return this.read<Player[]>(STORAGE_KEYS.PLAYERS, []);
  },

  setPlayers(players: Player[]): void {
    this.write(STORAGE_KEYS.PLAYERS, players);
  },

  getMatches(): Match[] {
    return this.read<Match[]>(STORAGE_KEYS.MATCH_RESULTS, []);
  },

  setMatches(matches: Match[]): void {
    this.write(STORAGE_KEYS.MATCH_RESULTS, matches);
  },
};

// --- Compatibility Exports for Existing Hooks ---

export const getPlayers = async (): Promise<Player[]> => {
  return storage.getPlayers();
};

export const createPlayer = async (player: InsertPlayer): Promise<Player> => {
  const players = storage.getPlayers();
  const newPlayer: Player = {
    ...player,
    id: generateId(),
    rating: player.rating ?? 5.0,
    weakHandRating: player.weakHandRating ?? 3.0,
    formationPreferences: player.formationPreferences ?? {},
    tags: player.tags ?? [],
    ratingHistory: player.ratingHistory ?? [],
    wins: player.wins ?? 0,
    losses: player.losses ?? 0,
    draws: player.draws ?? 0,
    active: player.active ?? true,
    createdAt: new Date(),
  };
  storage.setPlayers([...players, newPlayer]);
  return newPlayer;
};

export const updatePlayer = async (id: number, updates: Partial<Player>): Promise<Player> => {
  const players = storage.getPlayers();
  const index = players.findIndex((p) => p.id === id);
  if (index === -1) throw new Error("Player not found");
  const updatedPlayer = { ...players[index], ...updates };
  players[index] = updatedPlayer;
  storage.setPlayers(players);
  return updatedPlayer;
};

export const deletePlayer = async (id: number): Promise<void> => {
  const players = storage.getPlayers();
  storage.setPlayers(players.filter((p) => p.id !== id));
};

export const getMatches = async (): Promise<Match[]> => {
  return storage.getMatches();
};

export const saveMatch = async (matchData: { teams: any; date: string }): Promise<Match> => {
  const matches = storage.getMatches();
  const newMatch: Match = {
    id: generateId(),
    date: new Date(matchData.date),
    teams: matchData.teams,
    completed: false,
    poolId: null,
    formation: "3-3",
    blackScore: null,
    whiteScore: null,
    tournamentId: null,
  };
  storage.setMatches([newMatch, ...matches]);
  return newMatch;
};

export const deleteMatch = async (id: number): Promise<void> => {
  const matches = storage.getMatches();
  storage.setMatches(matches.filter((m) => m.id !== id));
};
