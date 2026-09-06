import { STATUT_CHAUFFEUR, type StatutChauffeur } from "@/domaine/chauffeur";

/**
 * Pastille de statut d'un chauffeur — même traitement que celle des véhicules :
 * seul le point porte la couleur, le cadre reste neutre.
 */
export function PastilleStatutChauffeur({ statut, compacte }: { statut: StatutChauffeur; compacte?: boolean }) {
  const d = STATUT_CHAUFFEUR[statut];
  return (
    <span title={d.precision} className="inline-flex h-6 items-center gap-2 rounded-full bg-surface-3 px-2.5 text-[12px] font-medium whitespace-nowrap text-texte-2">
      <span className="size-2 shrink-0 rounded-full" style={{ background: d.couleur }} />
      {compacte ? null : d.libelle}
    </span>
  );
}
