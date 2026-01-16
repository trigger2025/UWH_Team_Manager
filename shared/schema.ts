import { pgTable, text, serial, boolean, integer, jsonb, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// --- Enums ---

export const FormationType = z.enum(["3-3", "1-3-2"]);
export type FormationType = z.infer<typeof FormationType>;

export const FormationPosition33 = z.enum([
  "Forward", "Centre", "Half Back", "Centre Back"
]);
export const FormationPosition132 = z.enum([
  "Forward", "Wing", "Centre", "Back"
]);

export type FormationPosition33 = z.infer<typeof FormationPosition33>;
export type FormationPosition132 = z.infer<typeof FormationPosition132>;

export type FormationPosition = FormationPosition33 | FormationPosition132;

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

export interface PlayerWithAssignedFormationRole extends Player {
  assignedPosition: FormationPosition;
  formationRole: "main" | "alternate" | "filler";
}

export interface GeneratedTeam {
  color: "Black" | "White";
  formation: FormationType;
  players: PlayerWithAssignedFormationRole[];
  totalRating: number;
}

export interface PlayerRatingSnapshot {
  playerId: number;
  rating: number;
  weakHandRating: number | null;
  timestamp: string;
}

export interface PoolRotationEntry {
  poolId: number;
  startTime: string;
  durationMinutes: number;
  notes?: string;
}

export interface PresetTeam {
  name: string;
  playerIds: number[];
  preferredFormation?: FormationType;
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
