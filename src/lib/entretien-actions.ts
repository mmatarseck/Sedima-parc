"use server";

import { revalidatePath } from "next/cache";
import type { GroupeOperation } from "@/domaine/entretien";
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
  base: "km" | "heures";
}

export async function enregistrerProgramme(p: ProgrammeSaisi): Promise<Issue> {
  if (!authentificationReelle()) return HORS_BASE;
  if (!p.libelle.trim()) return { ok: false, motif: "Le programme porte un nom." };
  const client = await clientServeur();
  const code = p.code ?? `${slug(p.libelle)}-${Date.now().toString(36).slice(-4)}`;
  const ecrit = await client.from("programme_entretien").upsert({ code, libelle: p.libelle.trim(), precision: p.precision.trim() || null, categories: p.categories, base: p.base, actif: true }, { onConflict: "code" });
  if (ecrit.error) return { ok: false, motif: `Programme non enregistré : ${ecrit.error.message}` };
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
  const r = await client.from("programme_entretien").update({ actif: false, categories: [] }).eq("code", code);
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
