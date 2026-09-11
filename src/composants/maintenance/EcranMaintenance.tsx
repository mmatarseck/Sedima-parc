"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, Pencil, Play, Plus, Wrench } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Numero } from "@/composants/interface/Numero";
import { Echeance, Pastille } from "@/composants/interface/Pastille";
import { TableListe, type ColonneListe, type FiltreListe } from "@/composants/interface/TableListe";
import { CHAMPS, champsCreation } from "@/composants/transactions/champs";
import { FournisseurEdition, useEdition } from "@/composants/transactions/ContexteEdition";
import { fabriquerIntervention, fabriquerLigneOrdre } from "@/composants/transactions/fabriques";
import { BUSINESS_UNIT } from "@/domaine/libelles";
import {
  actionSuivante,
  COULEUR_STATUT_ORDRE,
  COULEUR_URGENCE_TRAVAIL,
  estOuvert,
  NATURE_TRAVAIL,
  PRECISION_STATUT_ORDRE,
  PRECISION_URGENCE_TRAVAIL,
  STATUT_ORDRE,
  TON_STATUT_ORDRE,
  TON_URGENCE_TRAVAIL,
  URGENCE_TRAVAIL,
  urgenceEcheance,
  type LigneInterventionFlotte,
  type LigneOrdre,
  type LigneTravail,
} from "@/domaine/maintenance";
import type { BusinessUnit } from "@/domaine/types";
import { FLOTTE } from "@/donnees/parc-demo";
import { enregistrerModification, lireCreations, lireToutesCreations } from "@/lib/clotures-demo";
import { date, dateCourte, kilometrage, montant } from "@/lib/format";

/* ============================================================================
 * Maintenance — une entrée du rail, trois vues.
 *
 * **À faire** : ce qui appelle une intervention et n'est pas encore planifié,
 * déduit des fiches — échéances du plan, observations de visite, véhicules
 * immobilisés, incidents non roulants. Chaque ligne se **planifie** en un ordre
 * de travail. **Ordres de travail** : la planification et son avancement —
 * on démarre, on clôt ; la clôture crée l'intervention sur la fiche du
 * véhicule et l'ordre garde son numéro. **Interventions** : ce qui a été fait
 * sur toute la flotte. Pas de bandeau de KPI : les compteurs sont dans le
 * sous-titre.
 * ==========================================================================*/

export type VueMaintenance = "afaire" | "ordres" | "interventions";

type Periode = "30" | "90" | "365" | "tout";
const PERIODES: { cle: Periode; libelle: string }[] = [
  { cle: "30", libelle: "30 j" },
  { cle: "90", libelle: "90 j" },
  { cle: "365", libelle: "12 mois" },
  { cle: "tout", libelle: "Tout" },
];

const FILTRES_TRAVAUX: FiltreListe<LigneTravail>[] = [
  { cle: "a-traiter", libelle: "À traiter", retient: (t) => t.urgence === "en-retard" || t.urgence === "a-planifier" },
  { cle: "en-retard", libelle: "En retard", retient: (t) => t.urgence === "en-retard" },
  { cle: "a-planifier", libelle: "À planifier", retient: (t) => t.urgence === "a-planifier" },
  { cle: "en-cours", libelle: "En cours", retient: (t) => t.urgence === "en-cours" },
  { cle: "a-venir", libelle: "À venir", retient: (t) => t.urgence === "a-venir" },
  { cle: "tous", libelle: "Tous", retient: () => true },
];

const FILTRES_ORDRES: FiltreListe<LigneOrdre>[] = [
  { cle: "ouverts", libelle: "Ouverts", retient: (o) => estOuvert(o.statut) },
  { cle: "planifies", libelle: "Planifiés", retient: (o) => o.statut === "planifie" },
  { cle: "atelier", libelle: "En atelier", retient: (o) => o.statut === "en-atelier" },
  { cle: "clos", libelle: "Clos", retient: (o) => o.statut === "clos" },
  { cle: "annules", libelle: "Annulés", retient: (o) => o.statut === "annule" },
  { cle: "tous", libelle: "Tous", retient: () => true },
];

const FILTRES_INTERVENTIONS: FiltreListe<LigneInterventionFlotte>[] = [
  { cle: "toutes", libelle: "Toutes", retient: () => true },
  { cle: "preventives", libelle: "Préventives", retient: (i) => i.type === "preventif" },
  { cle: "curatives", libelle: "Curatives", retient: (i) => i.type === "curatif" },
];

function decaler(iso: string, jours: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

function joursEntre(debut: string, fin: string): number {
  return Math.max(0, Math.round((new Date(`${fin}T00:00:00Z`).getTime() - new Date(`${debut}T00:00:00Z`).getTime()) / 86_400_000));
}

function Segments<T extends string>({ valeur, options, onChange, etiquette }: { valeur: T; options: { cle: T; libelle: string }[]; onChange: (v: T) => void; etiquette: string }) {
  return (
    <div className="sans-barre flex h-8 max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-surface-3 p-1" role="group" aria-label={etiquette}>
      {options.map((o) => (
        <button key={o.cle} type="button" aria-pressed={valeur === o.cle} onClick={() => onChange(o.cle)} className={`h-6 rounded-full px-2.5 text-[12px] whitespace-nowrap transition-colors ${valeur === o.cle ? "bg-surface font-semibold text-texte shadow-onglet" : "font-medium text-texte-2 hover:text-texte"}`}>
          {o.libelle}
        </button>
      ))}
    </div>
  );
}

interface Props {
  travaux: LigneTravail[];
  ordres: LigneOrdre[];
  interventions: LigneInterventionFlotte[];
  aujourdhui: string;
  vueInitiale: VueMaintenance;
  cible?: string;
}

export function EcranMaintenance(props: Props) {
  return (
    <FournisseurEdition sujet="maintenance" href="/maintenance">
      <Interieur {...props} />
    </FournisseurEdition>
  );
}

function Interieur({ travaux, ordres, interventions, aujourdhui, vueInitiale, cible }: Props) {
  const { demander, creer, surcharger, version, actualiser } = useEdition();
  const [vue, setVue] = useState<VueMaintenance>(vueInitiale);
  const [periode, setPeriode] = useState<Periode>("365");
  const [bu, setBu] = useState<BusinessUnit | "toutes">("toutes");
  const [monte, setMonte] = useState(false);
  useEffect(() => setMonte(true), []);

  /* ---- Ce qui a été créé dans l'application ---- */
  const ordresCrees = useMemo(
    () => (monte ? lireCreations("maintenance").filter((c) => c.type === "ordre").map(fabriquerLigneOrdre).filter((o): o is LigneOrdre => o !== null) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, monte],
  );
  const interventionsCreees = useMemo<LigneInterventionFlotte[]>(
    () =>
      monte
        ? lireToutesCreations("intervention")
            .map((c) => {
              const l = FLOTTE.find((x) => `vehicule:${x.vehicule.id}` === c.sujet);
              if (!l) return null;
              return { ...fabriquerIntervention(c), vehiculeId: l.vehicule.id, immatriculation: l.vehicule.immatriculation, immatriculationAffichee: l.vehicule.immatriculationAffichee, vehicule: `${l.vehicule.marque} ${l.vehicule.appellation}`, businessUnit: l.vehicule.businessUnit, site: l.site?.libelle ?? null, creee: true };
            })
            .filter((i): i is LigneInterventionFlotte => i !== null)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, monte],
  );

  const tousOrdres = useMemo(() => {
    const fusion = [...ordresCrees, ...ordres.filter((o) => !ordresCrees.some((c) => c.numero === o.numero))].map((o) => surcharger(o));
    fusion.sort((a, b) => b.datePrevue.localeCompare(a.datePrevue));
    if (cible) fusion.sort((a, b) => (a.numero === cible ? -1 : b.numero === cible ? 1 : 0));
    return fusion;
  }, [ordresCrees, ordres, surcharger, cible]);

  /* Le tableau « à faire » suit les ordres tels qu'ils sont maintenant : un ordre
     créé ici met la ligne « en cours », un ordre clos la rend à son urgence. */
  const tousTravaux = useMemo(() => {
    const ouverts = tousOrdres.filter((o) => estOuvert(o.statut));
    return travaux.map((t) => {
      const ordre = ouverts.find((o) => o.vehiculeId === t.vehiculeId && (t.origineNumero ? o.origineNumero === t.origineNumero : o.origineNumero === null && o.type === t.type)) ?? null;
      if (ordre) return { ...t, ordreNumero: ordre.numero, urgence: "en-cours" as const };
      if (t.urgence !== "en-cours") return { ...t, ordreNumero: null };
      const urgence = t.nature === "echeance" && t.kmRestants !== null && t.joursRestants !== null ? urgenceEcheance(t.kmRestants, t.joursRestants) : ("a-planifier" as const);
      return { ...t, ordreNumero: null, urgence };
    });
  }, [travaux, tousOrdres]);

  const toutesInterventions = useMemo(() => {
    const fusion = [...interventionsCreees, ...interventions.filter((i) => !interventionsCreees.some((c) => c.numero === i.numero))].map((i) => surcharger(i));
    fusion.sort((a, b) => b.date.localeCompare(a.date));
    if (cible) fusion.sort((a, b) => (a.numero === cible ? -1 : b.numero === cible ? 1 : 0));
    return fusion;
  }, [interventionsCreees, interventions, surcharger, cible]);

  /* ---- Fenêtre commune ---- */
  const depuis = useMemo(() => (periode === "tout" ? "" : decaler(aujourdhui, -Number(periode))), [periode, aujourdhui]);
  const bus = useMemo(() => (Object.keys(BUSINESS_UNIT) as BusinessUnit[]).filter((b) => tousTravaux.some((t) => t.businessUnit === b) || toutesInterventions.some((i) => i.businessUnit === b)), [tousTravaux, toutesInterventions]);
  const parBu = <T extends { businessUnit: BusinessUnit | null }>(l: T) => bu === "toutes" || l.businessUnit === bu;

  const travauxVisibles = useMemo(() => tousTravaux.filter(parBu), [tousTravaux, bu]); // eslint-disable-line react-hooks/exhaustive-deps
  const ordresVisibles = useMemo(() => tousOrdres.filter((o) => parBu(o) && (!depuis || o.datePrevue >= depuis || estOuvert(o.statut) || o.numero === cible)), [tousOrdres, bu, depuis, cible]); // eslint-disable-line react-hooks/exhaustive-deps
  const interventionsVisibles = useMemo(() => toutesInterventions.filter((i) => parBu(i) && (!depuis || i.date >= depuis || i.numero === cible)), [toutesInterventions, bu, depuis, cible]); // eslint-disable-line react-hooks/exhaustive-deps

  const enRetard = travauxVisibles.filter((t) => t.urgence === "en-retard").length;
  const aPlanifier = travauxVisibles.filter((t) => t.urgence === "a-planifier").length;
  const enCours = travauxVisibles.filter((t) => t.urgence === "en-cours").length;
  const ouverts = ordresVisibles.filter((o) => estOuvert(o.statut)).length;
  const enAtelier = ordresVisibles.filter((o) => o.statut === "en-atelier").length;
  const totalInterventions = interventionsVisibles.reduce((s, i) => s + i.montant, 0);

  /* ---- Gestes ---- */
  function planifier(t?: LigneTravail) {
    creer({
      type: "ordre",
      titre: t ? `Planifier · ${t.objet} · ${t.immatriculationAffichee}` : "Nouvel ordre de travail",
      champs: champsCreation("ordre", { pour: "maintenance" }),
      valeurs: t
        ? { vehiculeId: t.vehiculeId, type: t.type, objet: t.objet, origineNumero: t.origineNumero, datePrevue: decaler(aujourdhui, 3), immobilisationPrevueJours: t.type === "preventif" ? 1 : null }
        : { datePrevue: aujourdhui },
    });
  }

  function modifierOrdre(o: LigneOrdre) {
    demander({ type: "ordre", numero: o.numero, titre: `Ordre de travail ${o.numero} · ${o.objet}`, valeurs: o as unknown as Record<string, unknown>, champs: CHAMPS.ordre });
  }

  /* Démarrer : le véhicule entre au garage. Un geste, une trace, sans ressaisie. */
  function demarrer(o: LigneOrdre) {
    enregistrerModification({
      numero: o.numero,
      type: "ordre",
      titre: `Ordre de travail ${o.numero} · ${o.objet}`,
      href: `/maintenance?vue=ordres&ref=${o.numero}`,
      champs: CHAMPS.ordre,
      avant: o as unknown as Record<string, unknown>,
      apres: { ...(o as unknown as Record<string, unknown>), statut: "en-atelier", dateDebut: aujourdhui },
      motif: "Véhicule entré au garage",
    });
    actualiser();
  }

  /* Clôturer : l'intervention réalisée est créée sur la fiche du véhicule, et
     l'ordre se referme sur son numéro. Une saisie, deux transactions. */
  function cloturer(o: LigneOrdre) {
    const immobilisation = o.dateDebut ? Math.max(1, joursEntre(o.dateDebut, aujourdhui) + 1) : o.immobilisationPrevueJours;
    creer({
      type: "intervention",
      titre: `Clôturer ${o.numero} · intervention réalisée sur ${o.immatriculationAffichee}`,
      champs: champsCreation("intervention", { pour: "vehicule" }),
      valeurs: { date: aujourdhui, type: o.type, objet: o.objet, garage: o.garage, immobilisationJours: immobilisation, montant: o.montantEstime },
      sujetDe: () => `vehicule:${o.vehiculeId}`,
      apresCreation: (c) =>
        enregistrerModification({
          numero: o.numero,
          type: "ordre",
          titre: `Ordre de travail ${o.numero} · ${o.objet}`,
          href: `/maintenance?vue=ordres&ref=${o.numero}`,
          champs: CHAMPS.ordre,
          avant: o as unknown as Record<string, unknown>,
          apres: { ...(o as unknown as Record<string, unknown>), statut: "clos", dateCloture: aujourdhui, interventionNumero: c.numero },
          motif: `Clos par l'intervention ${c.numero}`,
        }),
    });
  }

  function modifierIntervention(i: LigneInterventionFlotte) {
    demander({ type: "intervention", numero: i.numero, titre: `Intervention ${i.numero} · ${i.objet}`, valeurs: i as unknown as Record<string, unknown>, champs: CHAMPS.intervention });
  }

  /* ---- Colonnes ---- */
  const colonnesTravaux = useMemo<ColonneListe<LigneTravail>[]>(
    () => [
      { cle: "urgence", libelle: "Urgence", parDefaut: true, largeur: 120, texte: (t) => URGENCE_TRAVAIL[t.urgence], rendu: (t) => <Echeance ton={TON_URGENCE_TRAVAIL[t.urgence]}>{URGENCE_TRAVAIL[t.urgence]}</Echeance> },
      { cle: "objet", libelle: "Objet", parDefaut: true, largeur: 280, rendu: (t) => <span className="block truncate font-medium">{t.objet}</span> },
      { cle: "echeance", libelle: "Échéance", parDefaut: true, largeur: 210, tri: (t) => t.kmRestants ?? t.joursRestants, rendu: (t) => <span className="block truncate text-texte-2">{t.echeance}</span> },
      { cle: "nature", libelle: "Nature", parDefaut: true, largeur: 170, texte: (t) => NATURE_TRAVAIL[t.nature], rendu: (t) => NATURE_TRAVAIL[t.nature] },
      { cle: "origine", libelle: "Origine", parDefaut: true, largeur: 150, texte: (t) => t.origineNumero ?? "", rendu: (t) => (t.origineNumero ? <Numero valeur={t.origineNumero} /> : <span className="text-attenue">plan d&apos;entretien</span>) },
      { cle: "ordre", libelle: "Ordre de travail", parDefaut: true, largeur: 150, texte: (t) => t.ordreNumero ?? "", rendu: (t) => (t.ordreNumero ? <Numero valeur={t.ordreNumero} /> : <span className="text-attenue">—</span>) },
      { cle: "type", libelle: "Type", parDefaut: false, largeur: 110, texte: (t) => (t.type === "preventif" ? "Préventif" : "Curatif"), rendu: (t) => <Pastille ton={t.type === "preventif" ? "favorable" : "vigilance"}>{t.type === "preventif" ? "Préventif" : "Curatif"}</Pastille> },
      { cle: "site", libelle: "Site", parDefaut: false, largeur: 150, rendu: (t) => t.site ?? "—" },
      { cle: "bu", libelle: "BU", parDefaut: false, largeur: 140, rendu: (t) => (t.businessUnit ? BUSINESS_UNIT[t.businessUnit] : "—") },
      {
        cle: "action",
        libelle: "Action",
        parDefaut: true,
        largeur: 120,
        texte: (t) => (t.ordreNumero ? "Voir l'ordre" : "Planifier"),
        rendu: (t) =>
          t.ordreNumero ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const o = tousOrdresRef.courants.find((x) => x.numero === t.ordreNumero);
                if (o) modifierOrdre(o);
              }}
              className="bouton-discret h-7 px-2 text-[12px]"
            >
              <Pencil className="size-3.5" strokeWidth={1.8} />
              Voir l&apos;ordre
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                planifier(t);
              }}
              className="bouton-principal h-7 px-2.5 text-[12px]"
            >
              <CalendarPlus className="size-3.5" strokeWidth={2} />
              Planifier
            </button>
          ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* Les colonnes sont stables ; la liste des ordres, elle, change. Une référence
     mutable la tend aux cellules sans les recréer. */
  const tousOrdresRef = useMemo(() => ({ courants: [] as LigneOrdre[] }), []);
  tousOrdresRef.courants = tousOrdres;

  const colonnesOrdres = useMemo<ColonneListe<LigneOrdre>[]>(
    () => [
      { cle: "objet", libelle: "Objet", parDefaut: true, largeur: 260, rendu: (o) => <span className="block truncate font-medium">{o.objet}</span> },
      { cle: "type", libelle: "Type", parDefaut: true, largeur: 105, texte: (o) => (o.type === "preventif" ? "Préventif" : "Curatif"), rendu: (o) => <Pastille ton={o.type === "preventif" ? "favorable" : "vigilance"}>{o.type === "preventif" ? "Préventif" : "Curatif"}</Pastille> },
      { cle: "garage", libelle: "Garage", parDefaut: true, largeur: 200, rendu: (o) => <span className="block truncate">{o.garage}</span> },
      { cle: "statut", libelle: "Statut", parDefaut: true, largeur: 110, texte: (o) => STATUT_ORDRE[o.statut], rendu: (o) => <Echeance ton={TON_STATUT_ORDRE[o.statut]}>{STATUT_ORDRE[o.statut]}</Echeance> },
      { cle: "origine", libelle: "Origine", parDefaut: true, largeur: 150, texte: (o) => o.origineNumero ?? o.origineLibelle ?? "", rendu: (o) => (o.origineNumero ? <Numero valeur={o.origineNumero} /> : <span className="text-attenue">{o.origineLibelle ?? "—"}</span>) },
      { cle: "intervention", libelle: "Intervention", parDefaut: true, largeur: 150, texte: (o) => o.interventionNumero ?? "", rendu: (o) => (o.interventionNumero ? <Numero valeur={o.interventionNumero} /> : <span className="text-attenue">—</span>) },
      { cle: "immob", libelle: "Immob. prévue", parDefaut: false, largeur: 120, alignee: "droite", tri: (o) => o.immobilisationPrevueJours, rendu: (o) => (o.immobilisationPrevueJours === null ? "—" : <span className="code">{o.immobilisationPrevueJours} j</span>) },
      { cle: "montant", libelle: "Montant estimé", parDefaut: false, largeur: 130, alignee: "droite", tri: (o) => o.montantEstime, rendu: (o) => (o.montantEstime === null ? "—" : <span className="code">{montant(o.montantEstime)}</span>) },
      { cle: "debut", libelle: "Entré le", parDefaut: false, largeur: 110, tri: (o) => o.dateDebut, rendu: (o) => <span className="code">{o.dateDebut ? dateCourte(o.dateDebut) : "—"}</span> },
      { cle: "cloture", libelle: "Clos le", parDefaut: false, largeur: 110, tri: (o) => o.dateCloture, rendu: (o) => <span className="code">{o.dateCloture ? dateCourte(o.dateCloture) : "—"}</span> },
      { cle: "demandeur", libelle: "Demandeur", parDefaut: false, largeur: 170, rendu: (o) => o.demandeur },
      { cle: "site", libelle: "Site", parDefaut: false, largeur: 150, rendu: (o) => o.site ?? "—" },
      { cle: "commentaire", libelle: "Commentaire", parDefaut: false, largeur: 280, rendu: (o) => <span className="block truncate">{o.commentaire ?? "—"}</span> },
      {
        cle: "action",
        libelle: "Action",
        parDefaut: true,
        largeur: 120,
        texte: (o) => {
          const action = actionSuivante(o.statut);
          return action === "demarrer" ? "Démarrer" : action === "cloturer" ? "Clôturer" : "Modifier";
        },
        rendu: (o) => {
          const action = actionSuivante(o.statut);
          return (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (action === "demarrer") demarrer(o);
                else if (action === "cloturer") cloturer(o);
                else modifierOrdre(o);
              }}
              className={action ? "bouton-principal h-7 px-2.5 text-[12px]" : "bouton-discret h-7 px-2 text-[12px]"}
            >
              {action === "demarrer" ? <Play className="size-3.5" strokeWidth={2} /> : action === "cloturer" ? <Wrench className="size-3.5" strokeWidth={2} /> : <Pencil className="size-3.5" strokeWidth={1.8} />}
              {action === "demarrer" ? "Démarrer" : action === "cloturer" ? "Clôturer" : "Modifier"}
            </button>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const colonnesInterventions = useMemo<ColonneListe<LigneInterventionFlotte>[]>(
    () => [
      { cle: "type", libelle: "Type", parDefaut: true, largeur: 105, texte: (i) => (i.type === "preventif" ? "Préventif" : "Curatif"), rendu: (i) => <Pastille ton={i.type === "preventif" ? "favorable" : "vigilance"}>{i.type === "preventif" ? "Préventif" : "Curatif"}</Pastille> },
      { cle: "objet", libelle: "Objet", parDefaut: true, largeur: 260, rendu: (i) => <span className="block truncate font-medium">{i.objet}</span> },
      { cle: "garage", libelle: "Garage", parDefaut: true, largeur: 200, rendu: (i) => <span className="block truncate">{i.garage}</span> },
      { cle: "km", libelle: "Km relevé", parDefaut: false, largeur: 120, alignee: "droite", tri: (i) => i.km, rendu: (i) => <span className="code">{kilometrage(i.km)}</span> },
      { cle: "immob", libelle: "Immob.", parDefaut: true, largeur: 95, alignee: "droite", tri: (i) => i.immobilisationJours, rendu: (i) => (i.immobilisationJours === null ? <span className="text-attenue" title="Durée non relevée sur la pièce">—</span> : <span className="code">{i.immobilisationJours} j</span>) },
      { cle: "montant", libelle: "Montant", parDefaut: true, largeur: 125, alignee: "droite", tri: (i) => i.montant, rendu: (i) => <span className="code font-medium">{montant(i.montant)}</span> },
      { cle: "piece", libelle: "Pièce", parDefaut: true, largeur: 110, rendu: (i) => <span className="code text-[12px]">{i.reference || "—"}</span> },
      { cle: "site", libelle: "Site", parDefaut: false, largeur: 150, rendu: (i) => i.site ?? "—" },
      { cle: "bu", libelle: "BU", parDefaut: false, largeur: 140, rendu: (i) => (i.businessUnit ? BUSINESS_UNIT[i.businessUnit] : "—") },
      {
        cle: "action",
        libelle: "Action",
        parDefaut: true,
        largeur: 100,
        texte: () => "Modifier",
        rendu: (i) => (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              modifierIntervention(i);
            }}
            className="bouton-discret h-7 px-2 text-[12px]"
          >
            <Pencil className="size-3.5" strokeWidth={1.8} />
            Modifier
          </button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const sousTitre =
    vue === "afaire"
      ? `${enRetard} en retard · ${aPlanifier} à planifier · ${enCours} en cours · au ${date(aujourdhui)}`
      : vue === "ordres"
        ? `${ordresVisibles.length} ordre${ordresVisibles.length > 1 ? "s" : ""} de travail · ${ouverts} ouvert${ouverts > 1 ? "s" : ""} · ${enAtelier} en atelier · au ${date(aujourdhui)}`
        : `${interventionsVisibles.length} intervention${interventionsVisibles.length > 1 ? "s" : ""} · ${montant(totalInterventions)} · au ${date(aujourdhui)}`;

  return (
    <div className="flex flex-col gap-5 px-8 py-7 lg:h-full">
      <TitreEcran
        titre="Maintenance"
        sousTitre={sousTitre}
        actions={
          <>
            <Segments
              valeur={vue}
              options={[
                { cle: "afaire" as VueMaintenance, libelle: "À faire" },
                { cle: "ordres" as VueMaintenance, libelle: "Ordres de travail" },
                { cle: "interventions" as VueMaintenance, libelle: "Interventions" },
              ]}
              onChange={setVue}
              etiquette="Vue"
            />
            {vue !== "afaire" ? <Segments valeur={periode} options={PERIODES} onChange={setPeriode} etiquette="Période" /> : null}
            <Segments
              valeur={bu}
              options={[{ cle: "toutes" as BusinessUnit | "toutes", libelle: "Toutes BU" }, ...bus.map((b) => ({ cle: b as BusinessUnit | "toutes", libelle: BUSINESS_UNIT[b] }))]}
              onChange={setBu}
              etiquette="Business unit"
            />
            {vue !== "interventions" ? (
              <button type="button" onClick={() => planifier()} className="bouton-principal">
                <Plus className="size-4" strokeWidth={2.2} />
                Ordre de travail
              </button>
            ) : null}
          </>
        }
      />

      {vue === "afaire" ? (
        <TableListe<LigneTravail>
          ecran="maintenance"
          lignes={travauxVisibles}
          cle={(t) => t.cle}
          href={(t) => `/flotte/${t.immatriculation}?onglet=entretien${t.origineNumero ? `&ref=${t.origineNumero}` : ""}`}
          filet={(t) => ({ couleur: COULEUR_URGENCE_TRAVAIL[t.urgence], libelle: URGENCE_TRAVAIL[t.urgence], precision: PRECISION_URGENCE_TRAVAIL[t.urgence] })}
          identifiant={{ cle: "immat", libelle: "Véhicule", largeur: 130, rendu: (t) => <span className="code">{t.immatriculationAffichee}</span> }}
          colonnes={colonnesTravaux}
          filtres={FILTRES_TRAVAUX}
          champsRecherche={(t) => [t.immatriculationAffichee, t.vehicule, t.objet, t.echeance, t.origineNumero ?? "", t.ordreNumero ?? "", t.site ?? "", NATURE_TRAVAIL[t.nature], URGENCE_TRAVAIL[t.urgence]]}
          placeholderRecherche="Immatriculation, objet, référence, site…"
          libelleRecherche="Rechercher un travail à faire"
          libelleUnite="travaux"
          vide="Rien à faire dans cette sélection."
        />
      ) : vue === "ordres" ? (
        <TableListe<LigneOrdre>
          ecran="ordres"
          lignes={ordresVisibles}
          cle={(o) => o.numero}
          href={(o) => `/flotte/${o.immatriculation}?onglet=entretien${o.interventionNumero ? `&ref=${o.interventionNumero}` : ""}`}
          filet={(o) => ({ couleur: COULEUR_STATUT_ORDRE[o.statut], libelle: STATUT_ORDRE[o.statut], precision: PRECISION_STATUT_ORDRE[o.statut] })}
          identifiant={{ cle: "numero", libelle: "Réf.", largeur: 140, rendu: (o) => <Numero valeur={o.numero} /> }}
          fixes={FIXES_ORDRES}
          colonnes={colonnesOrdres}
          filtres={FILTRES_ORDRES}
          champsRecherche={(o) => [o.numero, o.immatriculationAffichee, o.vehicule, o.objet, o.garage, o.origineNumero ?? "", o.interventionNumero ?? "", o.demandeur, STATUT_ORDRE[o.statut]]}
          placeholderRecherche="Référence, immatriculation, objet, garage…"
          libelleRecherche="Rechercher un ordre de travail"
          libelleUnite="ordres"
          vide="Aucun ordre de travail ne correspond."
          surLigne={modifierOrdre}
        />
      ) : (
        <TableListe<LigneInterventionFlotte>
          ecran="interventions"
          lignes={interventionsVisibles}
          cle={(i) => i.numero}
          href={(i) => `/flotte/${i.immatriculation}?onglet=entretien&ref=${i.numero}`}
          filet={(i) => ({ couleur: i.type === "preventif" ? "var(--color-accent)" : "var(--color-vigilance)", libelle: i.type === "preventif" ? "Préventive" : "Curative", precision: i.type === "preventif" ? "Entretien planifié" : "Réparation après panne ou défaut" })}
          identifiant={{ cle: "numero", libelle: "Réf.", largeur: 140, rendu: (i) => <Numero valeur={i.numero} /> }}
          fixes={FIXES_INTERVENTIONS}
          colonnes={colonnesInterventions}
          filtres={FILTRES_INTERVENTIONS}
          champsRecherche={(i) => [i.numero, i.immatriculationAffichee, i.vehicule, i.objet, i.garage, i.reference, i.site ?? ""]}
          placeholderRecherche="Référence, immatriculation, objet, garage…"
          libelleRecherche="Rechercher une intervention"
          libelleUnite="interventions"
          vide="Aucune intervention ne correspond."
          surLigne={modifierIntervention}
        />
      )}
    </div>
  );
}

/* Constantes de module : mêmes colonnes d'un rendu à l'autre, sinon l'effet qui
   lit les préférences repart en boucle. */
const FIXES_ORDRES: ColonneListe<LigneOrdre>[] = [
  { cle: "immat", libelle: "Véhicule", parDefaut: true, largeur: 120, rendu: (o) => <Link href={`/flotte/${o.immatriculation}`} onClick={(e) => e.stopPropagation()} className="code font-medium text-accent-fonce hover:underline">{o.immatriculationAffichee}</Link> },
  { cle: "date", libelle: "Prévu le", parDefaut: true, largeur: 100, tri: (o) => o.datePrevue, rendu: (o) => <span className="code">{dateCourte(o.datePrevue)}</span> },
];

const FIXES_INTERVENTIONS: ColonneListe<LigneInterventionFlotte>[] = [
  { cle: "immat", libelle: "Véhicule", parDefaut: true, largeur: 120, rendu: (i) => <Link href={`/flotte/${i.immatriculation}`} onClick={(e) => e.stopPropagation()} className="code font-medium text-accent-fonce hover:underline">{i.immatriculationAffichee}</Link> },
  { cle: "date", libelle: "Date", parDefaut: true, largeur: 100, tri: (i) => i.date, rendu: (i) => <span className="code">{dateCourte(i.date)}</span> },
];
