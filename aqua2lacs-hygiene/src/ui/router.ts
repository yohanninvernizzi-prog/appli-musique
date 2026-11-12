import { useSyncExternalStore } from "react";

/** Mini-routeur basé sur le « # » de l'adresse : le bouton Retour du téléphone fonctionne. */

function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

function getPath(): string {
  return window.location.hash.replace(/^#/, "") || "/";
}

export function useRoute(): string[] {
  const path = useSyncExternalStore(subscribe, getPath);
  return path.split("/").filter(Boolean);
}

export function go(path: string, replace = false): void {
  if (replace) {
    const url = `${window.location.pathname}${window.location.search}#${path}`;
    try {
      window.history.replaceState(null, "", url);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      return;
    } catch {
      // Contexte restreint : on retombe sur une navigation classique.
    }
  }
  window.location.hash = path;
}

export function back(fallback: string): void {
  if (window.history.length > 1) window.history.back();
  else go(fallback, true);
}
