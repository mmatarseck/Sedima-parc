"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Numéro de référence d'une transaction, tel qu'il se cite dans une demande
 * d'achat. Un clic le copie : c'est le geste attendu — on le colle dans la DA,
 * on ne le recopie pas à la main.
 */
export function Numero({ valeur }: { valeur: string }) {
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    if (!copie) return;
    const t = setTimeout(() => setCopie(false), 1600);
    return () => clearTimeout(t);
  }, [copie]);

  async function copier(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(valeur);
      setCopie(true);
    } catch {
      /* presse-papiers indisponible : le numéro reste sélectionnable */
    }
  }

  return (
    <button
      type="button"
      onClick={copier}
      title={copie ? "Copié" : `${valeur} — cliquer pour copier`}
      className="code group inline-flex items-center gap-1.5 rounded-[6px] px-1 py-px text-[12px] whitespace-nowrap text-texte-2 transition-colors hover:bg-surface-3 hover:text-texte"
    >
      {valeur}
      {copie ? <Check className="size-3 text-accent-fonce" strokeWidth={2.2} /> : <Copy className="size-3 text-attenue-2 opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={1.8} />}
    </button>
  );
}
