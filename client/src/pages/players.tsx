import { useState } from "react";
import { usePlayers, useUpdatePlayer, useDeletePlayer } from "@/hooks/use-players";
import { AddPlayerDialog } from "@/components/add-player-dialog";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  Trash2, 
  Edit, 
  Search, 
  Swords, 
  MoreVertical,
  User
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Player } from "@shared/schema";

export default function PlayersPage() {
  const { data: players, isLoading } = usePlayers();
  const updateMutation = useUpdatePlayer();
  const deleteMutation = useDeletePlayer();
  const [search, setSearch] = useState("");
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  const filteredPlayers = players?.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name)) || [];

  const handleToggleActive = (id: number, active: boolean) => {
    updateMutation.mutate({ id, active });
  };

  const handleEdit = (player: Player) => {
    setEditingPlayer(player);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground animate-pulse">Loading roster...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50 px-6 py-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl text-foreground">Team Roster</h1>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-3 py-1">
            {players?.filter(p => p.active).length} Active
          </Badge>
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
      <div className="p-4 space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredPlayers.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="text-center py-12 text-muted-foreground"
            >
              <User className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No players found.</p>
              <p className="text-sm">Add some players to get started.</p>
            </motion.div>
          ) : (
            filteredPlayers.map((player) => (
              <motion.div
                key={player.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`
                  relative overflow-hidden rounded-xl border border-white/5 bg-card p-4
                  transition-all duration-300
                  ${player.active ? 'opacity-100 shadow-md shadow-black/20' : 'opacity-60 bg-card/50 grayscale-[0.5]'}
                `}
              >
                {/* Active Indicator Strip */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${player.active ? 'bg-primary' : 'bg-white/10'}`} />

                <div className="flex items-center justify-between pl-3">
                  <div className="flex items-center gap-3">
                    <div className={`
                      h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm
                      ${player.active ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}
                    `}>
                      {player.rating}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg leading-tight">{player.name}</h3>
                      <p className="text-xs text-muted-foreground">{player.active ? 'Active' : 'Inactive'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={player.active}
                      onCheckedChange={(checked) => handleToggleActive(player.id, checked)}
                      className="data-[state=checked]:bg-primary"
                    />
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-32 bg-card border-border">
                        <DropdownMenuItem onClick={() => handleEdit(player)}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive focus:bg-destructive/10"
                          onClick={() => deleteMutation.mutate(player.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
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

      {/* FAB */}
      <div className="fixed bottom-24 right-6 z-50">
        <AddPlayerDialog>
          <Button 
            size="icon" 
            className="h-14 w-14 rounded-full shadow-xl shadow-primary/30 bg-primary hover:bg-primary/90 text-primary-foreground transition-transform hover:scale-110 active:scale-95"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </AddPlayerDialog>
      </div>

      <BottomNav />
    </div>
  );
}

// Icon helper
function Plus({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" height="24" viewBox="0 0 24 24" 
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
      className={className}
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}
