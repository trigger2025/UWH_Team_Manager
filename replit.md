# Overview

This is an Underwater Hockey (UWH) team management application built with React and Express. The app helps manage player rosters, generate balanced teams for matches, and track match history. It uses a mobile-first design with a bottom navigation pattern and persists all data locally via localStorage - no backend API calls are required for core functionality.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript, bundled via Vite
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: React Query for async state management (used with localStorage, not API calls), React Context for global app state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming (oceanic/nautical dark theme)
- **Animations**: Framer Motion for smooth transitions
- **Forms**: React Hook Form with Zod validation

## Backend Architecture
- **Framework**: Express.js with TypeScript
- **Purpose**: Minimal - primarily serves static files in production and Vite dev server in development
- **API Routes**: Currently empty - the app is designed to be local-only with localStorage persistence
- **Database Schema**: Drizzle ORM with PostgreSQL schema defined (for potential future use), but not actively used

## Data Persistence
- **Primary Storage**: Browser localStorage
- **Storage Layer**: Custom storage utilities in `client/src/lib/storage.ts` and context provider in `client/src/context/AppContext.tsx`
- **Data Models**: Players, Matches, Admin Settings, Pool Rotation History, Preset Teams, Saved Tags
- **Migration**: Storage layer auto-migrates old player data (1-10 ratings scaled to 0-1000, adds weakHandEnabled field)

## Player Features
- **Ratings**: 0-1000 integer scale with dual slider + text input for precise control
- **Off-hand Rating**: Optional feature enabled via toggle (weakHandEnabled boolean); when disabled, weakHandRating is null
- **Tags**: Global savedTags system with autocomplete suggestions; tags are normalized to title-case and deduplicated case-insensitively; unused tags auto-removed when players are updated/deleted
- **Formation Preferences**: Per-formation position preferences (3-3 and 1-3-2 formations have separate, distinct positions)

## Team Generation System
- **Generation Workspace**: Persistent state across navigation (mode, teamFormations, selected players, playerOffHandSelections, generated teams, pool assignments, history)
- **Formation Positions**: 3-3 uses Forward, Centre, Half Back, Centre Back; 1-3-2 uses Forward, Wing, Centre, Back
- **Per-Team Formations**: Black and White teams can have different formations selected independently via `teamFormations: { black: FormationType, white: FormationType }`
- **Per-Player Off-hand Selection**: Individual players with off-hand enabled can toggle to use their off-hand rating via cyan "Off" button; stored in `playerOffHandSelections: Record<number, boolean>`
- **Explicit Selection**: Players must be explicitly selected before generation (none selected by default)
- **Team Size Scaling**: No hardcoded team size. Players split evenly across 2 teams per pool. Extra players beyond formation size get default position.
- **Re-roll**: Produces different team arrangements via random jitter in sort + random first-pick in snake draft. Each re-roll creates a new history entry.
- **Team Templates**: On Confirm, team structure is saved as a `TeamTemplate` (structure only, no ratings). Up to 10 templates stored. "Load Previous Teams" button opens a dialog to reload a template using current live ratings. Templates never store or modify ratings.
- **Generate Tab Behavior**: Always opens in player selection state. No auto-loading of previous teams. Teams are cleared on mount unless locked for pending match.
- **Manual Editing**: Move players between teams without automatic rebalancing. Position revalidated when moving to a team with a different formation (invalid positions get reassigned to default).
- **Match Snapshots**: Confirm creates MatchTeamSnapshot with rating snapshots (ratingUsed, usedOffHand, team, position) for each player
- **Rating System**: Delta-based. On match completion, stores `ratingDelta` and `ratingFieldUsed` in snapshot. On deletion, reverses via `currentRating -= ratingDelta`. Legacy snapshots with ratingBefore/ratingAfter are supported as fallback.
- **Pool Movement**: Players can be moved between Pool A and Pool B after generation, preserving team color. Position revalidated on cross-pool moves.
- **Modes**: Standard mode, Two Pools mode, and Tournament mode implemented; Preset Teams mode is a placeholder
- **Delete Confirmations**: AlertDialog confirmation required before deleting matches or players

## Tournament Mode
- **Generation**: Select players + number of teams (2-6), choose a formation; `generateMultipleTeams` splits players evenly into N teams using snake draft
- **Captain Naming**: Teams are named after their highest-rated player — format `{firstName} {lastInitial}'s Team` (e.g. "John S's Team")
- **Player Snapshots**: At tournament start, each player's current rating is snapshotted (`ratingBefore`, `weakHandRatingBefore`); stored in `TournamentState.playerSnapshots` and persisted to `TournamentHistoryEntry`
- **Delete with Reversal**: Deleting a tournament history entry reverts all player ratings to their pre-tournament snapshot values
- **Round Robin Fixtures**: `generateRoundRobin` creates all N*(N-1)/2 fixtures; stored in `generationWorkspace.tournament` as `TournamentState`
- **Tournament Page**: `/tournament` shows progress bar, all fixture cards with result buttons (Team A Win / Draw / Team B Win), live standings table
- **Result Recording**: Each fixture result can be set/changed until finalised; `completedCount` updates automatically
- **Finalise**: All fixtures must have results before finalising; `finaliseTournament` applies Elo rating changes with 70% K-factor (tournament modifier) to all players and marks the tournament as finalised
- **Reset**: Clears tournament state from workspace; rating changes applied before finalisation are not reversed
- **Rating Impact**: Win = +pts, Loss = -pts, Draw = proportional; uses same `calculateRatingAdjustments` as standard matches but with `tournamentMode: true`
- **History**: On finalise, tournament is saved to `tournamentHistory[]` (separate `uwh_tournament_history` localStorage key) and the active tournament is cleared; navigates to /results
- **Schedule Generator**: On the /tournament page, a Schedule section lets organisers set start time, game duration (minutes), turnover time (minutes), and 1 or 2 concurrent pools. Generates a time-based table showing which fixture plays when. In 2-pool mode, fixtures are paired side-by-side per time slot
- **Round-Based 2-Pool Scheduling**: Schedule uses true round-robin rounds (`generateRoundRobin` circle method). In 1-pool mode, each game is its own time slot (Bye = all non-playing teams for that slot). In 2-pool mode, each ROUND is one time slot with two games running simultaneously — `generateBalancedSchedule` assigns games to Pool A/B using an appearance tracker to keep distribution balanced
- **BYE Column**: When the number of teams is odd, the Bye column shows which team sits out each round (team name, not "–"). For even team counts, shows "–"
- **3-Team Force**: When exactly 3 teams exist, "2 Pools" button is disabled and `activePools` is forced to 1 — each round has exactly 1 real game so concurrent pools are meaningless
- **Schedule Validation**: Before saving, `validateSchedule` checks: no team appears twice in same round; 5-team schedules give each team exactly 4 games and 1 bye; 2-pool mode keeps |poolA − poolB| ≤ 1 per team. Regenerates once if invalid; falls back to single-pool if still invalid
- **Results Page Integration**: Completed Tournaments section appears at the bottom of Session History when history exists; each entry is a collapsible card showing date, team count, fixture count, winner badge, final standings (points), and per-team expandable sections showing `ratingBefore  ±netChange` rating change per player. No per-fixture breakdown. Fixture list always shown below standings with avg ratings per team and result outcomes.
- **Schedule Persistence**: Generated schedules are saved to `localStorage` key `activeTournamentSchedule` and schedule options (start time, duration, turnover, pools) to `tournamentScheduleOptions`; both are reloaded on page mount and cleared when the tournament is reset
- **Export to Image**: "Export as Image" button on tournament schedule uses html2canvas (scale 2x). "Export PNG" button on generate page exports the current teams view. Both download as PNG files
- **Avg Rating on Match Cards**: Normal (non-tournament) match cards in /results show "Avg NNN" below the Black and White score labels when showRatings is enabled; computed from player ratingUsed values at generation time

## Two Pools Mode
- **Pool Assignment**: Each selected player must be assigned to Pool A or Pool B before generation
- **Assignment UI**: A/B toggle buttons appear next to selected players (amber for Pool A, violet for Pool B)
- **Validation**: Generation blocked until all selected players are assigned; warnings shown for odd/insufficient player counts per pool
- **Generation**: Separate Black vs White teams generated for each pool independently
- **Confirm All**: Creates separate match records for Pool A and Pool B with slight timestamp offset for proper sorting
- **Pool Assignments Map**: Stored in workspace as `poolAssignments: Record<number, PoolAssignment>` where PoolAssignment is "A" | "B"
- **twoPoolsTeams**: Stores `{ poolA: StandardGeneratedTeams | null, poolB: StandardGeneratedTeams | null }`

## Intelligent Position Engine
- **Compatibility Matrix**: Formation-specific position compatibility scores (0-3 scale) determine how well a player's preferred position maps to each slot
- **Admin Settings**: `main_position_bonus` (default 4) and `alternate_position_bonus` (default 2) — configurable via sliders in Settings page (range 0-10)
- **Slot Targets**: Dynamic slot target counts based on formation and team size; extra players beyond base 6 are distributed by priority order
- **Assignment Algorithm**: Two-pass — specialists (no alternates) get their main position first, then remaining players assigned by highest compatibility score
- **Manual Move Reassignment**: When players are moved between teams or pools, all positions on affected teams are fully reassigned using the intelligent engine
- **Base Slot Structures**: 3-3: Forward(2), Centre(1), Half Back(2), Centre Back(1); 1-3-2: Forward(1), Wing(2), Centre(1), Back(2)

## Visibility Settings
- **Settings Storage**: Stored in context as `visibilitySettings: { showRatings: boolean, showPositions: boolean }`
- **Default Values**: Both `showRatings` and `showPositions` default to `true`
- **Settings UI**: Toggle switches in Settings page allow users to hide ratings and/or positions across all views
- **Applied Views**: Visibility settings are respected in generate.tsx (player selection list, team cards, player rows), results.tsx (match details with player ratings/positions), and players.tsx (rating avatars, off-hand badges, preferred positions section)
- **Use Case**: Allows coaches/organizers to hide skill ratings during team selection to reduce bias or hide position assignments

## Key Design Patterns
- **Mobile-First**: Bottom navigation bar, touch-optimized UI
- **Offline-First**: All data stored locally, no network dependency for core features
- **Component Architecture**: Shared UI components in `client/src/components/ui/`, page components in `client/src/pages/`
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

## Build System
- **Development**: Vite dev server with HMR, proxied through Express
- **Production**: Vite builds client to `dist/public/`, esbuild bundles server to `dist/index.cjs`
- **Database Migrations**: Drizzle Kit for schema management (`npm run db:push`)

# External Dependencies

## Database
- **PostgreSQL**: Configured via Drizzle ORM, requires `DATABASE_URL` environment variable
- **Connection**: Uses `pg` Pool with `connect-pg-simple` for session storage capability
- **Note**: Database is configured but not actively used - app currently runs on localStorage

## UI Libraries
- **Radix UI**: Headless component primitives (dialogs, dropdowns, tabs, etc.)
- **shadcn/ui**: Pre-styled component library (configured via `components.json`)
- **Lucide React**: Icon library
- **Embla Carousel**: Carousel functionality

## Replit-Specific
- **@replit/vite-plugin-runtime-error-modal**: Error overlay for development
- **@replit/vite-plugin-cartographer**: Development tooling (dev only)
- **@replit/vite-plugin-dev-banner**: Development banner (dev only)

## Validation & Forms
- **Zod**: Schema validation
- **drizzle-zod**: Zod schema generation from Drizzle schemas
- **React Hook Form**: Form state management with `@hookform/resolvers`

## Date Handling
- **date-fns**: Date formatting and manipulation