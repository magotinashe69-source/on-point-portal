import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Send } from "lucide-react";
import type { Assignment } from "@shared/schema";

// The one-tap "Publish" button for a draft assignment, plus its small
// "are you sure?" check so a draft is never released by accident.
//
// Publishing does one thing: it marks the assignment as live. From that moment
// it behaves exactly like an assignment created the normal way — the assigned
// students see it, can submit, and auto-marking works as usual.
export function PublishAssignmentButton({
  assignment,
  size = "sm",
  className = "",
}: {
  assignment: Assignment;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const { toast } = useToast();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const publishMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/assignments/${assignment.id}/publish`, {});
      return response.json();
    },
    onSuccess: (data) => {
      if (!data.success) {
        toast({ title: "Couldn't publish", description: data.message || "Please try again.", variant: "destructive" });
        return;
      }
      setIsConfirmOpen(false);
      toast({
        title: "Published!",
        description: `"${assignment.title}" is now visible to ${assignment.form}.`,
      });
      // Refresh every list that shows assignments (teacher's and students').
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
    },
    onError: () => {
      toast({ title: "Couldn't publish", description: "Please try again.", variant: "destructive" });
    },
  });

  return (
    <>
      <Button
        size={size}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsConfirmOpen(true);
        }}
        disabled={publishMutation.isPending}
        className={`font-bold text-white shadow-md hover:opacity-90 ${className}`}
        style={{ backgroundColor: "#BF9000" }}
        data-testid={`button-publish-${assignment.id}`}
      >
        {publishMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-1" />
        ) : (
          <Send className="h-4 w-4 mr-1" />
        )}
        Publish
      </Button>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent data-testid={`dialog-publish-${assignment.id}`}>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish this assignment to {assignment.form} now?</AlertDialogTitle>
            <AlertDialogDescription>
              "{assignment.title}" will appear for {assignment.form} straight away and
              students can start submitting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid={`button-publish-cancel-${assignment.id}`}>
              Not yet
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Keep the dialog open while it saves, so the spinner is visible.
                e.preventDefault();
                publishMutation.mutate();
              }}
              disabled={publishMutation.isPending}
              data-testid={`button-publish-confirm-${assignment.id}`}
            >
              {publishMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Yes, publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
