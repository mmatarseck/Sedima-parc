/* ============================================================================
 * La consommation d'un véhicule, mois par mois (métier, 22 septembre 2026 :
 * « montrer la consommation en courbe riche — L/100 km, F/100 km — et la
 * consommation en F par tonne livrée, si applicable, sur l'Aperçu »).
 *
 * Les litres et les francs d'un mois sont ceux de ses pleins ; ses kilomètres,
 * ceux de l'odomètre **interpolé** aux bornes du mois, entre les deux relevés
 * retenus qui l'encadrent. Un mois sans relevé de part et d'autre n'a pas de
 * kilomètres : sa consommation est nulle — un trou dans la courbe, pas un zéro.
 *
 * Le plein à plein (le dernier intervalle entre deux pleins complets, au
 * compteur) se calcule à part : c'est la mesure la plus juste, et la seule
 * qu'un remplissage partiel fausse — d'où la case « Plein complet » (0065).
 * ==========================================================================*/

export interface PleinConso {
  date: string;
  litres: number;
  montant: number;
  km: number | null;
  pleinComplet?: boolean;
}

export interface ReleveConso {
  date: string;
  valeur: number;
}

export interface ConsoMois {
  mois: string;
  litres: number;
  cout: number;
  km: number | null;
  /** Litres aux cent kilomètres ; nul sans kilomètres ou sans plein. */
  l100: number | null;
  /** Francs aux cent kilomètres. */
  f100: number | null;
}

const JOUR = 24 * 3600 * 1000;
const t = (jour: string) => new Date(`${jour.slice(0, 10)}T12:00:00Z`).getTime();

/** Le mois décalé de `delta` mois, au format AAAA-MM. */
export function decalerMois(mois: string, delta: number): string {
  const [a, m] = mois.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** L'odomètre au jour dit, interpolé entre les deux relevés qui l'encadrent ; nul hors de la série. */
export function odometreA(releves: ReleveConso[], jour: string): number | null {
  const cible = t(jour);
  let avant: ReleveConso | null = null;
  let apres: ReleveConso | null = null;
  for (const r of releves) {
    const x = t(r.date);
    if (x <= cible && (!avant || x > t(avant.date) || (x === t(avant.date) && r.valeur > avant.valeur))) avant = r;
    if (x >= cible && (!apres || x < t(apres.date) || (x === t(apres.date) && r.valeur < apres.valeur))) apres = r;
  }
  if (!avant || !apres) return null;
  const duree = t(apres.date) - t(avant.date);
  if (duree <= 0) return avant.valeur;
  return avant.valeur + ((apres.valeur - avant.valeur) * (cible - t(avant.date))) / duree;
}

/** La consommation des mois donnés, dans leur ordre. */
export function consommationParMois(pleins: PleinConso[], releves: ReleveConso[], mois: string[]): ConsoMois[] {
  /* Le compteur d'un plein est un relevé comme un autre. */
  const serie = [...releves, ...pleins.filter((p) => p.km !== null && p.km > 0).map((p) => ({ date: p.date, valeur: p.km! }))];
  return mois.map((m) => {
    const duMois = pleins.filter((p) => p.date.startsWith(m));
    const litres = Math.round(duMois.reduce((s, p) => s + p.litres, 0) * 10) / 10;
    const cout = duMois.reduce((s, p) => s + p.montant, 0);
    const debut = odometreA(serie, `${m}-01`);
    const fin = odometreA(serie, `${decalerMois(m, 1)}-01`);
    const km = debut !== null && fin !== null && fin > debut ? Math.round(fin - debut) : null;
    const mesurable = km !== null && km >= 50 && litres > 0;
    return {
      mois: m,
      litres,
      cout,
      km,
      l100: mesurable ? Math.round((litres / km) * 1000) / 10 : null,
      f100: mesurable ? Math.round((cout / km) * 100) : null,
    };
  });
}

/**
 * Le dernier intervalle plein à plein : du plein complet précédent au dernier
 * plein complet, les litres de tous les pleins qui suivent le premier (partiels
 * compris), sur les kilomètres entre les deux compteurs.
 */
export function dernierPleinAPlein(pleins: PleinConso[]): {
  du: string;
  au: string;
  km: number;
  litres: number;
  l100: number;
  f100: number;
} | null {
  const complets = pleins.filter((p) => p.pleinComplet !== false && p.km !== null && p.km > 0).sort((a, b) => a.date.localeCompare(b.date) || a.km! - b.km!);
  for (let i = complets.length - 1; i > 0; i--) {
    const fin = complets[i]!;
    const debut = complets[i - 1]!;
    const km = fin.km! - debut.km!;
    if (km < 50) continue;
    const entre = pleins.filter((p) => p !== debut && p.date >= debut.date && p.date <= fin.date && (p.date > debut.date || (p.km ?? 0) > debut.km!));
    const litres = entre.reduce((s, p) => s + p.litres, 0);
    const cout = entre.reduce((s, p) => s + p.montant, 0);
    if (litres <= 0) continue;
    return {
      du: debut.date,
      au: fin.date,
      km,
      litres: Math.round(litres * 10) / 10,
      l100: Math.round((litres / km) * 1000) / 10,
      f100: Math.round((cout / km) * 100),
    };
  }
  return null;
}

/** Le carburant par tonne livrée sur une période : nul quand le véhicule n'a rien livré de pesé. */
export function carburantParTonne(pleins: PleinConso[], livraisons: { date: string; poidsKg: number | null }[], debut: string, fin: string): { cout: number; tonnes: number; fParTonne: number } | null {
  const dans = (d: string) => d >= debut && d <= fin;
  const tonnes = livraisons.filter((l) => dans(l.date) && l.poidsKg !== null).reduce((s, l) => s + (l.poidsKg ?? 0), 0) / 1000;
  if (tonnes < 1) return null;
  const cout = pleins.filter((p) => dans(p.date)).reduce((s, p) => s + p.montant, 0);
  if (cout <= 0) return null;
  return {
    cout,
    tonnes: Math.round(tonnes * 10) / 10,
    fParTonne: Math.round(cout / tonnes),
  };
}

/** Les jours entre deux dates, pour borner une période glissante. */
export function jourMoins(jour: string, jours: number): string {
  return new Date(t(jour) - jours * JOUR).toISOString().slice(0, 10);
}
