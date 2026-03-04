# Overview

This is an Underwater Hockey (UWH) team management application designed to help manage player rosters, generate balanced teams for matches, and track match history. It features a mobile-first design and operates as an offline-first application, persisting all data locally using `localStorage`. The project aims to provide comprehensive tools for UWH team organization without relying on external backend API calls for its core functionalities.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
- **Framework**: React with TypeScript, bundled via Vite.
- **Routing**: Wouter for lightweight client-side routing.
- **State Management**: React Query for async state management (with `localStorage`), React Context for global app state.
- **UI Components**: `shadcn/ui` built on Radix UI, styled with Tailwind CSS (oceanic/nautical dark theme).
- **Animations**: Framer Motion for smooth transitions.
- **Forms**: React Hook Form with Zod validation.

## Backend
- **Framework**: Express.js with TypeScript.
- **Purpose**: Primarily serves static files in production and the Vite dev server in development. It's designed to be minimal as the application is local-only with `localStorage` persistence.

## Data Persistence
- **Primary Storage**: Browser `localStorage`.
- **Data Models**: Players, Matches, Admin Settings, Pool Rotation History, Preset Teams, Saved Tags.
- **Migration**: Automated migration of old player data to new formats.

## Player Management
- **Ratings**: 0-1000 integer scale with optional off-hand ratings.
- **Tags**: Global tag system with autocomplete, normalization, and deduplication.
- **Formation Preferences**: Per-formation position preferences for various formations (e.g., 3-3, 1-3-2).

## Team Generation System
- **Generation Workspace**: Persists state across navigation for selected players, off-hand selections, generated teams, and pool assignments.
- **Formations**: Supports 3-3 and 1-3-2 formations with distinct positions; allows independent formation selection for Black and White teams.
- **Player Selection**: Players must be explicitly selected; off-hand ratings can be toggled per player.
- **Team Sizing**: Dynamically splits players evenly across teams.
- **Re-roll**: Provides different team arrangements through random jitter and snake draft.
- **Team Templates**: Saves structural templates of generated teams for later reuse.
- **Match Snapshots**: Captures player ratings and positions at the time of match generation.
- **Rating System**: Delta-based rating adjustments on match completion, with reversal on deletion.
- **Pool Movement**: Allows players to be moved between Pool A and Pool B post-generation.
- **Modes**: Standard, Two Pools, and Tournament modes.
- **Intelligent Position Engine**: Assigns positions based on a compatibility matrix and configurable bonuses, ensuring balanced distribution.

## Tournament Mode
- **Generation**: Creates 2-6 teams from selected players using snake draft, naming teams after their highest-rated player.
- **Player Snapshots**: Records player ratings at the start of a tournament for consistent rating adjustments.
- **Fixtures**: Generates round-robin fixtures, displayed with real-time standings and result recording.
- **Finalization**: Applies Elo rating changes (with a 70% K-factor) to players upon tournament finalization.
- **Schedule Generator**: Creates time-based schedules for 1 or 2 concurrent pools, balancing team appearances.
- **History**: Saves finalized tournaments to a separate `localStorage` key and integrates with the results page.
- **Export**: Allows exporting tournament schedules and generated teams as PNG images.

## Tournament Team Roster Editing
- **Condition**: Only available when `tournament.finalised === false`
- **Location**: Standings section on /tournament — each team row is clickable to expand/collapse
- **One at a time**: Only one team expanded at a time; expanding a new row collapses the previous
- **Player list**: Expanded panel shows all players with rating; each has a ✕ remove button
- **Add Player**: "+ Add Player" button opens an inline searchable picker showing all master-list players not already assigned to any tournament team
- **Live avg**: Team average rating in the standings header row updates reactively as players are added/removed
- **Snapshot management**: `updateTournamentTeamRoster` in AppContext updates `playerSnapshots` — adds snapshots for newly added players (from current ratings), removes snapshots for removed players
- **Rating safety**: No actual rating changes until `finaliseTournament()` is called

## Editable Pending Matches
- **Functionality**: Allows editing player rosters within pending matches directly from the results page.
- **Updates**: Live updates to team player counts and average ratings as players are added or removed.

## Two Pools Mode
- **Assignment**: Requires players to be assigned to Pool A or Pool B before generation.
- **Generation**: Independently generates Black vs. White teams for each pool.
- **Confirmation**: Creates separate match records for each pool.

## Visibility Settings
- **Configuration**: Allows users to toggle visibility of ratings and positions across various app views (e.g., player selection, team cards, match details).

## Key Design Patterns
- **Mobile-First**: Optimized for touch interfaces with a bottom navigation bar.
- **Offline-First**: Core functionality operates without network dependency.
- **Component Architecture**: Organized UI components and page components.

# External Dependencies

## Database
- **PostgreSQL**: Configured via Drizzle ORM (for potential future use), requires `DATABASE_URL`.
- **Note**: Currently, the application relies on `localStorage` and does not actively use the database.

## UI Libraries
- **Radix UI**: Headless component primitives.
- **shadcn/ui**: Pre-styled component library.
- **Lucide React**: Icon library.
- **Embla Carousel**: Carousel functionality.

## Validation & Forms
- **Zod**: Schema validation.
- **drizzle-zod**: Zod schema generation from Drizzle schemas.
- **React Hook Form**: Form state management.

## Date Handling
- **date-fns**: Date formatting and manipulation.