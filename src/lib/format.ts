/* ============================================================================
 * Formatage — francs CFA, dates jour/mois/année, kilométrages.
 * Un seul fuseau, une seule devise : tout est décidé ici.
 * ==========================================================================*/

const NBSP = " ";

/** « 12 890 500 F ». Les milliers sont séparés par une espace insécable. */
export function montant(valeur: number | null, options?: { avecDevise?: boolean }): string {
  if (valeur === null || Number.isNaN(valeur)) return "—";
  const corps = Math.round(valeur)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return options?.avecDevise === false ? corps : `${corps}${NBSP}F`;
}

/** « 12,9 M F » — pour les tuiles et les pastilles, où la place manque. */
export function montantCourt(valeur: number | null): string {
  if (valeur === null || Number.isNaN(valeur)) return "—";
  const abs = Math.abs(valeur);
  if (abs >= 1_000_000) return `${(valeur / 1_000_000).toFixed(1).replace(".", ",")}${NBSP}M${NBSP}F`;
  if (abs >= 1_000) return `${Math.round(valeur / 1_000)}${NBSP}k${NBSP}F`;
  return montant(valeur);
}

/**
 * « 12 890 » ou « 11,2 » — nombre en écriture française, sans passer par
 * toLocaleString : le serveur et le navigateur ne séparent pas toujours les
 * milliers avec le même caractère, et la page ne s'hydraterait pas.
 */
export function nombre(valeur: number | null, decimales = 0): string {
  if (valeur === null || Number.isNaN(valeur)) return "—";
  const fixe = Math.abs(valeur).toFixed(decimales);
  const [entier, fraction] = fixe.split(".");
  const groupe = entier!.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${valeur < 0 ? "-" : ""}${groupe}${fraction ? `,${fraction}` : ""}`;
}

/** « 343 500 km ». */
export function kilometrage(valeur: number | null): string {
  if (valeur === null || Number.isNaN(valeur)) return "—";
  return `${valeur.toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)}${NBSP}km`;
}

/** « 28/09/2026 ». */
export function date(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const jj = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${jj}/${mm}/${d.getFullYear()}`;
}

/** « 28/09 » — pour les colonnes serrées. */
export function dateCourte(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Jours entre aujourd'hui et une échéance. Négatif si dépassée. */
export function joursRestants(echeance: string | null, aujourdhui = new Date()): number | null {
  if (!echeance) return null;
  const d = new Date(echeance);
  if (Number.isNaN(d.getTime())) return null;
  const jour = 24 * 60 * 60 * 1000;
  const a = Date.UTC(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate());
  const b = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((b - a) / jour);
}

/** « 76,2 % ». */
export function pourcentage(valeur: number | null, decimales = 1): string {
  if (valeur === null || Number.isNaN(valeur)) return "—";
  return `${valeur.toFixed(decimales).replace(".", ",")}${NBSP}%`;
}
