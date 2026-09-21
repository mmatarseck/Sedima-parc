/* ============================================================================
 * Les plaques qu'un libellé comptable nomme.
 *
 * Le grand livre écrit les immatriculations comme il peut : « AA 565 GA »,
 * « AB-900-JW », « VEHAA898PZ », « AA4922BB » pour DK 4922 BB. Cette lecture
 * est partagée par le chargement du grand livre et par la répartition des
 * factures qui couvrent plusieurs véhicules — une plaque doit se reconnaître
 * de la même façon des deux côtés.
 * ==========================================================================*/

const RE_PLAQUE = /(?<![A-Z0-9])(?:([A-Z]{2})[\s-]?(\d{3})[\s-]?([A-Z]{2})|([A-Z]{2})[\s-]?(\d{4})[\s-]?([A-Z]{1,2}))(?![A-Z0-9])/g;

/** Les plaques que le grand livre écrit de travers, et que rien ne redresse seul. Relues le 18 septembre 2026. */
const PLAQUES_CORRIGEES: [RegExp, string][] = [
  [/\bAA106EN\b/g, "AA106NE"], // le Coaster du personnel, lettres interverties
  [/\bAA09VA\b/g, "AA093VA"], // Tata LPT1618 des abattoirs, un chiffre sauté
  [/\bDK9649\b(?!\s?BG)/g, "DK9649BG"], // Kia Sorento, série oubliée
  /* Relues le 21 septembre 2026, à la répartition des factures : la même
     écriture nomme le véhicule juste à côté, ou le parc n'a qu'un voisin. */
  [/\bAB534GA\b/g, "AB543GA"], // Santa Fe, chiffres intervertis — le bon CMD2-26080279 le cite des deux façons
  [/\bAA186CP\b/g, "AA186CQ"], // Renault frigo 5 T des abattoirs, une lettre de série
];

export interface PlaquesLues {
  /** Les véhicules du parc que le libellé nomme, dans l'ordre où il les nomme. */
  plaques: string[];
  /** « AA4922BB → DK4922BB » : ce que la lecture a redressé. */
  redressees: string[];
  /** Les plaques bien formées que la flotte ne connaît pas. */
  horsParc: string[];
}

/** Fabrique le lecteur pour une flotte donnée : les immatriculations canoniques, sans séparateur. */
export function lecteurDePlaques(flotte: Iterable<string>): (libelle: string) => PlaquesLues {
  const connues = new Set(flotte);
  /* Les chiffres et la série (« 4922BB »), quand ils ne désignent qu'un véhicule. */
  const parQueue = new Map<string, string | null>();
  for (const p of connues) {
    const q = /^[A-Z]{2}(\d{3,4}[A-Z]{1,2})$/.exec(p)?.[1];
    if (q) parQueue.set(q, parQueue.has(q) ? null : p);
  }
  return (libelle) => {
    /* « VEHAA898PZ » : le mot collé à la plaque la cache ; on le décolle. */
    let t = libelle.toUpperCase().replace(/VEH(?:ICULE)?S?(?=[A-Z]{2}\s?\d{3})/g, "VEH ");
    for (const [faux, juste] of PLAQUES_CORRIGEES) t = t.replace(faux, juste);
    const lues: PlaquesLues = { plaques: [], redressees: [], horsParc: [] };
    for (const m of t.matchAll(RE_PLAQUE)) {
      const lue = m[1] ? `${m[1]}${m[2]}${m[3]}` : `${m[4]}${m[5]}${m[6]}`;
      let plaque: string | null = connues.has(lue) ? lue : null;
      if (!plaque) {
        const q = parQueue.get(lue.slice(2));
        if (q) {
          plaque = q;
          lues.redressees.push(`${lue} → ${q}`);
        }
      }
      if (plaque) {
        if (!lues.plaques.includes(plaque)) lues.plaques.push(plaque);
      } else if (!lues.horsParc.includes(lue)) lues.horsParc.push(lue);
    }
    return lues;
  };
}
