import { Player, Match, AdminSettings, PoolRotationEntry, PresetTeam, InsertPlayer, GenerationWorkspace, GeneratedTeamsSnapshot } from "@shared/schema";

export const STORAGE_KEYS = {
  PLAYERS: "uwh_players",
  MATCH_RESULTS: "uwh_match_results",
  ADMIN_SETTINGS: "uwh_admin_settings",
  POOL_ROTATION_HISTORY: "uwh_pool_rotation_history",
  PRESET_TEAMS: "uwh_preset_teams",
  SAVED_TAGS: "uwh_saved_tags",
  GENERATION_WORKSPACE: "uwh_generation_workspace",
} as const;

export const DEFAULT_GENERATION_WORKSPACE: GenerationWorkspace = {
  mode: "standard",
  formation: "3-3",
  selectedPlayerIds: [],
  useOffHandRatings: false,
  generatedTeams: null,
  poolAssignments: {},
  twoPoolsTeams: null,
  history: [],
  historyIndex: -1
};

export interface AppData {
  players: Player[];
  matchResults: Match[];
  adminSettings: AdminSettings[];
  poolRotationHistory: PoolRotationEntry[];
  presetTeams: PresetTeam[];
  savedTags: string[];
  generationWorkspace: GenerationWorkspace;
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
    const rawPlayers = this.read<any[]>(STORAGE_KEYS.PLAYERS, []);
    const migratedPlayers: Player[] = rawPlayers.map(p => ({
      ...p,
      rating: typeof p.rating === 'number' ? Math.round(Math.min(Math.max(p.rating <= 10 ? p.rating * 100 : p.rating, 0), 1000)) : 500,
      weakHandEnabled: p.weakHandEnabled ?? false,
      weakHandRating: p.weakHandEnabled ? (typeof p.weakHandRating === 'number' ? Math.round(Math.min(Math.max(p.weakHandRating <= 10 ? p.weakHandRating * 100 : p.weakHandRating, 0), 1000)) : 300) : null,
    }));
    
    const savedWorkspace = this.read<Partial<GenerationWorkspace> | null>(STORAGE_KEYS.GENERATION_WORKSPACE, null);
    
    // Merge saved workspace with defaults to ensure all fields exist
    const mergedWorkspace: GenerationWorkspace = {
      ...DEFAULT_GENERATION_WORKSPACE,
      ...(savedWorkspace || {})
    };
    
    return {
      players: migratedPlayers,
      matchResults: this.read<Match[]>(STORAGE_KEYS.MATCH_RESULTS, []),
      adminSettings: this.read<AdminSettings[]>(STORAGE_KEYS.ADMIN_SETTINGS, []),
      poolRotationHistory: this.read<PoolRotationEntry[]>(STORAGE_KEYS.POOL_ROTATION_HISTORY, []),
      presetTeams: this.read<PresetTeam[]>(STORAGE_KEYS.PRESET_TEAMS, []),
      savedTags: this.read<string[]>(STORAGE_KEYS.SAVED_TAGS, []),
      generationWorkspace: mergedWorkspace,
    };
  },

  saveAllData(data: Partial<AppData>): void {
    if (data.players) this.write(STORAGE_KEYS.PLAYERS, data.players);
    if (data.matchResults) this.write(STORAGE_KEYS.MATCH_RESULTS, data.matchResults);
    if (data.adminSettings) this.write(STORAGE_KEYS.ADMIN_SETTINGS, data.adminSettings);
    if (data.poolRotationHistory) this.write(STORAGE_KEYS.POOL_ROTATION_HISTORY, data.poolRotationHistory);
    if (data.presetTeams) this.write(STORAGE_KEYS.PRESET_TEAMS, data.presetTeams);
    if (data.savedTags !== undefined) this.write(STORAGE_KEYS.SAVED_TAGS, data.savedTags);
    if (data.generationWorkspace) this.write(STORAGE_KEYS.GENERATION_WORKSPACE, data.generationWorkspace);
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
    rating: player.rating ?? 500,
    weakHandEnabled: player.weakHandEnabled ?? false,
    weakHandRating: player.weakHandEnabled ? (player.weakHandRating ?? 300) : null,
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
