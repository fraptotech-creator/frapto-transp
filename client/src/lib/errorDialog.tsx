import { useSyncExternalStore } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Store mínimo (pub/sub) para um diálogo de erro GLOBAL, centralizado na tela.
// Uso: showErrorDialog("mensagem", "Título"). Monte <ErrorDialogHost/> uma vez.

type ErrorState = { open: boolean; title: string; message: string };

let state: ErrorState = { open: false, title: "", message: "" };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(l => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function showErrorDialog(message: string, title = "Não foi possível") {
  state = { open: true, title, message: message || "Ocorreu um erro." };
  emit();
}

function closeErrorDialog() {
  state = { ...state, open: false };
  emit();
}

export function ErrorDialogHost() {
  const snap = useSyncExternalStore(subscribe, () => state);
  return (
    <AlertDialog open={snap.open} onOpenChange={o => !o && closeErrorDialog()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{snap.title}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-wrap">
            {snap.message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={closeErrorDialog}>
            Entendi
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
