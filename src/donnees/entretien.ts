/* ============================================================================
 * Les programmes d'entretien, lus en base (0062).
 *
 * Ils vivaient dans le code (`entretien-demo.ts`). Métier, 21 septembre 2026 :
 * « les programmes d'entretien doivent être éditables ». Ils sont donc lus
 * dans `programme_entretien` et `operation_entretien`, que Paramètres ›
 * Programmes d'entretien tient.
 *
 * Une base sans 0062, ou sans programme, rend les gabarits d'origine : les
 * échéances continuent de se calculer.
 * ==========================================================================*/

import { cache } from "react";
import type { GroupeOperation, ProgrammeEntretien } from "@/domaine/entretien";
import type { CategorieVehicule } from "@/domaine/types";
import { clientServeur } from "@/lib/supabase";
import { PROGRAMMES } from "./entretien-demo";

interface LigneProgramme {
  code: string;
  libelle: string;
  precision: string | null;
  categories: CategorieVehicule[] | null;
  base: "km" | "heures";
  actif: boolean;
}

interface LigneOperation {
  code: string;
  programme_code: string;
  libelle: string;
  groupe: GroupeOperation;
  periodicite_km: number | null;
  periodicite_heures: number | null;
  periodicite_mois: number | null;
  mots_cles: string[] | null;
  duree_heures: number | string;
  cout_estime: number | string;
  critique: boolean;
  ordre: number;
  tache_libelle?: string | null;
}

/** Le code d'une opération dans son programme : « leger.vidange-moteur » se lit « vidange-moteur ». */
export function codeCourt(code: string, programme: string): string {
  /* « . » depuis 0062, « : » dans le jeu de départ. */
  return code.startsWith(`${programme}.`) || code.startsWith(`${programme}:`) ? code.slice(programme.length + 1) : code;
}

/** Les programmes à la forme du domaine — pur, pour le banc. */
export function programmesDepuisLignes(programmes: LigneProgramme[], operations: LigneOperation[]): ProgrammeEntretien[] {
  return programmes
    .filter((p) => p.actif)
    .map((p) => ({
      code: p.code,
      libelle: p.libelle,
      precision: p.precision ?? "",
      categories: p.categories ?? [],
      base: p.base,
      operations: operations
        .filter((o) => o.programme_code === p.code)
        .sort((a, b) => a.ordre - b.ordre || a.libelle.localeCompare(b.libelle, "fr"))
        .map((o) => ({
          code: codeCourt(o.code, p.code),
          libelle: o.libelle,
          groupe: o.groupe,
          periodicite: { km: o.periodicite_km, heures: o.periodicite_heures, mois: o.periodicite_mois },
          motsCles: o.mots_cles ?? [],
          dureeHeures: Number(o.duree_heures) || 0,
          coutEstime: Number(o.cout_estime) || 0,
          critique: o.critique,
          tacheLibelle: o.tache_libelle ?? null,
        })),
    }));
}

async function programmesServeurBrut(): Promise<{ programmes: ProgrammeEntretien[]; enBase: boolean }> {
  try {
    const client = await clientServeur();
    const [p, o] = await Promise.all([
      client.from("programme_entretien").select("code, libelle, precision, categories, base, actif").order("code").returns<LigneProgramme[]>(),
      client.from("operation_entretien").select("code, programme_code, libelle, groupe, periodicite_km, periodicite_heures, periodicite_mois, mots_cles, duree_heures, cout_estime, critique, ordre, tache_libelle").returns<LigneOperation[]>(),
    ]);
    if (p.error || o.error) {
      console.warn(`Programmes d'entretien illisibles (${(p.error ?? o.error)!.message}) : les gabarits d'origine s'appliquent. La migration 0062 est-elle jouée ?`);
      return { programmes: PROGRAMMES, enBase: false };
    }
    const programmes = programmesDepuisLignes(p.data ?? [], o.data ?? []);
    return programmes.length ? { programmes, enBase: true } : { programmes: PROGRAMMES, enBase: false };
  } catch {
    return { programmes: PROGRAMMES, enBase: false };
  }
}

/** Les programmes du parc, une lecture par requête. */
export const programmesServeur = cache(programmesServeurBrut);
