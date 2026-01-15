import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMatches, saveMatch, deleteMatch } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";

export function useMatches() {
  return useQuery({
    queryKey: ["matches"],
    queryFn: getMatches,
  });
}

export function useSaveMatch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: saveMatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      toast({ title: "Match Saved", description: "The teams have been recorded in history." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save match.", variant: "destructive" });
    },
  });
}

export function useDeleteMatch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: deleteMatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      toast({ title: "Match Deleted", description: "Match history entry removed." });
    },
  });
}
