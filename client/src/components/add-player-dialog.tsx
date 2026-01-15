import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPlayerSchema, type InsertPlayer, type Player } from "@shared/schema";
import { useApp } from "@/context/AppContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Plus, User } from "lucide-react";

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
      active: playerToEdit.active,
    } : {
      name: "",
      rating: 5,
      active: true,
    },
  });

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="icon" className="h-14 w-14 rounded-full shadow-lg shadow-primary/25 bg-gradient-to-tr from-primary to-cyan-400 hover:scale-105 transition-transform">
            <Plus className="h-6 w-6 text-primary-foreground" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display">
            {isEditing ? "Edit Player" : "New Player"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
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

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-muted-foreground">Rating</Label>
              <span className="text-2xl font-display font-bold text-primary">
                {form.watch("rating") ?? 5}
              </span>
            </div>
            <Slider
              min={1}
              max={10}
              step={1}
              value={[form.watch("rating") ?? 5]}
              onValueChange={(val) => form.setValue("rating", val[0])}
              className="py-4"
            />
            <div className="flex justify-between text-xs text-muted-foreground px-1">
              <span>Novice</span>
              <span>Pro</span>
            </div>
          </div>

          <DialogFooter>
            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11 rounded-lg transition-all active:scale-[0.98]"
            >
              {isEditing ? "Save Changes" : "Add Player"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
