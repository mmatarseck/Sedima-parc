/* ============================================================================
 * Rapports personnalisés — « on sélectionne les variables souhaitées ».
 *
 * Demande du métier du 4 septembre 2026. Un rapport personnalisé n'est pas un
 * autre genre de rapport : c'est **le même descripteur**, composé à la main
 * plutôt que livré avec l'application. Il s'appuie sur un rapport standard —
 * sa **base** — qui décide de ce qu'une ligne compte (un véhicule, un plein,
 * une déclaration) et fournit le vivier de colonnes ; on choisit ensuite
 * lesquelles, dans quel ordre, avec quels filtres et quelle période.
 *
 * Pourquoi une base plutôt qu'un choix libre parmi toutes les colonnes de
 * l'application : une ligne doit compter **une seule chose**. Mêler une colonne
 * « litres du plein » et une colonne « échéance du permis » ne donne pas un
 * rapport, cela donne un produit cartésien que personne ne sait lire. Le jour
 * où le métier voudra croiser deux dimensions, ce sera une base de plus, pas
 * un assouplissement de celle-ci.
 *
 * Rangés par compte, comme les réglages. Aujourd'hui dans le navigateur ;
 * demain une table `rapport_personnalise` côté Supabase, avec la même forme —
 * et le partage entre comptes deviendra alors possible, ce qu'un stockage
 * local ne permet pas.
 * ==========================================================================*/

import type { Perimetre } from "@/domaine/couts";
import type { Periode } from "@/domaine/periodes";
import { rapportParId, type ColonneRapport, type DefinitionRapport } from "@/domaine/rapports";
import type { Facettes } from "./reglages";

export interface RapportPersonnalise {
  id: string;
  nom: string;
  /** La phrase qui dit à quelle question il répond — comme pour un rapport standard. */
  description: string;
  /** L'identifiant du rapport standard dont il tire ses lignes. */
  base: string;
  /** Les colonnes retenues, dans l'ordre voulu. */
  colonnes: string[];
  facettes: Facettes;
  periode: Periode;
  perimetre: Perimetre;
  tri: { cle: string; sens: "asc" | "desc" } | null;
  /** Création, puis dernière modification. */
  cree: string;
  modifie: string;
}

const CLE = "sedima.parc.rapports.personnalises";

function cle(compte: string): string {
  return `${CLE}.${compte}`;
}

function lireTout(compte: string): RapportPersonnalise[] {
  try {
    const brut = localStorage.getItem(cle(compte));
    const liste = brut ? (JSON.parse(brut) as unknown) : [];
    return Array.isArray(liste) ? (liste as RapportPersonnalise[]).filter((r) => r && typeof r.id === "string" && rapportParId(r.base)) : [];
  } catch {
    return [];
  }
}

function ecrireTout(compte: string, liste: RapportPersonnalise[]): void {
  try {
    localStorage.setItem(cle(compte), JSON.stringify(liste));
  } catch {
    /* sans stockage, le rapport ne vaut que pour la session */
  }
}

/** Du plus récemment modifié au plus ancien : on retouche ce qu'on vient de faire. */
export function listePersonnalises(compte: string): RapportPersonnalise[] {
  return lireTout(compte).sort((a, b) => (b.modifie ?? "").localeCompare(a.modifie ?? ""));
}

export function personnaliseParId(compte: string, id: string): RapportPersonnalise | null {
  return lireTout(compte).find((r) => r.id === id) ?? null;
}

export function enregistrerPersonnalise(compte: string, r: Omit<RapportPersonnalise, "id" | "cree" | "modifie"> & { id?: string }): RapportPersonnalise {
  const liste = lireTout(compte);
  const maintenant = new Date().toISOString();
  const existant = r.id ? liste.find((x) => x.id === r.id) : null;
  const rapport: RapportPersonnalise = {
    ...r,
    id: existant?.id ?? `perso-${Date.now().toString(36)}`,
    cree: existant?.cree ?? maintenant,
    modifie: maintenant,
  };
  ecrireTout(compte, [rapport, ...liste.filter((x) => x.id !== rapport.id)]);
  return rapport;
}

export function supprimerPersonnalise(compte: string, id: string): void {
  ecrireTout(
    compte,
    lireTout(compte).filter((r) => r.id !== id),
  );
}

/**
 * Le descripteur qu'un rapport personnalisé présente à l'écran : celui de sa
 * base, dont on remplace le nom, la phrase et la liste des colonnes. Tout le
 * reste — le lien d'une ligne, l'identifiant, la fenêtre de temps, les totaux —
 * vient de la base, parce que ce sont les mêmes lignes.
 */
export function definitionDe(r: RapportPersonnalise): DefinitionRapport | null {
  const base = rapportParId(r.base);
  if (!base) return null;
  const identifiant = base.identifiant ?? base.colonnes[0]!.cle;
  const parCle = new Map(base.colonnes.map((c) => [c.cle, c]));
  /* L'identifiant est toujours présent, en tête : sans lui, on ne sait plus de
     quoi parle la ligne, ni où le clic doit mener. */
  const retenues = [identifiant, ...r.colonnes.filter((c) => c !== identifiant)];
  const colonnes: ColonneRapport[] = retenues.map((c) => parCle.get(c)).filter((c): c is ColonneRapport => Boolean(c)).map((c) => ({ ...c, parDefaut: true }));
  return {
    ...base,
    id: base.id,
    libelle: r.nom,
    description: r.description || base.description,
    colonnes: colonnes.length ? colonnes : base.colonnes,
    identifiant,
  };
}
