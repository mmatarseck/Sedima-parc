"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ENERGIE } from "@/domaine/libelles";
import { STATUT_TRANSFERT, libellePartie, statutTransfert, type Transfert } from "@/domaine/transferts";
import { lireAccesCourant } from "@/lib/acces-courant";
import { lireTransferts } from "@/lib/transferts-demo";

import Link from "next/link";
import { AlertTriangle, FileText, Paperclip, Plus, Receipt } from "lucide-react";
import { Carte, Definitions, TableauSimple } from "@/composants/interface/Carte";
import { IndicateurPiece } from "@/composants/interface/IndicateurPiece";
import { ListeEtPiece } from "@/composants/interface/ListeEtPiece";
import { Numero } from "@/composants/interface/Numero";
import { VisionneusePiece } from "@/composants/interface/VisionneusePiece";
import { useEdition } from "@/composants/transactions/ContexteEdition";
import { useAjoutVehicule } from "./ajout";
import { preuveDuRappel } from "@/domaine/rappels";
import { estOuvert, factureDe, STATUT_ORDRE, TON_STATUT_ORDRE, type LigneOrdre } from "@/domaine/maintenance";
import { PRIORITE_SERVICE, calculerService } from "@/domaine/service";
import { ETAT_SIGNALEMENT, PRIORITE_SIGNALEMENT, etatSignalement, trierSignalements, type LigneSignalement } from "@/domaine/signalements";
import { systemeDe } from "@/domaine/categories-maintenance";
import { enregistrerModification } from "@/lib/clotures-demo";
import { CHAMPS, champsCreation } from "@/composants/transactions/champs";
import { lireParametres } from "@/lib/parametres-demo";
import { ETAT_RAPPEL, echeanceProposee, etatRappel, type Rappel } from "@/domaine/rappels";
import { apparierAtelier } from "@/domaine/atelier";
import {
  fabriquerAffectationVehicule,
  fabriquerAttelage,
  fabriquerDepense,
  fabriquerDocument,
  fabriquerEvenementIncident,
  fabriquerEvenementStatut,
  fabriquerIntervention,
  fabriquerLigneOrdre,
  fabriquerPeriodeStatut,
  fabriquerSignalement,
  fabriquerPlein,
  fabriquerReleve,
  fabriquerRappel,
} from "@/composants/transactions/fabriques";
import type { Creation } from "@/domaine/cloture";
import { agregerCouts } from "@/domaine/fiche";
import { controlerReleves } from "@/domaine/releves";
import { Echeance, Pastille, PastilleStatut } from "@/composants/interface/Pastille";
import type {
  AffectationFiche,
  AttelageFiche,
  DepenseFiche,
  EvenementJournal,
  FicheVehicule,
  Intervention,
  PeriodeStatutFiche,
  PleinFiche,
  ReleveFiche,
} from "@/domaine/fiche";
import {
  BUSINESS_UNIT,
  libelleCategorie,
  GROUPE_CHARGE,
  MOTIF_IMMOBILISATION,
  MOTIF_SORTIE,
  POSTE_DEPENSE,
  ROLE_AFFECTATION,
  groupeDuPoste,
  type Ton,
} from "@/domaine/libelles";
import { libelleUsageCourant } from "@/domaine/parametres";
import { libelleMois } from "@/domaine/temps";
import { date, kilometrage, montant, montantCourt, nombre, pourcentage } from "@/lib/format";
import { GraphiqueBarresEmpilees } from "./GraphiqueBarresEmpilees";
import { PlanEntretien } from "./PlanEntretien";

/* ========================================================================== */
/* Pièces communes                                                            */
/* ========================================================================== */

const LIBELLE_ORIGINE_RELEVE: Record<ReleveFiche["origine"], string> = {
  saisie: "Saisie",
  plein: "Plein",
  garage: "Garage",
  telematique: "Balise",
  depense: "Dépense",
};

const LIBELLE_ORIGINE: Record<DepenseFiche["origine"], string> = {
  caisse: "Caisse parc",
  "bon-de-commande": "Bon de commande",
  facture: "Facture",
  /* Une pièce prise au magasin par un service (0059). */
  stock: "Magasin",
};

/** Cellule « Km relevé » : barrée et signalée quand le contrôle l'a écartée. */
function KmReleve({ km, motifRejet }: { km: number | null; motifRejet: string | null }) {
  if (km === null) {
    return (
      <span className="text-attenue-2" title="Aucun relevé saisi">
        —
      </span>
    );
  }
  if (motifRejet) {
    return (
      <span className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap text-attenue" title={`Relevé écarté : ${motifRejet}`}>
        <AlertTriangle className="size-3.5 text-vigilance" strokeWidth={2} />
        <span className="line-through">{kilometrage(km)}</span>
      </span>
    );
  }
  return <span className="whitespace-nowrap">{kilometrage(km)}</span>;
}

function PastilleOrigine({ origine }: { origine: DepenseFiche["origine"] }) {
  return (
    <span className="inline-flex h-6 items-center rounded-full bg-surface-3 px-2.5 text-[12px] font-medium whitespace-nowrap text-texte-2">
      {LIBELLE_ORIGINE[origine]}
    </span>
  );
}

/**
 * Le justificatif d'une ligne : « Jointe » quand un fichier est attaché — un
 * clic sur la ligne l'ouvre à droite de la liste, dans l'application. Plus
 * aucun lien ne l'ouvre dans un onglet (métier, 21 septembre 2026 : « éliminer
 * les boutons qui ouvrent les fichiers hors plateforme »). Sans fichier,
 * « Fourni » reste une déclaration.
 */
function Justificatif({ present, fichier }: { present: boolean; fichier?: string | null }) {
  if (!present && !fichier) return <Echeance ton="vigilance">manquant</Echeance>;
  if (!fichier) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-texte-2" title="La pièce est déclarée fournie, mais aucun fichier n'y est attaché : « Modifier » permet de l'ajouter.">
        <FileText className="size-3.5 text-attenue" strokeWidth={1.8} />
        Fourni
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent-fonce" title="Pièce jointe — cliquer sur la ligne pour la lire à droite">
      <Paperclip className="size-3.5" strokeWidth={1.8} />
      Jointe
    </span>
  );
}

/**
 * Une ligne de repère : une pastille de ton, un libellé, une date ou un
 * kilométrage aligné à droite, et le détail en dessous.
 *
 * « Situation » et « Prochaines échéances » se lisent l'une sous l'autre dans
 * l'Aperçu et disent la même chose — un fait, quand, et de quoi il s'agit. Elles
 * étaient pourtant écrites deux fois, l'une en colonnes, l'autre en liste
 * (corrigé le 14 septembre 2026, demande du métier). Un seul composant les
 * empêche de diverger à la prochaine retouche.
 */
function LigneRepere({ ton, libelle, repere, precision }: { ton: Ton; libelle: string; repere: string | null; precision: string }) {
  return (
    <li className="flex items-start gap-3 border-b border-bordure py-3 first:pt-0 last:border-b-0 last:pb-0">
      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${ton === "defavorable" ? "bg-defavorable" : ton === "vigilance" ? "bg-vigilance" : ton === "favorable" ? "bg-accent" : "bg-attenue-2"}`} />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span className="text-[13px] font-medium text-texte">{libelle}</span>
          {repere ? <span className="code ml-auto shrink-0 text-[12px] text-texte-2">{repere}</span> : null}
        </p>
        <p className="meta mt-0.5">{precision}</p>
      </div>
    </li>
  );
}

/* ========================================================================== */
/* Aperçu — agrégats, analyses, alertes                                       */
/* ========================================================================== */

/**
 * L'Aperçu est le seul onglet qui interprète : il agrège les charges en trois
 * familles, dresse la liste des alertes, montre les tendances et les
 * échéances. Il ne liste aucune transaction — c'est le rôle des autres onglets.
 */
export function OngletApercu({ fiche }: { fiche: FicheVehicule }) {
  const { echeances, prochaineIntervention } = fiche;
  const { creations, surcharger } = useEdition();

  /* L'Aperçu résume les listes des autres onglets : il doit donc voir ce
     qu'elles voient, créations comprises. Sans quoi une dépense saisie
     apparaîtrait dans Dépenses et manquerait aux charges qui les totalisent —
     et l'écart serait mis sur le compte d'un défaut de l'application. En
     production, la transaction est en base et les vues recalculent seules. */
  const depenses = sansDoublon([...creations("depense", fabriquerDepense), ...fiche.depenses.map(surcharger)]);
  const { chargesParGroupe, coutsMensuels, total: totalDepenses } = agregerCouts(depenses, fiche.coutsMensuels.map((m) => m.mois));
  /* Le kilométrage des douze mois ne s'affiche nulle part : on le retrouve des
     deux indicateurs du serveur, pour que le coût au kilomètre suive les
     dépenses ajoutées sans qu'il faille recalculer toute la série. */
  const kmDouzeMois = fiche.indicateurs.coutDouzeMois && fiche.indicateurs.coutParKm ? fiche.indicateurs.coutDouzeMois / fiche.indicateurs.coutParKm : null;
  const coutParKm = kmDouzeMois && kmDouzeMois > 0 ? Math.round(totalDepenses / kmDouzeMois) : fiche.indicateurs.coutParKm;
  const totalCharges = chargesParGroupe.reduce((somme, g) => somme + g.montant, 0);
  const derniereIntervention = sansDoublon([...creations("intervention", fabriquerIntervention), ...fiche.interventions.map(surcharger)]).sort((x, y) => y.date.localeCompare(x.date))[0] ?? null;
  const dernierPlein = sansDoublon([...creations("plein", fabriquerPlein), ...fiche.pleins.map(surcharger)]).sort((x, y) => y.date.localeCompare(x.date))[0] ?? null;

  return (
    /* Les quatre cartes sont enfants directs de la grille, et non deux colonnes
       empilées côte à côte : deux piles indépendantes se décalent dès que l'une
       porte une ligne de plus, et l'œil lit des escaliers. Enfants directs, les
       cellules d'une même rangée s'étirent à la hauteur de la plus haute —
       « Charges » avec « Situation », « Dépenses mensuelles » avec
       « Prochaines échéances » (métier, 14 septembre 2026). */
    <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-2">
      {/* ---- Charges en trois familles ---- */}
      <Carte titre="Charges sur 12 mois" precision={`${montant(totalCharges)} · ${nombre(coutParKm)} F/km · toutes voies de paiement`}>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {chargesParGroupe.map((g) => {
            const part = totalCharges > 0 ? (g.montant / totalCharges) * 100 : 0;
            return (
              <div key={g.groupe} className="min-w-0">
                <p className="label-champ">{GROUPE_CHARGE[g.groupe]}</p>
                <p className="mt-1.5 text-[24px] leading-none font-semibold tracking-[-0.02em] text-texte">{montantCourt(g.montant)}</p>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${part}%` }} />
                </div>
                <p className="meta mt-1.5">{pourcentage(part, 0)} des charges</p>
                <ul className="mt-2.5 flex flex-col gap-1">
                  {g.postes.slice(0, 3).map((c) => (
                    <li key={c.poste} className="flex items-baseline gap-2 text-[12.5px]">
                      <span className="min-w-0 truncate text-texte-2">{POSTE_DEPENSE[c.poste]}</span>
                      <span className="code ml-auto shrink-0 text-texte">{montantCourt(c.montant)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Carte>

      {/* ---- Situation ---- */}
      <Carte titre="Situation" precision="Le dernier fait connu de chaque nature">
        <ul className="flex flex-col">
          <LigneRepere
            ton="neutre"
            libelle="Dernière intervention"
            repere={derniereIntervention ? date(derniereIntervention.date) : null}
            precision={derniereIntervention ? [derniereIntervention.objet, derniereIntervention.garage].filter(Boolean).join(" · ") : "Aucune enregistrée"}
          />
          <LigneRepere
            ton="neutre"
            libelle="Dernier plein"
            repere={dernierPlein ? date(dernierPlein.date) : null}
            precision={dernierPlein ? `${nombre(dernierPlein.litres, 1)} L · ${montant(dernierPlein.montant)} · ${dernierPlein.source}` : "Aucun"}
          />
          <LigneRepere
            ton={prochaineIntervention && prochaineIntervention.kmRestants <= 1000 ? "vigilance" : "neutre"}
            libelle="Prochain entretien"
            /* Un entretien se repère au compteur, pas au calendrier : c'est le
               kilométrage restant qui décide, la date n'en est qu'une estimation. */
            repere={prochaineIntervention ? `dans ${kilometrage(prochaineIntervention.kmRestants)}` : null}
            precision={prochaineIntervention ? `${prochaineIntervention.libelle} · ≈ ${prochaineIntervention.joursEstimes} j` : "Non planifié"}
          />
        </ul>
      </Carte>

      {/* ---- Tendance des dépenses, décomposée ----
          Empilée par famille : un mois à trois millions ne dit rien tant qu'on
          ignore s'il s'agit de carburant ou d'une réparation. */}
      <Carte titre="Dépenses mensuelles" precision="Par famille de charges — le total du mois se lit au sommet de la barre">
        <GraphiqueBarresEmpilees
          points={coutsMensuels.map((m) => ({ libelle: libelleMois(m.mois, true), valeurs: m.parGroupe }))}
          series={[
            { cle: "carburant", libelle: GROUPE_CHARGE.carburant, couleur: "var(--color-accent)" },
            { cle: "maintenance", libelle: GROUPE_CHARGE.maintenance, couleur: "var(--color-vigilance)" },
            { cle: "autres", libelle: GROUPE_CHARGE.autres, couleur: "var(--color-attenue-2)" },
          ]}
          hauteur={170}
        />
      </Carte>

      {/* ---- Échéances ---- */}
      <Carte titre="Prochaines échéances" precision="Documents et entretien, du plus urgent au plus lointain">
        <ul className="flex flex-col">
          {echeances.map((e) => (
            <LigneRepere key={`${e.libelle}-${e.repere}`} ton={e.ton} libelle={e.libelle} repere={e.repere.includes("-") ? date(e.repere) : e.repere} precision={e.precision} />
          ))}
        </ul>
      </Carte>
    </div>
  );
}

/* ========================================================================== */
/* Caractéristiques — référentiel du véhicule                                 */
/* ========================================================================== */

export function OngletCaracteristiques({ fiche, detenteur }: { fiche: FicheVehicule; detenteur?: ReactNode }) {
  const { surcharger } = useEdition();
  /* Véhicule et identité partagent le numéro de la fiche : une modification de
     « Modifier » recouvre les deux. */
  const v = surcharger({ numero: `VEH-${fiche.ligne.vehicule.immatriculation}`, ...fiche.ligne.vehicule });
  const i = surcharger({ numero: `VEH-${fiche.ligne.vehicule.immatriculation}`, ...fiche.identite });
  const avecUnite = (n: number | null, unite: string) => (n === null ? null : `${nombre(n)} ${unite}`);

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <Carte titre="Identification">
        <Definitions
          elements={[
            { libelle: "Immatriculation", valeur: <span className="code font-medium">{v.immatriculationAffichee}</span> },
            { libelle: "N° de châssis (VIN)", valeur: v.vin ? <span className="code">{v.vin}</span> : null },
            { libelle: "Marque", valeur: v.marque },
            { libelle: "Appellation commerciale", valeur: v.appellation },
            { libelle: "Type / modèle", valeur: i.typeModele },
            { libelle: "1re mise en circulation", valeur: date(i.premiereMiseEnCirculation) },
            { libelle: "Date d'immatriculation", valeur: date(i.dateImmatriculation) },
            { libelle: "Région", valeur: i.region },
            { libelle: "Catégorie", valeur: libelleCategorie(v) },
            { libelle: "Usage", valeur: libelleUsageCourant(v.usage, v.usageMetier) },
          ]}
        />
      </Carte>

      <Carte titre="Caractéristiques techniques">
        <Definitions
          elements={[
            { libelle: "Puissance", valeur: avecUnite(i.puissanceCv, "CV") },
            { libelle: "Cylindrée", valeur: avecUnite(i.cylindree, "cm³") },
            { libelle: "PTAC", valeur: avecUnite(i.ptac, "kg") },
            { libelle: "PTRA", valeur: avecUnite(i.ptra, "kg") },
            { libelle: "Poids à vide", valeur: avecUnite(i.poidsVide, "kg") },
            { libelle: "Charge utile", valeur: avecUnite(i.chargeUtile, "kg") },
            { libelle: "Énergie", valeur: i.energie ? ENERGIE[i.energie] : null },
            { libelle: "Réservoir", valeur: avecUnite(i.capaciteReservoir, "L") },
          ]}
        />
      </Carte>

      {/* -- Le détenteur d'un véhicule léger ---------------------------------
       *
       * Ajouté le 10 septembre 2026, après une remarque du métier : « certains
       * véhicules n'ont pas de fiche dédiée — semble-t-il les véhicules
       * légers ».
       *
       * Le diagnostic, une fois posé : les légers **ont** une fiche complète
       * depuis que la base les porte tous les cent soixante-sept. Ce qu'ils
       * perdaient, c'est ce qui les distingue — qui tient le véhicule, à quel
       * titre, et s'il relève du plan car. Ces faits vivaient dans la fiche
       * réduite du parc léger, celle qui s'ouvre quand la base ne connaît pas
       * le véhicule ; la fiche complète, elle, ne les affichait nulle part.
       *
       * `ligne.attributaire` est déjà rempli par `ligneDepuisLaBase` depuis
       * `attribution_legere` : il n'y avait qu'à le montrer. La carte
       * n'apparaît que pour un véhicule qui a un détenteur — un camion de
       * transport n'en a pas, il a un chauffeur titulaire, qui se lit dans
       * l'onglet Affectations.
       * ------------------------------------------------------------------- */}
      {/* Le dossier du parc léger, quand la page le fournit, dit plus que la ligne : forfait, plan car, devenir. */}
      {detenteur ?? (fiche.ligne.attributaire ? (
        <Carte titre="Détenteur" precision="Le véhicule est attribué, non affecté à un chauffeur">
          <Definitions
            elements={[
              { libelle: fiche.ligne.attributaire.pool ? "Pool" : "Nom", valeur: fiche.ligne.attributaire.nom },
              { libelle: "Fonction", valeur: fiche.ligne.attributaire.fonction },
              { libelle: "Plan car", valeur: fiche.ligne.attributaire.planCar ? "Oui" : "Non" },
              { libelle: "Régime d'usage", valeur: i.utilisation },
            ]}
          />
        </Carte>
      ) : null)}

      <Carte titre="Rattachement">
        <Definitions
          elements={[
            { libelle: "Entité", valeur: i.entite },
            { libelle: "Business unit", valeur: v.businessUnit ? BUSINESS_UNIT[v.businessUnit] : null },
            { libelle: "Site", valeur: fiche.ligne.site?.libelle ?? null },
            { libelle: "Utilisation", valeur: i.utilisation },
            { libelle: "Régime de propriété", valeur: i.regimePropriete },
            { libelle: "Transport spécial", valeur: v.transportSpecial ? "Oui — compte dans D_TICV" : "Non" },
            { libelle: "Télématique", valeur: i.gpsActif ? "Balise Teltonika active" : "Non équipé" },
            { libelle: "Engagé au parc", valeur: v.engage ? "Oui — compte dans D_TDPA" : "Non" },
          ]}
        />
      </Carte>

      <Carte titre="Achat, valeur et amortissement">
        <Definitions
          elements={[
            { libelle: "Fournisseur", valeur: v.fournisseur ?? null },
            { libelle: "Valeur d'acquisition", valeur: montant(i.valeurAcquisition) },
            { libelle: "Date d'acquisition", valeur: i.dateAcquisition ? date(i.dateAcquisition) : null },
            { libelle: "Référence d'immobilisation", valeur: i.referenceImmobilisation },
            { libelle: "Durée d'amortissement", valeur: i.dureeAmortissementAnnees ? `${i.dureeAmortissementAnnees} ans` : null },
            { libelle: "Valeur nette comptable", valeur: montant(i.valeurNetteComptable) },
            { libelle: "Fin d'amortissement", valeur: i.finAmortissement ? date(i.finAmortissement) : null },
          ]}
        />
      </Carte>

      {/* Ce qu'une sortie de parc laisse écrit (0047) : la carte n'apparaît que
          pour un véhicule sorti — elle n'aurait rien à dire des autres. */}
      {v.statut === "sorti" ? (
        <Carte titre="Sortie du parc">
          <Definitions
            elements={[
              { libelle: "Sorti le", valeur: v.dateSortie ? date(v.dateSortie) : null },
              { libelle: "Motif", valeur: v.motifSortie ? MOTIF_SORTIE[v.motifSortie] : null },
            ]}
          />
        </Carte>
      ) : null}

    </div>
  );
}

/* ========================================================================== */
/* Affectations — liste                                                       */
/* ========================================================================== */

/** « 2026-09-08T12:00:00Z » → « 08/09/2026 12:00 », comme la liste des fiches. */
function heureRemise(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/**
 * Les fiches de transfert du véhicule — la remise, l'état des lieux, les deux
 * signatures. Elles vivent ici, à côté des affectations, parce qu'une fiche
 * complète **ouvre l'affectation du récipiendaire et ferme la précédente** :
 * c'est le même fait, vu de l'autre côté. L'entrée du rail a été retirée le
 * 9 septembre 2026 ; la liste de toutes les fiches reste à un clic.
 */
function CarteTransferts({ immatriculation, initial }: { immatriculation: string; initial: Transfert[] }) {
  const [liste, setListe] = useState<Transfert[]>(initial);
  const [peutCreer, setPeutCreer] = useState(false);
  useEffect(() => {
    /* Celles que le navigateur a dressées depuis, comme la liste des fiches. */
    setListe(lireTransferts(initial).filter((t) => t.vehicule.immatriculation.replace(/[^0-9A-Za-z]/g, "").toUpperCase() === immatriculation || initial.some((x) => x.id === t.id)));
    const acces = lireAccesCourant();
    setPeutCreer(acces.profil !== "detenteur" && (acces.niveaux.transferts === "saisie" || acces.niveaux.transferts === "gestion"));
  }, [initial, immatriculation]);
  const aSigner = liste.filter((t) => { const s = statutTransfert(t); return s !== "complete" && s !== "annulee"; }).length;
  const triees = [...liste].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Carte
      titre="Fiches de transfert"
      precision={liste.length ? `${liste.length} remise${liste.length > 1 ? "s" : ""}${aSigner ? ` · ${aSigner} à signer` : ""} · une fiche complète ouvre l'affectation qui suit et ferme la précédente` : "Compteur, carburant, documents, équipements, réserves et deux signatures à chaque remise du véhicule"}
      action={
        <span className="flex items-center gap-2.5">
          <Link href="/transferts" className="bouton-discret h-9 px-3 text-[12.5px]">
            Toutes les fiches
          </Link>
          {peutCreer ? (
            <Link href={`/transferts/nouveau?vehicule=${immatriculation}`} className="bouton-secondaire h-9">
              <Plus className="size-4" strokeWidth={2} />
              Nouvelle fiche
            </Link>
          ) : null}
        </span>
      }
      sansMarge
    >
      <TableauSimple<Transfert>
        reglages="fiche-vehicule.transferts"
        cle={(t) => t.id}
        lignes={triees}
        vide="Aucune fiche de transfert pour ce véhicule."
        colonnes={[
          { cle: "numero", libelle: "N°", rendu: (t) => <Link href={`/transferts/${t.id}`} className="code text-[12.5px] font-medium text-accent-fonce hover:text-accent hover:underline">{t.numero}</Link> },
          { cle: "date", libelle: "Remise", rendu: (t) => <span className="code">{heureRemise(t.date)}</span> },
          { cle: "de", libelle: "Remis par", rendu: (t) => <span className="text-texte">{libellePartie(t.remettant)}</span> },
          { cle: "a", libelle: "Reçu par", rendu: (t) => <span className="text-texte">{libellePartie(t.recipiendaire)}</span> },
          { cle: "motif", libelle: "Motif", rendu: (t) => <span className="text-texte-2">{t.motif}</span> },
          { cle: "km", libelle: "Compteur", alignee: "droite", rendu: (t) => (t.km === null ? <span className="text-attenue-2">—</span> : kilometrage(t.km)) },
          { cle: "reserves", libelle: "Réserves", alignee: "droite", rendu: (t) => (t.reserves.length ? <span className="font-medium text-vigilance">{t.reserves.length}</span> : <span className="text-attenue-2">—</span>) },
          { cle: "statut", libelle: "Statut", rendu: (t) => { const s = statutTransfert(t); return <Pastille ton={STATUT_TRANSFERT[s].ton}>{STATUT_TRANSFERT[s].libelle}</Pastille>; } },
        ]}
      />
    </Carte>
  );
}

export function OngletAffectations({ fiche, transferts = [], cible }: { fiche: FicheVehicule; transferts?: Transfert[]; cible?: string }) {
  const ajouter = useAjoutVehicule(fiche);
  const { surcharger, demander, creations } = useEdition();
  const categorie = fiche.ligne.vehicule.categorie;
  const bu = fiche.ligne.vehicule.businessUnit ? BUSINESS_UNIT[fiche.ligne.vehicule.businessUnit] : "—";
  const affectations = [...creations("affectation", (c) => fabriquerAffectationVehicule(c, `${bu} · ${fiche.ligne.site?.libelle ?? "—"}`)), ...fiche.affectations.map(surcharger)];
  const attelagesCrees = creations("attelage", (c) => fabriquerAttelage(c, categorie === "semi-remorque" ? "remorque" : "tracteur"));
  const attelable = categorie === "tracteur" || categorie === "semi-remorque" || fiche.attelages.length > 0 || attelagesCrees.length > 0;
  const attelages = [...attelagesCrees, ...fiche.attelages.map(surcharger)];
  return (
    <div className="flex flex-col gap-5">
    <Carte
      titre="Affectations"
      precision="Chaque période rattache au chauffeur en poste les kilomètres, la consommation et les incidents"
      action={
        <button type="button" onClick={() => ajouter("affectation")} className="bouton-secondaire h-9">
          <Plus className="size-4" strokeWidth={2} />
          Nouvelle affectation
        </button>
      }
      sansMarge
    >
      <TableauSimple<AffectationFiche> reglages="fiche-vehicule.affectations"
        cle={(a) => `${a.chauffeur}-${a.debut}`}
        lignes={affectations}
        numero={(a) => a.numero}
        cible={cible}
        surModifier={(a) => demander({ type: "affectation", numero: a.numero, titre: `Affectation · ${a.chauffeur ?? "sans chauffeur"}`, valeurs: a as unknown as Record<string, unknown> })}
        colonnes={[
          { cle: "numero", libelle: "Réf.", rendu: (a) => <Numero valeur={a.numero} /> },
          {
            cle: "chauffeur",
            libelle: "Chauffeur",
            rendu: (a) => (
              <span className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 text-[11px] font-semibold text-texte-2">{a.initiales}</span>
                {a.chauffeur && a.chauffeurId ? (
                  <Link href={`/chauffeurs/${a.chauffeurId}`} className="font-medium text-accent-fonce hover:text-accent hover:underline">
                    {a.chauffeur}
                  </Link>
                ) : (
                  <span className={a.chauffeur ? "font-medium" : "text-attenue-2"}>{a.chauffeur ?? "Non affecté"}</span>
                )}
              </span>
            ),
          },
          { cle: "role", libelle: "Rôle", rendu: (a) => (a.role ? ROLE_AFFECTATION[a.role] : "—") },
          { cle: "debut", libelle: "Du", rendu: (a) => <span className="code">{date(a.debut)}</span> },
          { cle: "fin", libelle: "Au", rendu: (a) => (a.fin ? <span className="code">{date(a.fin)}</span> : <Pastille ton="favorable">en cours</Pastille>) },
          { cle: "bu", libelle: "BU / Site", rendu: (a) => a.buSite },
          { cle: "km", libelle: "Km parcourus", alignee: "droite", rendu: (a) => kilometrage(a.kmParcourus) },
          { cle: "motif", libelle: "Motif", rendu: (a) => <span className="text-texte-2">{a.motif}</span> },
        ]}
      />
    </Carte>

    <CarteTransferts immatriculation={fiche.ligne.vehicule.immatriculation} initial={transferts} />

    {attelable ? (
      <Carte
        titre="Attelages"
        precision={categorie === "tracteur" ? "Les remorques tirées par ce tracteur, sur période ou jusqu'à nouvel ordre" : categorie === "semi-remorque" ? "Les tracteurs qui ont tiré cette remorque, sur période ou jusqu'à nouvel ordre" : "Associations tracteur–remorque"}
        action={
          <button type="button" onClick={() => ajouter("attelage")} className="bouton-secondaire h-9">
            <Plus className="size-4" strokeWidth={2} />
            Nouvel attelage
          </button>
        }
        sansMarge
      >
        <TableauSimple<AttelageFiche> reglages="fiche-vehicule.attelages"
          cle={(a) => a.numero}
          lignes={attelages}
          vide={
            fiche.attelagesIllisibles
              ? "Les attelages n'ont pas pu être lus — la table n'est peut-être pas encore en base. Ce véhicule est peut-être attelé."
              : categorie === "tracteur"
                ? "Aucune remorque attelée à ce jour."
                : "Aucun tracteur attelé à ce jour."
          }
          numero={(a) => a.numero}
          cible={cible}
          surModifier={(a) => demander({ type: "attelage", numero: a.numero, titre: `Attelage · ${a.autreImmatriculationAffichee}`, valeurs: a as unknown as Record<string, unknown> })}
          colonnes={[
            { cle: "numero", libelle: "Réf.", rendu: (a) => <Numero valeur={a.numero} /> },
            {
              cle: "autre",
              libelle: categorie === "tracteur" ? "Remorque" : categorie === "semi-remorque" ? "Tracteur" : "Véhicule attelé",
              rendu: (a) => (
                <span className="flex flex-col">
                  <Link href={`/flotte/${a.autreImmatriculation}`} className="code font-medium text-accent-fonce hover:text-accent hover:underline">
                    {a.autreImmatriculationAffichee}
                  </Link>
                  <span className="meta">{a.autreVehicule}</span>
                </span>
              ),
            },
            { cle: "role", libelle: "Rôle", rendu: (a) => (a.role === "tracteur" ? "Tracteur → remorque" : "Remorque ← tracteur") },
            { cle: "debut", libelle: "Du", rendu: (a) => <span className="code">{date(a.debut)}</span> },
            { cle: "fin", libelle: "Au", rendu: (a) => (a.fin ? <span className="code">{date(a.fin)}</span> : <Pastille ton="favorable">{a.permanent ? "définitif" : "en cours"}</Pastille>) },
            { cle: "motif", libelle: "Motif", rendu: (a) => <span className="text-texte-2">{a.motif ?? "—"}</span> },
          ]}
        />
      </Carte>
    ) : null}
    </div>
  );
}

/* ========================================================================== */
/* Conformité — liste des documents                                           */
/* ========================================================================== */

/**
 * Une ligne créée dans l'application vit deux fois le temps que la base la
 * confirme : sa copie du navigateur, et la ligne que le serveur renvoie déjà
 * (métier, 21 septembre 2026 : « après la création d'un service et sa clôture,
 * deux lignes apparaissent sur l'atelier »). Le numéro fait foi : la première
 * — la copie, qui porte les dernières valeurs — reste.
 */
function sansDoublon<T extends { numero: string }>(lignes: T[]): T[] {
  const vus = new Set<string>();
  return lignes.filter((l) => (vus.has(l.numero) ? false : (vus.add(l.numero), true)));
}

export function OngletConformite({ fiche, cible }: { fiche: FicheVehicule; cible?: string }) {
  const ajouter = useAjoutVehicule(fiche);
  const { surcharger, demander, creer, creations } = useEdition();
  const v = fiche.ligne.vehicule;
  /*
   * Les rappels d'abord : c'est ce que la Conformité suit depuis le
   * 16 septembre 2026 — la prochaine échéance de ce qui se renouvelle, saisie
   * par le métier. Les documents restent en dessous : ce sont les pièces qui
   * prouvent, pas ce qui alerte.
   */
  const rappels = [...creations("rappel", (c) => fabriquerRappel(c, { vehicule: { id: v.id, immatriculation: v.immatriculation, immatriculationAffichee: v.immatriculationAffichee, marque: v.marque, appellation: v.appellation } })), ...fiche.rappels.map(surcharger)];
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const rappelsEchus = rappels.filter((r) => etatRappel(r.echeance, aujourdhui) === "echu").length;
  const rappelsBientot = rappels.filter((r) => etatRappel(r.echeance, aujourdhui) === "bientot").length;
  /*
   * RENOUVELER, C'EST DÉPOSER LA NOUVELLE PIÈCE (métier, 21 septembre 2026 :
   * « prévoir la possibilité de joindre une pièce justificative — PV de visite
   * technique, police d'assurance »). Le geste crée le document — son type, sa
   * date d'effet, sa nouvelle échéance, et le scan, obligatoire — puis porte la
   * nouvelle échéance sur le rappel. La pièce rejoint le dossier, sous cette
   * liste, et s'ouvre depuis la ligne du rappel.
   *
   * Le rappel ne cite pas le numéro du document : ce numéro peut encore changer
   * quand la base le prend, et la clé étrangère refuserait l'écriture. La
   * preuve se retrouve par le type — le document le plus récent qui porte un
   * scan —, et le commentaire du rappel nomme la pièce.
   */
  function renouveler(r: Rappel) {
    const def = lireParametres().documents.types.find((t) => t.id === r.type);
    const proposee = (def ? echeanceProposee(def, aujourdhui) : null) ?? r.echeance;
    creer({
      type: "document",
      titre: `Renouveler · ${r.libelle} · ${v.immatriculationAffichee}`,
      champs: champsCreation("document", { pour: "vehicule", categorie: v.categorie }).map((c) =>
        c.cle === "fichier"
          ? { ...c, obligatoire: true, libelle: "La pièce justificative", precision: "PV de visite technique, police d'assurance, attestation — en PDF ou en image" }
          : c.cle === "dateEffet"
            ? { ...c, libelle: "Renouvelé le" }
            : c.cle === "echeance"
              ? { ...c, libelle: "Nouvelle échéance", obligatoire: true }
              : c,
      ),
      valeurs: { type: r.type, dateEffet: aujourdhui, echeance: proposee },
      apresCreation: (c) => {
        const faitLe = String(c.valeurs.dateEffet ?? aujourdhui);
        const echeance = String(c.valeurs.echeance || (def ? echeanceProposee(def, faitLe) : null) || proposee);
        const avant = { echeance: r.echeance, faitLe: r.faitLe ?? "", documentNumero: r.documentNumero ?? "", commentaire: r.commentaire ?? "" };
        enregistrerModification({
          numero: r.numero,
          sujet: `vehicule:${v.immatriculation}`,
          type: "rappel",
          titre: `Rappel · ${r.libelle}`,
          href: `/flotte/${v.immatriculation}?onglet=conformite`,
          champs: CHAMPS.rappel,
          avant,
          apres: { ...avant, echeance, faitLe, commentaire: `Renouvelé le ${faitLe.split("-").reverse().join("/")} — pièce ${c.numero}` },
          motif: `Renouvelé : pièce ${c.numero} déposée`,
        });
      },
    });
  }
  /*
   * LES PIÈCES SUR LES LIGNES (métier, 22 septembre 2026 : « mettre les pièces
   * réglementaires dans les lignes directement ; au clic d'une ligne, on ouvre
   * à côté la pièce »). Le dossier à part a quitté l'onglet : chaque ligne
   * porte sa pièce — le document du même type, le procès-verbal pour la visite
   * technique, la licence pour la licence de transport — et le clic l'ouvre à
   * droite. Une pièce dont le type n'a pas de rappel a sa ligne aussi, « non
   * suivie » : on la voit, on l'ouvre, et « Suivre » en fait un rappel.
   */
  const documentsConnus = [
    ...creations("document", (c) => fabriquerDocument(c, v.categorie)).map((d) => ({ numero: d.numero, type: d.type as string, dateEffet: d.dateEffet, echeance: d.echeance ?? null, fichier: d.fichier ?? null })),
    ...fiche.documents.map((d) => ({ numero: d.numero, type: d.type as string, dateEffet: d.dateEffet, echeance: d.echeance, fichier: fiche.pieces.find((p) => p.type === "document" && p.numero === d.numero)?.fichier ?? null })),
    /* Une pièce de document que la liste des documents ne porte pas encore : son type se retrouve par son libellé. */
    ...fiche.pieces.filter((p) => p.type === "document" && !fiche.documents.some((d) => d.numero === p.numero)).map((p) => ({ numero: p.numero, type: lireParametres().documents.types.find((t) => t.libelle === p.libelle)?.id ?? p.libelle, dateEffet: p.date, echeance: null as string | null, fichier: p.fichier as string | null })),
    ...fiche.pieces.filter((p) => p.type === "visite").map((p) => ({ numero: p.numero, type: "visite-technique", dateEffet: p.date, echeance: null as string | null, fichier: p.fichier as string | null })),
    ...fiche.pieces.filter((p) => p.type === "licence").map((p) => ({ numero: p.numero, type: "licence-transport", dateEffet: p.date, echeance: /échéance (\d{4}-\d{2}-\d{2})/.exec(p.precision)?.[1] ?? null, fichier: p.fichier as string | null })),
  ];
  const libelleType = (type: string) => lireParametres().documents.types.find((t) => t.id === type)?.libelle ?? type;
  type LigneConformite = Rappel & { suivi: boolean };
  const typesSuivis = new Set(rappels.map((r) => r.type as string));
  const nonSuivis: LigneConformite[] = [...new Set(documentsConnus.filter((d) => d.fichier && !typesSuivis.has(d.type)).map((d) => d.type))].map((type) => {
    const d = documentsConnus.filter((x) => x.type === type && x.fichier).sort((a, b) => (b.dateEffet ?? "").localeCompare(a.dateEffet ?? ""))[0]!;
    return { id: `piece-${type}`, numero: `PIECE-${d.numero}`, porteur: "vehicule", vehiculeId: v.id, immatriculation: v.immatriculation, immatriculationAffichee: v.immatriculationAffichee, vehicule: `${v.marque} ${v.appellation}`, chauffeurId: null, chauffeur: null, chauffeurAdresse: null, type: type as Rappel["type"], libelle: libelleType(type), echeance: d.echeance ?? "", faitLe: d.dateEffet, documentNumero: d.numero, commentaire: null, suivi: false };
  });
  const lignes: LigneConformite[] = [...rappels.map((r) => ({ ...r, suivi: true })), ...nonSuivis];
  const [rappelOuvert, setRappelOuvert] = useState<string | null>(null);
  const ouvert = rappelOuvert ? (lignes.find((r) => r.numero === rappelOuvert) ?? null) : null;
  const preuveOuverte = ouvert ? preuveDuRappel(ouvert, documentsConnus) : null;
  /* Une pièce non suivie devient un rappel : son type, et l'échéance qu'elle porte. */
  function suivre(l: LigneConformite) {
    creer({ type: "rappel", titre: `Suivre · ${l.libelle} · ${v.immatriculationAffichee}`, champs: champsCreation("rappel", { pour: "vehicule", categorie: v.categorie }), valeurs: { type: l.type, echeance: l.echeance || "" } });
  }
  /*
   * UNE SEULE LISTE, ET RIEN DE PLUS (métier, 16 septembre 2026) : le type de
   * document, sa validité, l'échéance de renouvellement. La validité vient du
   * type (Paramètres › Documents), relue à l'ouverture.
   */
  const validiteDe = (type: string): string => {
    const def = lireParametres().documents.types.find((t) => t.id === type);
    return def?.validiteMois ? `${def.validiteMois} mois` : "—";
  };
  return (
    <ListeEtPiece
      piece={
        ouvert ? (
          <VisionneusePiece
            fichier={preuveOuverte?.fichier ?? null}
            libelle={ouvert.libelle}
            precision={[ouvert.echeance ? `échéance ${date(ouvert.echeance)}` : null, preuveOuverte?.dateEffet ? `pièce du ${date(preuveOuverte.dateEffet)}` : null, ouvert.suivi ? null : "échéance non suivie"].filter(Boolean).join(" · ")}
            vide="Aucune pièce justificative pour ce document. « Renouveler » la dépose avec la nouvelle échéance."
            onFermer={() => setRappelOuvert(null)}
            actions={
              ouvert.suivi ? (
                <button type="button" onClick={() => renouveler(ouvert)} className="bouton-secondaire h-9">
                  Renouveler
                </button>
              ) : (
                <button type="button" onClick={() => suivre(ouvert)} className="bouton-secondaire h-9" title="En faire un rappel, suivi en Conformité">
                  Suivre l&apos;échéance
                </button>
              )
            }
          />
        ) : null
      }
    >
    <div className="flex flex-col gap-5">
    <Carte
      titre="Conformité"
      precision={rappels.length ? `${rappels.length} échéance${rappels.length > 1 ? "s" : ""} suivie${rappels.length > 1 ? "s" : ""}${rappelsEchus ? ` · ${rappelsEchus} échue${rappelsEchus > 1 ? "s" : ""}` : ""}${rappelsBientot ? ` · ${rappelsBientot} sous trente jours` : ""}${nonSuivis.length ? ` · ${nonSuivis.length} pièce${nonSuivis.length > 1 ? "s" : ""} sans échéance suivie` : ""} — un clic ouvre la pièce` : "Aucune échéance suivie — l'assurance, la visite technique ou le certificat se saisissent ici"}
      action={
        <span className="flex gap-2">
          <button type="button" onClick={() => ajouter("document")} className="bouton-secondaire h-9" title="Carte grise, police d'assurance, certificat — la pièce rejoint la ligne de son type">
            <FileText className="size-4" strokeWidth={1.8} />
            Déposer une pièce
          </button>
          <button type="button" onClick={() => ajouter("rappel")} className="bouton-secondaire h-9">
            <Plus className="size-4" strokeWidth={2} />
            Nouveau rappel
          </button>
        </span>
      }
      sansMarge
    >
      <TableauSimple<LigneConformite> reglages="fiche-vehicule.rappels"
        cle={(r) => r.numero}
        lignes={lignes}
        vide="Aucun rappel ni aucune pièce sur ce véhicule."
        numero={(r) => (r.suivi ? r.numero : r.documentNumero ?? r.numero)}
        cible={cible}
        seulement={ouvert ? ["document", "echeance"] : undefined}
        surLigne={(r) => setRappelOuvert((o) => (o === r.numero ? null : r.numero))}
        ouverte={rappelOuvert}
        surModifier={(r) => (r.suivi ? demander({ type: "rappel", numero: r.numero, titre: `Rappel · ${r.libelle}`, champs: CHAMPS.rappel, valeurs: { echeance: r.echeance, faitLe: r.faitLe ?? "", documentNumero: r.documentNumero ?? "", commentaire: r.commentaire ?? "" } }) : suivre(r))}
        colonnes={[
          {
            cle: "document",
            libelle: "Document",
            rendu: (r) => (
              <span className="flex items-center gap-2">
                <IndicateurPiece present={Boolean(preuveDuRappel(r, documentsConnus)?.fichier)} />
                <span className={r.suivi ? "font-medium" : "font-medium text-texte-2"}>{r.libelle}</span>
              </span>
            ),
          },
          { cle: "validite", libelle: "Validité", rendu: (r) => <span className="text-texte-2">{validiteDe(r.type)}</span> },
          {
            cle: "echeance",
            libelle: "Échéance de renouvellement",
            rendu: (r) => {
              if (!r.suivi)
                return (
                  <span className="flex items-center gap-2">
                    {r.echeance ? <span className="code whitespace-nowrap text-texte-2">{date(r.echeance)}</span> : null}
                    <Echeance ton="neutre">Non suivie</Echeance>
                  </span>
                );
              const e = etatRappel(r.echeance, aujourdhui);
              return (
                <span className="flex items-center gap-2">
                  <span className="code whitespace-nowrap">{date(r.echeance)}</span>
                  <Echeance ton={ETAT_RAPPEL[e].ton}>{ETAT_RAPPEL[e].libelle}</Echeance>
                </span>
              );
            },
          },
          {
            cle: "renouveler",
            libelle: "",
            rendu: (r) =>
              r.suivi ? (
                <button type="button" onClick={(ev) => { ev.stopPropagation(); renouveler(r); }} className="bouton-discret h-7 px-2 text-[12px]" title="Déposer la nouvelle pièce et porter la nouvelle échéance">
                  Renouveler
                </button>
              ) : (
                <button type="button" onClick={(ev) => { ev.stopPropagation(); suivre(r); }} className="bouton-discret h-7 px-2 text-[12px]" title="En faire un rappel, suivi en Conformité">
                  Suivre
                </button>
              ),
          },
        ]}
      />
    </Carte>
    </div>
    </ListeEtPiece>
  );
}

/* ========================================================================== */
/* Entretien — interventions, pièces et pneumatiques                          */
/* ========================================================================== */

/* --------------------------------------------------------------------------
 * Une ligne d'atelier : ce qui a été fait sur le véhicule, quelle que soit la
 * pièce comptable qui le porte.
 *
 * Demande du métier du 15 septembre 2026 : « grouper sur une seule liste les
 * interventions, les pièces et pneumatiques ». Les deux tableaux disaient la
 * même chose en deux endroits — un train de pneus posé au garage était une
 * intervention, le même train acheté puis monté était une dépense, et il
 * fallait lire deux listes pour savoir ce qu'avait coûté un véhicule. La
 * distinction est comptable, pas mécanique.
 *
 * LA COLONNE « NATURE » GARDE CE QUI SE PERD À FUSIONNER : préventif, curatif,
 * pièces, pneumatiques. On voit d'un coup d'œil ce qui relève de l'entretien
 * programmé et ce qui relève de la panne.
 * ------------------------------------------------------------------------ */

type NatureAtelier = "preventif" | "curatif" | "pieces" | "pneumatiques";

interface LigneAtelier {
  cle: string;
  numero: string;
  date: string;
  nature: NatureAtelier;
  objet: string;
  /** Le garage d'une intervention, le fournisseur d'une fourniture. */
  tiers: string;
  km: number | null;
  kmMotifRejet: string | null;
  immobilisationJours: number | null;
  montant: number;
  reference: string | null;
  /** Caisse, bon de commande ou facture — une fourniture seulement. */
  origine: DepenseFiche["origine"] | null;
  /** La facture ou le reçu de la dépense, dans le seau : s'ouvre depuis la ligne (16 septembre 2026). */
  fichier: string | null;
  /** Les tâches du catalogue de l'intervention (0061). */
  taches: string[];
  modifier: () => void;
}

const NATURE_ATELIER: Record<NatureAtelier, { libelle: string; ton: "favorable" | "vigilance" | "neutre" }> = {
  preventif: { libelle: "Préventif", ton: "favorable" },
  curatif: { libelle: "Curatif", ton: "vigilance" },
  pieces: { libelle: "Pièces", ton: "neutre" },
  pneumatiques: { libelle: "Pneumatiques", ton: "neutre" },
};

export function OngletMaintenance({ fiche, cible }: { fiche: FicheVehicule; cible?: string }) {
  const ajouter = useAjoutVehicule(fiche);
  const { surcharger, demander, creations, ouvrirService } = useEdition();
  const vf = fiche.ligne.vehicule;
  /* Les services et les pannes signalées (0060) : ce qui est à réparer, et ce qui le répare. */
  const servicesCrees = creations("ordre", fabriquerLigneOrdre).filter((o): o is LigneOrdre => o !== null);
  const services = [...servicesCrees, ...(fiche.services ?? []).filter((o) => !servicesCrees.some((c) => c.numero === o.numero))].map(surcharger);
  const signalementsCrees = creations("signalement", fabriquerSignalement).filter((s): s is LigneSignalement => s !== null);
  const signalements = trierSignalements([...signalementsCrees, ...(fiche.signalements ?? []).filter((s) => !signalementsCrees.some((c) => c.numero === s.numero))].map(surcharger)).map((s) => ({ ...s, etat: etatSignalement(s, services) }));
  const pannesEnAttente = signalements.filter((s) => s.etat === "ouvert" || s.etat === "pris-en-charge");
  const servicesOuverts = services.filter((o) => estOuvert(o.statut));
  /* Fermés, ils restent visibles — l'historique du véhicule —, sans geste à faire (métier, 21 septembre 2026). */
  const pannesFermees = signalements.filter((s) => s.etat === "resolu" || s.etat === "annule");
  const servicesFermes = services.filter((o) => !estOuvert(o.statut));
  const [voirPannesFermees, setVoirPannesFermees] = useState(false);
  const [voirServicesFermes, setVoirServicesFermes] = useState(false);
  const vehiculeService = { immatriculation: vf.immatriculation, immatriculationAffichee: vf.immatriculationAffichee, libelle: `${vf.marque} ${vf.appellation}` };
  const ouvrir = (o: LigneOrdre) => ouvrirService({ service: o, vehicule: vehiculeService, signalements, services });
  const reparer = (s: LigneSignalement) =>
    ouvrirService({ vehicule: vehiculeService, signalements, services, propose: { type: "curatif", objet: s.description, origineNumero: s.numero, signalements: [s.numero], priorite: s.priorite === "critique" ? "urgent" : "non-planifie" } });
  const interventions = sansDoublon([...creations("intervention", fabriquerIntervention), ...fiche.interventions.map(surcharger)]);
  const depensesCreees = creations("depense", fabriquerDepense);
  /*
   * Toute la famille « maintenance », et non les deux seuls postes pièces et
   * pneumatiques : une dépense de poste « maintenance préventive » ou
   * « curative » relève du même groupe de charges, mais l'ancien filtre la
   * laissait de côté — et l'onglet Autres dépenses l'écarte aussi, par le même
   * groupe. Elle n'apparaissait donc **sur aucun onglet de la fiche**.
   */
  const fournitures = sansDoublon([...depensesCreees, ...fiche.depenses.map(surcharger)]).filter((d) => groupeDuPoste(d.poste) === "maintenance");

  /*
   * UNE LIGNE PAR FAIT (métier, 16 septembre 2026, décision « A »). Le
   * chargeur des bons de commande a créé une intervention et une dépense par
   * bon, jumelles par leur suffixe ; la base a raison de tenir les deux — la
   * dépense est la maille des coûts —, l'écran n'a pas à les montrer deux
   * fois. La paire devient une ligne : le geste, chez qui, au compteur, la
   * durée viennent de l'intervention ; le montant, l'origine et la facture
   * viennent de la dépense. « Modifier » ouvre l'intervention.
   */
  const { paires, interventionsSeules, depensesSeules } = apparierAtelier(interventions, fournitures);
  const ligneIntervention = (i: Intervention, d: DepenseFiche | null, lignes: DepenseFiche[] = d ? [d] : []): LigneAtelier => ({
    cle: `int-${i.numero}`,
    numero: i.numero,
    date: i.date,
    nature: i.type === "preventif" ? "preventif" : "curatif",
    objet: i.objet,
    tiers: i.garage,
    km: i.km,
    kmMotifRejet: null,
    immobilisationJours: i.immobilisationJours,
    /* Une facture saisie dans l'application a plusieurs lignes : la ligne
       d'atelier en porte la somme, et la première pièce jointe trouvée. */
    montant: lignes.length ? lignes.reduce((s, x) => s + x.montant, 0) : i.montant,
    reference: i.reference,
    origine: d ? d.origine : null,
    fichier: lignes.find((x) => x.photo)?.photo ?? null,
    taches: i.taches ?? [],
    modifier: () => demander({ type: "intervention", numero: i.numero, titre: `Intervention · ${i.objet}`, valeurs: i as unknown as Record<string, unknown> }),
  });
  const atelier: LigneAtelier[] = [
    ...paires.map(({ intervention, depense, lignes }) => ligneIntervention(intervention, depense, lignes)),
    ...interventionsSeules.map((i) => ligneIntervention(i, null)),
    ...depensesSeules.map(
      (d): LigneAtelier => ({
        cle: `dep-${d.id}`,
        numero: d.numero,
        date: d.date,
        /* Les postes « maintenance préventive » et « curative » se rangent sous
           la nature qu'ils nomment : c'est le même travail qu'une intervention,
           passé par la caisse plutôt que par le garage. */
        nature: d.poste === "pneumatiques" ? "pneumatiques" : d.poste === "pieces" ? "pieces" : d.poste === "maintenance-preventive" ? "preventif" : "curatif",
        objet: d.libelle,
        tiers: d.beneficiaire ?? "—",
        km: d.km,
        kmMotifRejet: d.kmMotifRejet,
        /* Une fourniture n'immobilise pas : c'est l'intervention qui la monte
           qui immobilise, et elle a sa propre ligne. */
        immobilisationJours: null,
        montant: d.montant,
        reference: d.reference,
        origine: d.origine,
        fichier: d.photo ?? null,
        taches: [],
        modifier: () => demander({ type: "depense", numero: d.numero, titre: `Dépense · ${d.libelle}`, valeurs: d as unknown as Record<string, unknown> }),
      }),
    ),
  ].sort((a, b) => b.date.localeCompare(a.date));
  /* Le total se lit sur les lignes fusionnées : une paire compte son montant une
     fois, pas deux — c'est le même franc sur l'intervention et sur la dépense. */
  const total = atelier.reduce((s, l) => s + l.montant, 0);
  /* La ligne ouverte : sa facture se lit à droite, la liste se rétracte (métier,
     21 septembre 2026). On retient la clé, pas la ligne — la liste se refait à
     chaque écriture, et la pièce doit suivre la ligne corrigée. */
  const [cleOuverte, setCleOuverte] = useState<string | null>(null);
  const ouverte = cleOuverte ? (atelier.find((l) => l.cle === cleOuverte) ?? null) : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Carte
          titre="Pannes signalées"
          precision={pannesEnAttente.length ? `${pannesEnAttente.length} à réparer · ${pannesEnAttente.filter((s) => s.etat === "pris-en-charge").length} prise${pannesEnAttente.filter((s) => s.etat === "pris-en-charge").length > 1 ? "s" : ""} en charge par un service` : "Aucune panne en attente de réparation"}
          action={
            <button type="button" onClick={() => ajouter("signalement")} className="bouton-secondaire h-9" title="Priorité, système, description, photos">
              <AlertTriangle className="size-4" strokeWidth={1.8} />
              Signaler une panne
            </button>
          }
          sansMarge
        >
          {pannesEnAttente.length === 0 ? (
            <p className="px-5 pb-4 text-[12.5px] text-texte-2">Rien à réparer : une panne signalée ici attendra qu&apos;un service l&apos;inclue.</p>
          ) : (
            <ul className="flex flex-col px-3 pb-3">
              {pannesEnAttente.map((s) => (
                <li key={s.numero} data-numero={s.numero} className={`flex items-center gap-3 rounded-[10px] px-2 py-2 hover:bg-surface-2 ${cible === s.numero ? "bg-accent-fond" : ""}`}>
                  <button type="button" onClick={() => demander({ type: "signalement", numero: s.numero, titre: `Signalement ${s.numero} · ${s.description}`, valeurs: s as unknown as Record<string, unknown>, champs: CHAMPS.signalement })} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <Echeance ton={PRIORITE_SIGNALEMENT[s.priorite].ton}>{PRIORITE_SIGNALEMENT[s.priorite].libelle}</Echeance>
                    <IndicateurPiece present={s.pieces.length > 0} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">{s.description}</span>
                      <span className="meta block truncate">{[date(s.date), systemeDe(s.systeme)?.libelle, ETAT_SIGNALEMENT[s.etat].libelle].filter(Boolean).join(" · ")}</span>
                    </span>
                  </button>
                  {s.etat === "ouvert" ? (
                    <button type="button" onClick={() => reparer(s)} className="bouton-discret h-7 shrink-0 px-2 text-[12px]">
                      Créer un service
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {pannesFermees.length ? (
            <div className="border-t border-bordure px-3 pt-2 pb-3">
              <button type="button" onClick={() => setVoirPannesFermees((x) => !x)} className="meta px-2 font-medium hover:text-texte">
                {voirPannesFermees ? "Masquer" : "Voir"} les {pannesFermees.length} panne{pannesFermees.length > 1 ? "s" : ""} résolue{pannesFermees.length > 1 ? "s" : ""} ou annulée{pannesFermees.length > 1 ? "s" : ""}
              </button>
              {voirPannesFermees ? (
                <ul className="mt-1 flex flex-col">
                  {pannesFermees.map((s) => (
                    <li key={s.numero}>
                      <button type="button" onClick={() => demander({ type: "signalement", numero: s.numero, titre: `Signalement ${s.numero} · ${s.description}`, valeurs: s as unknown as Record<string, unknown>, champs: CHAMPS.signalement })} className="flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-texte-2 hover:bg-surface-2">
                        <Echeance ton={ETAT_SIGNALEMENT[s.etat].ton}>{ETAT_SIGNALEMENT[s.etat].libelle}</Echeance>
                        <span className="min-w-0 flex-1 truncate text-[12.5px]">{s.description}</span>
                        <span className="meta shrink-0">{[date(s.date), s.serviceNumero].filter(Boolean).join(" · ")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </Carte>

        <Carte
          titre="Services de maintenance"
          precision={servicesOuverts.length ? `${servicesOuverts.length} en cours · ${services.length} au total` : services.length ? `Aucun en cours · ${services.length} au total` : "Aucun service sur ce véhicule"}
          action={
            <button type="button" onClick={() => ajouter("ordre-de-travail")} className="bouton-secondaire h-9" title="Tâches, pièces du magasin, facture, pannes incluses">
              <Plus className="size-4" strokeWidth={2} />
              Nouveau service
            </button>
          }
          sansMarge
        >
          {services.length === 0 ? (
            <p className="px-5 pb-4 text-[12.5px] text-texte-2">Un service planifie un entretien ou répare une panne ; sa clôture écrit l&apos;intervention et ses dépenses dans l&apos;atelier, ci-dessous.</p>
          ) : (
            <ul className="flex flex-col px-3 pb-3">
              {servicesOuverts.length === 0 ? <li className="px-2 py-2 text-[12.5px] text-texte-2">Aucun service ouvert.</li> : null}
              {[...servicesOuverts, ...(voirServicesFermes ? servicesFermes : [])].map((o) => {
                const cout = o.lignes?.length ? calculerService(factureDe(o)).coutTotal : o.montantEstime;
                return (
                  <li key={o.numero} data-numero={o.numero}>
                    <button type="button" onClick={() => ouvrir(o)} className={`flex w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left hover:bg-surface-2 ${cible === o.numero ? "bg-accent-fond" : ""}`}>
                      <Echeance ton={TON_STATUT_ORDRE[o.statut]}>{STATUT_ORDRE[o.statut]}</Echeance>
                      <IndicateurPiece present={(o.pieces?.length ?? 0) > 0} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{o.objet}</span>
                        <span className="meta block truncate">{[o.numero, date(o.datePrevue), o.garage !== "—" ? o.garage : null, PRIORITE_SERVICE[o.priorite ?? "planifie"].libelle, o.signalements?.length ? `${o.signalements.length} panne${o.signalements.length > 1 ? "s" : ""}` : null].filter(Boolean).join(" · ")}</span>
                      </span>
                      {cout !== null && cout !== undefined ? <span className="code shrink-0 text-[12.5px]">{montant(cout)}</span> : null}
                    </button>
                  </li>
                );
              })}
              {servicesFermes.length ? (
                <li className="border-t border-bordure pt-2">
                  <button type="button" onClick={() => setVoirServicesFermes((x) => !x)} className="meta px-2 font-medium hover:text-texte">
                    {voirServicesFermes ? "Masquer" : "Voir"} les {servicesFermes.length} service{servicesFermes.length > 1 ? "s" : ""} clos ou annulé{servicesFermes.length > 1 ? "s" : ""}
                  </button>
                </li>
              ) : null}
            </ul>
          )}
        </Carte>
      </div>

      <ListeEtPiece
        piece={
          ouverte ? (
            <VisionneusePiece
              fichier={ouverte.fichier}
              libelle={ouverte.objet}
              precision={[date(ouverte.date), ouverte.tiers, montant(ouverte.montant), ouverte.reference].filter(Boolean).join(" · ")}
              vide="Aucune facture n'est attachée à cette ligne. « Modifier la ligne » permet de la joindre : elle s'ouvrira ici."
              onFermer={() => setCleOuverte(null)}
              actions={
                <button type="button" onClick={() => ouverte.modifier()} className="bouton-secondaire h-9">
                  Modifier la ligne
                </button>
              }
            />
          ) : null
        }
      >
      <Carte
        titre="Atelier"
        precision={`${atelier.length} ligne${atelier.length > 1 ? "s" : ""}${paires.length ? ` · ${paires.length} intervention${paires.length > 1 ? "s" : ""} avec leur dépense sur une seule ligne` : ""} · ${montant(total)} sur 12 mois`}
        action={
          <button type="button" onClick={() => ajouter("intervention")} className="bouton-secondaire h-9" title="L'intervention, ses lignes de dépense, le fournisseur, le compteur et la facture jointe">
            <Receipt className="size-4" strokeWidth={1.8} />
            Saisir une facture
          </button>
        }
        sansMarge
      >
        {/*
          * Six colonnes qui se lisent, quatre en réserve (métier, 16 septembre
          * 2026 : « réorganiser cette table, taille des colonnes »). Dix colonnes
          * à largeur libre débordaient de la carte dès que la fenêtre se
          * resserrait ; la ligne se lisait en défilant. On répond d'abord à la
          * question qu'on pose à l'atelier — quand, quoi, chez qui, combien —,
          * l'objet prend la place qui reste et se tronque. L'origine, le
          * compteur, l'immobilisation et le numéro de pièce restent à un clic,
          * dans le choix des colonnes, et ce choix est retenu par profil.
          */}
        <TableauSimple<LigneAtelier> reglages="fiche-vehicule.atelier.4"
          fixe
          /* Rétractée à côté d'une pièce, la liste ne garde que ce qui s'y lit, et
             laisse le navigateur répartir : ses largeurs réglées sont celles de
             la pleine page. */
          ajustable={!ouverte}
          seulement={ouverte ? ["date", "objet", "montant"] : undefined}
          /* Sans pièce jointe, rien à montrer : le clic n'ouvre pas le cadre (métier, 21 septembre 2026). */
          surLigne={(l) => setCleOuverte((c) => (c === l.cle || !l.fichier ? null : l.cle))}
          ouverte={cleOuverte}
          cle={(l) => l.cle}
          lignes={atelier}
          vide="Aucune intervention ni fourniture sur la période."
          numero={(l) => l.numero}
          cible={cible}
          surModifier={(l) => l.modifier()}
          colonnes={[
            { cle: "date", libelle: "Date", largeur: "104px", rendu: (l) => <span className="code whitespace-nowrap">{date(l.date)}</span> },
            {
              cle: "nature",
              libelle: "Nature",
              largeur: "124px",
              rendu: (l) => <Pastille ton={NATURE_ATELIER[l.nature].ton}>{NATURE_ATELIER[l.nature].libelle}</Pastille>,
            },
            /* La facture s'ouvre sur la ligne, à côté de l'objet — pas dans une colonne
               qu'un réglage peut masquer (métier, 16 septembre 2026 : « je ne sais
               pas ouvrir le fichier attaché par ligne »). */
            {
              cle: "objet",
              libelle: "Objet",
              rendu: (l) => (
                <span className="flex min-w-0 items-center gap-2">
                  <IndicateurPiece present={Boolean(l.fichier)} />
                  <span className="min-w-0 truncate font-medium" title={l.objet}>{l.objet}</span>
                </span>
              ),
            },
            /* La tâche de service, par défaut (métier, 21 septembre 2026). */
            { cle: "taches", libelle: "Tâche de service", largeur: "240px", rendu: (l) => (l.taches.length ? <span className="block truncate text-texte-2" title={l.taches.join(" · ")}>{l.taches.join(" · ")}</span> : <span className="text-attenue-2">—</span>) },
            { cle: "tiers", libelle: "Garage ou fournisseur", largeur: "240px", rendu: (l) => <span className="block truncate" title={l.tiers}>{l.tiers}</span> },
            { cle: "montant", libelle: "Montant", largeur: "118px", alignee: "droite", rendu: (l) => <span className="font-medium whitespace-nowrap">{montant(l.montant)}</span> },
            { cle: "numero", libelle: "Réf.", largeur: "136px", rendu: (l) => <Numero valeur={l.numero} /> },
            { cle: "origine", libelle: "Origine", largeur: "130px", parDefaut: false, rendu: (l) => (l.origine ? <PastilleOrigine origine={l.origine} /> : <span className="text-attenue-2">—</span>) },
            { cle: "km", libelle: "Km relevé", largeur: "110px", alignee: "droite", parDefaut: false, rendu: (l) => <KmReleve km={l.km} motifRejet={l.kmMotifRejet} /> },
            { cle: "immob", libelle: "Immob.", largeur: "84px", alignee: "droite", parDefaut: false, rendu: (l) => (l.immobilisationJours === null ? <span className="text-attenue" title="Une fourniture n'immobilise pas ; pour une intervention, durée non relevée sur la pièce">—</span> : `${l.immobilisationJours} j`) },
            /* La facture s'ouvre depuis la ligne (métier, 16 septembre 2026) : pour une
               dépense, le justificatif signé au clic ; pour une intervention, la
               référence de sa pièce. */
            { cle: "ref", libelle: "Pièce", largeur: "130px", rendu: (l) => (l.fichier ? <Justificatif present fichier={l.fichier} /> : <span className="code whitespace-nowrap text-accent-fonce">{l.reference ?? "—"}</span>) },
          ]}
        />
      </Carte>
      </ListeEtPiece>

    </div>
  );
}

/* ========================================================================== */
/* Plan d'entretien — les rappels, sur leur propre onglet                      */
/* ========================================================================== */

/**
 * Le plan d'entretien tenait le haut de l'onglet Maintenance, au-dessus des
 * listes. Demande du métier du 15 septembre 2026 : « mettre le plan
 * d'intervention (les rappels) sur un autre onglet ».
 *
 * Les deux ne se lisent pas au même moment, et c'est ce qui les sépare :
 * l'atelier dit **ce qui a été fait** et se consulte après coup ; le plan dit
 * **ce qui reste à faire** et se consulte avant de décider. Les empiler
 * obligeait à passer sous les rappels pour atteindre l'historique, chaque fois.
 */
export function OngletPlanEntretien({ fiche }: { fiche: FicheVehicule }) {
  return <PlanEntretien fiche={fiche} />;
}

/* ========================================================================== */
/* Carburant — liste des pleins                                               */
/* ========================================================================== */

export function OngletCarburant({ fiche, cible }: { fiche: FicheVehicule; cible?: string }) {
  const ajouter = useAjoutVehicule(fiche);
  const { surcharger, demander, creations } = useEdition();
  const pleins = sansDoublon([...creations("plein", fabriquerPlein), ...fiche.pleins.map(surcharger)]);
  const litres = pleins.reduce((s, p) => s + p.litres, 0);
  const total = pleins.reduce((s, p) => s + p.montant, 0);
  const avecTicket = pleins.filter((p) => p.photo).length;
  /* Comme à l'atelier (métier, 21 septembre 2026 : « faire de même pour le
     fuel ») : le clic ouvre le ticket à droite, la liste se rétracte. */
  const [idOuvert, setIdOuvert] = useState<string | null>(null);
  const ouvert = idOuvert ? (pleins.find((p) => p.id === idOuvert) ?? null) : null;
  const modifier = (p: PleinFiche) => demander({ type: "plein", numero: p.numero, titre: `Plein · ${nombre(p.litres, 1)} L — ${p.source}`, valeurs: p as unknown as Record<string, unknown> });
  return (
    <ListeEtPiece
      piece={
        ouvert ? (
          <VisionneusePiece
            fichier={ouvert.photo ?? null}
            libelle={`Plein · ${nombre(ouvert.litres, 1)} L — ${ouvert.source}`}
            precision={[date(ouvert.date), montant(ouvert.montant), ouvert.reference || null].filter(Boolean).join(" · ")}
            vide="Aucun ticket n'est attaché à ce plein. « Modifier la ligne » permet de le joindre : il s'ouvrira ici."
            onFermer={() => setIdOuvert(null)}
            actions={
              <button type="button" onClick={() => modifier(ouvert)} className="bouton-secondaire h-9">
                Modifier la ligne
              </button>
            }
          />
        ) : null
      }
    >
    <Carte
      titre="Pleins"
      precision={`${pleins.length} pleins · ${avecTicket} avec leur ticket · ${nombre(litres, 1)} L · ${montant(total)} — l'analyse mensuelle est dans l'Aperçu et dans Coûts & analyses`}
      action={
        <button type="button" onClick={() => ajouter("plein")} className="bouton-secondaire h-9" title="Le plein, le compteur et le ticket ou le bon joint">
          <Receipt className="size-4" strokeWidth={1.8} />
          Saisir un plein
        </button>
      }
      sansMarge
    >
      <TableauSimple<PleinFiche> reglages="fiche-vehicule.pleins"
        cle={(p) => p.id}
        lignes={pleins}
        numero={(p) => p.numero}
        cible={cible}
        seulement={ouvert ? ["date", "source", "montant"] : undefined}
        surLigne={(p) => setIdOuvert((c) => (c === p.id || !p.photo ? null : p.id))}
        ouverte={idOuvert}
        surModifier={modifier}
        colonnes={[
          { cle: "numero", libelle: "Réf.", rendu: (p) => <Numero valeur={p.numero} /> },
          { cle: "date", libelle: "Date", rendu: (p) => <span className="code whitespace-nowrap">{date(p.date)}</span> },
          {
            cle: "source",
            libelle: "Source",
            rendu: (p) => (
              <span className="flex items-center gap-2">
                <IndicateurPiece present={Boolean(p.photo)} />
                <span className="font-medium">{p.source}</span>
              </span>
            ),
          },
          { cle: "reference", libelle: "Bon de sortie", rendu: (p) => <span className="code whitespace-nowrap text-texte-2">{p.reference}</span> },
          { cle: "litres", libelle: "Litres", alignee: "droite", rendu: (p) => nombre(p.litres, 1) },
          { cle: "prix", libelle: "Prix / L", alignee: "droite", rendu: (p) => `${nombre(p.prixLitre)} F` },
          { cle: "montant", libelle: "Montant", alignee: "droite", rendu: (p) => <span className="font-medium">{montant(p.montant)}</span> },
          { cle: "km", libelle: "Km relevé", alignee: "droite", rendu: (p) => <KmReleve km={p.km} motifRejet={p.kmMotifRejet} /> },
          { cle: "ticket", libelle: "Ticket", rendu: (p) => <Justificatif present={Boolean(p.photo)} fichier={p.photo} /> },
        ]}
      />
    </Carte>
    </ListeEtPiece>
  );
}

/* ========================================================================== */
/* Autres dépenses — tout ce qui n'est ni carburant ni maintenance            */
/* ========================================================================== */

export function OngletAutresDepenses({ fiche, cible }: { fiche: FicheVehicule; cible?: string }) {
  const ajouter = useAjoutVehicule(fiche);
  const { surcharger, demander, creations } = useEdition();
  const autres = sansDoublon([...creations("depense", fabriquerDepense), ...fiche.depenses.map(surcharger)]).filter((d) => groupeDuPoste(d.poste) === "autres");
  const total = autres.reduce((s, d) => s + d.montant, 0);
  /* Comme à l'atelier : le clic ouvre la facture à droite, la liste se rétracte. */
  const [idOuverte, setIdOuverte] = useState<string | null>(null);
  const ouverte = idOuverte ? (autres.find((d) => d.id === idOuverte) ?? null) : null;
  const modifier = (d: DepenseFiche) => demander({ type: "depense", numero: d.numero, titre: `Dépense · ${d.libelle}`, valeurs: d as unknown as Record<string, unknown> });
  return (
    <ListeEtPiece
      piece={
        ouverte ? (
          <VisionneusePiece
            fichier={ouverte.photo ?? null}
            libelle={ouverte.libelle}
            precision={[date(ouverte.date), POSTE_DEPENSE[ouverte.poste], ouverte.beneficiaire, montant(ouverte.montant), ouverte.reference].filter(Boolean).join(" · ")}
            vide="Aucune facture n'est attachée à cette dépense. « Modifier la ligne » permet de la joindre : elle s'ouvrira ici."
            onFermer={() => setIdOuverte(null)}
            actions={
              <button type="button" onClick={() => modifier(ouverte)} className="bouton-secondaire h-9">
                Modifier la ligne
              </button>
            }
          />
        ) : null
      }
    >
    <Carte
      titre="Autres dépenses"
      precision={`${autres.length} dépenses · ${montant(total)} — assurance, documents, péages, frais de route, contraventions, divers`}
      action={
        <button type="button" onClick={() => ajouter("depense")} className="bouton-secondaire h-9" title="Une ou plusieurs lignes, le fournisseur et la pièce justificative jointe">
          <Receipt className="size-4" strokeWidth={1.8} />
          Saisir une dépense
        </button>
      }
      sansMarge
    >
      <TableauSimple<DepenseFiche> reglages="fiche-vehicule.autres-depenses"
        cle={(d) => d.id}
        lignes={autres}
        numero={(d) => d.numero}
        cible={cible}
        seulement={ouverte ? ["date", "libelle", "montant"] : undefined}
        surLigne={(d) => setIdOuverte((c) => (c === d.id || !d.photo ? null : d.id))}
        ouverte={idOuverte}
        surModifier={modifier}
        colonnes={[
          { cle: "numero", libelle: "Réf.", rendu: (d) => <Numero valeur={d.numero} /> },
          { cle: "date", libelle: "Date", largeur: "110px", rendu: (d) => <span className="code whitespace-nowrap">{date(d.date)}</span> },
          { cle: "poste", libelle: "Poste", rendu: (d) => <span className="whitespace-nowrap font-medium">{POSTE_DEPENSE[d.poste]}</span> },
          {
            cle: "libelle",
            libelle: "Libellé",
            rendu: (d) => (
              <span className="flex min-w-0 max-w-[320px] items-center gap-2">
                <IndicateurPiece present={Boolean(d.photo)} />
                <span className="min-w-0 truncate">{d.libelle}</span>
              </span>
            ),
          },
          { cle: "beneficiaire", libelle: "Bénéficiaire", rendu: (d) => d.beneficiaire ?? <span className="text-attenue-2">—</span> },
          { cle: "origine", libelle: "Origine", rendu: (d) => <PastilleOrigine origine={d.origine} /> },
          { cle: "reference", libelle: "Pièce", rendu: (d) => <span className="code whitespace-nowrap text-texte-2">{d.reference ?? "—"}</span> },
          { cle: "justificatif", libelle: "Justificatif", rendu: (d) => <Justificatif present={d.justificatif} fichier={d.photo ?? undefined} /> },
          { cle: "km", libelle: "Km relevé", alignee: "droite", rendu: (d) => <KmReleve km={d.km} motifRejet={d.kmMotifRejet} /> },
          { cle: "montant", libelle: "Montant", alignee: "droite", rendu: (d) => <span className="font-medium">{montant(d.montant)}</span> },
        ]}
      />
    </Carte>
    </ListeEtPiece>
  );
}

/* ========================================================================== */
/* Kilométrages — liste des relevés avec le verdict du contrôle               */
/* ========================================================================== */

/**
 * Le relevé que porte une transaction créée — un plein, une intervention, une
 * dépense. Nul quand aucun kilométrage n'a été saisi : on ne relève pas un
 * compteur que personne n'a lu. Le numéro est celui de la transaction porteuse,
 * comme dans le jeu de démonstration.
 */
function releveDe(c: Creation, origine: ReleveFiche["origine"], source: string): ReleveFiche | null {
  const valeur = Number(c.valeurs.km ?? c.valeurs.kilometrage ?? NaN);
  if (!Number.isFinite(valeur) || valeur <= 0) return null;
  return { numero: c.numero, date: String(c.valeurs.date ?? c.date).slice(0, 10), valeur, origine, source, depenseId: null, valide: true, motifRejet: null };
}

export function OngletKilometrage({ fiche, cible }: { fiche: FicheVehicule; cible?: string }) {
  const ajouter = useAjoutVehicule(fiche);
  const { surcharger, demander, creations } = useEdition();
  /* Un plein, une intervention ou une dépense saisis dans l'application portent
     un kilométrage : c'est un relevé, au même titre que ceux du jeu de
     démonstration, et il doit se lire ici. */
  const relevesIndirects: ReleveFiche[] = [
    ...creations("plein", (c) => releveDe(c, "plein", `Plein — ${c.valeurs.reference ?? "saisie dans l'application"}`)),
    ...creations("intervention", (c) => releveDe(c, "garage", `${c.valeurs.garage ?? "Garage"} — ${c.valeurs.objet ?? "intervention"}`)),
    ...creations("depense", (c) => releveDe(c, "depense", String(c.valeurs.libelle ?? "Dépense"))),
  ];
  /* Le contrôle de cohérence se rejoue sur la série entière : un relevé saisi
     entre deux autres peut en écarter un qui passait, et l'inverse. Les
     verdicts du jeu de démonstration ne valent que pour lui seul. */
  const releves = controlerReleves([...creations("releve", fabriquerReleve), ...relevesIndirects, ...fiche.releves.map(surcharger)], fiche.ligne.vehicule.categorie);
  const valides = releves.filter((r) => r.valide);
  const ecartes = releves.length - valides.length;

  /* Écart depuis le relevé retenu qui précède chronologiquement : c'est lui
     qui rend une erreur de saisie visible avant même son motif. */
  const precedentValide = new Map<ReleveFiche, ReleveFiche | null>();
  const chrono = [...valides].sort((a, b) => a.date.localeCompare(b.date) || a.valeur - b.valeur);
  chrono.forEach((r, i) => precedentValide.set(r, i > 0 ? chrono[i - 1]! : null));

  return (
    <Carte
      titre="Relevés kilométriques"
      precision={`${valides.length} retenus${ecartes > 0 ? ` · ${ecartes} écarté${ecartes > 1 ? "s" : ""} par le contrôle de cohérence` : ""} — chaque plein, intervention ou dépense est l'occasion de relever le compteur`}
      action={
        <button type="button" onClick={() => ajouter("releve")} className="bouton-secondaire h-9">
          <Plus className="size-4" strokeWidth={2} />
          Saisir un relevé
        </button>
      }
      sansMarge
    >
      <TableauSimple<ReleveFiche> reglages="fiche-vehicule.releves"
        cle={(r) => r.numero}
        lignes={releves}
        fixe
        numero={(r) => r.numero}
        cible={cible}
        surModifier={(r) => demander({ type: "releve", numero: r.numero, titre: `Relevé · ${r.source}`, valeurs: r as unknown as Record<string, unknown> })}
        colonnes={[
          { cle: "numero", libelle: "Réf.", largeur: "150px", rendu: (r) => <Numero valeur={r.numero} /> },
          { cle: "date", libelle: "Date", largeur: "110px", rendu: (r) => <span className="code whitespace-nowrap">{date(r.date)}</span> },
          { cle: "source", libelle: "Source", rendu: (r) => <span className={`block truncate ${r.valide ? "" : "text-attenue"}`}>{r.source}</span> },
          {
            cle: "origine",
            libelle: "Origine",
            largeur: "110px",
            rendu: (r) => (
              <span className="inline-flex h-6 items-center rounded-full bg-surface-3 px-2.5 text-[12px] font-medium whitespace-nowrap text-texte-2">
                {LIBELLE_ORIGINE_RELEVE[r.origine]}
              </span>
            ),
          },
          {
            cle: "valeur",
            libelle: "Relevé",
            alignee: "droite",
            largeur: "130px",
            rendu: (r) => <span className={`whitespace-nowrap ${r.valide ? "font-medium" : "text-attenue line-through"}`}>{kilometrage(r.valeur)}</span>,
          },
          {
            cle: "ecart",
            libelle: "Depuis le précédent",
            alignee: "droite",
            largeur: "170px",
            rendu: (r) => {
              if (!r.valide) return <span className="text-attenue-2">—</span>;
              const p = precedentValide.get(r);
              if (!p) return <span className="text-attenue-2">premier</span>;
              const jours = Math.max(1, Math.round((new Date(r.date).getTime() - new Date(p.date).getTime()) / (24 * 3600 * 1000)));
              return (
                <span className="whitespace-nowrap text-texte-2">
                  +{kilometrage(r.valeur - p.valeur)} <span className="text-attenue">· {jours} j</span>
                </span>
              );
            },
          },
          {
            cle: "controle",
            libelle: "Contrôle",
            largeur: "300px",
            rendu: (r) =>
              r.valide ? (
                <Echeance ton="favorable">retenu</Echeance>
              ) : (
                <span className="flex items-start gap-2">
                  <Echeance ton="vigilance">écarté</Echeance>
                  <span className="min-w-0 text-[12px] leading-snug text-texte-2">{r.motifRejet}</span>
                </span>
              ),
          },
        ]}
      />
    </Carte>
  );
}

/* ========================================================================== */
/* Journal — chronologie et périodes de statut                                */
/* ========================================================================== */

const LIBELLE_CATEGORIE: Record<EvenementJournal["categorie"], string> = {
  statut: "Statut",
  affectation: "Affectation",
  document: "Document",
  intervention: "Intervention",
  depense: "Dépense",
  releve: "Relevé",
  note: "Note",
};

export function OngletJournal({ fiche }: { fiche: FicheVehicule }) {
  const { creations, creationsLiees } = useEdition();
  /* Une déclaration saisie depuis un chauffeur cite ce véhicule : elle entre au
     journal comme si elle avait été saisie ici — c'est le même événement. */
  const incidentsLies = creationsLiees("incident", (c) => String(c.valeurs.vehiculeId ?? "") === fiche.ligne.vehicule.id, fabriquerEvenementIncident);
  const journal = [...creations("incident", fabriquerEvenementIncident), ...incidentsLies, ...creations("statut", fabriquerEvenementStatut), ...fiche.journal].sort((a, b) => b.date.localeCompare(a.date));
  const periodes = [...creations("statut", fabriquerPeriodeStatut), ...fiche.periodesStatut];
  return (
    <div className="flex flex-col gap-5">
      <Carte titre="Journal du véhicule" precision="Tout ce qui est arrivé à ce véhicule, par qui, et quand — du plus récent au plus ancien">
        <ol className="relative flex flex-col gap-0 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-bordure">
          {journal.map((e, i) => (
            <li key={`${e.date}-${i}`} className="relative flex items-start gap-4 py-3">
              <span className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 text-[10.5px] font-semibold text-texte-2 ring-4 ring-surface">
                {e.initiales}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[13px] font-medium text-texte">{e.auteur}</span>
                  <span className="badge-texte rounded-full bg-surface-3 px-2 py-px text-texte-2">{LIBELLE_CATEGORIE[e.categorie]}</span>
                  <span className="code ml-auto text-[12px] text-attenue">{date(e.date)}</span>
                </p>
                <p className="mt-1 text-[13px] leading-[1.5] text-texte-2">{e.texte}</p>
              </div>
            </li>
          ))}
        </ol>
      </Carte>

      <Carte titre="Périodes de statut" precision="Historique horodaté — c'est lui qui rend D_TDPA et D_TICV calculables" sansMarge>
        <TableauSimple<PeriodeStatutFiche> reglages="fiche-vehicule.periodes-statut"
          cle={(p) => `${p.statut}-${p.debut}`}
          lignes={periodes}
          colonnes={[
            { cle: "statut", libelle: "Statut", rendu: (p) => <PastilleStatut statut={p.statut} /> },
            { cle: "motif", libelle: "Motif", rendu: (p) => (p.motif ? MOTIF_IMMOBILISATION[p.motif] : "—") },
            { cle: "debut", libelle: "Début", rendu: (p) => <span className="code">{date(p.debut)}</span> },
            { cle: "fin", libelle: "Fin", rendu: (p) => (p.fin ? <span className="code">{date(p.fin)}</span> : <span className="text-attenue">en cours</span>) },
            { cle: "jours", libelle: "Durée", alignee: "droite", rendu: (p) => (p.jours > 0 ? `${p.jours} j` : "—") },
          ]}
        />
      </Carte>
    </div>
  );
}
