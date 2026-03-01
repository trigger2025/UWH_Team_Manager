import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Settings, 
  RefreshCw, 
  Trash2, 
  ShieldAlert,
  Zap,
  RotateCcw,
  Tag,
  X,
  AlertCircle,
  Eye,
  EyeOff,
  Crosshair
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { 
    adminSettings, 
    updateAdminSetting, 
    resetAllPlayerStats, 
    recalculatePlayerStatsFromResults,
    savedTags,
    deleteTag,
    isTagInUse,
    visibilitySettings,
    updateVisibilitySettings
  } = useApp();
  const { toast } = useToast();

  const kFactorSetting = adminSettings.find(s => s.key === "rating_strength");
  const currentKFactor = kFactorSetting ? parseInt(kFactorSetting.value as string) : 32;
  const [kFactorInput, setKFactorInput] = useState(currentKFactor.toString());

  const mainPosSetting = adminSettings.find(s => s.key === "main_position_bonus");
  const currentMainPosBonus = mainPosSetting ? parseInt(mainPosSetting.value as string) : 4;
  const altPosSetting = adminSettings.find(s => s.key === "alternate_position_bonus");
  const currentAltPosBonus = altPosSetting ? parseInt(altPosSetting.value as string) : 2;

  useEffect(() => {
    setKFactorInput(currentKFactor.toString());
  }, [currentKFactor]);

  const handleSliderChange = (value: number[]) => {
    const clamped = Math.min(Math.max(value[0], 0), 100);
    updateAdminSetting("rating_strength", clamped.toString());
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setKFactorInput(e.target.value);
  };

  const handleInputBlur = () => {
    const val = parseInt(kFactorInput);
    if (!isNaN(val)) {
      const clamped = Math.min(Math.max(val, 0), 100);
      updateAdminSetting("rating_strength", clamped.toString());
      setKFactorInput(clamped.toString());
    } else {
      setKFactorInput(currentKFactor.toString());
    }
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

  const handleDeleteTag = (tag: string) => {
    if (isTagInUse(tag)) {
      toast({
        title: "Cannot Delete Tag",
        description: `"${tag}" is currently in use by one or more players.`,
        variant: "destructive",
      });
      return;
    }
    
    const success = deleteTag(tag);
    if (success) {
      toast({
        title: "Tag Deleted",
        description: `"${tag}" has been removed from saved tags.`,
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
                <Label className="text-xs text-muted-foreground">K-Factor (Strength)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={kFactorInput}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    className="w-20 text-right font-mono font-bold text-primary"
                    min={0}
                    max={100}
                    data-testid="input-k-factor"
                  />
                </div>
              </div>
              <Slider 
                value={[currentKFactor]} 
                min={0} 
                max={100} 
                step={1} 
                onValueChange={handleSliderChange}
                data-testid="slider-k-factor"
              />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Higher values make ratings change more quickly after each game. Range: 0 (no change) to 100.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Crosshair className="h-4 w-4 text-emerald-500" />
              Position Assignment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-xs text-muted-foreground">Main Position Bonus</Label>
                <span className="font-mono font-bold text-primary text-sm" data-testid="text-main-pos-bonus">{currentMainPosBonus}</span>
              </div>
              <Slider
                value={[currentMainPosBonus]}
                min={0}
                max={10}
                step={1}
                onValueChange={(value) => updateAdminSetting("main_position_bonus", value[0].toString())}
                data-testid="slider-main-position-bonus"
              />
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-xs text-muted-foreground">Alternate Position Bonus</Label>
                <span className="font-mono font-bold text-primary text-sm" data-testid="text-alt-pos-bonus">{currentAltPosBonus}</span>
              </div>
              <Slider
                value={[currentAltPosBonus]}
                min={0}
                max={10}
                step={1}
                onValueChange={(value) => updateAdminSetting("alternate_position_bonus", value[0].toString())}
                data-testid="slider-alternate-position-bonus"
              />
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Higher values give stronger preference to players' main and alternate positions during team generation. Range: 0 (ignore preferences) to 10.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-4 w-4 text-cyan-500" />
              Tag Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {savedTags.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No tags saved yet. Tags are created when you add them to players.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {savedTags.map(tag => {
                  const inUse = isTagInUse(tag);
                  return (
                    <Badge 
                      key={tag} 
                      variant={inUse ? "secondary" : "outline"}
                      className="flex items-center gap-1.5 pr-1"
                      data-testid={`tag-item-${tag}`}
                    >
                      {tag}
                      <button
                        onClick={() => handleDeleteTag(tag)}
                        className={`ml-1 p-0.5 rounded-full transition-colors ${
                          inUse 
                            ? 'text-muted-foreground/50 cursor-not-allowed' 
                            : 'hover:bg-destructive/20 hover:text-destructive'
                        }`}
                        disabled={inUse}
                        data-testid={`button-delete-tag-${tag}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
            <div className="flex items-start gap-2 pt-2 text-[10px] text-muted-foreground">
              <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>Tags in use by players cannot be deleted. Remove them from all players first.</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4 text-green-500" />
              Display Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Show Ratings</Label>
                <p className="text-[10px] text-muted-foreground">Display player ratings across all views</p>
              </div>
              <Switch
                checked={visibilitySettings.showRatings}
                onCheckedChange={(checked) => updateVisibilitySettings({ showRatings: checked })}
                data-testid="switch-show-ratings"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Show Positions</Label>
                <p className="text-[10px] text-muted-foreground">Display player positions in team views</p>
              </div>
              <Switch
                checked={visibilitySettings.showPositions}
                onCheckedChange={(checked) => updateVisibilitySettings({ showPositions: checked })}
                data-testid="switch-show-positions"
              />
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
              data-testid="button-recalculate-ratings"
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
                data-testid="button-reset-stats"
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
