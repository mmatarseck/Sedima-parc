"use client";

import { prixEnergie } from "@/domaine/parametres";
import { DATE_REFERENCE } from "@/donnees/chauffeurs-demo";
import { lireParametres } from "@/lib/parametres-demo";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, Link2, Lock, MapPin, Pencil, Radio, UserRound } from "lucide-react";
import { BoutonDiscussion, PanneauDiscussion } from "@/composants/discussion/PanneauDiscussion";
import { BandeauKpi } from "@/composants/interface/BandeauKpi";
import { useCible } from "@/composants/interface/useCible";
import { champsCreation } from "@/composants/transactions/champs";
import { useEdition } from "@/composants/transactions/ContexteEdition";
import { FormulaireDeclaration } from "@/composants/incidents/FormulaireDeclaration";
import { OngletIncidents } from "@/composants/vehicule/OngletIncidents";
import { fabriquerAffectationVehicule, fabriquerDocument, fabriquerPeriodeStatut, fabriquerReleve, libelleSite } from "@/composants/transactions/fabriques";
import { TYPE_TRANSACTION, type TypeTransaction } from "@/domaine/reference";
import { PastilleStatut } from "@/composants/interface/Pastille";
import type { FicheVehicule as Fiche } from "@/domaine/fiche";
import type { Personne } from "@/domaine/discussion";
import type { Transfert } from "@/domaine/transferts";
import { BUSINESS_UNIT, STATUT_VEHICULE, TYPE_DOCUMENT, libelleCategorie } from "@/domaine/libelles";
import { personnesUtilisateurs } from "@/lib/discussion-demo";
import { date, montantCourt, nombre } from "@/lib/format";
import { controlerReleves } from "@/domaine/releves";
import { alertesDeLaFiche, alertesParOnglet } from "./alertes-fiche";
import { MenuAjout, type CibleAjout } from "./MenuAjout";
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
  OngletJournal,
  OngletKilometrage,
} from "./onglets";

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
  | "carburant"
  | "autres"
  | "kilometrage"
  | "journal";

/**
 * L'Aperçu porte tout ce qui s'agrège, s'analyse ou alerte. Chaque autre
 * onglet est une liste de transactions d'un seul type — c'est la règle posée
 * par le métier, et elle décide de ce qui va où.
 */
const ONGLETS: { cle: Onglet; libelle: string }[] = [
  { cle: "apercu", libelle: "Aperçu" },
  { cle: "caracteristiques", libelle: "Caractéristiques" },
  { cle: "affectations", libelle: "Affectations" },
  { cle: "conformite", libelle: "Conformité" },
  { cle: "incidents", libelle: "Incidents & sinistres" },
  { cle: "maintenance", libelle: "Maintenance" },
  { cle: "carburant", libelle: "Carburant" },
  { cle: "autres", libelle: "Autres dépenses" },
  { cle: "kilometrage", libelle: "Kilométrages" },
  { cle: "journal", libelle: "Journal" },
];

function estOnglet(valeur: string | undefined): valeur is Onglet {
  return ONGLETS.some((o) => o.cle === valeur);
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
  const [onglet, setOnglet] = useState<Onglet>(estOnglet(ongletInitial) ? ongletInitial : "apercu");
  useCible(cible, onglet);
  const [discussionOuverte, setDiscussionOuverte] = useState(discussionInitiale);
  const [declaration, setDeclaration] = useState(false);
  const [nombreMessages, setNombreMessages] = useState<number | null>(null);
  const { surcharger, creer, demander, creations, actualiser } = useEdition();

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
  /* L'immobilisation administrative l'emporte sur tout statut saisi : elle se
     lève quand le document est renouvelé, pas par une saisie. */
  const immobilisation = fiche.immobilisationAdministrative;
  const statutCourant = immobilisation?.statut ?? statutsCrees[0]?.statut ?? v.statut;
  const i = fiche.indicateurs;
  const titulaire = fiche.affectations.find((a) => a.role === "titulaire" && a.fin === null) ?? null;

  /* Sans formulaire encore, le menu « Ajouter » ouvre l'onglet qui liste le
     type choisi. Les cibles sans onglet propre (incident, statut) mènent au
     journal, où leur trace finira. */
  const ONGLET_PAR_CIBLE: Partial<Record<CibleAjout, Onglet>> = {
    plein: "carburant",
    depense: "autres",
    intervention: "maintenance",
    affectation: "affectations",
    attelage: "affectations",
    visite: "conformite",
    observation: "maintenance",
    incident: "incidents",
    document: "conformite",
    releve: "kilometrage",
    statut: "journal",
    inspection: "maintenance",
    "ordre-de-travail": "maintenance",
  };
  /* Chaque entrée du menu ouvre son formulaire ; à la création, l'onglet qui
     liste ce type s'ouvre pour montrer la ligne nouvelle. */
  const TITRE_CREATION: Partial<Record<CibleAjout, string>> = {
    plein: "Nouveau plein",
    depense: "Nouvelle dépense",
    intervention: "Nouvelle intervention",
    affectation: "Nouvelle affectation",
    attelage: "Nouvel attelage",
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
          date: "2026-09-02",
          debut: "2026-09-02",
          dateEffet: "2026-09-02",
          dateHeure: "2026-09-02",
          dateRendezVous: "2026-09-02",
          origine: "caisse",
          /* Le prix du litre vient du barème **en vigueur ce jour**, selon
             l'énergie du véhicule : on saisit un plein d'aujourd'hui. Pour un
             plein antérieur, la date saisie prime — le prix se corrige à la
             main, l'application ne devine pas à quel barème il se rattache. */
          prixLitre: type === "plein" ? prixEnergie(v.energie, DATE_REFERENCE, lireParametres()) : undefined,
          statut: type === "visite" ? "rendez-vous" : type === "observation" ? "a-traiter" : "declare",
          roulant: "oui",
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
          <Link href="/flotte" className="inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce">
            <ChevronLeft className="size-3.5" strokeWidth={1.8} />
            Flotte
          </Link>
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
              <PastilleStatut statut={statutCourant} />
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
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-vigilance">
                  <UserRound className="size-3.5" strokeWidth={1.8} />
                  Aucun chauffeur affecté
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
              onClick={() => demander({ type: "vehicule", numero: numeroFiche, titre: `Fiche ${v.immatriculationAffichee}`, valeurs: { ...fiche.identite, ...fiche.ligne.vehicule } as unknown as Record<string, unknown> })}
              className="bouton-secondaire"
            >
              <Pencil className="size-4 text-texte-2" strokeWidth={1.7} />
              Modifier
            </button>
            <BoutonDiscussion nombre={nombreMessages} ouvert={discussionOuverte} onClick={() => setDiscussionOuverte((o) => !o)} />
            <BoutonQr immatriculation={v.immatriculation} immatriculationAffichee={v.immatriculationAffichee} libelle={`${v.marque} ${v.appellation}`} />
            <MenuAjout onChoix={ajouter} />
            {declaration ? (
              <FormulaireDeclaration
                vehiculeId={v.id}
                aujourdhui="2026-09-02"
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
                className={`relative flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 pt-1 pb-3 text-[13px] whitespace-nowrap transition-colors ${
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
        {onglet === "conformite" && <OngletConformite fiche={fiche} cible={cible} />}
        {onglet === "incidents" && <OngletIncidents fiche={fiche} cible={cible} />}
        {onglet === "maintenance" && <OngletMaintenance fiche={fiche} cible={cible} />}
        {onglet === "carburant" && <OngletCarburant fiche={fiche} cible={cible} />}
        {onglet === "autres" && <OngletAutresDepenses fiche={fiche} cible={cible} />}
        {onglet === "kilometrage" && <OngletKilometrage fiche={fiche} cible={cible} />}
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
