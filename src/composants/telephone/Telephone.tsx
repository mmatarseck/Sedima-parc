"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { StatutVehicule } from "@/domaine/types";
import { STATUT_VEHICULE } from "@/domaine/libelles";

/* ============================================================================
 * Les briques de la vue téléphone : un en-tête serré, des blocs, des lignes,
 * des chiffres. Rien de nouveau dans la charte — les mêmes cartes, plus
 * denses, pour un écran de 360 pixels tenu d'une main.
 * ==========================================================================*/

export function EnTeteTelephone({ titre, retour, droite }: { titre: React.ReactNode; retour?: string; droite?: React.ReactNode }) {
  return (
    <header className="flex items-center gap-2 px-4 pt-3 pb-2">
      {retour ? (
        <Link href={retour} aria-label="Retour" className="grid size-9 shrink-0 place-items-center rounded-full text-texte-2 hover:bg-surface-3">
          <ChevronLeft className="size-5" strokeWidth={2} />
        </Link>
      ) : null}
      <h1 className="min-w-0 flex-1 truncate text-[18px] font-bold tracking-[-0.01em] text-texte">{titre}</h1>
      {droite}
    </header>
  );
}

export function Bloc({ titre, children, accent }: { titre?: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <section className={`carte px-3 py-2.5 ${accent ? "border-accent" : ""}`}>
      {titre ? <p className={`micro-sur-titre mb-1.5 ${accent ? "text-accent-fonce" : ""}`}>{titre}</p> : null}
      {children}
    </section>
  );
}

export function Ligne({ icone, ton = "neutre", titre, precision, valeur, href }: { icone: React.ReactNode; ton?: "neutre" | "vigilance" | "defavorable"; titre: string; precision?: string; valeur?: React.ReactNode; href?: string }) {
  const fond = ton === "defavorable" ? "bg-defavorable-fond text-defavorable" : ton === "vigilance" ? "bg-vigilance-fond text-vigilance" : "bg-accent-fond text-accent-fonce";
  const contenu = (
    <>
      <span className={`grid size-8 shrink-0 place-items-center rounded-[9px] text-[12px] font-bold ${fond}`}>{icone}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-texte">{titre}</span>
        {precision ? <span className="block truncate text-[11.5px] text-attenue">{precision}</span> : null}
      </span>
      {valeur !== undefined ? <span className="code shrink-0 text-[13px] font-semibold text-texte">{valeur}</span> : null}
    </>
  );
  const classes = "flex items-center gap-2.5 border-t border-bordure py-2 first:border-t-0";
  return href ? (
    <Link href={href} className={`${classes} -mx-1 rounded-[8px] px-1 hover:bg-surface-2`}>
      {contenu}
    </Link>
  ) : (
    <div className={classes}>{contenu}</div>
  );
}

export function Chiffre({ valeur, libelle, alerte }: { valeur: React.ReactNode; libelle: string; alerte?: boolean }) {
  return (
    <div className="carte px-3 py-2.5">
      <b className={`code block text-[22px] font-bold tracking-[-0.02em] ${alerte ? "text-defavorable" : "text-texte"}`}>{valeur}</b>
      <span className="block text-[11.5px] text-attenue">{libelle}</span>
    </div>
  );
}

export function PastilleStatutTelephone({ statut }: { statut: StatutVehicule }) {
  const d = STATUT_VEHICULE[statut];
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-surface-3 px-2.5 text-[11.5px] font-semibold whitespace-nowrap text-texte">
      <i className="size-2 rounded-full" style={{ background: d.couleur }} />
      {d.libelle}
    </span>
  );
}
