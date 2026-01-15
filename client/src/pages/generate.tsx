import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { generateTeams } from "@/lib/team-logic";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Users, 
  Swords, 
  RefreshCw, 
  ChevronRight,
  UserCheck,
  Trophy,
  History
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GeneratedTeam, Player } from "@shared/schema";

export default function GeneratePage() {
  const { players, saveMatchResult } = useApp();
  const [selectedIds, setSelectedIds] = useState<number[]>(() => 
    players.filter(p => p.active).map(p => p.id)
  );
  const [generatedTeams, setGeneratedTeams] = useState<{ black: GeneratedTeam; white: GeneratedTeam } | null>(null);

  const activePlayers = players.filter(p => p.active);

  const togglePlayer = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleGenerate = () => {
    const selectedPlayers = players.filter(p => selectedIds.includes(p.id));
    if (selectedPlayers.length < 2) return;

    const result = generateTeams(selectedPlayers, { black: "3-3", white: "3-3" });
    setGeneratedTeams(result);
  };

  const handleSaveResult = () => {
    if (!generatedTeams) return;
    saveMatchResult({
      date: new Date(),
      teams: generatedTeams,
      completed: false,
      poolId: null,
      formation: "3-3",
      blackScore: null,
      whiteScore: null,
      tournamentId: null,
    });
    // Optional: show toast or redirect
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50 px-6 py-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Swords className="h-6 w-6 text-primary" />
          Generate Teams
        </h1>
      </div>

      <div className="p-4 space-y-6">
        <AnimatePresence mode="wait">
          {!generatedTeams ? (
            <motion.div
              key="selection"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <Card className="border-border/50 bg-card/50">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      Select Players ({selectedIds.length})
                    </CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSelectedIds(activePlayers.map(p => p.id))}
                      className="text-xs h-7"
                    >
                      Select All Active
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-2">
                  {activePlayers.map(player => (
                    <div 
                      key={player.id}
                      onClick={() => togglePlayer(player.id)}
                      className={`
                        flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer
                        ${selectedIds.includes(player.id) 
                          ? 'bg-primary/10 border-primary/30' 
                          : 'bg-background/50 border-transparent hover:border-border'}
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`
                          h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs
                          ${selectedIds.includes(player.id) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                        `}>
                          {player.rating.toFixed(0)}
                        </div>
                        <span className="font-medium">{player.name}</span>
                      </div>
                      <Checkbox checked={selectedIds.includes(player.id)} />
                    </div>
                  ))}
                  {activePlayers.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">No active players in roster.</p>
                      <p className="text-xs">Go to Players tab to activate some.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Button 
                className="w-full h-14 rounded-2xl text-lg font-bold gap-2 shadow-lg shadow-primary/20"
                disabled={selectedIds.length < 2}
                onClick={handleGenerate}
              >
                <RefreshCw className="h-5 w-5" />
                Generate {selectedIds.length} Players
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 gap-4">
                {/* Black Team */}
                <Card className="border-primary/20 bg-card overflow-hidden">
                  <div className="bg-primary/10 px-4 py-3 flex justify-between items-center border-b border-primary/10">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
                      <h3 className="font-bold text-primary">Team Black</h3>
                    </div>
                    <Badge variant="outline" className="bg-background/50">
                      Avg: {(generatedTeams.black.totalRating / (generatedTeams.black.players.length || 1)).toFixed(1)}
                    </Badge>
                  </div>
                  <CardContent className="p-0">
                    {generatedTeams.black.players.map((p, i) => (
                      <div key={p.id} className={`flex items-center justify-between px-4 py-3 ${i !== generatedTeams.black.players.length - 1 ? 'border-b border-border/30' : ''}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono opacity-40">#{i+1}</span>
                          <span className="font-medium">{p.name}</span>
                        </div>
                        <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-tight">
                          {p.assignedPosition}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <div className="flex items-center justify-center">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-xs font-bold text-muted-foreground">VS</span>
                  </div>
                </div>

                {/* White Team */}
                <Card className="border-cyan-400/20 bg-card overflow-hidden">
                  <div className="bg-cyan-400/10 px-4 py-3 flex justify-between items-center border-b border-cyan-400/10">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-cyan-400" />
                      <h3 className="font-bold text-cyan-400">Team White</h3>
                    </div>
                    <Badge variant="outline" className="bg-background/50">
                      Avg: {(generatedTeams.white.totalRating / (generatedTeams.white.players.length || 1)).toFixed(1)}
                    </Badge>
                  </div>
                  <CardContent className="p-0">
                    {generatedTeams.white.players.map((p, i) => (
                      <div key={p.id} className={`flex items-center justify-between px-4 py-3 ${i !== generatedTeams.white.players.length - 1 ? 'border-b border-border/30' : ''}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono opacity-40">#{i+1}</span>
                          <span className="font-medium">{p.name}</span>
                        </div>
                        <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-tight">
                          {p.assignedPosition}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-col gap-3">
                <Button 
                  variant="outline" 
                  className="w-full h-12 rounded-xl gap-2"
                  onClick={() => setGeneratedTeams(null)}
                >
                  <History className="h-4 w-4" />
                  Reselect Players
                </Button>
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="secondary"
                    className="h-12 rounded-xl gap-2"
                    onClick={handleGenerate}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Re-roll
                  </Button>
                  <Button 
                    className="h-12 rounded-xl gap-2"
                    onClick={handleSaveResult}
                  >
                    <UserCheck className="h-4 w-4" />
                    Confirm
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNav />
    </div>
  );
}
