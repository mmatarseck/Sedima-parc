"use server";

import { revalidatePath } from "next/cache";
import { normaliserModele, type GroupeOperation, type ProgrammeEntretien } from "@/domaine/entretien";
import { programmesServeur } from "@/donnees/entretien";
import type { CategorieVehicule } from "@/domaine/types";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";

/* ============================================================================
 * Les programmes d'entretien, édités depuis Paramètres (0062).
 *
 * Métier, 21 septembre 2026 : « on peut rajouter ou retirer des tâches, ou
 * rajouter un nouveau programme pour une nouvelle catégorie de véhicule ».
 *
 * Une catégorie n'appartient qu'à un programme : la donner à l'un la retire
 * aux autres — sinon le véhicule relèverait de deux gabarits, et seul le
 * premier trouvé compterait. Un programme retiré est désactivé, pas effacé :
 * les plans et ajustements qui le citent restent lisibles.
 *
 * Depuis 0075, un programme cite aussi des **modèles** (« Mitsubishi L200 »),
 * qui passent devant la catégorie. Un modèle n'appartient qu'à un programme,
 * de même. Un programme de modèle naît le plus souvent d'un programme de
 * catégorie : il en reprend les opérations, qu'on resserre ou complète ensuite.
 *
 * La base vérifie le droit (gestion de la maintenance, ou administration).
 * ==========================================================================*/

export type Issue = { ok: true; code: string } | { ok: false; motif: string };

const HORS_BASE: Issue = { ok: false, motif: "Les programmes se modifient sur une base branchée." };

function slug(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "programme"
  );
}

export interface ProgrammeSaisi {
  /** Absent pour en créer un. */
  code?: string;
  libelle: string;
  precision: string;
  categories: CategorieVehicule[];
  /** « Mitsubishi L200 » : les modèles qui suivent ce programme (0075). */
  modeles: string[];
  base: "km" | "heures";
  /** À la création : le programme dont on reprend les opérations. */
  depuis?: string | null;
}

/** Les modèles saisis, sans doublon ni vide : « mitsubishi  L200 » et « Mitsubishi L200 » n'en font qu'un. */
function modelesPropres(modeles: string[]): string[] {
  const vus = new Map<string, string>();
  for (const m of modeles) {
    const propre = m.replace(/\s+/g, " ").trim();
    if (propre && !vus.has(normaliserModele(propre))) vus.set(normaliserModele(propre), propre);
  }
  return [...vus.values()];
}

export async function enregistrerProgramme(p: ProgrammeSaisi): Promise<Issue> {
  if (!authentificationReelle()) return HORS_BASE;
  if (!p.libelle.trim()) return { ok: false, motif: "Le programme porte un nom." };
  const client = await clientServeur();
  const code = p.code ?? `${slug(p.libelle)}-${Date.now().toString(36).slice(-4)}`;
  const modeles = modelesPropres(p.modeles);
  const ligne = { code, libelle: p.libelle.trim(), precision: p.precision.trim() || null, categories: p.categories, base: p.base, actif: true };
  const ecrit = await client.from("programme_entretien").upsert({ ...ligne, modeles }, { onConflict: "code" });
  if (ecrit.error) {
    /* Sans 0075, la colonne manque : le programme s'enregistre par catégorie, et l'écran dit pourquoi les modèles n'ont pas suivi. */
    if (!/modeles/.test(ecrit.error.message)) return { ok: false, motif: `Programme non enregistré : ${ecrit.error.message}` };
    if (modeles.length) return { ok: false, motif: "Les modèles s'enregistrent une fois la migration 0075 jouée." };
    const sansModeles = await client.from("programme_entretien").upsert(ligne, { onConflict: "code" });
    if (sansModeles.error) return { ok: false, motif: `Programme non enregistré : ${sansModeles.error.message}` };
  }
  /* Un programme neuf peut reprendre les opérations d'un autre : on part du gabarit de la catégorie, puis on le règle pour le modèle. */
  if (!p.code && p.depuis) {
    const source = await client
      .from("operation_entretien")
      .select("code, libelle, tache_libelle, groupe, periodicite_km, periodicite_heures, periodicite_mois, mots_cles, duree_heures, cout_estime, critique, ordre")
      .eq("programme_code", p.depuis)
      .returns<{ code: string; libelle: string; tache_libelle: string | null; groupe: GroupeOperation; periodicite_km: number | null; periodicite_heures: number | null; periodicite_mois: number | null; mots_cles: string[]; duree_heures: number; cout_estime: number; critique: boolean; ordre: number }[]>();
    if (source.error) return { ok: false, motif: `Programme créé, mais ses opérations n'ont pas été reprises : ${source.error.message}` };
    if (source.data?.length) {
      const copie = await client.from("operation_entretien").insert(source.data.map((o) => ({ ...o, code: `${code}.${o.code.replace(/^[^.:]+[.:]/, "")}`, programme_code: code })));
      if (copie.error) return { ok: false, motif: `Programme créé, mais ses opérations n'ont pas été reprises : ${copie.error.message}` };
    }
  }
  /* Les modèles donnés ici quittent les autres programmes. */
  if (modeles.length) {
    const autres = await client.from("programme_entretien").select("code, modeles").neq("code", code).returns<{ code: string; modeles: string[] | null }[]>();
    for (const a of autres.data ?? []) {
      const restent = (a.modeles ?? []).filter((m) => !modeles.some((n) => normaliserModele(n) === normaliserModele(m)));
      if (restent.length !== (a.modeles ?? []).length) await client.from("programme_entretien").update({ modeles: restent }).eq("code", a.code);
    }
  }
  /* Les catégories données ici quittent les autres programmes. */
  if (p.categories.length) {
    const autres = await client.from("programme_entretien").select("code, categories").neq("code", code).returns<{ code: string; categories: CategorieVehicule[] }[]>();
    for (const a of autres.data ?? []) {
      const restent = a.categories.filter((c) => !p.categories.includes(c));
      if (restent.length !== a.categories.length) await client.from("programme_entretien").update({ categories: restent }).eq("code", a.code);
    }
  }
  revalidatePath("/", "layout");
  return { ok: true, code };
}

export async function retirerProgramme(code: string): Promise<Issue> {
  if (!authentificationReelle()) return HORS_BASE;
  const client = await clientServeur();
  /* Ses catégories et ses modèles reviennent aux autres programmes ; sans 0075, il n'a pas de modèles à rendre. */
  let r = await client.from("programme_entretien").update({ actif: false, categories: [], modeles: [] }).eq("code", code);
  if (r.error && /modeles/.test(r.error.message)) r = await client.from("programme_entretien").update({ actif: false, categories: [] }).eq("code", code);
  if (r.error) return { ok: false, motif: `Programme non retiré : ${r.error.message}` };
  revalidatePath("/", "layout");
  return { ok: true, code };
}

export interface OperationSaisie {
  /** Le code court, absent pour en créer une : « vidange-moteur ». */
  code?: string;
  libelle: string;
  tacheLibelle: string | null;
  groupe: GroupeOperation;
  km: number | null;
  heures: number | null;
  mois: number | null;
  motsCles: string[];
  dureeHeures: number;
  coutEstime: number;
  critique: boolean;
  ordre: number;
}

const positifOuNul = (n: number | null) => (n !== null && Number.isFinite(n) && n > 0 ? Math.round(n) : null);

export async function enregistrerOperation(programme: string, o: OperationSaisie): Promise<Issue> {
  if (!authentificationReelle()) return HORS_BASE;
  if (!o.libelle.trim()) return { ok: false, motif: "L'opération porte un nom." };
  const km = positifOuNul(o.km);
  const heures = positifOuNul(o.heures);
  const mois = positifOuNul(o.mois);
  if (km === null && heures === null && mois === null) return { ok: false, motif: "Donnez au moins une périodicité : en km, en heures ou en mois." };
  const client = await clientServeur();
  const code = `${programme}.${o.code ?? `${slug(o.libelle)}-${Date.now().toString(36).slice(-4)}`}`;
  const r = await client.from("operation_entretien").upsert(
    {
      code,
      programme_code: programme,
      libelle: o.libelle.trim(),
      tache_libelle: o.tacheLibelle,
      groupe: o.groupe,
      periodicite_km: km,
      periodicite_heures: heures,
      periodicite_mois: mois,
      mots_cles: o.motsCles.map((m) => m.trim().toLowerCase()).filter(Boolean),
      duree_heures: Math.max(0, o.dureeHeures || 0),
      cout_estime: Math.max(0, Math.round(o.coutEstime || 0)),
      critique: o.critique,
      ordre: o.ordre,
    },
    { onConflict: "code" },
  );
  if (r.error) return { ok: false, motif: `Opération non enregistrée : ${r.error.message}` };
  revalidatePath("/", "layout");
  return { ok: true, code };
}

export async function retirerOperation(programme: string, code: string): Promise<Issue> {
  if (!authentificationReelle()) return HORS_BASE;
  const client = await clientServeur();
  const r = await client.from("operation_entretien").delete().eq("code", `${programme}.${code}`);
  if (r.error) return { ok: false, motif: `Opération non retirée : ${r.error.message}` };
  revalidatePath("/", "layout");
  return { ok: true, code };
}

/**
 * Les programmes du parc, pour le formulaire d'un service : un service peut
 * reprendre les tâches d'un plan d'entretien défini (métier, 21 septembre 2026).
 */
export async function lireProgrammes(): Promise<ProgrammeEntretien[]> {
  return (await programmesServeur()).programmes;
}
