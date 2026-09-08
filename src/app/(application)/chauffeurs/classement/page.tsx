import { Classement, type IdentiteClassement } from "@/composants/chauffeurs/Classement";
import { DATE_REFERENCE } from "@/donnees/chauffeurs-demo";
import { fichesChauffeursServeur } from "@/donnees/fiche-chauffeur";
import { authentificationReelle } from "@/lib/session-demo";
import { titrePage } from "@/domaine/marque";
import { classer, type LigneClassement } from "@/domaine/performance";

export const metadata = { title: titrePage("Chauffeur du mois") };

/** Les six derniers mois révolus, du plus récent au plus ancien. */
function moisRevolus(reference: string, nombre: number): string[] {
  const [a, m] = reference.split("-").map(Number);
  return Array.from({ length: nombre }, (_, i) => new Date(Date.UTC(a!, m! - 1 - (i + 1), 1)).toISOString().slice(0, 7));
}

/**
 * Classement SQDCM des chauffeurs, mois par mois. Calculé ici, côté serveur,
 * parce qu'il compare tous les chauffeurs entre eux — base branchée, toutes
 * les fiches du périmètre viennent de lire_fiches_chauffeurs() (0020).
 */
export default async function PageClassement() {
  const fiches = await fichesChauffeursServeur();
  const mois = moisRevolus(authentificationReelle() ? new Date().toISOString().slice(0, 10) : DATE_REFERENCE, 6);
  const classements: Record<string, LigneClassement[]> = {};
  for (const m of mois) classements[m] = classer(fiches, m);

  const identites: Record<string, IdentiteClassement> = {};
  for (const f of fiches) {
    identites[f.ligne.id] = {
      id: f.ligne.id,
      nom: f.ligne.nomComplet,
      initiales: f.ligne.initiales,
      vehicule: f.ligne.vehiculeTitulaire?.immatriculationAffichee ?? (f.ligne.suppleances[0] ? `suppléant · ${f.ligne.suppleances[0].immatriculationAffichee}` : null),
      site: f.ligne.site?.libelle ?? null,
    };
  }

  return <Classement mois={mois} classements={classements} identites={identites} />;
}
