/* ============================================================================
 * Préférences d'affichage d'une liste — colonnes visibles et largeurs.
 *
 * Rattachées au compte et à l'écran. Aujourd'hui dans le navigateur, sous une
 * clé qui porte le rôle ; demain dans une table de préférences côté Supabase,
 * avec la même forme.
 * ==========================================================================*/

export const LARGEUR_MINIMALE = 72;

export interface DefinitionColonneListe {
  cle: string;
  parDefaut: boolean;
}

/**
 * La liste Flotte a été livrée avant que les préférences ne soient partagées
 * entre écrans : ses clés n'ont pas de segment d'écran. On les conserve, pour
 * que personne ne perde ses réglages à la livraison du deuxième écran.
 */
function cle(ecran: string, compte: string, quoi: "colonnes" | "largeurs"): string {
  return ecran === "flotte" ? `sedima.parc.${quoi}.${compte}` : `sedima.parc.${ecran}.${quoi}.${compte}`;
}

/**
 * On enregistre les colonnes visibles, mais aussi celles qui existaient au
 * moment du choix. Sans cela, une colonne ajoutée plus tard resterait invisible
 * pour tous ceux qui ont déjà réglé leur affichage : ils ne la verraient jamais
 * apparaître, et croiraient à un oubli de développement.
 */
interface PreferenceColonnes {
  visibles: string[];
  connues: string[];
}

export function colonnesParDefaut(definitions: DefinitionColonneListe[]): string[] {
  return definitions.filter((c) => c.parDefaut).map((c) => c.cle);
}

export function lireColonnes(ecran: string, compte: string, definitions: DefinitionColonneListe[]): string[] {
  const defaut = colonnesParDefaut(definitions);
  const existantes = new Set(definitions.map((c) => c.cle));
  try {
    const brut = localStorage.getItem(cle(ecran, compte, "colonnes"));
    if (!brut) return defaut;
    const stocke = JSON.parse(brut) as unknown;

    // Ancien format : une simple liste des colonnes visibles.
    const preference: PreferenceColonnes = Array.isArray(stocke)
      ? { visibles: stocke as string[], connues: stocke as string[] }
      : (stocke as PreferenceColonnes);

    if (!preference || !Array.isArray(preference.visibles)) return defaut;

    const visibles = preference.visibles.filter((c) => typeof c === "string" && existantes.has(c));
    const connues = new Set(Array.isArray(preference.connues) ? preference.connues : visibles);

    // Les colonnes apparues depuis le dernier réglage suivent leur réglage d'origine.
    const nouvelles = definitions.filter((c) => !connues.has(c.cle) && c.parDefaut).map((c) => c.cle);

    const retenues = new Set([...visibles, ...nouvelles]);
    return definitions.filter((c) => retenues.has(c.cle)).map((c) => c.cle);
  } catch {
    return defaut;
  }
}

export function ecrireColonnes(ecran: string, compte: string, visibles: string[], definitions: DefinitionColonneListe[]): void {
  const preference: PreferenceColonnes = { visibles, connues: definitions.map((c) => c.cle) };
  try {
    localStorage.setItem(cle(ecran, compte, "colonnes"), JSON.stringify(preference));
  } catch {
    /* sans stockage, le choix ne vaut que pour la session */
  }
}

export function lireLargeurs(ecran: string, compte: string, defauts: Record<string, number>): Record<string, number> {
  try {
    const brut = localStorage.getItem(cle(ecran, compte, "largeurs"));
    if (!brut) return { ...defauts };
    const stocke = JSON.parse(brut) as Record<string, unknown>;
    const resultat = { ...defauts };
    for (const k of Object.keys(resultat)) {
      const v = stocke[k];
      if (typeof v === "number" && Number.isFinite(v)) resultat[k] = Math.max(LARGEUR_MINIMALE, Math.round(v));
    }
    return resultat;
  } catch {
    return { ...defauts };
  }
}

export function ecrireLargeurs(ecran: string, compte: string, largeurs: Record<string, number>): void {
  try {
    localStorage.setItem(cle(ecran, compte, "largeurs"), JSON.stringify(largeurs));
  } catch {
    /* sans stockage, le réglage ne vaut que pour la session */
  }
}
