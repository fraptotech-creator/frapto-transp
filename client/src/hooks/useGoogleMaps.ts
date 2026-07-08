/// <reference types="google.maps" />
import { useEffect, useState } from "react";

let loadPromise: Promise<void> | null = null;

function loadScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Falha ao carregar Google Maps"));
    document.head.appendChild(s);
  });
  return loadPromise;
}

/** Carrega a API JS do Google Maps uma única vez, com a chave dada. */
export function useGoogleMaps(apiKey: string | undefined) {
  const [loaded, setLoaded] = useState<boolean>(
    () => typeof window !== "undefined" && Boolean(window.google?.maps)
  );
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!apiKey || loaded) return;
    loadScript(apiKey)
      .then(() => setLoaded(true))
      .catch(() => setError(true));
  }, [apiKey, loaded]);

  return { loaded, error };
}
