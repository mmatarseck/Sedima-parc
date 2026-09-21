"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { Numero } from "@/composants/interface/Numero";
import { ChampSaisie } from "./ChampSaisie";
import { CHAMPS } from "./champs";
import { optionsPrestataires, optionsVehicules } from "./options";
import type { ChampEdition } from "@/domaine/cloture";
import { POSTE_DEPENSE, groupeDuPoste } from "@/domaine/libelles";
import { TYPE_PRESTATAIRE } from "@/domaine/prestataires";
import type { TypePrestataire } from "@/domaine/prestataires";
import { jourCourant } from "@/domaine/temps";
import type { PosteDepense } from "@/domaine/types";
import { enregistrerCreation, lireCreations } from "@/lib/clotures-demo";
import { montant as formaterMontant } from "@/lib/format";
import { lireReferentiels } from "@/lib/referentiels-navigateur";

/* ============================================================================
 * Saisir une facture : l'en-tête une fois, les lignes autant qu'il en faut.
 *
 * Métier, 21 septembre 2026 : « on doit pouvoir rajouter des dépenses et
 * interventions en renseignant toutes les lignes de dépenses, le fournisseur,
 * le kilométrage, etc., en attachant la facture en PDF ou image — depuis la vue
 * maintenance du véhicule, ou la page Maintenance. La même possibilité pour les
 * dépenses autres, où l'on attache la pièce justificative. »
 *
 * Deux usages, un seul formulaire :
 *
 *   * **atelier** — une intervention (ce que le garage a fait, au compteur,
 *     combien de jours) et **une dépense par ligne** de la facture (poste,
 *     libellé, montant). Les postes proposés sont ceux de la maintenance ;
 *   * **autres** — des dépenses seules, aux postes qui ne sont ni carburant ni
 *     maintenance : assurance, péage, documents, frais de route…
 *
 * LA FACTURE VIT SUR CHAQUE LIGNE. L'intervention n'a pas de colonne pour un
 * fichier ; chaque dépense porte la pièce jointe, et l'atelier l'ouvre à droite
 * de la liste, dans l'application.
 *
 * LA CLÉ DE FACTURE. Une clé « FAC-AAMMJJ-XXXX », posée à la saisie, est écrite
 * dans la référence de l'intervention et de chaque ligne : c'est elle, et non
 * le suffixe des numéros, qui les rassemble à l'atelier (`domaine/atelier`).
 * Les numéros se renumérotent quand la base les a déjà pris, chaque table de
 * son côté ; la clé ne bouge plus.
 * ==========================================================================*/

export type ModeFacture = "atelier" | "autres";

export interface VehiculeFacture {
  immatriculation: string;
  immatriculationAffichee: string;
  libelle: string;
}

interface Ligne {
  poste: string;
  libelle: string;
  montant: string;
}

const POSTES_ATELIER: PosteDepense[] = ["maintenance-curative", "maintenance-preventive", "pieces", "pneumatiques"];
const POSTES_AUTRES = (Object.keys(POSTE_DEPENSE) as PosteDepense[]).filter((p) => groupeDuPoste(p) === "autres" && p !== "amortissement" && p !== "salaire");

/** Les fournisseurs d'un atelier : garages, magasins de pièces, pneumaticiens, dépanneurs. */
const TYPES_ATELIER: TypePrestataire[] = ["garage", "pieces", "pneumatiques", "depanneur", "autre"];
const TOUS_TYPES = Object.keys(TYPE_PRESTATAIRE) as TypePrestataire[];

function nombre(s: string): number | null {
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return s.trim() !== "" && Number.isFinite(n) ? n : null;
}

export function cleFacture(dateIso: string, alea = Math.random().toString(36).slice(2, 6)): string {
  return `FAC-${dateIso.slice(2, 4)}${dateIso.slice(5, 7)}${dateIso.slice(8, 10)}-${alea.toUpperCase().padEnd(4, "0").slice(0, 4)}`;
}

export interface EntreeFacture {
  mode: ModeFacture;
  date: string;
  fournisseur: string;
  numeroFacture: string;
  km: number | null;
  origine: string;
  fichier: string;
  /** L'intervention — en atelier seulement. */
  type?: string;
  objet?: string;
  immobilisationJours?: number | null;
  lignes: { poste: string; libelle: string; montant: number }[];
  cle: string;
}

/**
 * Ce que la facture écrit, dans l'ordre : l'intervention d'abord (en atelier),
 * puis une dépense par ligne. Pur, pour que le banc le lise sans navigateur.
 */
export function ecrituresDeLaFacture(f: EntreeFacture): { type: "intervention" | "depense"; valeurs: Record<string, unknown> }[] {
  const reference = [f.numeroFacture.trim(), f.cle].filter(Boolean).join(" · ");
  const total = f.lignes.reduce((s, l) => s + l.montant, 0);
  const atelier = f.mode === "atelier";
  return [
    ...(atelier
      ? [{ type: "intervention" as const, valeurs: { date: f.date, type: f.type ?? "curatif", objet: (f.objet ?? "").trim(), garage: f.fournisseur, km: f.km, immobilisationJours: f.immobilisationJours ?? null, montant: total, reference } }]
      : []),
    ...f.lignes.map((l, i) => ({
      type: "depense" as const,
      valeurs: {
        date: f.date,
        poste: l.poste,
        libelle: l.libelle.trim(),
        montant: l.montant,
        beneficiaire: f.fournisseur,
        reference,
        origine: f.origine,
        justificatif: true,
        photo: f.fichier,
        /* Le compteur se lit une fois : sur l'intervention quand il y en a une,
           sinon sur la première ligne — chaque ligne qui le porterait ferait un
           relevé de plus. */
        km: !atelier && i === 0 ? f.km : null,
      },
    })),
  ];
}

export function FormulaireFacture({
  mode,
  vehicule,
  onFermer,
  onEnregistre,
}: {
  mode: ModeFacture;
  /** Le véhicule de la fiche ; absent depuis la page Maintenance, où on le choisit. */
  vehicule?: VehiculeFacture | null;
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const atelier = mode === "atelier";
  const postes = atelier ? POSTES_ATELIER : POSTES_AUTRES;
  const [saisie, setSaisie] = useState<Record<string, string | boolean>>(() => ({
    date: jourCourant(),
    type: "curatif",
    origine: atelier ? "facture" : "caisse",
  }));
  const [lignes, setLignes] = useState<Ligne[]>([{ poste: postes[0]!, libelle: "", montant: "" }]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tentee, setTentee] = useState(false);
  const [resultat, setResultat] = useState<string[] | null>(null);

  const entete = useMemo<ChampEdition[]>(() => {
    const champs: ChampEdition[] = [];
    if (!vehicule) champs.push({ cle: "vehiculeId", libelle: "Véhicule", type: "choix", options: optionsVehicules(), obligatoire: true });
    champs.push(
      {
        cle: "fournisseur",
        libelle: atelier ? "Garage ou fournisseur" : "Fournisseur ou bénéficiaire",
        type: "suggestion",
        suggestionsDe: () => optionsPrestataires(atelier ? TYPES_ATELIER : TOUS_TYPES, lireCreations),
        obligatoire: true,
        precision: "Choisi dans le référentiel, ou écrit s'il n'y est pas",
      },
      { cle: "date", libelle: "Date de la facture", type: "date", obligatoire: true },
      { cle: "numeroFacture", libelle: atelier ? "N° de facture ou de bon" : "N° de pièce", type: "texte" },
      { cle: "km", libelle: "Kilométrage au compteur", type: "nombre", unite: "km" },
      {
        cle: "origine",
        libelle: "Réglée par",
        type: "choix",
        options: [
          { valeur: "facture", libelle: "Facture fournisseur" },
          { valeur: "bon-de-commande", libelle: "Bon de commande" },
          { valeur: "caisse", libelle: "Caisse parc" },
        ],
        obligatoire: true,
      },
    );
    if (atelier) {
      champs.push(
        { cle: "type", libelle: "Nature", type: "choix", options: [{ valeur: "curatif", libelle: "Curatif — une panne, une casse" }, { valeur: "preventif", libelle: "Préventif — un entretien prévu" }], obligatoire: true },
        { cle: "immobilisationJours", libelle: "Immobilisation", type: "nombre", unite: "jours" },
        { cle: "objet", libelle: "Objet de l'intervention", type: "texte-long", obligatoire: true },
      );
    }
    champs.push({
      cle: "fichier",
      libelle: atelier ? "La facture" : "La pièce justificative",
      type: "photo",
      dossier: "documents",
      obligatoire: true,
      precision: "PDF ou image — elle s'ouvrira à droite de la liste, dans l'application",
    });
    return champs;
  }, [atelier, vehicule]);

  const total = lignes.reduce((s, l) => s + (nombre(l.montant) ?? 0), 0);
  const manquants = entete.filter((c) => c.obligatoire && !String(saisie[c.cle] ?? "").trim());
  const lignesInvalides = lignes.map((l) => !l.poste || !l.libelle.trim() || !((nombre(l.montant) ?? 0) > 0));
  const valide = manquants.length === 0 && lignes.length > 0 && !lignesInvalides.some(Boolean);

  const champLigne = (cle: keyof Ligne): ChampEdition =>
    cle === "poste"
      ? { cle, libelle: "Poste", type: "choix", options: postes.map((p) => ({ valeur: p, libelle: POSTE_DEPENSE[p] })) }
      : cle === "montant"
        ? { cle, libelle: "Montant", type: "nombre", unite: "F" }
        : { cle, libelle: "Libellé", type: "texte" };

  function changerLigne(i: number, cle: keyof Ligne, valeur: string) {
    setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, [cle]: valeur } : l)));
  }

  function enregistrer() {
    setTentee(true);
    setErreur(null);
    if (!valide) {
      setErreur(manquants.length ? `À renseigner : ${manquants.map((c) => c.libelle.toLowerCase()).join(", ")}.` : "Chaque ligne demande un poste, un libellé et un montant.");
      return;
    }
    const immatriculation = vehicule?.immatriculation ?? lireReferentiels().vehicules.find((v) => v.id === saisie.vehiculeId)?.immatriculation;
    if (!immatriculation) {
      setErreur("Le véhicule choisi n'est plus au référentiel : rechargez la page.");
      return;
    }
    const sujet = `vehicule:${immatriculation}`;
    const date = String(saisie.date);
    const ecritures = ecrituresDeLaFacture({
      mode,
      date,
      fournisseur: String(saisie.fournisseur).trim(),
      numeroFacture: String(saisie.numeroFacture ?? ""),
      km: nombre(String(saisie.km ?? "")),
      origine: String(saisie.origine),
      fichier: String(saisie.fichier),
      type: String(saisie.type ?? "curatif"),
      objet: String(saisie.objet ?? ""),
      immobilisationJours: nombre(String(saisie.immobilisationJours ?? "")),
      lignes: lignes.map((l) => ({ poste: l.poste, libelle: l.libelle, montant: nombre(l.montant) ?? 0 })),
      cle: cleFacture(date),
    });

    const numeros: string[] = [];
    for (const e of ecritures) {
      const r = enregistrerCreation({ sujet, type: e.type, champs: CHAMPS[e.type], valeurs: e.valeurs, motif: "" });
      /* La première écriture dit si le mois est ouvert : toutes partagent la date. */
      if (r.issue === "mois-clos") return setErreur(`Le mois de ${r.mois} est clos : seule la direction peut y enregistrer une facture.`);
      if (r.issue !== "creee") return setErreur("La facture n'a pas pu être enregistrée : la date est illisible.");
      numeros.push(r.creation.numero);
    }
    setResultat(numeros);
    onEnregistre();
    setTimeout(onFermer, 1800);
  }

  const titre = atelier ? "Saisir une facture d'atelier" : "Saisir une dépense et sa pièce";

  return (
    <>
      <button type="button" aria-label="Fermer" onClick={onFermer} className="fixed inset-0 z-50 cursor-default bg-encre/30" />
      <div role="dialog" aria-modal="true" aria-label={titre} className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="pointer-events-auto flex max-h-[92vh] w-full max-w-[820px] flex-col overflow-hidden rounded-[16px] border border-bordure bg-surface shadow-modale" style={{ animation: "apparition 160ms ease-out" }}>
          {/* ---- En-tête ---- */}
          <div className="flex items-start gap-3 border-b border-bordure px-6 py-4">
            <div className="min-w-0 flex-1">
              <p className="micro-sur-titre">{atelier ? "Intervention · facture" : "Dépense · pièce justificative"}</p>
              <h2 className="titre-bloc mt-0.5 truncate">{vehicule ? `${titre} · ${vehicule.immatriculationAffichee}` : titre}</h2>
              <p className="meta mt-1">
                {atelier ? "Une intervention, et une dépense par ligne de la facture. La facture jointe s'ouvre sur chaque ligne." : "Une dépense par ligne, chacune avec la pièce jointe."}
              </p>
            </div>
            <button type="button" onClick={onFermer} className="grid size-8 shrink-0 place-items-center rounded-full text-texte-2 hover:bg-surface-3 hover:text-texte">
              <X className="size-4" strokeWidth={1.8} />
              <span className="sr-only">Fermer</span>
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {/* ---- La facture ---- */}
            <h3 className="titre-bloc mb-3 border-b border-bordure pb-1.5 text-[13px]">{atelier ? "La facture" : "La pièce"}</h3>
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
              {entete.map((c) => {
                const large = c.type === "texte-long" || c.type === "photo";
                const manque = tentee && c.obligatoire && !String(saisie[c.cle] ?? "").trim();
                return (
                  <label key={c.cle} className={`flex flex-col gap-1.5 ${large ? "sm:col-span-2" : ""}`}>
                    <span className="label-champ">
                      {c.libelle}
                      {c.obligatoire ? <span className="text-defavorable"> ●</span> : null}
                    </span>
                    <ChampSaisie champ={c} valeur={saisie[c.cle] ?? ""} saisie={saisie} onChange={(v) => setSaisie((s) => ({ ...s, [c.cle]: v }))} invalide={manque} />
                    {c.precision ? <span className="meta">{c.precision}</span> : null}
                  </label>
                );
              })}
            </div>

            {/* ---- Les lignes ---- */}
            <div className="mt-6 mb-3 flex items-center gap-3 border-b border-bordure pb-1.5">
              <h3 className="titre-bloc flex-1 text-[13px]">Les lignes de dépense</h3>
              <button type="button" onClick={() => setLignes((ls) => [...ls, { poste: ls.at(-1)?.poste ?? postes[0]!, libelle: "", montant: "" }])} className="bouton-discret h-8 px-2 text-[12px]">
                <Plus className="size-3.5" strokeWidth={2} />
                Ajouter une ligne
              </button>
            </div>
            <ul className="flex flex-col gap-2">
              {lignes.map((l, i) => (
                <li key={i} className={`grid grid-cols-1 items-start gap-2 rounded-[10px] border p-2 sm:grid-cols-[190px_minmax(0,1fr)_150px_auto] ${tentee && lignesInvalides[i] ? "border-defavorable" : "border-bordure"}`}>
                  {(["poste", "libelle", "montant"] as const).map((cle) => (
                    <div key={cle} className="min-w-0">
                      <ChampSaisie champ={champLigne(cle)} valeur={l[cle]} saisie={l as unknown as Record<string, string>} onChange={(v) => changerLigne(i, cle, String(v))} invalide={tentee && (cle === "montant" ? !((nombre(l.montant) ?? 0) > 0) : !String(l[cle]).trim())} />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))}
                    disabled={lignes.length === 1}
                    className="grid size-9 place-items-center rounded-[10px] text-attenue hover:bg-surface-3 hover:text-defavorable disabled:opacity-30"
                    aria-label="Retirer cette ligne"
                    title="Retirer cette ligne"
                  >
                    <Trash2 className="size-4" strokeWidth={1.7} />
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-baseline justify-end gap-3 text-[13px]">
              <span className="text-texte-2">
                {lignes.length} ligne{lignes.length > 1 ? "s" : ""} · total
              </span>
              <span className="code text-[15px] font-semibold">{formaterMontant(total)}</span>
            </p>
          </div>

          {/* ---- Pied ---- */}
          <div className="flex items-center gap-3 border-t border-bordure px-6 py-4">
            <div className="meta min-w-0 flex-1">
              {resultat ? (
                <span className="inline-flex flex-wrap items-center gap-1.5 font-medium text-favorable">
                  <Check className="size-4" strokeWidth={2.2} />
                  Enregistrée :{" "}
                  {resultat.map((n) => (
                    <Numero key={n} valeur={n} />
                  ))}
                </span>
              ) : erreur ? (
                <span className="text-defavorable">{erreur}</span>
              ) : (
                "Chaque ligne est tracée, et se modifie ensuite depuis sa liste."
              )}
            </div>
            <button type="button" onClick={onFermer} className="bouton-secondaire">
              Annuler
            </button>
            <button type="button" onClick={enregistrer} disabled={Boolean(resultat)} className="bouton-principal">
              Enregistrer {total > 0 ? formaterMontant(total) : ""}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
