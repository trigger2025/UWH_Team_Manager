import { z } from "zod";
import { insertPlayerSchema, type Player, type Match } from "@shared/schema";

// Local Storage Keys
const PLAYERS_KEY = "uwh_players";
const MATCHES_KEY = "uwh_matches";

// Delay to simulate "database" feeling and show off UI states
const DELAY = 400;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to generate IDs
const generateId = () => Math.floor(Math.random() * 1000000);

// --- PLAYERS API ---

export const getPlayers = async (): Promise<Player[]> => {
  await delay(DELAY);
  const data = localStorage.getItem(PLAYERS_KEY);
  return data ? JSON.parse(data) : [];
};

export const createPlayer = async (player: z.infer<typeof insertPlayerSchema>): Promise<Player> => {
  await delay(DELAY);
  const players = await getPlayers();
  const newPlayer: Player = {
    id: generateId(),
    name: player.name,
    rating: player.rating,
    active: player.active ?? true,
  };
  
  // Implicitly handle duplicate updates if needed, but here we just append
  const updatedPlayers = [...players, newPlayer];
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(updatedPlayers));
  return newPlayer;
};

export const updatePlayer = async (id: number, updates: Partial<Player>): Promise<Player> => {
  await delay(DELAY);
  const players = await getPlayers();
  const index = players.findIndex((p) => p.id === id);
  
  if (index === -1) throw new Error("Player not found");
  
  const updatedPlayer = { ...players[index], ...updates };
  players[index] = updatedPlayer;
  
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(players));
  return updatedPlayer;
};

export const deletePlayer = async (id: number): Promise<void> => {
  await delay(DELAY);
  const players = await getPlayers();
  const filtered = players.filter((p) => p.id !== id);
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(filtered));
};

// --- MATCHES API ---

export const getMatches = async (): Promise<Match[]> => {
  await delay(DELAY);
  const data = localStorage.getItem(MATCHES_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveMatch = async (matchData: { teams: any; date: string }): Promise<Match> => {
  await delay(DELAY);
  const matches = await getMatches();
  const newMatch: Match = {
    id: generateId(),
    date: matchData.date,
    teams: matchData.teams,
    completed: false,
  };
  
  const updatedMatches = [newMatch, ...matches]; // Newest first
  localStorage.setItem(MATCHES_KEY, JSON.stringify(updatedMatches));
  return newMatch;
};

export const deleteMatch = async (id: number): Promise<void> => {
  await delay(DELAY);
  const matches = await getMatches();
  const filtered = matches.filter((m) => m.id !== id);
  localStorage.setItem(MATCHES_KEY, JSON.stringify(filtered));
};
