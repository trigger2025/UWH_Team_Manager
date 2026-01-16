import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { 
  Settings, 
  RefreshCw, 
  Trash2, 
  ShieldAlert,
  Zap,
  RotateCcw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { 
    adminSettings, 
    updateAdminSettings, 
    resetAllPlayerStats, 
    recalculatePlayerStatsFromResults 
  } = useApp();
  const { toast } = useToast();

  const kFactor = parseInt(adminSettings.find(s => s.key === "rating_strength")?.value || "32");

  const handleKFactorChange = (value: number[]) => {
    const newSettings = adminSettings.filter(s => s.key !== "rating_strength");
    newSettings.push({ key: "rating_strength", value: value[0].toString() });
    updateAdminSettings(newSettings);
  };

  const handleRecalculate = () => {
    recalculatePlayerStatsFromResults();
    toast({
      title: "Ratings Recalculated",
      description: "All player ratings have been rebuilt from match history.",
    });
  };

  const handleReset = () => {
    if (confirm("Are you sure? This will wipe all player wins/losses and history. Match results will remain.")) {
      resetAllPlayerStats();
      toast({
        title: "Stats Reset",
        description: "All player statistics have been cleared.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 px-4 pt-6">
      <div className="max-w-md mx-auto space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-6">
          <Settings className="h-6 w-6 text-primary" />
          Settings
        </h1>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              Rating Sensitivity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-xs text-muted-foreground">K-Factor (Current: {kFactor})</Label>
                <span className="text-xs font-mono font-bold text-primary">{kFactor}</span>
              </div>
              <Slider 
                value={[kFactor]} 
                min={1} 
                max={100} 
                step={1} 
                onValueChange={handleKFactorChange}
              />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Higher values make ratings change more quickly after each game. Standard Elo uses 32.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-blue-500" />
              Data Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2 h-11"
              onClick={handleRecalculate}
            >
              <RotateCcw className="h-4 w-4" />
              Recalculate Ratings
            </Button>
            <p className="text-[10px] text-muted-foreground px-1">
              Rebuilds all player ratings from scratch using the current match history.
            </p>
            
            <div className="pt-4 border-t border-border/30 mt-4">
              <Button 
                variant="ghost" 
                className="w-full justify-start gap-2 h-11 text-destructive hover:bg-destructive/10"
                onClick={handleReset}
              >
                <Trash2 className="h-4 w-4" />
                Reset Player Stats
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/10 flex gap-3">
          <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-destructive uppercase tracking-wider">Danger Zone</p>
            <p className="text-[10px] text-muted-foreground">
              These actions cannot be undone. Always double-check before proceeding.
            </p>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
