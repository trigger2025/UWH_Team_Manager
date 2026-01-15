import { useState } from "react";
import { usePlayers } from "@/hooks/use-players";
import { useSaveMatch } from "@/hooks/use-matches";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { Player } from "@shared/schema";
import { Shuffle, Save, RotateCcw, Share2, Swords } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

type Team = {
  name: string;
  color: "white" | "black";
  players: Player[];
  avgRating: number;
};

export default function GeneratePage() {
  const { data: allPlayers, isLoading } = usePlayers();
  const saveMatchMutation = useSaveMatch();
  
  const [teams, setTeams] = useState<[Team, Team] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Filter only active players
  const activePlayers = allPlayers?.filter(p => p.active) || [];

  const generateTeams = async () => {
    if (activePlayers.length < 2) return;
    
    setIsGenerating(true);
    setTeams(null);

    // Simulate calculation delay for dramatic effect
    await new Promise(resolve => setTimeout(resolve, 800));

    // Simple balanced algorithm
    // 1. Sort by rating desc
    const sorted = [...activePlayers].sort((a, b) => b.rating - a.rating);
    
    // 2. Snake draft distribution
    const team1Players: Player[] = [];
    const team2Players: Player[] = [];
    
    sorted.forEach((player, index) => {
      // Snake: 0->A, 1->B, 2->B, 3->A, 4->A, 5->B...
      if (index % 4 === 0 || index % 4 === 3) {
        team1Players.push(player);
      } else {
        team2Players.push(player);
      }
    });

    const calcAvg = (ps: Player[]) => 
      ps.length ? ps.reduce((acc, p) => acc + p.rating, 0) / ps.length : 0;

    setTeams([
      { name: "White Team", color: "white", players: team1Players, avgRating: calcAvg(team1Players) },
      { name: "Black Team", color: "black", players: team2Players, avgRating: calcAvg(team2Players) },
    ]);
    
    setIsGenerating(false);
  };

  const handleSave = () => {
    if (!teams) return;
    saveMatchMutation.mutate({
      date: new Date().toISOString(),
      teams: teams
    });
  };

  return (
    <div className="min-h-screen bg-background pb-24 px-4 pt-6">
      <div className="max-w-md mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="text-center space-y-2 mb-8">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 mb-2">
            <Swords className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-display text-foreground">Match Generator</h1>
          <p className="text-muted-foreground">
            {activePlayers.length} Active Players Ready
          </p>
        </div>

        {/* Action Button */}
        {!teams && (
          <div className="flex justify-center">
            <Button 
              size="lg" 
              onClick={generateTeams}
              disabled={isGenerating || activePlayers.length < 2}
              className="h-16 px-8 rounded-2xl text-lg font-bold shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 transition-all active:scale-95"
            >
              {isGenerating ? (
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </div>
              ) : (
                <>
                  <Shuffle className="mr-2 h-5 w-5" />
                  Generate Teams
                </>
              )}
            </Button>
          </div>
        )}

        {/* Results Display */}
        <AnimatePresence>
          {teams && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="space-y-6"
            >
              {/* Teams Comparison */}
              <div className="flex justify-center gap-4 text-xs font-medium text-muted-foreground mb-4">
                <div className="bg-card px-3 py-1 rounded-full border border-white/5">
                  Avg: {teams[0].avgRating.toFixed(1)}
                </div>
                <div className="bg-card px-3 py-1 rounded-full border border-white/5">
                  Avg: {teams[1].avgRating.toFixed(1)}
                </div>
              </div>

              {/* White Team Card */}
              <TeamCard team={teams[0]} delay={0.1} />

              {/* VS Badge */}
              <div className="flex justify-center -my-3 relative z-10">
                <span className="bg-background border border-border px-3 py-1 rounded-full text-xs font-bold text-muted-foreground shadow-sm">
                  VS
                </span>
              </div>

              {/* Black Team Card */}
              <TeamCard team={teams[1]} delay={0.2} />

              {/* Action Bar */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="grid grid-cols-2 gap-3 pt-4"
              >
                <Button variant="outline" size="lg" onClick={generateTeams} className="h-12 border-primary/20 text-primary hover:bg-primary/5">
                  <RotateCcw className="mr-2 h-4 w-4" /> Reroll
                </Button>
                <Button size="lg" onClick={handleSave} disabled={saveMatchMutation.isPending} className="h-12">
                  <Save className="mr-2 h-4 w-4" /> 
                  {saveMatchMutation.isPending ? "Saving..." : "Save Match"}
                </Button>
              </motion.div>

            </motion.div>
          )}
        </AnimatePresence>

        {activePlayers.length < 2 && !teams && (
          <div className="text-center p-6 border border-dashed border-white/10 rounded-xl bg-white/5">
            <p className="text-muted-foreground text-sm">Not enough active players.</p>
            <Button variant="link" className="text-primary" onClick={() => window.location.href='/players'}>
              Go to Players Tab
            </Button>
          </div>
        )}

      </div>
      <BottomNav />
    </div>
  );
}

function TeamCard({ team, delay }: { team: Team, delay: number }) {
  const isWhite = team.color === 'white';
  
  return (
    <motion.div
      initial={{ opacity: 0, x: isWhite ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
    >
      <Card className={`
        border-none overflow-hidden shadow-lg
        ${isWhite ? 'bg-white text-slate-900' : 'bg-slate-900 text-white border border-white/10'}
      `}>
        <div className={`h-2 w-full ${isWhite ? 'bg-slate-200' : 'bg-slate-800'}`} />
        <CardHeader className="pb-2">
          <CardTitle className="flex justify-between items-center text-lg">
            <span>{team.name}</span>
            <Badge variant={isWhite ? "secondary" : "outline"} className="font-mono text-xs">
              {team.players.length} Players
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {team.players.map((p) => (
              <li key={p.id} className="flex justify-between items-center text-sm">
                <span className="font-medium opacity-90">{p.name}</span>
                <span className={`text-xs font-mono opacity-60 ${isWhite ? 'bg-slate-100' : 'bg-slate-800'} px-1.5 py-0.5 rounded`}>
                  {p.rating}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </motion.div>
  );
}
