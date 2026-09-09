/* ============================================================================
 * Le parc léger, lu avec la session de l'utilisateur.
 *
 * Base branchée (0004, sans migration nouvelle) : les véhicules de service et
 * de fonction sont ceux de la Flotte dont le régime n'est pas l'exploitation
 * (lignes déjà lues, compteur et attribution compris), complétés de ce que la
 * liste ne porte pas — le plan car de l'attribution en cours, la business
 * unit et le département de l'attributaire, la carte et le montant du
 * forfait carburant. Sinon, le dossier de démonstration. La forme est celle
 * du domaine (`SourceParcLeger`) ; la fabrique des forfaits en dépense
 * (`depensesForfaitsDe`) est la même des deux côtés.
 * ==========================================================================*/

import { cache } from "react";
import type { Attributaire, EtatLeger, ForfaitCarburant, SourceParcLeger, VehiculeLeger } from "@/domaine/parc-leger";
import type { Parametres } from "@/domaine/parametres";
import type { BusinessUnit, LigneFlotte, StatutVehicule } from "@/domaine/types";
import { authentificationReelle } from "@/lib/session-demo";
import { clientServeur } from "@/lib/supabase";
import { lignesFlotte } from "./flotte";
import { sourceParcLegerDemo } from "./parc-leger-demo";

export interface LigneAttributionBase {
  attributaire_id: string | null;
  pool: string | null;
  plan_car: boolean;
  plan_car_duree_mois: number | null;
  plan_car_debut: string | null;
  plan_car_statut: "en-cours" | "cede";
  vehicule: { immatriculation: string } | null;
}

export interface LigneAttributaireBase {
  id: string;
  nom: string;
  fonction: string | null;
  departement: string | null;
  business_unit: BusinessUnit | null;
  actif: boolean;
}

export interface LigneForfaitBase {
  attributaire_id: string;
  montant_mensuel: number | string | null;
  carte: string | null;
}

/** Le statut d'un véhicule, relu comme l'état du dossier parc léger. */
const ETAT_PAR_STATUT: Partial<Record<StatutVehicule, EtatLeger>> = { "en-service": "actif", "en-backup": "pool", "en-reparation": "panne", "retrait-en-cours": "a-reformer", "a-recevoir": "a-recevoir" };

/** La source du parc léger depuis ce que la base a rendu — pure, pour le banc d'essai. */
export function sourceDepuisLignes(lignes: LigneFlotte[], attributions: LigneAttributionBase[], attributaires: LigneAttributaireBase[], forfaits: LigneForfaitBase[]): SourceParcLeger {
  const parImmat = new Map(attributions.filter((a) => a.vehicule).map((a) => [a.vehicule!.immatriculation, a]));
  const personnes: Attributaire[] = attributaires.map((a) => ({ id: a.id, nom: a.nom, fonction: a.fonction, departement: a.departement, businessUnit: a.business_unit }));
  const parNom = new Map(personnes.map((a) => [a.nom, a]));
  const vehicules: VehiculeLeger[] = lignes
    .filter((l) => l.vehicule.regime && l.vehicule.regime !== "exploitation")
    .map((l) => {
      const v = l.vehicule;
      const attribution = parImmat.get(v.immatriculation) ?? null;
      /* La ligne de flotte nomme la personne ou le pool ; la table dit son identifiant et son plan car. */
      const personne = attribution?.attributaire_id ? (personnes.find((a) => a.id === attribution.attributaire_id) ?? null) : l.attributaire && !l.attributaire.pool ? (parNom.get(l.attributaire.nom) ?? null) : null;
      const pool = attribution?.pool ?? (l.attributaire?.pool ? l.attributaire.nom : null);
      const statut = v.statut;
      /* L'état suit le statut, comme le seed l'a posé : un bus de service sans personne nommée reste « actif ». */
      const etat: EtatLeger = ETAT_PAR_STATUT[statut] ?? "actif";
      const aRecevoir = statut === "a-recevoir";
      /* Le lot du plan de cascade ouvre le commentaire de la table : « Lot 1 - 03 — Neuf… ». */
      const lot = v.commentaire?.match(/^(Lot [0-9]+ - [0-9]+)(?: — (.*))?$/s) ?? null;
      return {
        id: v.id,
        immatriculation: aRecevoir ? null : v.immatriculation,
        immatriculationAffichee: v.immatriculationAffichee,
        marque: v.marque,
        modele: v.appellation,
        annee: v.premiereMiseEnCirculation ? Number(v.premiereMiseEnCirculation.slice(0, 4)) : null,
        kilometrage: l.kilometrage,
        categorie: (["vehicule-leger", "camionnette", "moto", "bus"].includes(v.categorie) ? v.categorie : "vehicule-leger") as VehiculeLeger["categorie"],
        regime: v.regime ?? "service",
        etat,
        attributaireId: personne?.id ?? null,
        pool: personne ? null : pool,
        departement: personne?.departement ?? pool,
        businessUnit: personne?.businessUnit ?? v.businessUnit,
        planCar: attribution?.plan_car ? { dureeMois: attribution.plan_car_duree_mois, debut: attribution.plan_car_debut, statut: attribution.plan_car_statut } : null,
        lot: lot ? lot[1]! : aRecevoir ? v.immatriculationAffichee.replace(/ — à immatriculer$/, "") : null,
        commentaire: lot ? (lot[2] ?? null) : v.commentaire,
      };
    });
  const forfaitsDomaine: ForfaitCarburant[] = forfaits.map((f) => ({ attributaireId: f.attributaire_id, montantMensuel: f.montant_mensuel === null ? null : Number(f.montant_mensuel), carte: f.carte }));
  return { vehicules, attributaires: personnes.sort((a, b) => a.nom.localeCompare(b.nom, "fr")), forfaits: forfaitsDomaine };
}

async function parcLegerServeurBrut(parametres: Parametres): Promise<SourceParcLeger> {
  if (!authentificationReelle()) return sourceParcLegerDemo();
  const client = await clientServeur();
  const [lignes, attributions, attributaires, forfaits] = await Promise.all([
    lignesFlotte(parametres),
    client.from("attribution_legere").select("attributaire_id, pool, plan_car, plan_car_duree_mois, plan_car_debut, plan_car_statut, vehicule (immatriculation)").is("fin", null).limit(2000).returns<LigneAttributionBase[]>(),
    client.from("attributaire").select("id, nom, fonction, departement, business_unit, actif").order("nom").limit(2000).returns<LigneAttributaireBase[]>(),
    client.from("forfait_carburant").select("attributaire_id, montant_mensuel, carte").limit(2000).returns<LigneForfaitBase[]>(),
  ]);
  for (const [nom, lecture] of [["attributions", attributions], ["attributaires", attributaires], ["forfaits", forfaits]] as const) {
    if (lecture.error) console.warn(`Parc léger — ${nom} : lecture impossible (${lecture.error.message}).`);
  }
  return sourceDepuisLignes(lignes, attributions.data ?? [], attributaires.data ?? [], forfaits.data ?? []);
}

export const parcLegerServeur = cache(parcLegerServeurBrut);
