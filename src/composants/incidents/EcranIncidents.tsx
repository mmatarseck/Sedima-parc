"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { FormulaireDeclaration } from "@/composants/incidents/FormulaireDeclaration";
import { Numero } from "@/composants/interface/Numero";
import { Echeance, Pastille } from "@/composants/interface/Pastille";
import { TableListe, type ColonneListe, type FiltreListe } from "@/composants/interface/TableListe";
import { CHAMPS } from "@/composants/transactions/champs";
import { FournisseurEdition, useEdition } from "@/composants/transactions/ContexteEdition";
import { fabriquerLigneIncident } from "@/composants/transactions/fabriques";
import { COULEUR_DECLARATION, PRECISION_DECLARATION, ROULANT, TON_STATUT_DECLARATION, estEnCours, type LigneIncident } from "@/domaine/incidents";
import { BUSINESS_UNIT, MISSION_INCIDENT, NATURE_INCIDENT, RESPONSABILITE, STATUT_DECLARATION, TYPE_INCIDENT } from "@/domaine/libelles";
import type { BusinessUnit } from "@/domaine/types";
import { lireToutesCreations } from "@/lib/clotures-demo";
import { date, dateCourte, montantCourt } from "@/lib/format";

/* ============================================================================
 * Incidents & sinistres — toutes les déclarations, et l'entrée d'une nouvelle.
 *
 * Une liste comme les autres (filet de statut, colonnes réglables, recherche,
 * tri), filtrée par nature et par état, et au-dessus par BU et période. Chaque
 * ligne s'ouvre en modification tracée — c'est ainsi qu'on qualifie, qu'on
 * passe en traitement, qu'on clôt. « Déclarer » ouvre le formulaire en quatre
 * étapes ; la déclaration créée apparaît en tête.
 * ==========================================================================*/

type Periode = "30" | "90" | "365" | "tout";
const PERIODES: { cle: Periode; libelle: string }[] = [
  { cle: "30", libelle: "30 j" },
  { cle: "90", libelle: "90 j" },
  { cle: "365", libelle: "12 mois" },
  { cle: "tout", libelle: "Tout" },
];

const FILTRES: FiltreListe<LigneIncident>[] = [
  { cle: "tous", libelle: "Tous", retient: () => true },
  { cle: "en-cours", libelle: "En cours", retient: (l) => estEnCours(l.statut) },
  { cle: "accidents", libelle: "Accidents", retient: (l) => l.nature === "accident" },
  { cle: "incidents", libelle: "Incidents", retient: (l) => l.nature === "incident" },
  { cle: "sinistres", libelle: "Sinistres ouverts", retient: (l) => l.sinistreOuvert && estEnCours(l.statut) },
  { cle: "immobilises", libelle: "Non roulants", retient: (l) => l.roulant !== "oui" && estEnCours(l.statut) },
  { cle: "clos", libelle: "Clos", retient: (l) => l.statut === "clos" },
];

export function EcranIncidents({ lignes, aujourdhui, cible, declarerInitial }: { lignes: LigneIncident[]; aujourdhui: string; cible?: string; declarerInitial?: boolean }) {
  return (
    <FournisseurEdition sujet="incidents" href="/incidents">
      <Interieur lignes={lignes} aujourdhui={aujourdhui} cible={cible} declarerInitial={declarerInitial ?? false} />
    </FournisseurEdition>
  );
}

function Interieur({ lignes, aujourdhui, cible, declarerInitial }: { lignes: LigneIncident[]; aujourdhui: string; cible?: string; declarerInitial: boolean }) {
  const { demander, surcharger, version, actualiser } = useEdition();
  const [formulaire, setFormulaire] = useState(declarerInitial);
  const [bu, setBu] = useState<BusinessUnit | "toutes">("toutes");
  const [periode, setPeriode] = useState<Periode>("365");

  /* Les déclarations créées dans l'application, toutes fiches confondues. */
  const creees = useMemo(
    () => lireToutesCreations("incident").map(fabriquerLigneIncident).filter((l): l is LigneIncident => l !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );
  const toutes = useMemo(() => {
    const liste = [...creees, ...lignes.filter((l) => !creees.some((c) => c.numero === l.numero))].map((l) => surcharger(l));
    liste.sort((a, b) => b.dateHeure.localeCompare(a.dateHeure));
    /* La déclaration visée par une notification ou une recherche passe en tête. */
    if (cible) liste.sort((a, b) => (a.numero === cible ? -1 : b.numero === cible ? 1 : 0));
    return liste;
  }, [creees, lignes, surcharger, cible]);

  const bus = useMemo(() => (Object.keys(BUSINESS_UNIT) as BusinessUnit[]).filter((b) => toutes.some((l) => l.businessUnit === b)), [toutes]);
  const depuis = useMemo(() => {
    if (periode === "tout") return "";
    const d = new Date(`${aujourdhui}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - Number(periode));
    return d.toISOString().slice(0, 10);
  }, [periode, aujourdhui]);
  const visibles = useMemo(() => toutes.filter((l) => (bu === "toutes" || l.businessUnit === bu) && (!depuis || l.dateHeure >= depuis || l.numero === cible)), [toutes, bu, depuis, cible]);

  const enCours = visibles.filter((l) => estEnCours(l.statut)).length;
  const sinistres = visibles.filter((l) => l.sinistreOuvert && estEnCours(l.statut)).length;

  function modifier(l: LigneIncident) {
    demander({ type: "incident", numero: l.numero, titre: `Déclaration ${l.numero} · ${l.immatriculationAffichee}`, valeurs: l as unknown as Record<string, unknown>, champs: CHAMPS.incident });
  }

  const colonnes = useMemo<ColonneListe<LigneIncident>[]>(
    () => [
      { cle: "date", libelle: "Date", parDefaut: true, largeur: 128, tri: (l) => l.dateHeure, rendu: (l) => <span className="code">{dateCourte(l.dateHeure.slice(0, 10))}{l.dateHeure.length > 10 ? ` ${l.dateHeure.slice(11, 16)}` : ""}</span> },
      { cle: "nature", libelle: "Nature", parDefaut: true, largeur: 110, texte: (l) => NATURE_INCIDENT[l.nature], rendu: (l) => <Pastille ton={l.nature === "accident" ? "defavorable" : "vigilance"}>{NATURE_INCIDENT[l.nature]}</Pastille> },
      { cle: "type", libelle: "Type", parDefaut: true, largeur: 190, rendu: (l) => <span className="font-medium">{TYPE_INCIDENT[l.type]}</span> },
      { cle: "chauffeur", libelle: "Conducteur", parDefaut: true, largeur: 160, rendu: (l) => l.chauffeur ?? <span className="text-attenue">non affecté</span> },
      { cle: "lieu", libelle: "Lieu", parDefaut: true, largeur: 200, rendu: (l) => <span className="truncate">{l.lieu}</span> },
      { cle: "roulant", libelle: "Roulant", parDefaut: true, largeur: 110, texte: (l) => ROULANT[l.roulant], rendu: (l) => <Echeance ton={l.roulant === "oui" ? "favorable" : l.roulant === "non" ? "defavorable" : "vigilance"}>{ROULANT[l.roulant]}</Echeance> },
      { cle: "statut", libelle: "Suivi", parDefaut: true, largeur: 130, texte: (l) => STATUT_DECLARATION[l.statut], rendu: (l) => <Echeance ton={TON_STATUT_DECLARATION[l.statut]}>{STATUT_DECLARATION[l.statut]}</Echeance> },
      {
        cle: "action",
        libelle: "Action",
        parDefaut: true,
        largeur: 110,
        rendu: (l) => (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              modifier(l);
            }}
            className="bouton-discret h-7 px-2 text-[12px]"
          >
            <Pencil className="size-3.5" strokeWidth={1.8} />
            {l.statut === "declare" ? "Qualifier" : l.statut === "clos" ? "Rouvrir" : "Suivre"}
          </button>
        ),
      },
      { cle: "mission", libelle: "Mission", parDefaut: false, largeur: 120, rendu: (l) => (l.mission ? MISSION_INCIDENT[l.mission] : "—") },
      { cle: "responsabilite", libelle: "Responsabilité", parDefaut: true, largeur: 130, rendu: (l) => (l.responsabilite ? RESPONSABILITE[l.responsabilite] : <span className="text-attenue">—</span>) },
      { cle: "sinistre", libelle: "Sinistre", parDefaut: true, largeur: 110, texte: (l) => (l.sinistreOuvert ? "Ouvert" : "—"), rendu: (l) => (l.sinistreOuvert ? <Echeance ton="vigilance">Dossier ouvert</Echeance> : <span className="text-attenue">—</span>) },
      { cle: "blesses", libelle: "Blessés", parDefaut: false, largeur: 90, texte: (l) => (l.blesses ? "Oui" : "Non"), rendu: (l) => (l.blesses ? <Echeance ton="defavorable">Oui</Echeance> : "Non") },
      { cle: "cout", libelle: "Coût", parDefaut: true, largeur: 110, alignee: "droite", tri: (l) => l.cout, rendu: (l) => (l.cout === null ? <span className="text-attenue">—</span> : <span className="code">{montantCourt(l.cout)}</span>) },
      { cle: "immobilisation", libelle: "Immobilisation", parDefaut: true, largeur: 120, alignee: "droite", tri: (l) => l.immobilisationJours, rendu: (l) => (l.immobilisationJours === null ? <span className="text-attenue">—</span> : <span className="code">{l.immobilisationJours} j</span>) },
      { cle: "kilometrage", libelle: "Compteur", parDefaut: false, largeur: 110, alignee: "droite", tri: (l) => l.kilometrage, rendu: (l) => (l.kilometrage === null ? "—" : <span className="code">{l.kilometrage.toLocaleString("fr-FR")} km</span>) },
      { cle: "vehicule", libelle: "Véhicule", parDefaut: false, largeur: 180, rendu: (l) => l.vehicule },
      { cle: "bu", libelle: "BU", parDefaut: false, largeur: 130, rendu: (l) => (l.businessUnit ? BUSINESS_UNIT[l.businessUnit] : "—") },
      { cle: "site", libelle: "Site", parDefaut: false, largeur: 140, rendu: (l) => l.site ?? "—" },
      { cle: "declarant", libelle: "Déclarant", parDefaut: false, largeur: 150, rendu: (l) => l.declarant },
      { cle: "description", libelle: "Description", parDefaut: false, largeur: 320, rendu: (l) => <span className="truncate">{l.description}</span> },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="flex flex-col gap-5 px-8 py-7 lg:h-full">
      <TitreEcran
        titre="Incidents & sinistres"
        sousTitre={`${visibles.length} déclaration${visibles.length > 1 ? "s" : ""} · ${enCours} en cours · ${sinistres} sinistre${sinistres > 1 ? "s" : ""} ouvert${sinistres > 1 ? "s" : ""} · au ${date(aujourdhui)}`}
        actions={
          <>
            <div className="flex h-8 items-center gap-0.5 rounded-full bg-surface-3 p-1" role="group" aria-label="Période">
              {PERIODES.map((p) => (
                <button key={p.cle} type="button" aria-pressed={periode === p.cle} onClick={() => setPeriode(p.cle)} className={`h-6 rounded-full px-2.5 text-[12px] whitespace-nowrap transition-colors ${periode === p.cle ? "bg-surface font-semibold text-texte shadow-onglet" : "font-medium text-texte-2 hover:text-texte"}`}>
                  {p.libelle}
                </button>
              ))}
            </div>
            <div className="sans-barre flex h-8 max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-surface-3 p-1" role="group" aria-label="Business unit">
              {[{ cle: "toutes" as const, libelle: "Toutes BU" }, ...bus.map((b) => ({ cle: b, libelle: BUSINESS_UNIT[b] }))].map((o) => (
                <button key={o.cle} type="button" aria-pressed={bu === o.cle} onClick={() => setBu(o.cle)} className={`h-6 rounded-full px-2.5 text-[12px] whitespace-nowrap transition-colors ${bu === o.cle ? "bg-surface font-semibold text-texte shadow-onglet" : "font-medium text-texte-2 hover:text-texte"}`}>
                  {o.libelle}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setFormulaire(true)} className="bouton-principal">
              <Plus className="size-4" strokeWidth={2.2} />
              Déclarer
            </button>
          </>
        }
      />

      <TableListe<LigneIncident>
        ecran="incidents"
        lignes={visibles}
        cle={(l) => l.numero}
        href={(l) => `/flotte/${l.immatriculation}?onglet=incidents&ref=${l.numero}`}
        filet={(l) => ({ couleur: COULEUR_DECLARATION[l.statut], libelle: STATUT_DECLARATION[l.statut], precision: PRECISION_DECLARATION[l.statut] })}
        identifiant={{ cle: "numero", libelle: "Réf.", largeur: 150, rendu: (l) => <Numero valeur={l.numero} /> }}
        fixes={[{ cle: "immat", libelle: "Véhicule", parDefaut: true, largeur: 120, rendu: (l) => <span className="code font-medium">{l.immatriculationAffichee}</span> }]}
        colonnes={colonnes}
        filtres={FILTRES}
        champsRecherche={(l) => [l.numero, l.immatriculationAffichee, l.vehicule, l.chauffeur ?? "", l.lieu, l.description, TYPE_INCIDENT[l.type], NATURE_INCIDENT[l.nature], l.site ?? "", l.declarant]}
        placeholderRecherche="Référence, immatriculation, conducteur, lieu, type…"
        libelleRecherche="Rechercher une déclaration"
        libelleUnite="déclarations"
        vide="Aucune déclaration ne correspond."
      />

      {formulaire ? (
        <FormulaireDeclaration
          aujourdhui={aujourdhui}
          onFermer={() => setFormulaire(false)}
          onEnregistre={() => actualiser()}
        />
      ) : null}
    </div>
  );
}
