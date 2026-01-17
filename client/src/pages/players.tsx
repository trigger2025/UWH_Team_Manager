import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { AddPlayerDialog } from "@/components/add-player-dialog";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  Trash2, 
  Edit, 
  Search, 
  MoreVertical,
  User,
  Plus,
  HandMetal,
  Sword,
  Shield,
  Tag
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Player } from "@shared/schema";

export default function PlayersPage() {
  const { players, updatePlayer, deletePlayer, visibilitySettings } = useApp();
  const { showRatings, showPositions } = visibilitySettings;
  const [search, setSearch] = useState("");
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [playerToDelete, setPlayerToDelete] = useState<Player | null>(null);
  
  const handleConfirmDelete = () => {
    if (playerToDelete) {
      deletePlayer(playerToDelete.id);
      setPlayerToDelete(null);
    }
  };

  const filteredPlayers = players
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleToggleActive = (id: number, active: boolean) => {
    updatePlayer(id, { active });
  };

  const handleEdit = (player: Player) => {
    setEditingPlayer(player);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50 px-6 py-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl text-foreground font-bold">Roster</h1>
          <div className="flex gap-2">
             <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              {players.filter(p => p.active).length} Active
            </Badge>
            <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
              {players.length} Total
            </Badge>
          </div>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search players..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-none ring-1 ring-white/10 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* List */}
      <div className="p-4 space-y-4">
        <AnimatePresence mode="popLayout">
          {filteredPlayers.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="text-center py-20 text-muted-foreground"
            >
              <div className="bg-card/50 rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-4 border border-border/50">
                <User className="h-10 w-10 opacity-20" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Empty Roster</h2>
              <p className="text-sm max-w-[200px] mx-auto mt-1">Start adding players to build your underwater hockey team.</p>
            </motion.div>
          ) : (
            filteredPlayers.map((player) => (
              <motion.div
                key={player.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className={`
                  relative overflow-hidden rounded-2xl border border-white/5 bg-card p-4
                  transition-all duration-300
                  ${player.active ? 'opacity-100 shadow-lg shadow-black/20' : 'opacity-50 grayscale'}
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    {/* Rating Avatar */}
                    {showRatings && (
                      <div className={`
                        h-12 w-12 rounded-xl flex flex-col items-center justify-center border border-white/10
                        ${player.active ? 'bg-gradient-to-br from-primary/30 to-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}
                      `}>
                        <span className="text-xl font-bold leading-none">{player.rating.toFixed(0)}</span>
                        <span className="text-[10px] uppercase font-bold tracking-tighter opacity-60">SR</span>
                      </div>
                    )}
                    
                    <div>
                      <h3 className="font-bold text-lg leading-tight flex items-center gap-2">
                        {player.name}
                        {!player.active && <Badge variant="secondary" className="text-[10px] h-4 px-1 leading-none uppercase">Off</Badge>}
                      </h3>
                      
                      {/* Stats Badges */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {showRatings && player.weakHandEnabled && player.weakHandRating !== null && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                            <HandMetal className="h-2.5 w-2.5" />
                            {player.weakHandRating}
                          </div>
                        )}
                        {player.tags.slice(0, 2).map(tag => (
                          <div key={tag} className="flex items-center gap-1 text-[10px] font-bold text-cyan-400 bg-cyan-400/5 px-2 py-0.5 rounded-full border border-cyan-400/10">
                            <Tag className="h-2.5 w-2.5" />
                            {tag}
                          </div>
                        ))}
                        {player.tags.length > 2 && (
                          <div className="text-[10px] font-bold text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">
                            +{player.tags.length - 2}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <Switch 
                      checked={player.active}
                      onCheckedChange={(checked) => handleToggleActive(player.id, checked)}
                      className="data-[state=checked]:bg-primary"
                    />
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-32 bg-card border-border shadow-2xl">
                        <DropdownMenuItem onClick={() => handleEdit(player)} className="gap-2">
                          <Edit className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive focus:bg-destructive/10 gap-2"
                          onClick={() => setPlayerToDelete(player)}
                          data-testid={`button-delete-player-${player.id}`}
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Preferred Positions Quick View */}
                {showPositions && player.active && (
                  <div className="mt-4 pt-3 border-t border-white/5 grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                      <Sword className="h-3 w-3 text-primary/60" />
                      <span className="truncate">3-3: {(player.formationPreferences as any)?.["3-3"]?.main || "None"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                      <Shield className="h-3 w-3 text-cyan-400/60" />
                      <span className="truncate">1-3-2: {(player.formationPreferences as any)?.["1-3-2"]?.main || "None"}</span>
                    </div>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Edit Dialog (Controlled) */}
      {editingPlayer && (
        <AddPlayerDialog 
          playerToEdit={editingPlayer} 
          open={!!editingPlayer} 
          onOpenChange={(open) => !open && setEditingPlayer(null)} 
        />
      )}
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!playerToDelete} onOpenChange={(open) => !open && setPlayerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Player</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {playerToDelete?.name}? This action cannot be undone and will remove all their rating history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-player-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-player-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* FAB */}
      <div className="fixed bottom-24 right-6 z-50">
        <AddPlayerDialog>
          <Button 
            size="icon" 
            className="h-16 w-16 rounded-full shadow-2xl shadow-primary/40 bg-primary hover:bg-primary/90 text-primary-foreground transition-all hover:scale-110 active:scale-95"
          >
            <Plus className="h-8 w-8" />
          </Button>
        </AddPlayerDialog>
      </div>

      <BottomNav />
    </div>
  );
}
