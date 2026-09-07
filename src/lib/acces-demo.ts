import { normaliserAcces, type AccesUtilisateur } from "@/domaine/acces";
import { ACCES_DEMO } from "@/donnees/acces-demo";
import { enregistrerAcces, retirerAcces } from "@/lib/acces-actions";
import { authentificationReelle } from "@/lib/session-demo";

/* ============================================================================
 * Les accès, côté navigateur.
 *
 * En démonstration, la liste vit dans le stockage du navigateur, à partir des
 * fiches livrées. Base branchée, l'écriture part vers le serveur
 * (`acces-actions.ts`), qui répond par un motif de refus s'il y en a un, et
 * la liste vient de la page rendue par le serveur.
 * ==========================================================================*/

const CLE = "sedima.parc.acces";

export function lireAcces(): AccesUtilisateur[] {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return ACCES_DEMO.map((a) => ({ ...a }));
    const liste = (JSON.parse(brut) as unknown[]).map(normaliserAcces).filter((a): a is AccesUtilisateur => a !== null);
    return liste;
  } catch {
    return ACCES_DEMO.map((a) => ({ ...a }));
  }
}

function ecrireListe(liste: AccesUtilisateur[]): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(liste));
  } catch {
    /* sans stockage, la valeur ne vaut que pour la page courante */
  }
}

/** « u-gora-diop » : un identifiant lisible, unique. */
export function nouvelIdAcces(courriel: string, existants: AccesUtilisateur[]): string {
  const base = `u-${courriel
    .split("@")[0]!
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
  let id = base;
  let n = 2;
  while (existants.some((a) => a.id === id)) id = `${base}-${n++}`;
  return id;
}

/** Enregistre une fiche. Nul quand c'est fait ; sinon le motif du refus. */
export async function ecrireAcces(acces: AccesUtilisateur): Promise<string | null> {
  if (authentificationReelle()) return enregistrerAcces(acces);
  const liste = lireAcces();
  const i = liste.findIndex((a) => a.id === acces.id);
  const suite = i >= 0 ? liste.map((a) => (a.id === acces.id ? acces : a)) : [...liste, acces];
  ecrireListe(suite);
  return null;
}

export async function supprimerAcces(id: string): Promise<string | null> {
  if (authentificationReelle()) return retirerAcces(id);
  ecrireListe(lireAcces().filter((a) => a.id !== id));
  return null;
}
