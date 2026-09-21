"use client";

import { useState } from "react";
import { ChampPhoto } from "@/composants/interface/ChampPhoto";
import { ZoneDepot } from "@/composants/interface/ZoneDepot";
import { televerserPhoto } from "@/lib/photos";

/* ============================================================================
 * Plusieurs pièces sur une même ligne : photos prises sur place, constat,
 * procès-verbal, devis, facture.
 *
 * Une zone de dépôt reçoit un ou plusieurs fichiers d'un coup, glissés ou
 * choisis (métier, 21 septembre 2026, sur le modèle de Fleetio). Chaque pièce
 * déposée garde son cadre, qu'on retire d'un geste.
 *
 * `separer` : deux cadres côte à côte, **Photos** et **Documents**, comme chez
 * Fleetio. La valeur reste un seul tableau ; une image se range sous Photos,
 * le reste sous Documents.
 * ==========================================================================*/

const estImage = (ref: string) => !/\.pdf$/i.test(ref);

function Depot({ valeur, onChange, dossier, maximum, accept, filtre }: { valeur: string[]; onChange: (refs: string[]) => void; dossier: string; maximum: number; accept: string; filtre: (ref: string) => boolean }) {
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const siens = valeur.filter(filtre);

  async function deposer(fichiers: File[]) {
    setChargement(true);
    setErreur(null);
    const ajoutees: string[] = [];
    for (const f of fichiers.slice(0, Math.max(0, maximum - valeur.length))) {
      const r = await televerserPhoto(f, dossier);
      if ("refus" in r) setErreur(r.refus);
      else ajoutees.push(r.ref);
    }
    setChargement(false);
    if (ajoutees.length) onChange([...valeur, ...ajoutees]);
  }

  return (
    <div className="flex flex-col gap-2">
      {siens.length ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {siens.map((ref) => (
            <ChampPhoto key={ref} valeur={ref} dossier={dossier} compact onChange={(r) => onChange(r ? valeur.map((x) => (x === ref ? r : x)) : valeur.filter((x) => x !== ref))} />
          ))}
        </div>
      ) : null}
      {valeur.length < maximum ? <ZoneDepot multiple accept={accept} chargement={chargement} erreur={erreur} onFichiers={(f) => void deposer(f)} compact={siens.length > 0} /> : null}
    </div>
  );
}

export function ChampPieces({ valeur, onChange, dossier = "documents", maximum = 12, separer = false }: { valeur: string[]; onChange: (refs: string[]) => void; dossier?: string; maximum?: number; separer?: boolean }) {
  if (!separer) return <Depot valeur={valeur} onChange={onChange} dossier={dossier} maximum={maximum} accept="image/*,application/pdf" filtre={() => true} />;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {(
        [
          ["Photos", "image/*", estImage],
          ["Documents", "application/pdf", (r: string) => !estImage(r)],
        ] as const
      ).map(([titre, accept, filtre]) => (
        <section key={titre} className="rounded-[12px] border border-bordure bg-surface p-3.5">
          <h4 className="mb-2.5 text-[13.5px] font-semibold text-texte">{titre}</h4>
          <Depot valeur={valeur} onChange={onChange} dossier={dossier} maximum={maximum} accept={accept} filtre={filtre} />
        </section>
      ))}
    </div>
  );
}
