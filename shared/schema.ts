import { pgTable, text, serial, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  rating: integer("rating").notNull().default(5),
  active: boolean("active").notNull().default(true),
});

export const insertPlayerSchema = createInsertSchema(players).pick({
  name: true,
  rating: true,
  active: true,
});

export type Player = typeof players.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  teams: jsonb("teams").notNull(), // Store generated teams structure
  completed: boolean("completed").default(false),
});

export const insertMatchSchema = createInsertSchema(matches).pick({
  date: true,
  teams: true,
  completed: true,
});

export type Match = typeof matches.$inferSelect;
export type InsertMatch = z.infer<typeof insertMatchSchema>;
