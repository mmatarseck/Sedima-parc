"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";

/* ============================================================================
 * « Une nouvelle version de SEDIMA Parc est disponible — Actualiser ».
 *
 * Métier, 3 octobre 2026 : « un message en bannière ou en popup qui dit à
 * l'utilisateur qu'il y a une nouvelle version de l'app et qu'il peut
 * rafraîchir ». Une page ouverte depuis le matin continue de tourner sur le
 * code de son chargement : après une mise en production, elle ne voit ni les
 * nouveaux écrans ni les corrections, et peut écrire selon d'anciennes règles.
 *
 * La page retient la version qu'elle a trouvée en arrivant (`/api/version`, le
 * commit déployé) et la relit toutes les cinq minutes, et à chaque retour sur
 * l'onglet ou sur l'application du téléphone. Une version différente : le
 * bandeau paraît. « Actualiser » recharge la page ; « Plus tard » le range
 * jusqu'à la version suivante. Rien ne recharge de force — une saisie en cours
 * ne se perd pas.
 * ==========================================================================*/

const INTERVALLE = 5 * 60 * 1000;

async function versionEnLigne(): Promise<string | null> {
  try {
    const r = await fetch("/api/version", { cache: "no-store" });
    if (!r.ok) return null;
    const { version } = (await r.json()) as { version?: string };
    return version && version !== "local" ? version : null;
  } catch {
    return null;
  }
}

export function AvisNouvelleVersion() {
  const chargee = useRef<string | null>(null);
  const ecartee = useRef<string | null>(null);
  const [nouvelle, setNouvelle] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    async function verifier() {
      const v = await versionEnLigne();
      if (!vivant || !v) return;
      if (chargee.current === null) {
        chargee.current = v;
        return;
      }
      if (v !== chargee.current && v !== ecartee.current) setNouvelle(v);
    }
    void verifier();
    const minuterie = window.setInterval(() => void verifier(), INTERVALLE);
    const auRetour = () => {
      if (document.visibilityState === "visible") void verifier();
    };
    document.addEventListener("visibilitychange", auRetour);
    window.addEventListener("focus", auRetour);
    return () => {
      vivant = false;
      window.clearInterval(minuterie);
      document.removeEventListener("visibilitychange", auRetour);
      window.removeEventListener("focus", auRetour);
    };
  }, []);

  if (!nouvelle) return null;

  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 bottom-20 z-[60] flex justify-center px-4 lg:bottom-6">
      <div className="flex w-full max-w-[520px] items-center gap-3 rounded-[14px] border border-accent-bordure bg-surface px-4 py-3 shadow-flottante">
        <RefreshCw className="size-5 shrink-0 text-accent-fonce" strokeWidth={2} />
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold text-texte">Une nouvelle version de SEDIMA Parc est disponible</span>
          <span className="meta block">Actualisez pour en profiter — terminez d&apos;abord une saisie en cours.</span>
        </span>
        <button type="button" onClick={() => window.location.reload()} className="bouton-principal h-9 shrink-0 text-[13px]">
          Actualiser
        </button>
        <button
          type="button"
          onClick={() => {
            ecartee.current = nouvelle;
            setNouvelle(null);
          }}
          aria-label="Plus tard"
          title="Plus tard"
          className="grid size-8 shrink-0 place-items-center rounded-full text-texte-2 hover:bg-surface-3"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
