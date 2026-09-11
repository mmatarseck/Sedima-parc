/* ============================================================================
 * Les livraisons d'un véhicule — ce que ses bons de livraison disent de lui.
 *
 * Demande du métier (11 septembre 2026) : « préparer les données de livraison
 * et associer aux différents véhicules ». Les bons viennent de Sage X3
 * (`livraison`, 0044), un par ligne, rattachés par la plaque.
 *
 * Le poids d'un bon n'est connu que s'il est en kilos : un bon en sacs ou en
 * unités garde sa quantité, et son poids reste inconnu. Un mois dont aucun bon
 * n'est pesé n'a pas « 0 t » : il n'a pas de tonnage.
 * ==========================================================================*/

export type ModeLivraison = "parc" | "transporteur" | "client" | "inconnu";

export interface LivraisonFiche {
  /** Le numéro du bon dans Sage X3 : « BL26080000031 ». */
  numero: string;
  date: string;
  site: string;
  client: string | null;
  produits: string | null;
  /** Nul quand le bon n'est pas en kilos. */
  poidsKg: number | null;
  /** Les quantités par unité de vente, telles que le bon les écrit. */
  quantites: Record<string, number>;
  lignes: number;
  transporteur: string | null;
  chauffeur: string | null;
  source: string;
}

export interface MoisLivraisons {
  /** « 2026-08 ». */
  mois: string;
  bons: number;
  /** Nul quand aucun bon du mois n'est pesé. */
  poidsKg: number | null;
  bonsSansPoids: number;
  clients: number;
  jours: number;
}

export interface ResumeLivraisons {
  bons: number;
  poidsKg: number | null;
  bonsSansPoids: number;
  clients: number;
  premier: string | null;
  dernier: string | null;
}

function cumuler(bons: LivraisonFiche[]): Omit<MoisLivraisons, "mois"> {
  const pesees = bons.filter((b) => b.poidsKg !== null);
  return {
    bons: bons.length,
    poidsKg: pesees.length ? pesees.reduce((s, b) => s + (b.poidsKg ?? 0), 0) : null,
    bonsSansPoids: bons.length - pesees.length,
    clients: new Set(bons.map((b) => b.client).filter(Boolean)).size,
    jours: new Set(bons.map((b) => b.date)).size,
  };
}

/** Les livraisons mois par mois, du plus récent au plus ancien. */
export function livraisonsParMois(bons: LivraisonFiche[]): MoisLivraisons[] {
  const parMois = new Map<string, LivraisonFiche[]>();
  for (const b of bons) {
    const m = b.date.slice(0, 7);
    parMois.set(m, [...(parMois.get(m) ?? []), b]);
  }
  return [...parMois.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([mois, liste]) => ({ mois, ...cumuler(liste) }));
}

export function resumeLivraisons(bons: LivraisonFiche[]): ResumeLivraisons {
  const { bons: n, poidsKg, bonsSansPoids, clients } = cumuler(bons);
  const dates = bons.map((b) => b.date).sort();
  return { bons: n, poidsKg, bonsSansPoids, clients, premier: dates[0] ?? null, dernier: dates.at(-1) ?? null };
}

/** Les quantités d'un bon, lisibles : « 12 000 KG · 40 SAC ». */
export function quantitesLisibles(q: Record<string, number>, nombre: (n: number) => string): string {
  const e = Object.entries(q).filter(([, n]) => n > 0);
  return e.length ? e.map(([u, n]) => `${nombre(n)} ${u}`).join(" · ") : "—";
}
