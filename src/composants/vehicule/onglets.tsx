"use client";

import { ENERGIE } from "@/domaine/libelles";

import Link from "next/link";
import { AlertTriangle, FileText, Plus, Wrench } from "lucide-react";
import { Carte, Definitions, TableauSimple } from "@/composants/interface/Carte";
import { Numero } from "@/composants/interface/Numero";
import { useEdition } from "@/composants/transactions/ContexteEdition";
import { useAjoutVehicule } from "./ajout";
import {
  fabriquerAffectationVehicule,
  fabriquerAttelage,
  fabriquerDepense,
  fabriquerDocument,
  fabriquerEvenementIncident,
  fabriquerEvenementStatut,
  fabriquerIntervention,
  fabriquerPeriodeStatut,
  fabriquerObservation,
  fabriquerPlein,
  fabriquerReleve,
  fabriquerVisite,
} from "@/composants/transactions/fabriques";
import type { ObservationVisite, VisiteTechnique } from "@/domaine/types";
import type { Creation } from "@/domaine/cloture";
import { agregerCouts } from "@/domaine/fiche";
import { controlerReleves } from "@/domaine/releves";
import { Echeance, Pastille, PastilleStatut } from "@/composants/interface/Pastille";
import type {
  AffectationFiche,
  AttelageFiche,
  DepenseFiche,
  DocumentFiche,
  EtatDocument,
  EvenementJournal,
  FicheVehicule,
  Intervention,
  PeriodeStatutFiche,
  PleinFiche,
  ReleveFiche,
} from "@/domaine/fiche";
import {
  BUSINESS_UNIT,
  CATEGORIE_OBSERVATION,
  libelleCategorie,
  GRAVITE_OBSERVATION,
  GROUPE_CHARGE,
  STATUT_OBSERVATION,
  STATUT_VISITE,
  TYPE_VISITE,
  MOTIF_IMMOBILISATION,
  POSTE_DEPENSE,
  ROLE_AFFECTATION,
  TYPE_DOCUMENT,
  USAGE_VEHICULE,
  groupeDuPoste,
  type Ton,
} from "@/domaine/libelles";
import { libelleMois } from "@/donnees/fiche-demo";
import { date, kilometrage, montant, montantCourt, nombre, pourcentage } from "@/lib/format";
import { GraphiqueBarresEmpilees } from "./GraphiqueBarresEmpilees";
import { PlanEntretien } from "./PlanEntretien";

/* ========================================================================== */
/* Pièces communes                                                            */
/* ========================================================================== */

const TON_ETAT: Record<EtatDocument, Ton> = {
  "a-jour": "favorable",
  bientot: "vigilance",
  echu: "defavorable",
  manquant: "defavorable",
  permanent: "neutre",
};

const LIBELLE_ETAT: Record<EtatDocument, string> = {
  "a-jour": "À jour",
  bientot: "Bientôt",
  echu: "Échue",
  manquant: "Manquant",
  permanent: "Permanent",
};

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
};

function etatDocumentLibelle(d: DocumentFiche): string {
  if (d.etat === "echu" && d.joursRestants !== null) return `échue de ${Math.abs(d.joursRestants)} j`;
  if (d.etat === "bientot" && d.joursRestants !== null) return `dans ${d.joursRestants} j`;
  if (d.etat === "a-jour" && d.joursRestants !== null) return `dans ${d.joursRestants} j`;
  return LIBELLE_ETAT[d.etat].toLowerCase();
}

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

function Justificatif({ present }: { present: boolean }) {
  return present ? (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-texte-2" title="La pièce est déclarée fournie. Sa consultation viendra avec le stockage des fichiers — rien n'en tient encore le contenu.">
      <FileText className="size-3.5 text-attenue" strokeWidth={1.8} />
      Fourni
    </span>
  ) : (
    <Echeance ton="vigilance">manquant</Echeance>
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
  const depenses = [...creations("depense", fabriquerDepense), ...fiche.depenses.map(surcharger)];
  const { chargesParGroupe, coutsMensuels, total: totalDepenses } = agregerCouts(depenses, fiche.coutsMensuels.map((m) => m.mois));
  /* Le kilométrage des douze mois ne s'affiche nulle part : on le retrouve des
     deux indicateurs du serveur, pour que le coût au kilomètre suive les
     dépenses ajoutées sans qu'il faille recalculer toute la série. */
  const kmDouzeMois = fiche.indicateurs.coutDouzeMois && fiche.indicateurs.coutParKm ? fiche.indicateurs.coutDouzeMois / fiche.indicateurs.coutParKm : null;
  const coutParKm = kmDouzeMois && kmDouzeMois > 0 ? Math.round(totalDepenses / kmDouzeMois) : fiche.indicateurs.coutParKm;
  const totalCharges = chargesParGroupe.reduce((somme, g) => somme + g.montant, 0);
  const derniereIntervention = [...creations("intervention", fabriquerIntervention), ...fiche.interventions.map(surcharger)].sort((x, y) => y.date.localeCompare(x.date))[0] ?? null;
  const dernierPlein = [...creations("plein", fabriquerPlein), ...fiche.pleins.map(surcharger)].sort((x, y) => y.date.localeCompare(x.date))[0] ?? null;

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-5">
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

      </div>

      <div className="flex min-w-0 flex-col gap-5">
        {/* ---- Situation ---- */}
        <Carte titre="Situation">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
            <div className="min-w-0">
              <p className="label-champ">Dernière intervention</p>
              {derniereIntervention ? (
                <>
                  <p className="mt-1.5 truncate text-[13px] font-medium text-texte">{derniereIntervention.objet}</p>
                  <p className="meta mt-1 truncate">
                    {date(derniereIntervention.date)} · {derniereIntervention.garage}
                  </p>
                </>
              ) : (
                <p className="mt-1.5 text-[13px] text-attenue-2">Aucune enregistrée</p>
              )}
            </div>
            <div className="min-w-0">
              <p className="label-champ">Dernier plein</p>
              {dernierPlein ? (
                <>
                  <p className="mt-1.5 text-[13px] font-medium text-texte">
                    {nombre(dernierPlein.litres, 1)} L · {montant(dernierPlein.montant)}
                  </p>
                  <p className="meta mt-1 truncate">
                    {date(dernierPlein.date)} · {dernierPlein.source}
                  </p>
                </>
              ) : (
                <p className="mt-1.5 text-[13px] text-attenue-2">Aucun</p>
              )}
            </div>
            <div className="min-w-0">
              <p className="label-champ">Prochain entretien</p>
              {prochaineIntervention ? (
                <>
                  <p className="mt-1.5 text-[13px] font-medium text-texte">{prochaineIntervention.libelle}</p>
                  <p className="meta mt-1">
                    dans {kilometrage(prochaineIntervention.kmRestants)} · ≈ {prochaineIntervention.joursEstimes} j
                  </p>
                </>
              ) : (
                <p className="mt-1.5 text-[13px] text-attenue-2">Non planifié</p>
              )}
            </div>
          </div>
        </Carte>

        {/* ---- Échéances ---- */}
        <Carte titre="Prochaines échéances" precision="Documents et entretien, du plus urgent au plus lointain">
          <ul className="flex flex-col">
            {echeances.map((e) => (
              <li key={`${e.libelle}-${e.repere}`} className="flex items-start gap-3 border-b border-bordure py-3 first:pt-0 last:border-b-0 last:pb-0">
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${
                    e.ton === "defavorable" ? "bg-defavorable" : e.ton === "vigilance" ? "bg-vigilance" : e.ton === "favorable" ? "bg-accent" : "bg-attenue-2"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline gap-2">
                    <span className="text-[13px] font-medium text-texte">{e.libelle}</span>
                    <span className="code ml-auto shrink-0 text-[12px] text-texte-2">{e.repere.includes("-") ? date(e.repere) : e.repere}</span>
                  </p>
                  <p className="meta mt-0.5">{e.precision}</p>
                </div>
              </li>
            ))}
          </ul>
        </Carte>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Caractéristiques — référentiel du véhicule                                 */
/* ========================================================================== */

export function OngletCaracteristiques({ fiche }: { fiche: FicheVehicule }) {
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
            { libelle: "Usage", valeur: USAGE_VEHICULE[v.usage] },
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

      <Carte titre="Valeur et amortissement">
        <Definitions
          elements={[
            { libelle: "Valeur d'acquisition", valeur: montant(i.valeurAcquisition) },
            { libelle: "Durée d'amortissement", valeur: i.dureeAmortissementAnnees ? `${i.dureeAmortissementAnnees} ans` : null },
            { libelle: "Valeur nette comptable", valeur: montant(i.valeurNetteComptable) },
            { libelle: "Fin d'amortissement", valeur: i.finAmortissement ? date(i.finAmortissement) : null },
          ]}
        />
      </Carte>

    </div>
  );
}

/* ========================================================================== */
/* Affectations — liste                                                       */
/* ========================================================================== */

export function OngletAffectations({ fiche, cible }: { fiche: FicheVehicule; cible?: string }) {
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
          vide={categorie === "tracteur" ? "Aucune remorque attelée à ce jour." : "Aucun tracteur attelé à ce jour."}
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

export function OngletConformite({ fiche, cible }: { fiche: FicheVehicule; cible?: string }) {
  const ajouter = useAjoutVehicule(fiche);
  const { surcharger, demander, creations } = useEdition();
  const documents = [...creations("document", (c) => fabriquerDocument(c, fiche.ligne.vehicule.categorie)), ...fiche.documents.map(surcharger)];
  const manquants = documents.filter((d) => d.etat === "manquant").length;
  const echus = documents.filter((d) => d.etat === "echu").length;
  const visites = [...creations("visite", (c) => fabriquerVisite(c, fiche.ligne.vehicule.id)), ...fiche.visitesTechniques.map(surcharger)].sort((a, b) => b.dateRendezVous.localeCompare(a.dateRendezVous));
  const observations = [...creations("observation", (c) => fabriquerObservation(c, fiche.ligne.vehicule.id)), ...fiche.observationsVisite.map(surcharger)];
  const refusEnCours = visites.find((x) => x.statut === "refusee") ?? null;
  const contreVisitePrise = visites.some((x) => x.type === "contre-visite" && x.statut === "rendez-vous");
  return (
    <div className="flex flex-col gap-5">
    <Carte
      titre="Documents"
      precision={manquants + echus > 0 ? `${echus} échu${echus > 1 ? "s" : ""} · ${manquants} manquant${manquants > 1 ? "s" : ""}` : "Tous les documents sont à jour"}
      action={
        <button type="button" onClick={() => ajouter("document")} className="bouton-secondaire h-9">
          <Plus className="size-4" strokeWidth={2} />
          Ajouter un document
        </button>
      }
      sansMarge
    >
      <TableauSimple<DocumentFiche> reglages="fiche-vehicule.documents"
        cle={(d) => d.numero}
        lignes={documents}
        numero={(d) => d.numero}
        cible={cible}
        surModifier={(d) => demander({ type: "document", numero: d.numero, titre: `Document · ${TYPE_DOCUMENT[d.type]}`, valeurs: d as unknown as Record<string, unknown> })}
        colonnes={[
          { cle: "numero", libelle: "Réf.", rendu: (d) => <Numero valeur={d.numero} /> },
          {
            cle: "type",
            libelle: "Document",
            rendu: (d) => (
              <span className="flex flex-col">
                <span className="font-medium">{TYPE_DOCUMENT[d.type]}</span>
                {d.portee ? <span className="meta">{d.portee}</span> : null}
              </span>
            ),
          },
          { cle: "piece", libelle: "N° de pièce", rendu: (d) => <span className="code whitespace-nowrap text-texte-2">{d.numeroPiece ?? "—"}</span> },
          { cle: "emetteur", libelle: "Émetteur", rendu: (d) => d.emetteur ?? "—" },
          { cle: "effet", libelle: "Effet", rendu: (d) => <span className="code">{date(d.dateEffet)}</span> },
          { cle: "echeance", libelle: "Échéance", rendu: (d) => <span className="code">{date(d.echeance)}</span> },
          { cle: "montant", libelle: "Montant", alignee: "droite", rendu: (d) => montant(d.montant) },
          { cle: "justificatif", libelle: "Justificatif", rendu: (d) => (d.justificatif ? <Justificatif present /> : <span className="text-attenue-2">à fournir</span>) },
          { cle: "etat", libelle: "État", rendu: (d) => <Echeance ton={TON_ETAT[d.etat]}>{etatDocumentLibelle(d)}</Echeance> },
        ]}
      />
    </Carte>

    <Carte
      titre="Visites techniques"
      precision={
        refusEnCours && !contreVisitePrise
          ? `Dernière visite refusée${refusEnCours.dateLimiteContreVisite ? ` — contre-visite à passer avant le ${date(refusEnCours.dateLimiteContreVisite)}` : ""} · ${observations.filter((o) => o.statut !== "corrigee").length} observation${observations.filter((o) => o.statut !== "corrigee").length > 1 ? "s" : ""} à corriger`
          : "Rendez-vous, passages, résultats — le document n'est renouvelé qu'à l'acceptation ; les observations d'un refus sont suivies dans Entretien"
      }
      sansMarge
    >
      <TableauSimple<VisiteTechnique> reglages="fiche-vehicule.visites"
        cle={(x) => x.numero}
        lignes={visites}
        vide="Aucune visite technique enregistrée."
        numero={(x) => x.numero}
        cible={cible}
        surModifier={(x) => demander({ type: "visite", numero: x.numero, titre: `${TYPE_VISITE[x.type]} technique · ${date(x.dateRendezVous)}`, valeurs: x as unknown as Record<string, unknown> })}
        colonnes={[
          { cle: "numero", libelle: "Réf.", rendu: (x) => <Numero valeur={x.numero} /> },
          { cle: "type", libelle: "Type", rendu: (x) => <span className="font-medium">{TYPE_VISITE[x.type]}</span> },
          { cle: "rdv", libelle: "Rendez-vous", rendu: (x) => <span className="code whitespace-nowrap">{date(x.dateRendezVous)}{x.heure ? ` ${x.heure}` : ""}</span> },
          { cle: "centre", libelle: "Centre", rendu: (x) => x.centre },
          { cle: "passage", libelle: "Passée le", rendu: (x) => <span className="code">{x.datePassage ? date(x.datePassage) : "—"}</span> },
          { cle: "statut", libelle: "Résultat", rendu: (x) => <Pastille ton={STATUT_VISITE[x.statut].ton}>{STATUT_VISITE[x.statut].libelle}</Pastille> },
          { cle: "pv", libelle: "N° de PV", rendu: (x) => <span className="code whitespace-nowrap text-texte-2">{x.numeroPv ?? "—"}</span> },
          { cle: "limite", libelle: "Contre-visite avant", rendu: (x) => (x.dateLimiteContreVisite ? <Echeance ton={x.statut === "refusee" && !contreVisitePrise ? "defavorable" : "neutre"}>{date(x.dateLimiteContreVisite)}</Echeance> : <span className="text-attenue-2">—</span>) },
          { cle: "obs", libelle: "Observations", alignee: "droite", rendu: (x) => { const n = observations.filter((o) => o.visiteId === x.id).length; return n ? `${n}` : <span className="text-attenue-2">0</span>; } },
          { cle: "commentaire", libelle: "Commentaire", rendu: (x) => <span className="block max-w-[280px] truncate text-texte-2">{x.commentaire ?? "—"}</span> },
        ]}
      />
    </Carte>
    </div>
  );
}

/* ========================================================================== */
/* Entretien — interventions, pièces et pneumatiques                          */
/* ========================================================================== */

export function OngletMaintenance({ fiche, cible }: { fiche: FicheVehicule; cible?: string }) {
  const ajouter = useAjoutVehicule(fiche);
  const { surcharger, demander, creations } = useEdition();
  const interventions = [...creations("intervention", fabriquerIntervention), ...fiche.interventions.map(surcharger)];
  const depensesCreees = creations("depense", fabriquerDepense);
  const fournitures = [...depensesCreees, ...fiche.depenses.map(surcharger)].filter((d) => d.poste === "pieces" || d.poste === "pneumatiques");
  const total = interventions.reduce((s, i) => s + i.montant, 0) + fournitures.reduce((s, d) => s + d.montant, 0);
  const observations = [...creations("observation", (c) => fabriquerObservation(c, fiche.ligne.vehicule.id)), ...fiche.observationsVisite.map(surcharger)];
  const observationsOuvertes = observations.filter((o) => o.statut !== "corrigee");
  const visitesParId = new Map([...creations("visite", (c) => fabriquerVisite(c, fiche.ligne.vehicule.id)), ...fiche.visitesTechniques].map((x) => [x.id, x]));

  return (
    <div className="flex flex-col gap-5">
      <PlanEntretien fiche={fiche} />

      <Carte
        titre="Interventions"
        precision={`${fiche.interventions.length} interventions · maintenance ${montant(total)} sur 12 mois, fournitures comprises`}
        action={
          <button type="button" onClick={() => ajouter("intervention")} className="bouton-secondaire h-9">
            <Wrench className="size-4" strokeWidth={1.8} />
            Nouvelle intervention
          </button>
        }
        sansMarge
      >
        <TableauSimple<Intervention> reglages="fiche-vehicule.interventions"
          cle={(i) => i.numero}
          lignes={interventions}
          numero={(i) => i.numero}
          cible={cible}
          surModifier={(i) => demander({ type: "intervention", numero: i.numero, titre: `Intervention · ${i.objet}`, valeurs: i as unknown as Record<string, unknown> })}
          colonnes={[
            { cle: "numero", libelle: "Réf.", rendu: (i) => <Numero valeur={i.numero} /> },
            { cle: "date", libelle: "Date", rendu: (i) => <span className="code whitespace-nowrap">{date(i.date)}</span> },
            {
              cle: "type",
              libelle: "Type",
              rendu: (i) => <Pastille ton={i.type === "preventif" ? "favorable" : "vigilance"}>{i.type === "preventif" ? "Préventif" : "Curatif"}</Pastille>,
            },
            { cle: "objet", libelle: "Objet", rendu: (i) => <span className="font-medium">{i.objet}</span> },
            { cle: "garage", libelle: "Garage", rendu: (i) => i.garage },
            { cle: "km", libelle: "Km relevé", alignee: "droite", rendu: (i) => kilometrage(i.km) },
            { cle: "immob", libelle: "Immob.", alignee: "droite", rendu: (i) => `${i.immobilisationJours} j` },
            { cle: "montant", libelle: "Montant", alignee: "droite", rendu: (i) => <span className="font-medium">{montant(i.montant)}</span> },
            { cle: "ref", libelle: "Pièce", rendu: (i) => <span className="code whitespace-nowrap text-accent-fonce">{i.reference}</span> },
          ]}
        />
      </Carte>

      <Carte
        titre="Observations de visite technique"
        precision={observationsOuvertes.length ? `${observationsOuvertes.length} action${observationsOuvertes.length > 1 ? "s" : ""} corrective${observationsOuvertes.length > 1 ? "s" : ""} à clôturer avant la contre-visite` : observations.length ? "Toutes les observations sont corrigées" : "Aucune observation — les défauts relevés par le centre se suivent ici jusqu'à leur clôture"}
        sansMarge
      >
        <TableauSimple<ObservationVisite> reglages="fiche-vehicule.observations"
          cle={(o) => o.numero}
          lignes={observations}
          vide="Aucune observation de visite technique."
          numero={(o) => o.numero}
          cible={cible}
          surModifier={(o) => demander({ type: "observation", numero: o.numero, titre: `Observation · ${o.libelle}`, valeurs: o as unknown as Record<string, unknown> })}
          colonnes={[
            { cle: "numero", libelle: "Réf.", rendu: (o) => <Numero valeur={o.numero} /> },
            { cle: "visite", libelle: "Visite", rendu: (o) => { const vt = visitesParId.get(o.visiteId); return vt ? <span className="code whitespace-nowrap">{date(vt.datePassage ?? vt.dateRendezVous)}</span> : "—"; } },
            { cle: "libelle", libelle: "Observation", rendu: (o) => <span className="block max-w-[360px] font-medium">{o.libelle}</span> },
            { cle: "categorie", libelle: "Catégorie", rendu: (o) => CATEGORIE_OBSERVATION[o.categorie] },
            { cle: "gravite", libelle: "Gravité", rendu: (o) => <Pastille ton={o.gravite === "majeure" ? "defavorable" : "neutre"}>{GRAVITE_OBSERVATION[o.gravite]}</Pastille> },
            { cle: "statut", libelle: "Suivi", rendu: (o) => <Pastille ton={STATUT_OBSERVATION[o.statut].ton}>{STATUT_OBSERVATION[o.statut].libelle}</Pastille> },
            { cle: "intervention", libelle: "Intervention", rendu: (o) => (o.interventionNumero ? <Numero valeur={o.interventionNumero} /> : <span className="text-attenue-2">—</span>) },
            { cle: "corrigee", libelle: "Corrigée le", rendu: (o) => <span className="code">{o.corrigeeLe ? date(o.corrigeeLe) : "—"}</span> },
          ]}
        />
      </Carte>

      <Carte titre="Pièces et pneumatiques" precision="Fournitures de maintenance hors intervention" sansMarge>
        <TableauSimple<DepenseFiche> reglages="fiche-vehicule.pieces"
          cle={(d) => d.id}
          lignes={fournitures}
          vide="Aucune fourniture sur la période."
          numero={(d) => d.numero}
          cible={cible}
          surModifier={(d) => demander({ type: "depense", numero: d.numero, titre: `Dépense · ${d.libelle}`, valeurs: d as unknown as Record<string, unknown> })}
          colonnes={[
            { cle: "numero", libelle: "Réf.", rendu: (d) => <Numero valeur={d.numero} /> },
            { cle: "date", libelle: "Date", rendu: (d) => <span className="code whitespace-nowrap">{date(d.date)}</span> },
            { cle: "poste", libelle: "Poste", rendu: (d) => <span className="whitespace-nowrap font-medium">{POSTE_DEPENSE[d.poste]}</span> },
            { cle: "libelle", libelle: "Libellé", rendu: (d) => <span className="block max-w-[360px] truncate">{d.libelle}</span> },
            { cle: "beneficiaire", libelle: "Fournisseur", rendu: (d) => d.beneficiaire ?? "—" },
            { cle: "origine", libelle: "Origine", rendu: (d) => <PastilleOrigine origine={d.origine} /> },
            { cle: "reference", libelle: "Pièce", rendu: (d) => <span className="code whitespace-nowrap text-texte-2">{d.reference ?? "—"}</span> },
            { cle: "km", libelle: "Km relevé", alignee: "droite", rendu: (d) => <KmReleve km={d.km} motifRejet={d.kmMotifRejet} /> },
            { cle: "montant", libelle: "Montant", alignee: "droite", rendu: (d) => <span className="font-medium">{montant(d.montant)}</span> },
          ]}
        />
      </Carte>
    </div>
  );
}

/* ========================================================================== */
/* Carburant — liste des pleins                                               */
/* ========================================================================== */

export function OngletCarburant({ fiche, cible }: { fiche: FicheVehicule; cible?: string }) {
  const ajouter = useAjoutVehicule(fiche);
  const { surcharger, demander, creations } = useEdition();
  const pleins = [...creations("plein", fabriquerPlein), ...fiche.pleins.map(surcharger)];
  const litres = pleins.reduce((s, p) => s + p.litres, 0);
  const total = pleins.reduce((s, p) => s + p.montant, 0);
  return (
    <Carte
      titre="Pleins"
      precision={`${fiche.pleins.length} pleins · ${nombre(litres, 1)} L · ${montant(total)} — l'analyse mensuelle est dans l'Aperçu et dans Coûts & analyses`}
      action={
        <button type="button" onClick={() => ajouter("plein")} className="bouton-secondaire h-9">
          <Plus className="size-4" strokeWidth={2} />
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
        surModifier={(p) => demander({ type: "plein", numero: p.numero, titre: `Plein · ${nombre(p.litres, 1)} L — ${p.source}`, valeurs: p as unknown as Record<string, unknown> })}
        colonnes={[
          { cle: "numero", libelle: "Réf.", rendu: (p) => <Numero valeur={p.numero} /> },
          { cle: "date", libelle: "Date", rendu: (p) => <span className="code whitespace-nowrap">{date(p.date)}</span> },
          { cle: "source", libelle: "Source", rendu: (p) => <span className="font-medium">{p.source}</span> },
          { cle: "reference", libelle: "Bon de sortie", rendu: (p) => <span className="code whitespace-nowrap text-texte-2">{p.reference}</span> },
          { cle: "litres", libelle: "Litres", alignee: "droite", rendu: (p) => nombre(p.litres, 1) },
          { cle: "prix", libelle: "Prix / L", alignee: "droite", rendu: (p) => `${nombre(p.prixLitre)} F` },
          { cle: "montant", libelle: "Montant", alignee: "droite", rendu: (p) => <span className="font-medium">{montant(p.montant)}</span> },
          { cle: "km", libelle: "Km relevé", alignee: "droite", rendu: (p) => <KmReleve km={p.km} motifRejet={p.kmMotifRejet} /> },
        ]}
      />
    </Carte>
  );
}

/* ========================================================================== */
/* Autres dépenses — tout ce qui n'est ni carburant ni maintenance            */
/* ========================================================================== */

export function OngletAutresDepenses({ fiche, cible }: { fiche: FicheVehicule; cible?: string }) {
  const ajouter = useAjoutVehicule(fiche);
  const { surcharger, demander, creations } = useEdition();
  const autres = [...creations("depense", fabriquerDepense), ...fiche.depenses.map(surcharger)].filter((d) => groupeDuPoste(d.poste) === "autres");
  const total = autres.reduce((s, d) => s + d.montant, 0);
  return (
    <Carte
      titre="Autres dépenses"
      precision={`${autres.length} dépenses · ${montant(total)} — assurance, documents, péages, frais de route, contraventions, divers`}
      action={
        <button type="button" onClick={() => ajouter("depense")} className="bouton-secondaire h-9">
          <Plus className="size-4" strokeWidth={2} />
          Nouvelle dépense
        </button>
      }
      sansMarge
    >
      <TableauSimple<DepenseFiche> reglages="fiche-vehicule.autres-depenses"
        cle={(d) => d.id}
        lignes={autres}
        numero={(d) => d.numero}
        cible={cible}
        surModifier={(d) => demander({ type: "depense", numero: d.numero, titre: `Dépense · ${d.libelle}`, valeurs: d as unknown as Record<string, unknown> })}
        colonnes={[
          { cle: "numero", libelle: "Réf.", rendu: (d) => <Numero valeur={d.numero} /> },
          { cle: "date", libelle: "Date", largeur: "110px", rendu: (d) => <span className="code whitespace-nowrap">{date(d.date)}</span> },
          { cle: "poste", libelle: "Poste", rendu: (d) => <span className="whitespace-nowrap font-medium">{POSTE_DEPENSE[d.poste]}</span> },
          { cle: "libelle", libelle: "Libellé", rendu: (d) => <span className="block max-w-[300px] truncate">{d.libelle}</span> },
          { cle: "beneficiaire", libelle: "Bénéficiaire", rendu: (d) => d.beneficiaire ?? <span className="text-attenue-2">—</span> },
          { cle: "origine", libelle: "Origine", rendu: (d) => <PastilleOrigine origine={d.origine} /> },
          { cle: "reference", libelle: "Pièce", rendu: (d) => <span className="code whitespace-nowrap text-texte-2">{d.reference ?? "—"}</span> },
          { cle: "justificatif", libelle: "Justificatif", rendu: (d) => <Justificatif present={d.justificatif} /> },
          { cle: "km", libelle: "Km relevé", alignee: "droite", rendu: (d) => <KmReleve km={d.km} motifRejet={d.kmMotifRejet} /> },
          { cle: "montant", libelle: "Montant", alignee: "droite", rendu: (d) => <span className="font-medium">{montant(d.montant)}</span> },
        ]}
      />
    </Carte>
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
