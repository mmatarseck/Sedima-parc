/* ============================================================================
 * Le carburant par tonne livrée (métier, 22 septembre 2026 : « montrer la conso
 * en F/T livré, si applicable, quelque part sur la vue véhicule »), lu sur
 * l'Aperçu. Les courbes L/100 km et F/100 km, elles, sont dans les rapports
 * (« Consommation de carburant ») : le métier les a retirées de la fiche.
 * ==========================================================================*/

const JOUR = 24 * 3600 * 1000;

/** Le carburant par tonne livrée sur une période : nul quand le véhicule n'a rien livré de pesé. */
export function carburantParTonne(pleins: { date: string; montant: number }[], livraisons: { date: string; poidsKg: number | null }[], debut: string, fin: string): { cout: number; tonnes: number; fParTonne: number } | null {
  const dans = (d: string) => d >= debut && d <= fin;
  const tonnes = livraisons.filter((l) => dans(l.date) && l.poidsKg !== null).reduce((s, l) => s + (l.poidsKg ?? 0), 0) / 1000;
  if (tonnes < 1) return null;
  const cout = pleins.filter((p) => dans(p.date)).reduce((s, p) => s + p.montant, 0);
  if (cout <= 0) return null;
  return { cout, tonnes: Math.round(tonnes * 10) / 10, fParTonne: Math.round(cout / tonnes) };
}

/** Le jour, `jours` jours plus tôt : le début d'une période glissante. */
export function jourMoins(jour: string, jours: number): string {
  return new Date(new Date(`${jour.slice(0, 10)}T12:00:00Z`).getTime() - jours * JOUR).toISOString().slice(0, 10);
}
