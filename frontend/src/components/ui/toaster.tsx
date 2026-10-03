import { useToast } from "@/hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function Toaster() {
  const { toasts, dismiss } = useToast();
  // Errors are a modal the user must acknowledge ("Got it"), not a toast that fades away.
  const error = toasts.find((t) => t.variant === "destructive" && t.open);

  return (
    <ToastProvider>
      {toasts
        .filter((t) => t.variant !== "destructive")
        .map(function ({ id, title, description, action, ...props }) {
          return (
            <Toast key={id} {...props}>
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
              {action}
              <ToastClose />
            </Toast>
          );
        })}
      <ToastViewport />
      <AlertDialog
        open={!!error}
        onOpenChange={(open) => !open && error && dismiss(error.id)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {error?.title || "Something went wrong"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {error?.description || "Please try again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Got it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ToastProvider>
  );
}
