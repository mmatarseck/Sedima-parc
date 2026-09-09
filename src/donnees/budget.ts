/* ============================================================================
 * Le budget, lu avec la session de l'utilisateur.
 *
 * Base branchée, sans migration : la table `enveloppe` (0002) porte les
 * enveloppes de l'exercice ; la consommation se lit sur les dépenses des
 * véhicules depuis l'ouverture de l'exercice, chacune sur la business unit
 * de son véhicule ; l'engagé sur les demandes d'achat déjà lues
 * (`achatsServeur()`). Le suivi s'assemble avec les mêmes règles qu'en
 * démonstration (`assembler-budget.ts`). Trois lectures bornées par requête.
 *
 * Les forfaits carburant du parc léger, eux, n'existent qu'en démonstration
 * tant que le parc léger n'est pas construit en base : le carburant s'y lit
 * sans eux.
 * ==========================================================================*/

import { cache } from "react";
import type { DepenseBudget, SourceBudget } from "@/domaine/assembler-budget";
import type { Enveloppe } from "@/domaine/budget";
import type { LigneAchat } from "@/domaine/caisse";
import { afficher } from "@/domaine/immatriculation";
import type { BusinessUnit, PosteDepense } from "@/domaine/types";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";
import { achatsServeur } from "./achats";
import { sourceBudgetDemo } from "./budget-demo";

export interface LigneEnveloppe {
  numero: string;
  exercice: string;
  poste: PosteDepense;
  business_unit: BusinessUnit | null;
  montant: number | string;
  profil: (number | string)[] | null;
  base: string;
  commentaire: string | null;
}

export interface LigneDepenseBudget {
  numero: string;
  date: string;
  poste: PosteDepense;
  libelle: string;
  montant: number | string;
  beneficiaire: string | null;
  origine: DepenseBudget["origine"];
  justificatif: boolean;
  vehicule: { immatriculation: string; marque: string; appellation: string; business_unit: BusinessUnit | null } | null;
}

/** Une enveloppe telle que la table la porte, à la forme du domaine. */
export function enveloppeDepuisLigne(l: LigneEnveloppe): Enveloppe {
  const profil = l.profil ? l.profil.map(Number) : null;
  return { numero: l.numero, exercice: l.exercice, poste: l.poste, businessUnit: l.business_unit, montant: Number(l.montant), profil: profil && profil.length === 12 ? profil : null, base: l.base, commentaire: l.commentaire };
}

/** Les faits rendus par la base, à la forme que le budget assemble — pure, pour le banc d'essai. */
export function sourceDepuisLignes(enveloppes: LigneEnveloppe[], depenses: LigneDepenseBudget[], demandes: LigneAchat[], aujourdhui: string): SourceBudget {
  return {
    exercice: aujourdhui.slice(0, 4),
    aujourdhui,
    enveloppes: enveloppes.map(enveloppeDepuisLigne),
    /* Une dépense sans véhicule n'a pas de business unit : elle ne se ventile
       pas, elle ne consomme donc aucune enveloppe — comme en démonstration. */
    depenses: depenses
      .filter((d) => d.vehicule !== null)
      .map((d) => ({
        numero: d.numero,
        date: d.date,
        poste: d.poste,
        libelle: d.libelle,
        montant: Number(d.montant),
        beneficiaire: d.beneficiaire,
        origine: d.origine,
        justificatif: d.justificatif,
        businessUnit: d.vehicule!.business_unit,
        immatriculation: d.vehicule!.immatriculation,
        immatriculationAffichee: afficher(d.vehicule!.immatriculation),
        vehicule: `${d.vehicule!.marque} ${d.vehicule!.appellation}`,
      })),
    demandes,
  };
}

async function budgetServeurBrut(): Promise<SourceBudget> {
  if (!authentificationReelle()) return sourceBudgetDemo();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const exercice = aujourdhui.slice(0, 4);
  const client = await clientServeur();
  const [enveloppes, depenses, demandes] = await Promise.all([
    client.from("enveloppe").select("numero, exercice, poste, business_unit, montant, profil, base, commentaire").eq("exercice", exercice).order("numero").returns<LigneEnveloppe[]>(),
    client
      .from("depense")
      .select("numero, date, poste, libelle, montant, beneficiaire, origine, justificatif, vehicule (immatriculation, marque, appellation, business_unit)")
      .gte("date", `${exercice}-01-01`)
      .lte("date", aujourdhui)
      .order("date", { ascending: false })
      .limit(10000)
      .returns<LigneDepenseBudget[]>(),
    achatsServeur(),
  ]);
  /* Table pas encore jouée : un budget sans enveloppe, tout hors budget — l'écran le dit. */
  if (enveloppes.error) console.warn(`Budget : enveloppes illisibles (${enveloppes.error.message}).`);
  if (depenses.error) console.warn(`Budget : dépenses illisibles (${depenses.error.message}).`);
  return sourceDepuisLignes(enveloppes.data ?? [], depenses.data ?? [], demandes, aujourdhui);
}

export const budgetServeur = cache(budgetServeurBrut);
