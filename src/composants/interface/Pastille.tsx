import { CLASSES_TON, STATUT_VEHICULE, type Ton } from "@/domaine/libelles";
import type { StatutVehicule } from "@/domaine/types";

/**
 * Pastille d'état — un point coloré et un libellé, dans un cadre teinté.
 * Le point permet de lire l'état sans se fier à la seule couleur du texte.
 */
export function Pastille({ ton, children }: { ton: Ton; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium whitespace-nowrap ${CLASSES_TON[ton]}`}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}

/**
 * Pastille de statut de véhicule.
 *
 * Les sept statuts ont leurs couleurs propres, données par la gestion de parc.
 * Seul le point les porte : le cadre reste neutre, sans quoi l'écran virerait au
 * nuancier. Comme dans les références, le fond est un gris très clair sans
 * bordure — la pastille se lit comme une étiquette, pas comme un bouton.
 */
export function PastilleStatut({ statut, compacte }: { statut: StatutVehicule; compacte?: boolean }) {
  const d = STATUT_VEHICULE[statut];
  return (
    <span
      title={d.precision}
      className="inline-flex h-6 items-center gap-2 rounded-full bg-surface-3 px-2.5 text-[12px] font-medium whitespace-nowrap text-texte-2"
    >
      <span className="size-2 shrink-0 rounded-full" style={{ background: d.couleur }} />
      {compacte ? null : d.libelle}
    </span>
  );
}

/**
 * Marqueur d'échéance — plus compact que la pastille, en chiffres alignés,
 * pour les colonnes de tableau où l'on compare des délais entre eux.
 */
export function Echeance({ ton, children }: { ton: Ton; children: React.ReactNode }) {
  return (
    <span
      className={`code inline-flex h-6 items-center rounded-[8px] border px-2 text-[11.5px] font-medium whitespace-nowrap ${CLASSES_TON[ton]}`}
    >
      {children}
    </span>
  );
}
