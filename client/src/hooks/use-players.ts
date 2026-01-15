import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPlayers, createPlayer, updatePlayer, deletePlayer } from "@/lib/storage";
import { type InsertPlayer } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function usePlayers() {
  return useQuery({
    queryKey: ["players"],
    queryFn: getPlayers,
  });
}

export function useCreatePlayer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: InsertPlayer) => createPlayer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players"] });
      toast({ title: "Player added", description: "Successfully added to the roster." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add player.", variant: "destructive" });
    },
  });
}

export function useUpdatePlayer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, ...updates }: { id: number } & Partial<InsertPlayer>) => 
      updatePlayer(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players"] });
      // Suppress toast for quick toggles to avoid spam, maybe add logic?
      // For now, only toast on full edits if we were distinguishing, but here we just toast.
      // Actually, for active toggle it's nice to be silent or subtle.
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update player.", variant: "destructive" });
    },
  });
}

export function useDeletePlayer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: number) => deletePlayer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players"] });
      toast({ title: "Player removed", description: "They have been removed from the roster." });
    },
  });
}
