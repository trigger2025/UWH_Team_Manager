import { Player, Match, AdminSettings, PoolRotationEntry, PresetTeam, InsertPlayer, GenerationWorkspace, GeneratedTeamsSnapshot, VisibilitySettings, TournamentHistoryEntry, DEFAULT_ATTENDANCE_TRACKING, DEFAULT_POOL_TRACKING } from "@shared/schema";

export const STORAGE_KEYS = {
  PLAYERS: "uwh_players",
  MATCH_RESULTS: "uwh_match_results",
  ADMIN_SETTINGS: "uwh_admin_settings",
  POOL_ROTATION_HISTORY: "uwh_pool_rotation_history",
  PRESET_TEAMS: "uwh_preset_teams",
  SAVED_TAGS: "uwh_saved_tags",
  GENERATION_WORKSPACE: "uwh_generation_workspace",
  VISIBILITY_SETTINGS: "uwh_visibility_settings",
  TOURNAMENT_HISTORY: "uwh_tournament_history",
} as const;

export const DEFAULT_VISIBILITY_SETTINGS: import("@shared/schema").VisibilitySettings = {
  showRatings: true,
  showPositions: true,
};

export const DEFAULT_GENERATION_WORKSPACE: GenerationWorkspace = {
  mode: "standard",
  teamFormations: { black: "3-3", white: "3-3" },
  poolAFormations: { black: "3-3", white: "3-3" },
  poolBFormations: { black: "3-3", white: "3-3" },
  selectedPlayerIds: [],
  playerOffHandSelections: {},
  generatedTeams: null,
  poolAssignments: {},
  twoPoolsTeams: null,
  history: [],
  historyIndex: -1,
  teamTemplates: [],
  pendingMatch: null,
  pendingMatchPoolA: null,
  pendingMatchPoolB: null,
  teamsLocked: false,
  tournamentTeamCount: 3,
  tournament: null,
};

// Migrate legacy workspace data to new schema
function migrateWorkspace(saved: any): GenerationWorkspace {
  const migrated: GenerationWorkspace = { ...DEFAULT_GENERATION_WORKSPACE };
  
  if (!saved) return migrated;
  
  // Copy over fields that haven't changed
  if (saved.mode) migrated.mode = saved.mode;
  if (saved.selectedPlayerIds) migrated.selectedPlayerIds = saved.selectedPlayerIds;
  if (saved.generatedTeams) migrated.generatedTeams = saved.generatedTeams;
  if (saved.poolAssignments) migrated.poolAssignments = saved.poolAssignments;
  if (saved.twoPoolsTeams) migrated.twoPoolsTeams = saved.twoPoolsTeams;
  if (saved.historyIndex !== undefined) migrated.historyIndex = saved.historyIndex;
  if (saved.pendingMatch) migrated.pendingMatch = saved.pendingMatch;
  if (saved.pendingMatchPoolA) migrated.pendingMatchPoolA = saved.pendingMatchPoolA;
  if (saved.pendingMatchPoolB) migrated.pendingMatchPoolB = saved.pendingMatchPoolB;
  if (saved.teamsLocked !== undefined) migrated.teamsLocked = saved.teamsLocked;
  
  // Migrate formation -> teamFormations
  if (saved.teamFormations) {
    migrated.teamFormations = saved.teamFormations;
  } else if (saved.formation) {
    migrated.teamFormations = { black: saved.formation, white: saved.formation };
  }
  
  // Per-pool formations
  if (saved.poolAFormations) {
    migrated.poolAFormations = saved.poolAFormations;
  } else {
    migrated.poolAFormations = { ...migrated.teamFormations };
  }
  if (saved.poolBFormations) {
    migrated.poolBFormations = saved.poolBFormations;
  } else {
    migrated.poolBFormations = { ...migrated.teamFormations };
  }
  
  // Migrate useOffHandRatings -> playerOffHandSelections
  if (saved.playerOffHandSelections) {
    migrated.playerOffHandSelections = saved.playerOffHandSelections;
  }
  // Note: We don't auto-populate playerOffHandSelections from legacy useOffHandRatings
  // since the new model requires explicit per-player selection
  
  if (saved.history && Array.isArray(saved.history)) {
    migrated.history = saved.history.map((snapshot: any) => ({
      id: snapshot.id,
      timestamp: snapshot.timestamp,
      teams: snapshot.teams,
      twoPoolsTeams: snapshot.twoPoolsTeams,
      poolAssignments: snapshot.poolAssignments,
      mode: snapshot.mode || "standard",
      teamFormations: snapshot.teamFormations || 
        (snapshot.formation ? { black: snapshot.formation, white: snapshot.formation } : { black: "3-3", white: "3-3" }),
      poolAFormations: snapshot.poolAFormations,
      poolBFormations: snapshot.poolBFormations,
      playerOffHandSelections: snapshot.playerOffHandSelections || {}
    }));
  }

  if (saved.teamTemplates && Array.isArray(saved.teamTemplates)) {
    migrated.teamTemplates = saved.teamTemplates;
  }

  if (saved.tournamentTeamCount) migrated.tournamentTeamCount = saved.tournamentTeamCount;
  if (saved.tournament) migrated.tournament = saved.tournament;

  return migrated;
}

export interface AppData {
  players: Player[];
  matchResults: Match[];
  adminSettings: AdminSettings[];
  poolRotationHistory: PoolRotationEntry[];
  presetTeams: PresetTeam[];
  savedTags: string[];
  generationWorkspace: GenerationWorkspace;
  visibilitySettings: VisibilitySettings;
  tournamentHistory: TournamentHistoryEntry[];
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
      attendanceTracking: p.attendanceTracking ? {
        ...DEFAULT_ATTENDANCE_TRACKING,
        ...p.attendanceTracking,
      } : DEFAULT_ATTENDANCE_TRACKING,
      poolTracking: p.poolTracking ? {
        ...DEFAULT_POOL_TRACKING,
        ...p.poolTracking,
      } : DEFAULT_POOL_TRACKING,
    }));
    
    const savedWorkspace = this.read<any>(STORAGE_KEYS.GENERATION_WORKSPACE, null);
    
    // Migrate saved workspace from legacy format to new schema
    const mergedWorkspace = migrateWorkspace(savedWorkspace);
    
    return {
      players: migratedPlayers,
      matchResults: this.read<Match[]>(STORAGE_KEYS.MATCH_RESULTS, []),
      adminSettings: this.read<AdminSettings[]>(STORAGE_KEYS.ADMIN_SETTINGS, []),
      poolRotationHistory: this.read<PoolRotationEntry[]>(STORAGE_KEYS.POOL_ROTATION_HISTORY, []),
      presetTeams: this.read<PresetTeam[]>(STORAGE_KEYS.PRESET_TEAMS, []),
      savedTags: this.read<string[]>(STORAGE_KEYS.SAVED_TAGS, []),
      generationWorkspace: mergedWorkspace,
      visibilitySettings: this.read<VisibilitySettings>(STORAGE_KEYS.VISIBILITY_SETTINGS, DEFAULT_VISIBILITY_SETTINGS),
      tournamentHistory: this.read<TournamentHistoryEntry[]>(STORAGE_KEYS.TOURNAMENT_HISTORY, []),
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
    if (data.visibilitySettings) this.write(STORAGE_KEYS.VISIBILITY_SETTINGS, data.visibilitySettings);
    if (data.tournamentHistory) this.write(STORAGE_KEYS.TOURNAMENT_HISTORY, data.tournamentHistory);
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
    attendanceTracking: DEFAULT_ATTENDANCE_TRACKING,
    poolTracking: DEFAULT_POOL_TRACKING,
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
