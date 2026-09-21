"use client";

import { LienRetour } from "@/composants/interface/LienRetour";
import { definitionDocument, prixEnergie } from "@/domaine/parametres";
import { jourCourant } from "@/domaine/temps";
import { lireParametres } from "@/lib/parametres-demo";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { estProvisoire, normaliser } from "@/domaine/immatriculation";
import { Archive, ArchiveRestore, Link2, Lock, MapPin, Pencil, Radio, UserRound } from "lucide-react";
import { BoutonDiscussion, PanneauDiscussion } from "@/composants/discussion/PanneauDiscussion";
import { BandeauKpi } from "@/composants/interface/BandeauKpi";
import { useCible } from "@/composants/interface/useCible";
import { CHAMPS, champsCreation } from "@/composants/transactions/champs";
import { peutCourant } from "@/lib/acces-courant";
import { useEdition } from "@/composants/transactions/ContexteEdition";
import { FormulaireDeclaration } from "@/composants/incidents/FormulaireDeclaration";
import { OngletIncidents } from "@/composants/vehicule/OngletIncidents";
import { fabriquerAffectationVehicule, fabriquerDocument, fabriquerPeriodeStatut, fabriquerRappel, fabriquerReleve, libelleSite } from "@/composants/transactions/fabriques";
import { etatRappel } from "@/domaine/rappels";
import type { TypeDocument } from "@/domaine/types";
import { TYPE_TRANSACTION, type TypeTransaction } from "@/domaine/reference";
import { StatutModifiable } from "./StatutModifiable";
import type { FicheVehicule as Fiche } from "@/domaine/fiche";
import type { Personne } from "@/domaine/discussion";
import type { Transfert } from "@/domaine/transferts";
import { idAttributaire } from "@/domaine/parc-leger";
import { BUSINESS_UNIT, STATUT_VEHICULE, TYPE_DOCUMENT, libelleCategorie } from "@/domaine/libelles";
import { personnesUtilisateurs } from "@/lib/discussion-demo";
import { date, montantCourt, nombre } from "@/lib/format";
import { controlerReleves } from "@/domaine/releves";
import { alertesDeLaFiche, alertesParOnglet } from "./alertes-fiche";
import { MenuAjout, type CibleAjout } from "./MenuAjout";
import { useAjoutVehicule } from "./ajout";
import { PhotoVehicule } from "./PhotoVehicule";
import { BoutonQr } from "./PanneauQr";
import { enregistrerModification } from "@/lib/clotures-demo";
import {
  OngletAffectations,
  OngletApercu,
  OngletAutresDepenses,
  OngletCaracteristiques,
  OngletCarburant,
  OngletConformite,
  OngletMaintenance,
  OngletPlanEntretien,
  OngletJournal,
  OngletKilometrage,
} from "./onglets";
import { OngletDossier } from "./OngletDossier";
import { OngletLivraisons } from "./OngletLivraisons";

const LIBELLE_ORIGINE_RELEVE: Record<Fiche["releves"][number]["origine"], string> = {
  saisie: "saisie manuelle",
  plein: "au plein",
  garage: "au garage",
  telematique: "par la balise",
  depense: "avec une dépense",
};

type Onglet =
  | "apercu"
  | "caracteristiques"
  | "affectations"
  | "conformite"
  | "incidents"
  | "maintenance"
  | "plan"
  | "carburant"
  | "autres"
  | "kilometrage"
  | "livraisons"
  | "journal";

/**
 * L'Aperçu porte tout ce qui s'agrège, s'analyse ou alerte. Chaque autre
 * onglet est une liste de transactions d'un seul type — c'est la règle posée
 * par le métier, et elle décide de ce qui va où.
 */
const ONGLETS: { cle: Onglet; libelle: string; ordinateurSeulement?: boolean }[] = [
  { cle: "apercu", libelle: "Aperçu" },
  { cle: "caracteristiques", libelle: "Caractéristiques" },
  { cle: "affectations", libelle: "Affectations" },
  /* Conformité et Dossier réunis (métier, 21 septembre 2026) : l'échéance de
     ce qui se renouvelle, et la pièce qui le prouve, sur le même onglet. */
  { cle: "conformite", libelle: "Conformité" },
  { cle: "incidents", libelle: "Incidents & sinistres" },
  { cle: "maintenance", libelle: "Maintenance" },
  /* Les rappels sur leur propre onglet (15 septembre 2026) : ce qui reste à
     faire ne se lit pas au même moment que ce qui a été fait. */
  { cle: "plan", libelle: "Plan d'entretien" },
  { cle: "carburant", libelle: "Carburant" },
  { cle: "autres", libelle: "Autres dépenses" },
  { cle: "kilometrage", libelle: "Kilométrages" },
  { cle: "livraisons", libelle: "Livraisons" },
  { cle: "journal", libelle: "Journal" },
];

function estOnglet(valeur: string | undefined): valeur is Onglet {
  return ONGLETS.some((o) => o.cle === valeur);
}

/** Les adresses d'avant la réunion des onglets mènent toujours quelque part : « dossier » ouvre la Conformité. */
function ongletDe(valeur: string | undefined): Onglet {
  if (valeur === "dossier") return "conformite";
  return estOnglet(valeur) ? valeur : "apercu";
}

/**
 * Fiche véhicule 360°.
 *
 * L'en-tête — retour, identité, indicateurs, onglets — est fixe : seul le
 * contenu de l'onglet défile. C'est une colonne flex bornée en hauteur dont
 * le dernier enfant prend le reste et porte le défilement ; aucun `sticky`,
 * donc aucun décalage à compenser.
 */
export function FicheVehicule({ fiche, transferts = [], utilisateurs, ongletInitial, discussionInitiale = false, cible, detenteur }: { fiche: Fiche; transferts?: Transfert[]; /** Les comptes que la discussion peut citer ; ceux de la démonstration à défaut. */ utilisateurs?: Personne[]; ongletInitial?: string; discussionInitiale?: boolean; cible?: string; /** Le dossier du parc léger d'un véhicule de service ou de fonction : détenteur, forfait, plan car. */ detenteur?: ReactNode }) {
  const router = useRouter();
  const [onglet, setOnglet] = useState<Onglet>(ongletDe(ongletInitial));
  useCible(cible, onglet);
  const [discussionOuverte, setDiscussionOuverte] = useState(discussionInitiale);
  const [declaration, setDeclaration] = useState(false);
  const [nombreMessages, setNombreMessages] = useState<number | null>(null);
  const { surcharger, creer, demander, creations, actualiser, saisirFacture } = useEdition();
  const ajouterCommun = useAjoutVehicule(fiche);

  /* Archiver relève de la gestion de la flotte, comme créer un véhicule : le
     bouton ne promet rien à qui n'en a que la saisie ou la lecture. */
  const [peutGerer, setPeutGerer] = useState(false);
  useEffect(() => setPeutGerer(peutCourant("flotte", "gestion")), []);
  function archiver() {
    const vehicule = fiche.ligne.vehicule;
    creer({
      type: "archive",
      titre: `${vehicule.archiveLe ? "Désarchiver" : "Archiver"} · ${vehicule.immatriculationAffichee}`,
      champs: CHAMPS.archive,
      valeurs: { date: jourCourant() },
    });
  }

  /* La fiche elle-même se modifie et se trace comme une transaction : ses
     valeurs surchargées s'affichent ici, dans l'en-tête, et dans Caractéristiques. */
  /* Les alertes se comptent sur **les mêmes listes que les onglets affichent**,
     créations comprises : sans quoi le badge et l'écran se contrediraient. */
  const documentsVus = [...creations("document", (c) => fabriquerDocument(c, fiche.ligne.vehicule.categorie)), ...fiche.documents.map(surcharger)];
  const affectationsVues = [...creations("affectation", (c) => fabriquerAffectationVehicule(c, "")), ...fiche.affectations.map(surcharger)];
  const relevesVus = controlerReleves([...creations("releve", fabriquerReleve), ...fiche.releves.map(surcharger)], fiche.ligne.vehicule.categorie);
  const badges = alertesParOnglet(alertesDeLaFiche(fiche, { documents: documentsVus, affectations: affectationsVues, releves: relevesVus }));

  const numeroFiche = `VEH-${fiche.ligne.vehicule.immatriculation}`;
  const v = surcharger({ numero: numeroFiche, ...fiche.ligne.vehicule });
  const siteLibelle = v.siteId === fiche.ligne.vehicule.siteId ? (fiche.ligne.site?.libelle ?? "—") : (libelleSite(v.siteId) ?? "—");
  /* Un changement de statut créé dans l'application prime sur le statut du jeu de données. */
  const statutsCrees = creations("statut", fabriquerPeriodeStatut).sort((a, b) => b.debut.localeCompare(a.debut));
  /* Le document échu avertit, il n'impose plus le statut (15 septembre 2026) :
     c'est l'équipe parc qui sait si le camion roule, attend au garage ou part
     en mutation — pas un échéancier. */
  /*
   * SEULS LES DOCUMENTS SUIVIS EN CONFORMITÉ se signalent ici (métier,
   * 21 septembre 2026 — AB-932-ET affichait « licence de transport échue »
   * alors que la liste des échéances suivies ne la citait pas). L'en-tête lit
   * donc les rappels du véhicule, créations et corrections comprises : un
   * rappel échu d'un document critique l'immobilise administrativement.
   */
  const rappelsSuivis = [
    ...creations("rappel", (c) => fabriquerRappel(c, { vehicule: { id: fiche.ligne.vehicule.id, immatriculation: fiche.ligne.vehicule.immatriculation, immatriculationAffichee: fiche.ligne.vehicule.immatriculationAffichee, marque: fiche.ligne.vehicule.marque, appellation: fiche.ligne.vehicule.appellation } })),
    ...fiche.rappels.map(surcharger),
  ];
  const echus = rappelsSuivis.filter((r) => etatRappel(r.echeance, jourCourant()) === "echu" && (definitionDocument(r.type, lireParametres())?.critique ?? false));
  const immobilisation: { documents: { type: TypeDocument; etat: "echu" | "manquant" }[] } | null = echus.length ? { documents: [...new Set(echus.map((r) => r.type))].map((type) => ({ type, etat: "echu" })) } : null;
  const statutCourant = statutsCrees[0]?.statut ?? v.statut;
  const i = fiche.indicateurs;
  const titulaire = fiche.affectations.find((a) => a.role === "titulaire" && a.fin === null) ?? null;
  /* Qui tient ce véhicule, quand ce n'est pas un chauffeur : la liste Flotte le
     nomme depuis toujours, l'en-tête de la fiche l'ignorait. */
  const attributaire = fiche.ligne.attributaire ?? null;
  const leger = Boolean(v.regime && v.regime !== "exploitation");

  /* Sans formulaire encore, le menu « Ajouter » ouvre l'onglet qui liste le
     type choisi. Les cibles sans onglet propre (incident, statut) mènent au
     journal, où leur trace finira. */
  const ONGLET_PAR_CIBLE: Partial<Record<CibleAjout, Onglet>> = {
    plein: "carburant",
    depense: "autres",
    intervention: "maintenance",
    affectation: "affectations",
    attelage: "affectations",
    attribution: "affectations",
    visite: "conformite",
    observation: "maintenance",
    incident: "incidents",
    document: "conformite",
    releve: "kilometrage",
    statut: "journal",
    inspection: "maintenance",
    "ordre-de-travail": "maintenance",
    rappel: "conformite",
  };
  /* Chaque entrée du menu ouvre son formulaire ; à la création, l'onglet qui
     liste ce type s'ouvre pour montrer la ligne nouvelle. */
  const TITRE_CREATION: Partial<Record<CibleAjout, string>> = {
    plein: "Nouveau plein",
    depense: "Nouvelle dépense",
    intervention: "Nouvelle intervention",
    affectation: "Nouvelle affectation",
    attelage: "Nouvel attelage",
    attribution: "Attribution",
    visite: "Rendez-vous de visite technique",
    observation: "Observation de visite technique",
    incident: "Déclarer un incident ou un accident",
    document: "Nouveau document",
    releve: "Nouveau relevé kilométrique",
    statut: "Changement de statut",
  };
  function ajouter(cible: CibleAjout) {
    /* La déclaration a son formulaire en quatre étapes (cadrage incidents). */
    if (cible === "incident") {
      setDeclaration(true);
      return;
    }
    /* Signaler une panne, ouvrir un service : le geste des onglets (0060). */
    if (cible === "signalement" || cible === "ordre-de-travail") {
      ajouterCommun(cible);
      setOnglet("maintenance");
      return;
    }
    /* Une intervention et une dépense se saisissent comme la facture qui les
       porte, depuis ce menu comme depuis les listes (21 septembre 2026). */
    if (cible === "intervention" || cible === "depense") {
      saisirFacture({ mode: cible === "intervention" ? "atelier" : "autres", vehicule: { immatriculation: v.immatriculation, immatriculationAffichee: v.immatriculationAffichee, libelle: `${v.marque} ${v.appellation}` } });
      setOnglet(ONGLET_PAR_CIBLE[cible] ?? "journal");
      return;
    }
    const type = cible as TypeTransaction;
    const titre = TITRE_CREATION[cible];
    if (titre && type in TYPE_TRANSACTION) {
      creer({
        type,
        titre: `${titre} · ${v.immatriculationAffichee}`,
        champs: champsCreation(type, {
          pour: "vehicule",
          categorie: v.categorie,
          visites: fiche.visitesTechniques.map((x) => ({ valeur: x.id, libelle: `${x.type === "contre-visite" ? "Contre-visite" : "Visite"} du ${date(x.datePassage ?? x.dateRendezVous)} · ${x.centre}` })),
        }),
        valeurs: {
          date: jourCourant(),
          debut: jourCourant(),
          dateEffet: jourCourant(),
          dateHeure: jourCourant(),
          dateRendezVous: jourCourant(),
          origine: "caisse",
          /* Le prix du litre vient du barème **en vigueur ce jour**, selon
             l'énergie du véhicule : on saisit un plein d'aujourd'hui. Pour un
             plein antérieur, la date saisie prime — le prix se corrige à la
             main, l'application ne devine pas à quel barème il se rattache. */
          prixLitre: type === "plein" ? prixEnergie(v.energie, jourCourant(), lireParametres()) : undefined,
          statut: type === "visite" ? "rendez-vous" : type === "observation" ? "a-traiter" : "declare",
          roulant: "oui",
          /* L'attelage a deux côtés : la fiche dit lequel elle tient, sinon la
             base ne saurait pas qui tracte qui. */
          role: type === "attelage" ? (v.categorie === "semi-remorque" ? "remorque" : "tracteur") : undefined,
          type: type === "visite" ? "visite" : undefined,
          centre: "CCVA Rufisque",
        },
      });
    }
    setOnglet(ONGLET_PAR_CIBLE[cible] ?? "journal");
  }

  /* Qui peut être cité dans la discussion : les utilisateurs de l'application
     et les chauffeurs passés par ce véhicule. */
  const personnes: Personne[] = useMemo(() => {
    const vus = new Set<string>();
    const chauffeurs: Personne[] = [];
    for (const a of fiche.affectations) {
      if (!a.chauffeurId || !a.chauffeur || vus.has(a.chauffeurId)) continue;
      vus.add(a.chauffeurId);
      chauffeurs.push({ id: `chauffeur:${a.chauffeurId}`, nom: a.chauffeur, initiales: a.initiales, precision: `Chauffeur — ${a.fin === null ? (a.role === "titulaire" ? "titulaire" : "suppléant") : "ancienne affectation"}` });
    }
    return [...(utilisateurs ?? personnesUtilisateurs()), ...chauffeurs];
  }, [fiche.affectations, utilisateurs]);

  return (
    <div className="flex flex-col lg:h-full">
      {/* ---- En-tête fixe ---- */}
      <div className="flex shrink-0 flex-col gap-4 border-b border-bordure px-8 pt-6 pb-0">
        <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[12.5px] text-attenue">
          <LienRetour href="/flotte" libelle="Flotte" />
        </nav>

        <div className="flex flex-wrap items-start gap-4">
          {/* La photo d'abord : sur un parc où trois camions du même modèle se
              ressemblent, c'est elle qui identifie avant l'immatriculation. */}
          <PhotoVehicule
            photo={typeof v.photo === "string" && v.photo ? v.photo : null}
            categorie={v.categorie}
            immatriculation={v.immatriculationAffichee}
            onChanger={(photo) =>
              enregistrerModification({
                numero: numeroFiche,
                type: "vehicule",
                titre: `Fiche ${v.immatriculationAffichee}`,
                href: `/flotte/${v.immatriculation}`,
                champs: [{ cle: "photo", libelle: "Photo", type: "texte" }],
                avant: { photo: v.photo ?? null },
                apres: { photo },
                motif: photo ? "Photo du véhicule ajoutée" : "Photo du véhicule retirée",
              }) && actualiser()
            }
          />
          <div className="min-w-0 flex-1 basis-[420px]">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="titre-page code whitespace-nowrap">{v.immatriculationAffichee}</h1>
              <StatutModifiable
                statut={statutCourant}
                immatriculation={v.immatriculation}
                immatriculationAffichee={v.immatriculationAffichee}
                immobilisation={immobilisation?.documents ?? null}
                aujourdhui={jourCourant()}
              />
              {immobilisation ? (
                <span
                  title={`Statut saisi : ${STATUT_VEHICULE[v.statut].libelle}. Le véhicule repasse à ce statut dès que les documents sont renouvelés.`}
                  className="inline-flex h-6 items-center gap-1.5 rounded-full bg-defavorable-fond px-2.5 text-[12px] font-medium text-defavorable"
                >
                  <Lock className="size-3" strokeWidth={2} />
                  Immobilisé administrativement · {immobilisation.documents.map((d) => `${TYPE_DOCUMENT[d.type].toLowerCase()} ${d.etat === "manquant" ? "manquant" : "échu"}`).join(", ")}
                </span>
              ) : null}
              {v.transportSpecial ? (
                <span className="inline-flex h-6 items-center rounded-full bg-surface-3 px-2.5 text-[12px] font-medium text-texte-2">
                  Transport spécial
                </span>
              ) : null}
              {/* Sans plaque : le châssis tient lieu de clé jusqu'à la carte
                  grise (16 septembre 2026). Le bouton ouvre la seule saisie
                  utile ; la fiche suit sa nouvelle adresse, l'historique reste. */}
              {estProvisoire(v.immatriculation) ? (
                <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-vigilance-fond px-2.5 text-[12px] font-medium text-vigilance" title="La carte grise n'est pas encore là : le véhicule est entré sous son numéro de châssis">
                  Sans plaque · VIN <span className="code">{v.vin ?? v.immatriculation.slice(3)}</span>
                  <button
                    type="button"
                    className="ml-1 underline decoration-dotted underline-offset-2 hover:text-texte"
                    onClick={() =>
                      demander({
                        type: "vehicule",
                        numero: numeroFiche,
                        titre: `Immatriculer · ${v.marque} ${v.appellation}`,
                        champs: [
                          { cle: "immatriculation", libelle: "Immatriculation (carte grise)", type: "texte", obligatoire: true },
                          { cle: "dateImmatriculation", libelle: "Date d'immatriculation", type: "date" },
                        ],
                        valeurs: { immatriculation: "", dateImmatriculation: v.dateImmatriculation ?? "" },
                        apresModification: (apres) => {
                          const suivante = normaliser(String(apres.immatriculation ?? ""));
                          if (suivante && suivante !== v.immatriculation) router.replace(`/flotte/${suivante}`);
                        },
                      })
                    }
                  >
                    Renseigner la plaque
                  </button>
                </span>
              ) : null}
              {v.archiveLe ? (
                <span
                  title={`Archivé le ${date(v.archiveLe.slice(0, 10))}${v.archiveMotif ? ` — ${v.archiveMotif}` : ""}. Le véhicule ne figure plus dans les listes ni dans les choix ; « Désarchiver » l'y remet.`}
                  className="inline-flex h-6 items-center gap-1.5 rounded-full bg-surface-3 px-2.5 text-[12px] font-medium text-texte-2"
                >
                  <Archive className="size-3" strokeWidth={2} />
                  Archivé le {date(v.archiveLe.slice(0, 10))}
                  {v.archiveMotif ? ` · ${v.archiveMotif}` : ""}
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-texte-2">
              <span className="font-medium text-texte">
                {v.marque} {v.appellation}
              </span>
              <span className="text-attenue-2">·</span>
              <span>{libelleCategorie(v)}</span>
              <span className="text-attenue-2">·</span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5 text-attenue" strokeWidth={1.8} />
                {v.businessUnit ? BUSINESS_UNIT[v.businessUnit] : "—"} · {siteLibelle}
              </span>
              <span className="text-attenue-2">·</span>
              {/* Le nom mène à la fiche du chauffeur — c'est ce qu'on attend
                  d'un nom —, et le crayon d'à côté change qui conduit, sans
                  passer par l'onglet Affectations. Le même crayon sert quand
                  personne n'est affecté : c'est justement là qu'il faut agir. */}
              {titulaire ? (
                <span className="inline-flex items-center gap-1.5" title={`Titulaire depuis le ${date(titulaire.debut)}`}>
                  <UserRound className="size-3.5 text-attenue" strokeWidth={1.8} />
                  {titulaire.chauffeurId ? (
                    <Link href={`/chauffeurs/${titulaire.chauffeurId}`} className="font-medium text-texte hover:text-accent-fonce hover:underline">
                      {titulaire.chauffeur}
                    </Link>
                  ) : (
                    <span className="font-medium text-texte">{titulaire.chauffeur}</span>
                  )}
                  {fiche.ligne.nombreSuppleants > 0 ? <span className="text-attenue">+ {fiche.ligne.nombreSuppleants} suppléant</span> : null}
                  <BoutonAffecter onClick={() => ajouter("affectation")} libelle={`Changer l'affectation de ${v.immatriculationAffichee}`} />
                </span>
              ) : attributaire ? (
                /* Un véhicule de service ou de fonction n'a pas de chauffeur :
                   il a quelqu'un qui le tient. L'en-tête disait « Aucun
                   chauffeur affecté » là où la liste Flotte nommait
                   l'attributaire — deux écrans, deux réponses, pour le même
                   véhicule (corrigé le 15 septembre 2026). */
                <span className="inline-flex items-center gap-1.5" title="Le véhicule est attribué, non affecté à un chauffeur">
                  <UserRound className="size-3.5 text-attenue" strokeWidth={1.8} />
                  {attributaire.pool ? (
                    <span className="font-medium text-texte-2">{attributaire.nom}</span>
                  ) : (
                    <Link href={`/attributaires/${idAttributaire(attributaire.nom)}`} className="font-medium text-texte hover:text-accent-fonce hover:underline">
                      {attributaire.nom}
                    </Link>
                  )}
                  <BoutonAffecter onClick={() => ajouter("attribution")} libelle={`Changer ou retirer l'attributaire de ${v.immatriculationAffichee}`} />
                </span>
              ) : leger ? (
                /* Léger sans personne : ce qui manque est une attribution, pas
                   une affectation — et c'est le bon geste qu'on propose. */
                <span className="inline-flex items-center gap-1.5 text-vigilance">
                  <UserRound className="size-3.5" strokeWidth={1.8} />
                  Aucun attributaire
                  <BoutonAffecter onClick={() => ajouter("attribution")} libelle={`Attribuer ${v.immatriculationAffichee} à quelqu'un`} />
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-vigilance">
                  <UserRound className="size-3.5" strokeWidth={1.8} />
                  Aucun chauffeur affecté
                  <BoutonAffecter onClick={() => ajouter("affectation")} libelle={`Affecter un chauffeur à ${v.immatriculationAffichee}`} />
                </span>
              )}
              {fiche.ligne.attelageCourant ? (
                <>
                  <span className="text-attenue-2">·</span>
                  <span className="inline-flex items-center gap-1.5" title={fiche.ligne.attelageCourant.role === "tracteur" ? "Remorque attelée" : "Tracteur attelé"}>
                    <Link2 className="size-3.5 text-attenue" strokeWidth={1.8} />
                    <span className="text-texte-2">{fiche.ligne.attelageCourant.role === "tracteur" ? "tire" : "tirée par"}</span>
                    <Link href={`/flotte/${fiche.ligne.attelageCourant.immatriculation}`} className="code font-medium text-texte hover:text-accent-fonce hover:underline">
                      {fiche.ligne.attelageCourant.immatriculationAffichee}
                    </Link>
                  </span>
                </>
              ) : null}
              {fiche.identite.gpsActif ? (
                <>
                  <span className="text-attenue-2">·</span>
                  <span className="inline-flex items-center gap-1.5 text-accent-fonce">
                    <Radio className="size-3.5" strokeWidth={1.8} />
                    GPS actif
                  </span>
                </>
              ) : null}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() =>
                demander({
                  type: "vehicule",
                  numero: numeroFiche,
                  titre: `Fiche ${v.immatriculationAffichee}`,
                  /* La plaque se propose au format d'affichage — c'est ainsi
                     qu'on la lit sur la carte grise ; l'écriture la ramène à sa
                     forme canonique. */
                  /* Le plan car ne vit pas sur le véhicule mais sur son
                     attribution : la case doit montrer ce qui est engagé. */
                  valeurs: { ...fiche.identite, ...fiche.ligne.vehicule, immatriculation: v.immatriculationAffichee, planCar: fiche.ligne.attributaire?.planCar ?? false } as unknown as Record<string, unknown>,
                  /* Changer la plaque change l'adresse de la fiche : sans ce
                     saut, un rechargement tomberait sur l'ancienne, qui n'existe
                     plus. Le véhicule, lui, n'a pas bougé — c'est le même
                     identifiant qui porte ses dépenses et ses livraisons. */
                  apresModification: (apres) => {
                    const suivante = normaliser(String(apres.immatriculation ?? ""));
                    if (suivante && suivante !== v.immatriculation) router.replace(`/flotte/${suivante}`);
                  },
                })
              }
              className="bouton-secondaire"
            >
              <Pencil className="size-4 text-texte-2" strokeWidth={1.7} />
              Modifier
            </button>
            {/* Archiver n'est pas sortir (0054) : le véhicule quitte les listes
                sans qu'on affirme rien sur son sort, et y revient d'un clic. Le
                geste relève de la gestion de la flotte, comme créer un véhicule. */}
            {peutGerer ? (
              <button
                type="button"
                onClick={archiver}
                className="bouton-secondaire"
                title={fiche.ligne.vehicule.archiveLe ? "Remet le véhicule dans les listes — rien n'a été perdu" : "Retire le véhicule des listes et des choix sans rien effacer : sa fiche et son historique restent"}
              >
                {fiche.ligne.vehicule.archiveLe ? <ArchiveRestore className="size-4 text-texte-2" strokeWidth={1.7} /> : <Archive className="size-4 text-texte-2" strokeWidth={1.7} />}
                {fiche.ligne.vehicule.archiveLe ? "Désarchiver" : "Archiver"}
              </button>
            ) : null}
            <BoutonDiscussion nombre={nombreMessages} ouvert={discussionOuverte} onClick={() => setDiscussionOuverte((o) => !o)} />
            <BoutonQr immatriculation={v.immatriculation} immatriculationAffichee={v.immatriculationAffichee} libelle={`${v.marque} ${v.appellation}`} />
            <MenuAjout onChoix={ajouter} />
            {declaration ? (
              <FormulaireDeclaration
                vehiculeId={v.id}
                aujourdhui={jourCourant()}
                onFermer={() => setDeclaration(false)}
                onEnregistre={() => {
                  actualiser();
                  setOnglet("incidents");
                }}
              />
            ) : null}
          </div>
        </div>

        <BandeauKpi
          kpis={[
            {
              label: "Kilométrage",
              valeur: i.kilometrage === null ? "—" : nombre(i.kilometrage),
              unite: "km",
              precision: fiche.releves.find((r) => r.valide)
                ? `relevé le ${date(fiche.releves.find((r) => r.valide)!.date)} · ${LIBELLE_ORIGINE_RELEVE[fiche.releves.find((r) => r.valide)!.origine]}`
                : "aucun relevé retenu",
            },
            { label: "Moyenne / mois", valeur: i.kmParMois === null ? "—" : nombre(i.kmParMois), unite: "km", precision: "sur 6 mois glissants" },
            {
              label: "Consommation",
              valeur: i.consommationL100 === null ? "—" : nombre(i.consommationL100),
              unite: "L/100",
              precision: `référence ${nombre(fiche.referenceL100)}`,
              ton: i.consommationL100 !== null && i.consommationL100 > fiche.referenceL100 * 1.15 ? "vigilance" : "neutre",
            },
            { label: "Charges 12 mois", valeur: montantCourt(i.coutDouzeMois).replace(/\s?F$/, ""), unite: "F", precision: "carburant, maintenance, autres" },
            { label: "Coût / km", valeur: i.coutParKm === null ? "—" : nombre(i.coutParKm), unite: "F", precision: "12 mois glissants" },
            {
              label: "Disponibilité",
              valeur: i.disponibilitePct === null ? "—" : `${i.disponibilitePct}`,
              unite: "%",
              precision: "12 mois glissants",
              ton: i.disponibilitePct !== null && i.disponibilitePct < 85 ? "defavorable" : "favorable",
            },
          ]}
        />

        {/* Pas de zone de défilement propre : le -mb-px des onglets y ferait
            naître une barre verticale. Si la place manque, ils passent à la ligne. */}
        <div className="-mb-px flex flex-wrap items-end gap-1" role="tablist" aria-label="Sections de la fiche">
          {ONGLETS.map((o) => {
            const actif = o.cle === onglet;
            return (
              <button
                key={o.cle}
                type="button"
                role="tab"
                aria-selected={actif}
                onClick={() => setOnglet(o.cle)}
                className={`relative shrink-0 items-center gap-1.5 border-b-2 px-2.5 pt-1 pb-3 text-[13px] whitespace-nowrap transition-colors ${o.ordinateurSeulement ? "hidden lg:flex" : "flex"} ${
                  actif ? "border-accent font-semibold text-texte" : "border-transparent font-medium text-texte-2 hover:text-texte"
                }`}
              >
                {o.libelle}
                {/* Ce qui demande une action se signale **sur l'onglet où on le
                    traite** : une visite échue se règle dans Conformité, pas
                    dans l'Aperçu. Le badge dit où aller, l'onglet montre la ligne. */}
                {badges.get(o.cle) ? (
                  <span
                    title={`${badges.get(o.cle)!.nombre} point${badges.get(o.cle)!.nombre > 1 ? "s" : ""} à traiter`}
                    className={`grid h-[17px] min-w-[17px] shrink-0 place-items-center rounded-full px-1 text-[10.5px] font-bold ${
                      badges.get(o.cle)!.ton === "defavorable" ? "bg-defavorable text-white" : "bg-vigilance-fond text-vigilance"
                    }`}
                  >
                    {badges.get(o.cle)!.nombre}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Contenu de l'onglet : la seule zone qui défile ---- */}
      <div role="tabpanel" className="defilement-discret min-h-0 flex-1 px-8 py-6 lg:overflow-y-auto">
        {onglet === "apercu" && <OngletApercu fiche={fiche} />}
        {onglet === "caracteristiques" && <OngletCaracteristiques fiche={fiche} detenteur={detenteur} />}
        {onglet === "affectations" && <OngletAffectations fiche={fiche} transferts={transferts} cible={cible} />}
        {onglet === "conformite" && (
          <div className="flex flex-col gap-8">
            <OngletConformite fiche={fiche} cible={cible} />
            {/* Le dossier sous les échéances, partout : sous 1280 px la liste des
                pièces passe au-dessus du cadre, qui reste lisible. */}
            <OngletDossier fiche={fiche} />
          </div>
        )}
        {onglet === "incidents" && <OngletIncidents fiche={fiche} cible={cible} onDeclarer={() => setDeclaration(true)} />}
        {onglet === "maintenance" && <OngletMaintenance fiche={fiche} cible={cible} />}
        {onglet === "plan" && <OngletPlanEntretien fiche={fiche} />}
        {onglet === "carburant" && <OngletCarburant fiche={fiche} cible={cible} />}
        {onglet === "autres" && <OngletAutresDepenses fiche={fiche} cible={cible} />}
        {onglet === "kilometrage" && <OngletKilometrage fiche={fiche} cible={cible} />}
        {onglet === "livraisons" && <OngletLivraisons fiche={fiche} cible={cible} />}
        {onglet === "journal" && <OngletJournal fiche={fiche} />}
      </div>

      <PanneauDiscussion
        sujet={`vehicule:${v.immatriculation}`}
        libelle={v.immatriculationAffichee}
        href={`/flotte/${v.immatriculation}`}
        personnes={personnes}
        ouvert={discussionOuverte}
        onFermer={() => setDiscussionOuverte(false)}
        onNombre={setNombreMessages}
      />
    </div>
  );
}

/**
 * Le crayon posé après le nom du chauffeur : il ouvre le formulaire
 * d'affectation, celui-là même que le menu « Ajouter » propose. Un chemin de
 * plus vers la même écriture, pas une écriture de plus.
 */
function BoutonAffecter({ onClick, libelle }: { onClick: () => void; libelle: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={libelle}
      className="grid size-5 shrink-0 place-items-center rounded-[6px] text-attenue transition-colors hover:bg-surface-3 hover:text-accent-fonce focus-visible:bg-surface-3 focus-visible:text-accent-fonce"
    >
      <Pencil className="size-3" strokeWidth={1.9} />
      <span className="sr-only">{libelle}</span>
    </button>
  );
}
