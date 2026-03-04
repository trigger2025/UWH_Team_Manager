import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronDown, X } from "lucide-react";
import { Player } from "@shared/schema";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";

export const ALL_POSITIONS = ["Forward", "Centre", "Half Back", "Centre Back", "Wing", "Back"] as const;

export const POSITION_SHORT: Record<string, string> = {
  "Forward": "F",
  "Centre": "C",
  "Half Back": "HB",
  "Centre Back": "CB",
  "Wing": "W",
  "Back": "B",
};

export const BASE_SORT_OPTIONS = [
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "rating-desc", label: "Rating High → Low" },
  { value: "rating-asc", label: "Rating Low → High" },
];

export interface FilterState {
  search: string;
  tags: string[];
  positions: string[];
  sortBy: string;
}

export function defaultFilterState(sortBy = "name-asc"): FilterState {
  return { search: "", tags: [], positions: [], sortBy };
}

function playerMatchesFilter(player: Player, filter: FilterState): boolean {
  const search = filter.search.trim().toLowerCase();
  if (search && !player.name.toLowerCase().includes(search)) return false;

  if (filter.tags.length > 0) {
    const playerTagsNorm = (player.tags || []).map(t => t.trim().toLowerCase());
    const hasTag = filter.tags.some(ft => playerTagsNorm.includes(ft.toLowerCase()));
    if (!hasTag) return false;
  }

  if (filter.positions.length > 0) {
    const prefs = (player.formationPreferences as any) || {};
    const playerPositions = new Set<string>();
    for (const formKey of Object.keys(prefs)) {
      const pref = prefs[formKey];
      if (pref?.main) playerPositions.add(pref.main);
      (pref?.alternates || []).forEach((p: string) => playerPositions.add(p));
    }
    const hasPos = filter.positions.some(fp => playerPositions.has(fp));
    if (!hasPos) return false;
  }

  return true;
}

function sortPlayers(
  players: Player[],
  sortBy: string,
  statsMap?: Map<number, { wins: number; winRate: number; totalRatingChange: number; currentWinStreak: number; currentLossStreak: number }>
): Player[] {
  const sorted = [...players];
  switch (sortBy) {
    case "name-asc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "name-desc":
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case "rating-desc":
      return sorted.sort((a, b) => b.rating - a.rating);
    case "rating-asc":
      return sorted.sort((a, b) => a.rating - b.rating);
    case "most-wins":
      return sorted.sort((a, b) => (statsMap?.get(b.id)?.wins ?? 0) - (statsMap?.get(a.id)?.wins ?? 0));
    case "win-rate":
      return sorted.sort((a, b) => (statsMap?.get(b.id)?.winRate ?? 0) - (statsMap?.get(a.id)?.winRate ?? 0));
    case "rating-gain":
      return sorted.sort((a, b) => (statsMap?.get(b.id)?.totalRatingChange ?? 0) - (statsMap?.get(a.id)?.totalRatingChange ?? 0));
    case "win-streak":
      return sorted.sort((a, b) => (statsMap?.get(b.id)?.currentWinStreak ?? 0) - (statsMap?.get(a.id)?.currentWinStreak ?? 0));
    case "loss-streak":
      return sorted.sort((a, b) => (statsMap?.get(b.id)?.currentLossStreak ?? 0) - (statsMap?.get(a.id)?.currentLossStreak ?? 0));
    default:
      return sorted;
  }
}

export function applyPlayerFilter(
  players: Player[],
  filter: FilterState,
  statsMap?: Map<number, { wins: number; winRate: number; totalRatingChange: number; currentWinStreak: number; currentLossStreak: number }>
): Player[] {
  const filtered = players.filter(p => playerMatchesFilter(p, filter));
  return sortPlayers(filtered, filter.sortBy, statsMap);
}

interface PlayerFilterBarProps {
  filter: FilterState;
  onChange: (next: FilterState) => void;
  availableTags?: string[];
  extraSortOptions?: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  "data-testid"?: string;
}

export function PlayerFilterBar({
  filter,
  onChange,
  availableTags = [],
  extraSortOptions = [],
  placeholder = "Search players...",
  className = "",
  "data-testid": testId = "player-filter-bar",
}: PlayerFilterBarProps) {
  const sortOptions = [...BASE_SORT_OPTIONS, ...extraSortOptions];
  const activeFilters = filter.tags.length + filter.positions.length;

  function toggleTag(tag: string) {
    const next = filter.tags.includes(tag)
      ? filter.tags.filter(t => t !== tag)
      : [...filter.tags, tag];
    onChange({ ...filter, tags: next });
  }

  function togglePosition(pos: string) {
    const next = filter.positions.includes(pos)
      ? filter.positions.filter(p => p !== pos)
      : [...filter.positions, pos];
    onChange({ ...filter, positions: next });
  }

  function clearAll() {
    onChange({ ...filter, search: "", tags: [], positions: [] });
  }

  const currentSortLabel = sortOptions.find(o => o.value === filter.sortBy)?.label ?? "Sort";

  return (
    <div className={`space-y-2 ${className}`} data-testid={testId}>
      {/* Search row */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={filter.search}
          onChange={e => onChange({ ...filter, search: e.target.value })}
          className="pl-9 h-9 bg-card border-none ring-1 ring-white/10 focus:ring-primary/50 text-sm"
          data-testid={`${testId}-search`}
        />
        {filter.search && (
          <button
            onClick={() => onChange({ ...filter, search: "" })}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Filter row: Tags | Positions | Sort */}
      <div className="flex gap-1.5 items-center">
        {/* Tag filter */}
        {availableTags.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`h-7 text-[11px] px-2 gap-1 border-border/50 ${filter.tags.length > 0 ? "border-primary/40 text-primary" : "text-muted-foreground"}`}
                data-testid={`${testId}-tags-btn`}
              >
                Tags {filter.tags.length > 0 && <Badge className="h-4 w-4 p-0 flex items-center justify-center text-[9px] bg-primary">{filter.tags.length}</Badge>}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44 bg-card border-border shadow-xl max-h-60 overflow-y-auto">
              <DropdownMenuLabel className="text-[10px] text-muted-foreground py-1">Filter by Tag</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableTags.map(tag => (
                <DropdownMenuCheckboxItem
                  key={tag}
                  checked={filter.tags.includes(tag)}
                  onCheckedChange={() => toggleTag(tag)}
                  className="text-xs"
                >
                  {tag}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Position filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`h-7 text-[11px] px-2 gap-1 border-border/50 ${filter.positions.length > 0 ? "border-primary/40 text-primary" : "text-muted-foreground"}`}
              data-testid={`${testId}-pos-btn`}
            >
              Position {filter.positions.length > 0 && <Badge className="h-4 w-4 p-0 flex items-center justify-center text-[9px] bg-primary">{filter.positions.length}</Badge>}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40 bg-card border-border shadow-xl">
            <DropdownMenuLabel className="text-[10px] text-muted-foreground py-1">Filter by Position</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ALL_POSITIONS.map(pos => (
              <DropdownMenuCheckboxItem
                key={pos}
                checked={filter.positions.includes(pos)}
                onCheckedChange={() => togglePosition(pos)}
                className="text-xs"
              >
                <span className="font-mono font-bold text-primary w-7 inline-block">{POSITION_SHORT[pos]}</span>
                {pos}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] px-2 gap-1 border-border/50 text-muted-foreground ml-auto"
              data-testid={`${testId}-sort-btn`}
            >
              {currentSortLabel}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 bg-card border-border shadow-xl">
            {sortOptions.map(opt => (
              <DropdownMenuCheckboxItem
                key={opt.value}
                checked={filter.sortBy === opt.value}
                onCheckedChange={() => onChange({ ...filter, sortBy: opt.value })}
                className="text-xs"
              >
                {opt.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Clear all */}
        {(filter.search || activeFilters > 0) && (
          <button
            onClick={clearAll}
            className="text-[10px] text-muted-foreground hover:text-foreground px-1.5"
            data-testid={`${testId}-clear`}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
