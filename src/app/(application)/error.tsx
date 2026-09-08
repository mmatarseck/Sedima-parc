"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Quand une page de l'application casse au serveur, l'écran reste dans la
 * coquille et parle français : ce qui s'est passé, le repère qui retrouve
 * l'erreur dans le journal de l'hébergeur, et deux issues — réessayer ou
 * revenir à la flotte. Sans cet écran, Next affiche sa page anglaise.
 */
export default function ErreurApplication({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4 px-4 py-10">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-6 shrink-0 text-defavorable" strokeWidth={1.8} />
        <div className="flex flex-col gap-1">
          <h1 className="text-[17px] font-semibold text-texte">La page n&apos;a pas pu s&apos;afficher</h1>
          <p className="text-[13.5px] leading-[1.5] text-texte-2">
            Une erreur est survenue au serveur en préparant cette page. Le journal de l&apos;hébergeur en garde la trace ; le repère ci-dessous permet de la retrouver.
          </p>
        </div>
      </div>
      {error.digest ? (
        <p className="code rounded-[10px] border border-bordure bg-surface-2 px-3 py-2 text-[12.5px] text-texte-2">
          Repère : {error.digest}
        </p>
      ) : null}
      {process.env.NODE_ENV !== "production" ? <pre className="overflow-x-auto rounded-[10px] border border-bordure bg-surface-2 p-3 text-[12px] text-texte-2">{error.message}</pre> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={reset} className="bouton-principal h-10 rounded-[10px] px-4 text-[13.5px]">
          <RotateCcw className="size-4" strokeWidth={2} />
          Réessayer
        </button>
        <Link href="/flotte" className="bouton-secondaire h-10 rounded-[10px] px-4 text-[13.5px]">
          Retour à la flotte
        </Link>
      </div>
    </div>
  );
}
