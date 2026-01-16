import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  insertPlayerSchema, 
  type InsertPlayer, 
  type Player, 
  FormationType, 
  FormationPosition33, 
  FormationPosition132 
} from "@shared/schema";
import { useApp } from "@/context/AppContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, User, X, Hand } from "lucide-react";

interface AddPlayerDialogProps {
  playerToEdit?: Player;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

const normalizeTag = (tag: string) => tag.trim().toLowerCase();

export function AddPlayerDialog({ playerToEdit, open: controlledOpen, onOpenChange: controlledOnOpenChange, children }: AddPlayerDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setUncontrolledOpen;

  const { addPlayer, updatePlayer, savedTags } = useApp();
  const isEditing = !!playerToEdit;

  const form = useForm<InsertPlayer>({
    resolver: zodResolver(insertPlayerSchema),
    defaultValues: playerToEdit ? {
      name: playerToEdit.name,
      rating: playerToEdit.rating,
      weakHandEnabled: playerToEdit.weakHandEnabled ?? false,
      weakHandRating: playerToEdit.weakHandRating ?? 300,
      active: playerToEdit.active,
      tags: playerToEdit.tags,
      formationPreferences: playerToEdit.formationPreferences as any,
    } : {
      name: "",
      rating: 500,
      weakHandEnabled: false,
      weakHandRating: 300,
      active: true,
      tags: [],
      formationPreferences: {
        "3-3": { main: "Forward", alternates: [] },
        "1-3-2": { main: "Forward", alternates: [] }
      } as any,
    },
  });

  const [tagInput, setTagInput] = useState("");
  const [ratingInputStr, setRatingInputStr] = useState((playerToEdit?.rating ?? 500).toString());
  const [weakHandInputStr, setWeakHandInputStr] = useState((playerToEdit?.weakHandRating ?? 300).toString());

  useEffect(() => {
    if (open) {
      setRatingInputStr((form.getValues("rating") ?? 500).toString());
      setWeakHandInputStr((form.getValues("weakHandRating") ?? 300).toString());
    }
  }, [open, form]);

  const watchedRating = form.watch("rating");
  const watchedWeakHand = form.watch("weakHandRating");
  const watchedWeakHandEnabled = form.watch("weakHandEnabled");

  useEffect(() => {
    if (watchedRating !== undefined && watchedRating.toString() !== ratingInputStr) {
      if (document.activeElement?.id !== "rating-input") {
        setRatingInputStr(watchedRating.toString());
      }
    }
  }, [watchedRating]);

  useEffect(() => {
    if (watchedWeakHand !== undefined && watchedWeakHand?.toString() !== weakHandInputStr) {
      if (document.activeElement?.id !== "weakhand-input") {
        setWeakHandInputStr((watchedWeakHand ?? 300).toString());
      }
    }
  }, [watchedWeakHand]);

  const tagSuggestions = useMemo(() => {
    if (!tagInput.trim()) return [];
    const currentTags = (form.getValues("tags") || []).map(normalizeTag);
    const normalizedInput = normalizeTag(tagInput);
    return savedTags.filter(t => {
      const norm = normalizeTag(t);
      return norm.includes(normalizedInput) && !currentTags.includes(norm);
    }).slice(0, 5);
  }, [tagInput, savedTags, form]);

  const addTag = (tagToAdd?: string) => {
    const tag = (tagToAdd || tagInput).trim();
    if (!tag) return;
    const currentTags = form.getValues("tags") || [];
    const normalizedCurrent = currentTags.map(normalizeTag);
    if (!normalizedCurrent.includes(normalizeTag(tag))) {
      form.setValue("tags", [...currentTags, tag]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    const currentTags = form.getValues("tags") || [];
    form.setValue("tags", currentTags.filter(t => t !== tag));
  };

  const handleRatingInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRatingInputStr(e.target.value);
  };

  const handleRatingInputBlur = () => {
    const val = parseInt(ratingInputStr);
    if (!isNaN(val)) {
      const clamped = Math.min(Math.max(val, 0), 1000);
      form.setValue("rating", clamped);
      setRatingInputStr(clamped.toString());
    } else {
      setRatingInputStr((form.getValues("rating") ?? 500).toString());
    }
  };

  const handleWeakHandInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWeakHandInputStr(e.target.value);
  };

  const handleWeakHandInputBlur = () => {
    const val = parseInt(weakHandInputStr);
    if (!isNaN(val)) {
      const clamped = Math.min(Math.max(val, 0), 1000);
      form.setValue("weakHandRating", clamped);
      setWeakHandInputStr(clamped.toString());
    } else {
      setWeakHandInputStr((form.getValues("weakHandRating") ?? 300).toString());
    }
  };

  const onSubmit = (data: InsertPlayer) => {
    const submitData = {
      ...data,
      weakHandRating: data.weakHandEnabled ? data.weakHandRating : null
    };
    if (isEditing && playerToEdit) {
      updatePlayer(playerToEdit.id, submitData);
      setOpen(false);
    } else {
      addPlayer(submitData);
      setOpen(false);
      form.reset();
    }
  };

  const getPositionsForFormation = (type: FormationType) => {
    if (type === "3-3") return Object.values(FormationPosition33.Values);
    if (type === "1-3-2") return Object.values(FormationPosition132.Values);
    return [];
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="icon" className="h-14 w-14 rounded-full shadow-lg shadow-primary/25 bg-primary hover:scale-105 transition-transform">
            <Plus className="h-6 w-6 text-primary-foreground" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display">
            {isEditing ? "Edit Player" : "New Player"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="formations">Formations</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-muted-foreground">Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="name" 
                    placeholder="Enter player name" 
                    className="pl-9 bg-background/50 border-input focus:border-primary transition-colors h-10"
                    data-testid="input-player-name"
                    {...form.register("name")}
                  />
                </div>
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-muted-foreground">Main Rating</Label>
                  <Input
                    id="rating-input"
                    type="number"
                    value={ratingInputStr}
                    onChange={handleRatingInputChange}
                    onBlur={handleRatingInputBlur}
                    className="w-20 text-right font-mono font-bold text-primary"
                    min={0}
                    max={1000}
                    data-testid="input-player-rating"
                  />
                </div>
                <Slider
                  min={0}
                  max={1000}
                  step={10}
                  value={[form.watch("rating") ?? 500]}
                  onValueChange={(val) => form.setValue("rating", val[0])}
                />
              </div>

              <div className="p-4 rounded-lg border border-border/50 bg-background/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Hand className="h-4 w-4 text-cyan-400" />
                    <Label className="text-muted-foreground">Off-hand Rating</Label>
                  </div>
                  <Switch
                    checked={watchedWeakHandEnabled ?? false}
                    onCheckedChange={(checked) => form.setValue("weakHandEnabled", checked)}
                    data-testid="switch-weak-hand-enabled"
                  />
                </div>
                {watchedWeakHandEnabled && (
                  <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex justify-end">
                      <Input
                        id="weakhand-input"
                        type="number"
                        value={weakHandInputStr}
                        onChange={handleWeakHandInputChange}
                        onBlur={handleWeakHandInputBlur}
                        className="w-20 text-right font-mono font-bold text-cyan-400"
                        min={0}
                        max={1000}
                        data-testid="input-weak-hand-rating"
                      />
                    </div>
                    <Slider
                      min={0}
                      max={1000}
                      step={10}
                      value={[form.watch("weakHandRating") ?? 300]}
                      onValueChange={(val) => form.setValue("weakHandRating", val[0])}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Tags</Label>
                <div className="relative">
                  <div className="flex gap-2">
                    <Input 
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="Add tag (e.g. Captain, Fast)"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      className="bg-background/50"
                      data-testid="input-tag"
                    />
                    <Button type="button" onClick={() => addTag()} variant="secondary" data-testid="button-add-tag">Add</Button>
                  </div>
                  {tagSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-14 mt-1 bg-card border border-border rounded-md shadow-lg z-50">
                      {tagSuggestions.map(suggestion => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => addTag(suggestion)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors first:rounded-t-md last:rounded-b-md"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(form.watch("tags") || []).map(tag => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(tag)} />
                    </Badge>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="formations" className="space-y-6">
              {["3-3", "1-3-2"].map((fType) => {
                const formation = fType as FormationType;
                const prefs = (form.watch("formationPreferences") as any) || {};
                const pref = prefs[formation] || { main: "Forward", alternates: [] };
                const availablePositions = getPositionsForFormation(formation);
                
                return (
                  <div key={formation} className="p-4 rounded-lg border border-border/50 bg-background/30 space-y-4">
                    <h4 className="font-bold text-primary flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      Formation {formation}
                    </h4>
                    
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Main Position</Label>
                      <Select 
                        value={pref.main} 
                        onValueChange={(val) => {
                          const currentPrefs = (form.getValues("formationPreferences") as any) || {};
                          form.setValue("formationPreferences", {
                            ...currentPrefs,
                            [formation]: { ...pref, main: val }
                          } as any);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availablePositions.map(pos => <SelectItem key={pos} value={pos}>{pos}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Alternate Positions</Label>
                      <div className="flex flex-wrap gap-2">
                        {(pref.alternates || []).map((pos: string) => (
                          <Badge key={pos} variant="outline" className="flex items-center gap-1">
                            {pos}
                            <X className="h-3 w-3 cursor-pointer" onClick={() => {
                              const currentPrefs = (form.getValues("formationPreferences") as any) || {};
                              form.setValue("formationPreferences", {
                                ...currentPrefs,
                                [formation]: { ...pref, alternates: pref.alternates.filter((a: string) => a !== pos) }
                              } as any);
                            }} />
                          </Badge>
                        ))}
                        {(pref.alternates || []).length < 3 && (
                          <Select onValueChange={(val) => {
                            if (!pref.alternates.includes(val)) {
                              const currentPrefs = (form.getValues("formationPreferences") as any) || {};
                              form.setValue("formationPreferences", {
                                ...currentPrefs,
                                [formation]: { ...pref, alternates: [...pref.alternates, val] }
                              } as any);
                            }
                          }}>
                            <SelectTrigger className="w-full h-8 border-dashed">
                              <SelectValue placeholder="+ Add Alternate" />
                            </SelectTrigger>
                            <SelectContent>
                              {availablePositions.map(pos => <SelectItem key={pos} value={pos}>{pos}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-12 rounded-xl transition-all active:scale-[0.98]"
              data-testid="button-submit-player"
            >
              {isEditing ? "Save Changes" : "Create Player"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
