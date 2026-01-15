import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPlayerSchema, type InsertPlayer, type Player, FormationType, FormationPosition } from "@shared/schema";
import { useApp } from "@/context/AppContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, User, X } from "lucide-react";

interface AddPlayerDialogProps {
  playerToEdit?: Player;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function AddPlayerDialog({ playerToEdit, open: controlledOpen, onOpenChange: controlledOnOpenChange, children }: AddPlayerDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setUncontrolledOpen;

  const { addPlayer, updatePlayer } = useApp();
  const isEditing = !!playerToEdit;

  const form = useForm<InsertPlayer>({
    resolver: zodResolver(insertPlayerSchema),
    defaultValues: playerToEdit ? {
      name: playerToEdit.name,
      rating: playerToEdit.rating,
      weakHandRating: playerToEdit.weakHandRating,
      active: playerToEdit.active,
      tags: playerToEdit.tags,
      formationPreferences: playerToEdit.formationPreferences as any,
    } : {
      name: "",
      rating: 5,
      weakHandRating: 3,
      active: true,
      tags: [],
      formationPreferences: {
        "3-3": { main: "Center Forward", alternates: [] },
        "1-3-2": { main: "Goalie", alternates: [] }
      } as any,
    },
  });

  const [tagInput, setTagInput] = useState("");

  const addTag = () => {
    const currentTags = form.getValues("tags") || [];
    if (tagInput && !currentTags.includes(tagInput)) {
      form.setValue("tags", [...currentTags, tagInput]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    const currentTags = form.getValues("tags") || [];
    form.setValue("tags", currentTags.filter(t => t !== tag));
  };

  const onSubmit = (data: InsertPlayer) => {
    if (isEditing && playerToEdit) {
      updatePlayer(playerToEdit.id, data);
      setOpen(false);
    } else {
      addPlayer(data);
      setOpen(false);
      form.reset();
    }
  };

  const positions: FormationPosition[] = [
    "Left Wing", "Center Forward", "Right Wing",
    "Left Mid", "Center Mid", "Right Mid",
    "Left Back", "Full Back", "Right Back", "Goalie"
  ];

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
                    {...form.register("name")}
                  />
                </div>
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-muted-foreground">Main Rating</Label>
                    <span className="text-xl font-display font-bold text-primary">
                      {(form.watch("rating") ?? 5).toFixed(1)}
                    </span>
                  </div>
                  <Slider
                    min={1}
                    max={10}
                    step={0.5}
                    value={[form.watch("rating") ?? 5]}
                    onValueChange={(val) => form.setValue("rating", val[0])}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-muted-foreground">Weak Hand</Label>
                    <span className="text-xl font-display font-bold text-cyan-400">
                      {(form.watch("weakHandRating") ?? 3).toFixed(1)}
                    </span>
                  </div>
                  <Slider
                    min={1}
                    max={10}
                    step={0.5}
                    value={[form.watch("weakHandRating") ?? 3]}
                    onValueChange={(val) => form.setValue("weakHandRating", val[0])}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Tags</Label>
                <div className="flex gap-2">
                  <Input 
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Add tag (e.g. Captain, Fast)"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    className="bg-background/50"
                  />
                  <Button type="button" onClick={addTag} variant="secondary">Add</Button>
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
                const pref = prefs[formation] || { main: "Center Forward", alternates: [] };
                
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
                          {positions.map(pos => <SelectItem key={pos} value={pos}>{pos}</SelectItem>)}
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
                              {positions.map(pos => <SelectItem key={pos} value={pos}>{pos}</SelectItem>)}
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
            >
              {isEditing ? "Save Changes" : "Create Player"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
