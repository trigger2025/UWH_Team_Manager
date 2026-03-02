import { pgTable, text, serial, boolean, integer, jsonb, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// --- Enums ---

export const FormationType = z.enum(["3-3", "1-3-2"]);
export type FormationType = z.infer<typeof FormationType>;

// Canonical positions for each formation (as per user requirements)
export const FormationPosition33 = z.enum([
  "Forward", "Centre", "Half Back", "Centre Back"
]);
export const FormationPosition132 = z.enum([
  "Forward", "Wing", "Centre", "Back"
]);

export type FormationPosition33 = z.infer<typeof FormationPosition33>;
export type FormationPosition132 = z.infer<typeof FormationPosition132>;

export type FormationPosition = FormationPosition33 | FormationPosition132;

// Generation modes
export const GenerationMode = z.enum(["standard", "two_pools", "preset_teams", "tournament"]);
export type GenerationMode = z.infer<typeof GenerationMode>;

// Pool assignment for Two Pools mode
export const PoolAssignment = z.enum(["A", "B"]);
export type PoolAssignment = z.infer<typeof PoolAssignment>;

// --- Core Models ---

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  rating: integer("rating").notNull().default(500),
  
  // Weak hand is optional
  weakHandEnabled: boolean("weak_hand_enabled").notNull().default(false),
  weakHandRating: integer("weak_hand_rating"),
  
  // Stores { [FormationType]: { main: FormationPosition, alternates: FormationPosition[] } }
  formationPreferences: jsonb("formation_preferences").notNull().default({}),
  
  // Player's custom tags
  tags: text("tags").array().notNull().default([]),
  
  // Stores array of { date: string, rating: number }
  ratingHistory: jsonb("rating_history").notNull().default([]),
  
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  draws: integer("draws").notNull().default(0),
  
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pools = pgTable("pools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  dimensions: text("dimensions"), // e.g., "25m x 15m"
  active: boolean("active").notNull().default(true),
});

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  date: timestamp("date").defaultNow().notNull(),
  poolId: integer("pool_id").references(() => pools.id),
  
  // Configuration used to generate this match
  formation: text("formation").notNull(), // FormationType
  
  // Stores { black: TeamData, white: TeamData }
  // TeamData: { players: { playerId: number, position: FormationPosition }[] }
  teams: jsonb("teams").notNull(),
  
  // Results
  blackScore: integer("black_score"),
  whiteScore: integer("white_score"),
  completed: boolean("completed").default(false),
  
  tournamentId: integer("tournament_id"), // Optional link to tournament
});

export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startDate: timestamp("start_date").defaultNow(),
  status: text("status").notNull().default("active"), // active, completed
});

export const adminSettings = pgTable("admin_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
});

// --- Complex Types (Not stored directly in DB or used as wrappers) ---

// Player with assigned formation role during team generation
export interface PlayerWithAssignedFormationRole extends Player {
  assignedPosition: FormationPosition;
  formationRole: "main" | "alternate" | "filler";
  // Rating snapshot at generation time
  ratingUsed: number;
  usedOffHand: boolean;
  // Cluster label for teams > 6 players (e.g. "Forward", "Back Line", "super-sub")
  clusterLabel?: string;
}

export interface GeneratedTeam {
  color: "Black" | "White";
  formation: FormationType;
  players: PlayerWithAssignedFormationRole[];
  totalRating: number;
}

// Snapshot stored when match result is confirmed
export interface PlayerRatingSnapshot {
  playerId: number;
  playerName: string;
  ratingUsed: number;
  usedOffHand: boolean;
  mainRating: number;
  offHandRating: number | null;
  // Rating tracking for reversal support
  ratingBefore: number; // Rating value before match (main or off-hand based on usedOffHand)
  ratingAfter?: number; // Rating value after match (set when completed)
  ratingDelta?: number; // Change applied (+/-)
  team: "Black" | "White";
  position: string;
}

// Stored with match when teams are confirmed
export interface MatchTeamSnapshot {
  black: {
    players: PlayerRatingSnapshot[];
    totalRating: number;
    formation: FormationType;
  };
  white: {
    players: PlayerRatingSnapshot[];
    totalRating: number;
    formation: FormationType;
  };
  useOffHandRatings: boolean;
  timestamp: string;
}

export interface PoolRotationEntry {
  poolId: number;
  startTime: string;
  durationMinutes: number;
  notes?: string;
}

export interface PresetTeam {
  id: number;
  name: string;
  playerIds: number[];
  preferredFormation?: FormationType;
  poolAssignment?: number; // For two pools mode
}

// Generated teams for two pools mode
export interface TwoPoolsGeneratedTeams {
  poolA: { black: GeneratedTeam; white: GeneratedTeam } | null;
  poolB: { black: GeneratedTeam; white: GeneratedTeam } | null;
}

// Per-player off-hand selection during generation
export interface PlayerOffHandSelection {
  [playerId: number]: boolean; // true = use off-hand, false = use main hand
}

// Team formation configuration
export interface TeamFormations {
  black: FormationType;
  white: FormationType;
}

// Generation workspace state (persisted globally)
export interface GenerationWorkspace {
  mode: GenerationMode;
  teamFormations: TeamFormations;
  poolAFormations: TeamFormations;
  poolBFormations: TeamFormations;
  selectedPlayerIds: number[];
  playerOffHandSelections: PlayerOffHandSelection;
  generatedTeams: { black: GeneratedTeam; white: GeneratedTeam } | null;
  poolAssignments: Record<number, PoolAssignment>;
  twoPoolsTeams: TwoPoolsGeneratedTeams | null;
  history: GeneratedTeamsSnapshot[];
  historyIndex: number;
  teamTemplates: TeamTemplate[];
  pendingMatch: PendingMatch | null;
  pendingMatchPoolA: PendingMatch | null;
  pendingMatchPoolB: PendingMatch | null;
  teamsLocked: boolean;
}

// Pending match state (teams locked, waiting for scores)
export interface PendingMatch {
  teams: MatchTeamSnapshot;
  createdAt: string;
  poolLabel?: "A" | "B"; // For 2 pools mode
}

// Visibility settings for UI
export interface VisibilitySettings {
  showRatings: boolean;
  showPositions: boolean;
}

export interface TeamTemplatePlayerEntry {
  playerId: number;
  assignedPosition: string;
  usedOffHand: boolean;
}

export interface TeamTemplateStructure {
  formation: FormationType;
  players: TeamTemplatePlayerEntry[];
}

export interface TeamTemplate {
  id: string;
  mode: GenerationMode;
  createdAt: number;
  pools: {
    A?: {
      black: TeamTemplateStructure;
      white: TeamTemplateStructure;
    };
    B?: {
      black: TeamTemplateStructure;
      white: TeamTemplateStructure;
    };
  };
  teamFormations: TeamFormations;
  poolAFormations?: TeamFormations;
  poolBFormations?: TeamFormations;
  playerOffHandSelections: PlayerOffHandSelection;
  poolAssignments?: Record<number, PoolAssignment>;
}

export interface GeneratedTeamsSnapshot {
  id: number;
  timestamp: string;
  teams?: { black: GeneratedTeam; white: GeneratedTeam };
  twoPoolsTeams?: TwoPoolsGeneratedTeams;
  poolAssignments?: Record<number, PoolAssignment>;
  mode: GenerationMode;
  teamFormations: TeamFormations;
  poolAFormations?: TeamFormations;
  poolBFormations?: TeamFormations;
  playerOffHandSelections: PlayerOffHandSelection;
}

// --- Zod Schemas & Types ---

export const insertPlayerSchema = createInsertSchema(players).omit({ 
  id: true, 
  createdAt: true 
});
export type Player = typeof players.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;

export const insertPoolSchema = createInsertSchema(pools).omit({ id: true });
export type Pool = typeof pools.$inferSelect;
export type InsertPool = z.infer<typeof insertPoolSchema>;

export const insertMatchSchema = createInsertSchema(matches).omit({ id: true });
export type Match = typeof matches.$inferSelect;
export type InsertMatch = z.infer<typeof insertMatchSchema>;

export const insertTournamentSchema = createInsertSchema(tournaments).omit({ id: true });
export type Tournament = typeof tournaments.$inferSelect;

export const insertAdminSettingsSchema = createInsertSchema(adminSettings).omit({ id: true });
export type AdminSettings = typeof adminSettings.$inferSelect;
