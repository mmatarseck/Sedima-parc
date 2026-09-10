"use client";

import Link from "next/link";
import { FileText, Lock, Plus } from "lucide-react";
import { Carte, Definitions, TableauSimple } from "@/composants/interface/Carte";
import { Numero } from "@/composants/interface/Numero";
import { CHAMPS_CONTRAVENTION, CHAMPS_FRAIS } from "@/composants/transactions/champs";
import { useEdition } from "@/composants/transactions/ContexteEdition";
import type { CibleAjout } from "@/composants/vehicule/MenuAjout";

/** Ce que la fiche prête aux onglets : sa création tracée, la même que la barre d ajout. */
type Ajouter = (cible: CibleAjout) => void;
import {
  fabriquerAffectationChauffeur,
  fabriquerContravention,
  fabriquerDocumentChauffeur,
  fabriquerEvenementAptitude,
  fabriquerEvenementIndisponibilite,
  fabriquerIncidentChauffeur,
  fabriquerIndisponibilite,
  fabriquerSanction,
} from "@/composants/transactions/fabriques";
import { Echeance, Pastille } from "@/composants/interface/Pastille";
import { GraphiqueBarres } from "@/composants/vehicule/GraphiqueBarres";
import type {
  AffectationChauffeur,
  ConsommationChauffeur,
  ContraventionChauffeur,
  FicheChauffeur,
  FraisDeRoute,
  IncidentChauffeur,
  PeriodeMois,
} from "@/domaine/chauffeur";
import type { DocumentFiche, EtatDocument } from "@/domaine/fiche";
import {
  APTITUDE,
  CONTRAT_CHAUFFEUR,
  MISSION_INCIDENT,
  MOTIF_INDISPONIBILITE,
  NATURE_INCIDENT,
  RESPONSABILITE,
  ROLE_AFFECTATION,
  STATUT_DECLARATION,
  TYPE_DOCUMENT,
  TYPE_INCIDENT,
  TYPE_SANCTION,
  type Ton,
} from "@/domaine/libelles";
import type { Indisponibilite, Sanction } from "@/domaine/types";
import { libelleMois } from "@/donnees/fiche-demo";
import { date, kilometrage, montant, nombre } from "@/lib/format";

/** Ce que la période retient de la fiche — calculé une fois dans l'en-tête. */
export interface Selection {
  debut: string;
  fin: string;
  periode: PeriodeMois;
  consommation: ConsommationChauffeur[];
  contraventions: ContraventionChauffeur[];
  incidents: IncidentChauffeur[];
  sanctions: Sanction[];
  fraisDeRoute: FraisDeRoute[];
  affectations: AffectationChauffeur[];
  joursIndisponibles: number;
}

/* ========================================================================== */
/* Pièces communes                                                            */
/* ========================================================================== */

const TON_ETAT: Record<EtatDocument, Ton> = { "a-jour": "favorable", bientot: "vigilance", echu: "defavorable", manquant: "defavorable", permanent: "neutre" };

function etatDocumentLibelle(d: DocumentFiche): string {
  if (d.etat === "manquant") return "manquant";
  if (d.joursRestants === null) return "à jour";
  if (d.joursRestants < 0) return `échue de ${Math.abs(d.joursRestants)} j`;
  return `dans ${d.joursRestants} j`;
}

function Vehicule({ immatriculation, affichee, precision }: { immatriculation?: string; affichee: string; precision?: string }) {
  const contenu = <span className="code font-medium">{affichee}</span>;
  return (
    <span className="flex flex-col">
      {immatriculation ? (
        <Link href={`/flotte/${immatriculation}`} className="text-accent-fonce hover:text-accent hover:underline">
          {contenu}
        </Link>
      ) : (
        contenu
      )}
      {precision ? <span className="meta truncate">{precision}</span> : null}
    </span>
  );
}

function TonEcart({ pct }: { pct: number }) {
  const ton: Ton = pct > 15 ? "vigilance" : pct < -5 ? "favorable" : "neutre";
  return (
    <Echeance ton={ton}>
      {pct > 0 ? "+" : ""}
      {nombre(pct, 0)} %
    </Echeance>
  );
}

const PRECISION_PERIODE = (s: Selection) => `du ${date(s.debut)} au ${date(s.fin)}`;

/**
 * Le coût des déclarations, ou rien du tout. Une somme de dépenses rattachées
 * ne se dit que si au moins une l'est : sans cela, « 0 F » affirmerait qu'un
 * chauffeur n'a rien coûté là où l'on ignore ce qu'il a coûté. Sans aucune
 * déclaration, en revanche, le coût est bien nul.
 */
function coutDeclarations(incidents: { cout: number | null }[]): string | null {
  if (!incidents.length) return montant(0);
  const connus = incidents.filter((i) => i.cout !== null);
  return connus.length ? montant(connus.reduce((s, i) => s + (i.cout ?? 0), 0)) : null;
}

/* ========================================================================== */
/* Aperçu — agrégats, analyses, alertes                                       */
/* ========================================================================== */

interface Alerte {
  ton: "defavorable" | "vigilance";
  titre: string;
  precision: string;
}

export function OngletApercu({ fiche, selection, voitSanctions }: { fiche: FicheChauffeur; selection: Selection; voitSanctions: boolean }) {
  const l = fiche.ligne;

  /* ---- Consommation par véhicule ---- */
  const parVehicule = new Map<string, { affichee: string; immatriculation: string; km: number; litres: number; referenceKm: number; cout: number }>();
  for (const c of selection.consommation) {
    const e = parVehicule.get(c.vehiculeId) ?? { affichee: c.immatriculationAffichee, immatriculation: c.vehiculeId, km: 0, litres: 0, referenceKm: 0, cout: 0 };
    e.km += c.kmParcourus;
    e.litres += c.litres;
    e.referenceKm += c.referenceL100 * c.kmParcourus;
    e.cout += c.cout;
    parVehicule.set(c.vehiculeId, e);
  }
  const lignesVehicule = [...parVehicule.values()].sort((a, b) => b.km - a.km);

  /* ---- Kilomètres et événements par mois ---- */
  const mois: string[] = [];
  const [annee, m] = selection.fin.split("-").map(Number);
  for (let delta = selection.periode; delta >= 1; delta--) {
    const d = new Date(Date.UTC(annee!, m! - 1 - delta, 1));
    mois.push(d.toISOString().slice(0, 7));
  }
  const kmParMois = mois.map((x) => ({ libelle: libelleMois(x, true), valeur: selection.consommation.filter((c) => c.mois === x).reduce((s, c) => s + c.kmParcourus, 0) }));
  const evenementsParMois = mois.map((x) => {
    const contraventions = selection.contraventions.filter((c) => c.date.startsWith(x)).length;
    const incidents = selection.incidents.filter((i) => i.declaration.dateHeure.startsWith(x)).length;
    return { libelle: libelleMois(x, true), valeur: contraventions + incidents, precision: `${contraventions} contravention${contraventions > 1 ? "s" : ""} · ${incidents} incident${incidents > 1 ? "s" : ""}` };
  });

  /* ---- Alertes ---- */
  const alertes: Alerte[] = [];
  const permis = fiche.documents.find((d) => d.type === "permis");
  const visite = fiche.documents.find((d) => d.type === "visite-medicale");
  if (l.chauffeur.actif) {
    if (l.chauffeur.aptitude === "inapte") alertes.push({ ton: "defavorable", titre: "Déclaré inapte à conduire", precision: `${l.chauffeur.aptitudeMotif ?? "Sans motif enregistré"}${l.chauffeur.aptitudeDate ? ` · décision du ${date(l.chauffeur.aptitudeDate)}` : ""}` });
    if (l.chauffeur.aptitude === "apte-avec-reserve") alertes.push({ ton: "vigilance", titre: "Apte avec réserve", precision: l.chauffeur.aptitudeMotif ?? "Réserve sans motif enregistré" });
    if (permis?.etat === "manquant") alertes.push({ ton: "defavorable", titre: "Permis de conduire non enregistré", precision: "Le chauffeur ne peut pas être compté « prêt à conduire »" });
    if (permis?.etat === "echu") alertes.push({ ton: "defavorable", titre: "Permis de conduire échu", precision: `Échu depuis ${Math.abs(permis.joursRestants ?? 0)} jours — aucune affectation ne devrait rester ouverte` });
    if (visite?.etat === "echu") alertes.push({ ton: "defavorable", titre: "Visite médicale échue", precision: `Échue depuis ${Math.abs(visite.joursRestants ?? 0)} jours · ${visite.emetteur ?? ""}` });
    if (l.indisponibilite) {
      alertes.push({
        ton: l.indisponibilite.motif === "suspension-permis" ? "defavorable" : "vigilance",
        titre: `${MOTIF_INDISPONIBILITE[l.indisponibilite.motif]}${l.indisponibilite.fin ? ` jusqu'au ${date(l.indisponibilite.fin)}` : ""}`,
        precision: l.vehiculeTitulaire ? `${l.vehiculeTitulaire.immatriculationAffichee} sans conducteur${l.suppleances.length ? "" : " — pas de suppléant en cours"}` : (l.indisponibilite.commentaire ?? "Aucun véhicule concerné"),
      });
    }
    if (permis?.etat === "bientot") alertes.push({ ton: "vigilance", titre: "Permis à renouveler", precision: `Échéance dans ${permis.joursRestants} jours` });
    if (visite?.etat === "bientot") alertes.push({ ton: "vigilance", titre: "Visite médicale à programmer", precision: `Échéance dans ${visite.joursRestants} jours · ${visite.emetteur ?? ""}` });
    if (l.statut === "disponible") alertes.push({ ton: "vigilance", titre: "Sans affectation", precision: "Disponible pour un véhicule sans chauffeur" });
  }
  const responsables = selection.incidents.filter((i) => i.declaration.nature === "accident" && i.declaration.responsabilite === "sedima");
  if (responsables.length) alertes.push({ ton: "defavorable", titre: `${responsables.length} accident${responsables.length > 1 ? "s" : ""} responsable${responsables.length > 1 ? "s" : ""} sur la période`, precision: responsables.map((i) => `${TYPE_INCIDENT[i.declaration.type]} · ${date(i.declaration.dateHeure)}`).join(" — ") });
  if (selection.contraventions.length >= 2) alertes.push({ ton: "vigilance", titre: `${selection.contraventions.length} contraventions sur la période`, precision: `${montant(selection.contraventions.reduce((s, c) => s + c.montant, 0))} · ${selection.contraventions.filter((c) => c.retenue).length} avec retenue` });
  const ecartVehicule = lignesVehicule.find((v) => v.km > 0 && (v.litres / v.km) * 100 > (v.referenceKm / v.km) * 1.15);
  if (ecartVehicule) alertes.push({ ton: "vigilance", titre: `Consommation au-dessus de la référence sur ${ecartVehicule.affichee}`, precision: `${nombre((ecartVehicule.litres / ecartVehicule.km) * 100, 1)} L/100 contre ${nombre(ecartVehicule.referenceKm / ecartVehicule.km, 1)} attendus` });

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-5">
        <Carte titre="Consommation par véhicule" precision={`${PRECISION_PERIODE(selection)} · référence pondérée par les kilomètres`} sansMarge>
          <TableauSimple reglages="fiche-chauffeur.consommation-vehicules"
            cle={(v) => v.immatriculation}
            lignes={lignesVehicule}
            vide="Aucun kilomètre attribué sur la période."
            colonnes={[
              { cle: "vehicule", libelle: "Véhicule", rendu: (v) => <Vehicule immatriculation={v.immatriculation} affichee={v.affichee} /> },
              { cle: "km", libelle: "Km", alignee: "droite", rendu: (v) => kilometrage(v.km) },
              { cle: "litres", libelle: "Litres", alignee: "droite", rendu: (v) => nombre(v.litres, 0) },
              {
                cle: "l100",
                libelle: "L/100 km",
                alignee: "droite",
                // La référence se lit sous la valeur : une colonne de moins, et l'œil compare sans bouger.
                rendu: (v) => (
                  <span className="flex flex-col items-end leading-tight">
                    <span className="font-medium">{v.km > 0 ? nombre((v.litres / v.km) * 100, 1) : "—"}</span>
                    <span className="meta text-[11.5px]">réf. {v.km > 0 ? nombre(v.referenceKm / v.km, 1) : "—"}</span>
                  </span>
                ),
              },
              { cle: "ecart", libelle: "Écart", rendu: (v) => (v.km > 0 ? <TonEcart pct={((v.litres / v.km) * 100 - v.referenceKm / v.km) / (v.referenceKm / v.km) * 100} /> : "—") },
              { cle: "cout", libelle: "Carburant", alignee: "droite", rendu: (v) => montant(v.cout) },
            ]}
          />
        </Carte>

        <Carte titre="Kilomètres par mois" precision="Toutes affectations confondues, au prorata des jours conduits">
          <GraphiqueBarres points={kmParMois} unite="km" hauteur={160} />
        </Carte>

        <Carte titre="Contraventions et incidents par mois" precision="Ce qui est arrivé pendant qu'il conduisait">
          <GraphiqueBarres points={evenementsParMois} hauteur={130} />
        </Carte>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <Carte titre="Alertes" precision={alertes.length === 0 ? "Rien à signaler" : `${alertes.length} point${alertes.length > 1 ? "s" : ""} à traiter`}>
          {alertes.length === 0 ? (
            <div className="flex items-center gap-3 rounded-[10px] bg-favorable-fond px-4 py-3">
              <span className="size-2 rounded-full bg-accent" />
              <p className="text-[13px] text-texte">Documents à jour, affecté, rien d'anormal sur la période.</p>
            </div>
          ) : (
            <ul className="flex flex-col">
              {alertes.map((a) => (
                <li key={a.titre} className="flex items-start gap-3 border-b border-bordure py-3 first:pt-0 last:border-b-0 last:pb-0">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${a.ton === "defavorable" ? "bg-defavorable" : "bg-vigilance"}`} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-texte">{a.titre}</p>
                    <p className="meta mt-0.5">{a.precision}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Carte>

        <Carte titre="Situation">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="min-w-0">
              <p className="label-champ">Affectation</p>
              {l.vehiculeTitulaire ? (
                <>
                  <p className="mt-1.5 text-[13px] leading-snug font-medium text-texte">
                    <Link href={`/flotte/${l.vehiculeTitulaire.immatriculation}`} className="code whitespace-nowrap text-accent-fonce hover:text-accent hover:underline">
                      {l.vehiculeTitulaire.immatriculationAffichee}
                    </Link>{" "}
                    · {l.vehiculeTitulaire.marque}
                  </p>
                  <p className="meta mt-1 leading-snug">titulaire depuis le {date(l.vehiculeTitulaire.debut)}</p>
                </>
              ) : l.suppleances.length > 0 ? (
                <>
                  <p className="mt-1.5 text-[13px] leading-snug font-medium text-texte">Suppléant de {l.suppleances.map((s) => s.immatriculationAffichee).join(", ")}</p>
                  <p className="meta mt-1 leading-snug">depuis le {date(l.suppleances[0]!.debut)}</p>
                </>
              ) : (
                <p className="mt-1.5 text-[13px] text-attenue-2">{l.statut === "sorti" ? "—" : "Sans véhicule"}</p>
              )}
              {l.vehiculeTitulaire && l.suppleances.length > 0 ? <p className="meta mt-1 leading-snug">+ suppléant de {l.suppleances.map((s) => s.immatriculationAffichee).join(", ")}</p> : null}
            </div>
            <div className="min-w-0">
              <p className="label-champ">Permis</p>
              <p className="mt-1.5 text-[13px] font-medium text-texte">{l.chauffeur.permisCategories.join(" · ")}</p>
              <p className="meta mt-1">{l.permis.manquant ? "non enregistré" : `échéance ${date(l.permis.echeance)}`}</p>
            </div>
            <div className="min-w-0">
              <p className="label-champ">Visite médicale</p>
              <p className="mt-1.5 text-[13px] font-medium text-texte">{date(l.visiteMedicale.echeance)}</p>
              <p className="meta mt-1">{l.visiteMedicale.joursRestants !== null && l.visiteMedicale.joursRestants < 0 ? `échue de ${Math.abs(l.visiteMedicale.joursRestants)} j` : `dans ${l.visiteMedicale.joursRestants} j`}</p>
            </div>
            <div className="min-w-0">
              <p className="label-champ">Aptitude</p>
              <p className="mt-1.5">
                <Pastille ton={APTITUDE[l.chauffeur.aptitude].ton}>{APTITUDE[l.chauffeur.aptitude].libelle}</Pastille>
              </p>
              <p className="meta mt-1 leading-snug">{l.chauffeur.aptitudeMotif ?? (l.chauffeur.aptitudeDate ? `décision du ${date(l.chauffeur.aptitudeDate)}` : "aucune réserve")}</p>
            </div>
          </div>
        </Carte>

        <Carte titre="Sur la période" precision={PRECISION_PERIODE(selection)}>
          <Definitions
            colonnes={2}
            elements={[
              { libelle: "Jours d'immobilisation causés", valeur: `${selection.incidents.reduce((s, i) => s + i.immobilisationJours, 0)} j` },
              { libelle: "Coût des incidents", valeur: coutDeclarations(selection.incidents) ?? "non suivi" },
              ...(voitSanctions
                ? [
                    { libelle: "Sanctions", valeur: selection.sanctions.length === 0 ? "Aucune" : `${selection.sanctions.length} — ${selection.sanctions.map((s) => TYPE_SANCTION[s.type].toLowerCase()).join(", ")}` },
                  ]
                : []),
            ]}
          />
        </Carte>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Identité                                                                   */
/* ========================================================================== */

export function OngletIdentite({ fiche }: { fiche: FicheChauffeur }) {
  const { surcharger } = useEdition();
  /* Chauffeur et identité partagent le numéro de la fiche : « Modifier » recouvre les deux. */
  const c = surcharger({ numero: `CHA-${fiche.ligne.id}`, ...fiche.ligne.chauffeur });
  const i = surcharger({ numero: `CHA-${fiche.ligne.id}`, ...fiche.identite });
  /* Les catégories sont saisies en texte (« B · C ») ; l'affichage accepte les deux formes. */
  const categories: string[] = Array.isArray(i.permisCategories) ? i.permisCategories : String(i.permisCategories ?? "").split(/[^A-Za-z0-9]+/).filter(Boolean);
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <Carte titre="État civil et contact">
        <Definitions
          elements={[
            { libelle: "Nom", valeur: c.nom },
            { libelle: "Prénom", valeur: c.prenom },
            { libelle: "Date de naissance", valeur: i.dateNaissance ? `${date(i.dateNaissance)} · ${i.age} ans` : null },
            { libelle: "Téléphone", valeur: <span className="code">{c.telephone}</span> },
            { libelle: "Adresse", valeur: i.adresse },
            { libelle: "Contact d'urgence", valeur: i.contactUrgence },
          ]}
        />
      </Carte>

      <Carte titre="Contrat et rattachement">
        <Definitions
          elements={[
            { libelle: "Matricule RH", valeur: <span className="code">{c.matriculeRh}</span> },
            { libelle: "Contrat", valeur: CONTRAT_CHAUFFEUR[c.contrat] },
            { libelle: "Date d'entrée", valeur: i.dateEmbauche ? `${date(i.dateEmbauche)} · ${nombre(i.ancienneteAnnees, 1)} ans` : null },
            { libelle: "Date de sortie", valeur: i.dateSortie ? date(i.dateSortie) : "—" },
            { libelle: "Site de rattachement", valeur: fiche.ligne.site?.libelle ?? null },
            { libelle: "Région", valeur: fiche.ligne.site?.region ?? null },
          ]}
        />
      </Carte>

      <Carte titre="Permis de conduire" precision="Les échéances et le justificatif sont dans l'onglet Documents">
        <Definitions
          elements={[
            { libelle: "Numéro", valeur: i.permisNumero ? <span className="code">{i.permisNumero}</span> : null },
            { libelle: "Catégories", valeur: categories.join(" · ") },
            { libelle: "Délivré le", valeur: i.permisDelivrance ? date(i.permisDelivrance) : null },
            { libelle: "Habilité aux poids lourds", valeur: categories.includes("C") ? "Oui" : "Non — véhicules légers seulement" },
          ]}
        />
      </Carte>

      <Carte titre="Aptitude à conduire" precision="Décision saisie par la gestion de parc — elle s'ajoute au statut, elle ne le remplace pas">
        <Definitions
          elements={[
            { libelle: "Aptitude", valeur: <Pastille ton={APTITUDE[c.aptitude].ton}>{APTITUDE[c.aptitude].libelle}</Pastille> },
            { libelle: "Décision du", valeur: c.aptitudeDate ? date(c.aptitudeDate) : null },
            { libelle: "Motif ou réserve", valeur: c.aptitudeMotif ? <span className="whitespace-normal">{c.aptitudeMotif}</span> : "—" },
          ]}
        />
      </Carte>
    </div>
  );
}

/* ========================================================================== */
/* Affectations                                                               */
/* ========================================================================== */

export function OngletAffectations({ fiche, selection, cible, onAjouter }: { fiche: FicheChauffeur; selection: Selection; cible?: string; onAjouter?: Ajouter }) {
  const { surcharger, demander, creations } = useEdition();
  const affectations = [...creations("affectation", fabriquerAffectationChauffeur), ...fiche.affectations.map(surcharger)];
  const total = affectations.length;
  return (
    <Carte
      titre="Affectations"
      precision={`${selection.affectations.length} sur la période, ${total} au total — chaque période lui rattache les kilomètres, la consommation et les incidents du véhicule`}
      action={
        <button type="button" onClick={() => onAjouter?.("affectation")} disabled={!onAjouter} className="bouton-secondaire h-9 disabled:cursor-not-allowed disabled:opacity-50">
          <Plus className="size-4" strokeWidth={2} />
          Nouvelle affectation
        </button>
      }
      sansMarge
    >
      <TableauSimple<AffectationChauffeur> reglages="fiche-chauffeur.affectations"
        cle={(a) => a.id}
        lignes={affectations}
        vide="Aucune affectation enregistrée."
        numero={(a) => a.numero}
        cible={cible}
        surModifier={(a) => demander({ type: "affectation", numero: a.numero, titre: `Affectation · ${a.immatriculationAffichee}`, valeurs: a as unknown as Record<string, unknown> })}
        colonnes={[
          { cle: "numero", libelle: "Réf.", rendu: (a) => <Numero valeur={a.numero} /> },
          { cle: "vehicule", libelle: "Véhicule", rendu: (a) => <Vehicule immatriculation={a.immatriculation} affichee={a.immatriculationAffichee} precision={a.vehicule} /> },
          { cle: "role", libelle: "Rôle", rendu: (a) => ROLE_AFFECTATION[a.role] },
          { cle: "debut", libelle: "Du", rendu: (a) => <span className="code">{date(a.debut)}</span> },
          { cle: "fin", libelle: "Au", rendu: (a) => (a.fin ? <span className="code">{date(a.fin)}</span> : <Pastille ton="favorable">en cours</Pastille>) },
          { cle: "bu", libelle: "BU / Site", rendu: (a) => a.buSite },
          { cle: "km", libelle: "Km parcourus", alignee: "droite", rendu: (a) => kilometrage(a.kmParcourus) },
          { cle: "motif", libelle: "Motif", rendu: (a) => <span className="text-texte-2">{a.motif}</span> },
        ]}
      />
    </Carte>
  );
}

/* ========================================================================== */
/* Documents                                                                  */
/* ========================================================================== */

export function OngletDocuments({ fiche, cible, onAjouter }: { fiche: FicheChauffeur; cible?: string; onAjouter?: Ajouter }) {
  const { surcharger, demander, creations } = useEdition();
  const documents = [...creations("document", fabriquerDocumentChauffeur), ...fiche.documents.map(surcharger)];
  const aProbleme = documents.filter((d) => d.etat === "echu" || d.etat === "manquant").length;
  return (
    <Carte
      titre="Documents"
      precision={aProbleme > 0 ? `${aProbleme} document${aProbleme > 1 ? "s" : ""} à régulariser` : "Permis et visite médicale à jour"}
      action={
        <button type="button" onClick={() => onAjouter?.("document")} disabled={!onAjouter} className="bouton-secondaire h-9 disabled:cursor-not-allowed disabled:opacity-50">
          <Plus className="size-4" strokeWidth={2} />
          Ajouter un document
        </button>
      }
      sansMarge
    >
      <TableauSimple<DocumentFiche> reglages="fiche-chauffeur.documents"
        cle={(d) => d.numero}
        lignes={documents}
        numero={(d) => d.numero}
        cible={cible}
        surModifier={(d) => demander({ type: "document", numero: d.numero, titre: `Document · ${TYPE_DOCUMENT[d.type]}`, valeurs: d as unknown as Record<string, unknown> })}
        colonnes={[
          { cle: "numero", libelle: "Réf.", rendu: (d) => <Numero valeur={d.numero} /> },
          { cle: "type", libelle: "Document", rendu: (d) => <span className="font-medium">{TYPE_DOCUMENT[d.type]}</span> },
          { cle: "piece", libelle: "N° de pièce", rendu: (d) => <span className="code whitespace-nowrap text-texte-2">{d.numeroPiece ?? "—"}</span> },
          { cle: "emetteur", libelle: "Émetteur", rendu: (d) => d.emetteur ?? "—" },
          { cle: "effet", libelle: "Effet", rendu: (d) => <span className="code">{date(d.dateEffet)}</span> },
          { cle: "echeance", libelle: "Échéance", rendu: (d) => <span className="code">{date(d.echeance)}</span> },
          {
            cle: "justificatif",
            libelle: "Justificatif",
            rendu: (d) =>
              d.justificatif ? (
                <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-texte-2" title="La pièce est déclarée fournie. Sa consultation viendra avec le stockage des fichiers — rien n'en tient encore le contenu.">
                  <FileText className="size-3.5 text-attenue" strokeWidth={1.8} />
                  Fourni
                </span>
              ) : (
                <span className="text-attenue-2">à fournir</span>
              ),
          },
          { cle: "etat", libelle: "État", rendu: (d) => <Echeance ton={TON_ETAT[d.etat]}>{etatDocumentLibelle(d)}</Echeance> },
        ]}
      />
    </Carte>
  );
}

/* ========================================================================== */
/* Consommation — un mois par véhicule                                        */
/* ========================================================================== */

export function OngletConsommation({ selection }: { selection: Selection }) {
  const litres = selection.consommation.reduce((s, c) => s + c.litres, 0);
  const cout = selection.consommation.reduce((s, c) => s + c.cout, 0);
  return (
    <Carte
      titre="Consommation mensuelle"
      precision={`${PRECISION_PERIODE(selection)} · ${nombre(litres, 0)} L · ${montant(cout)} — la part du mois conduite par le chauffeur, véhicule par véhicule`}
      sansMarge
    >
      <TableauSimple<ConsommationChauffeur> reglages="fiche-chauffeur.consommation-mensuelle"
        cle={(c) => `${c.mois}-${c.vehiculeId}`}
        lignes={selection.consommation}
        vide="Aucun kilomètre attribué sur la période."
        colonnes={[
          { cle: "mois", libelle: "Mois", rendu: (c) => <span className="whitespace-nowrap font-medium">{libelleMois(c.mois)}</span> },
          { cle: "vehicule", libelle: "Véhicule", rendu: (c) => <Vehicule immatriculation={c.vehiculeId} affichee={c.immatriculationAffichee} /> },
          { cle: "km", libelle: "Km", alignee: "droite", rendu: (c) => kilometrage(c.kmParcourus) },
          { cle: "litres", libelle: "Litres", alignee: "droite", rendu: (c) => nombre(c.litres, 1) },
          { cle: "l100", libelle: "L/100 km", alignee: "droite", rendu: (c) => <span className="font-medium">{nombre(c.litresAux100, 1)}</span> },
          { cle: "ref", libelle: "Référence", alignee: "droite", rendu: (c) => nombre(c.referenceL100, 1) },
          { cle: "ecart", libelle: "Écart", rendu: (c) => <TonEcart pct={c.ecartPct} /> },
          { cle: "cout", libelle: "Carburant", alignee: "droite", rendu: (c) => montant(c.cout) },
        ]}
      />
    </Carte>
  );
}

/* ========================================================================== */
/* Contraventions                                                             */
/* ========================================================================== */

export function OngletContraventions({ selection, cible, onAjouter }: { selection: Selection; cible?: string; onAjouter?: Ajouter }) {
  const { surcharger, demander, creations } = useEdition();
  const contraventions = [...creations("depense", (c) => (c.valeurs.poste === "contravention" ? fabriquerContravention(c) : null)), ...selection.contraventions.map(surcharger)];
  const total = contraventions.reduce((s, c) => s + c.montant, 0);
  const retenues = contraventions.filter((c) => c.retenue).length;
  return (
    <Carte
      titre="Contraventions"
      precision={`${PRECISION_PERIODE(selection)} · ${selection.contraventions.length} · ${montant(total)}${retenues ? ` · ${retenues} avec retenue sur salaire` : ""}`}
      action={
        <button type="button" onClick={() => onAjouter?.("contravention")} disabled={!onAjouter} className="bouton-secondaire h-9 disabled:cursor-not-allowed disabled:opacity-50">
          <Plus className="size-4" strokeWidth={2} />
          Saisir une contravention
        </button>
      }
      sansMarge
    >
      <TableauSimple<ContraventionChauffeur> reglages="fiche-chauffeur.contraventions"
        cle={(c) => c.id}
        lignes={contraventions}
        vide="Aucune contravention sur la période."
        numero={(c) => c.numero}
        cible={cible}
        surModifier={(c) => demander({ type: "depense", numero: c.numero, titre: `Contravention · ${c.libelle}`, valeurs: c as unknown as Record<string, unknown>, champs: CHAMPS_CONTRAVENTION })}
        colonnes={[
          { cle: "numero", libelle: "Réf.", rendu: (c) => <Numero valeur={c.numero} /> },
          { cle: "date", libelle: "Date", rendu: (c) => <span className="code whitespace-nowrap">{date(c.date)}</span> },
          { cle: "vehicule", libelle: "Véhicule", rendu: (c) => <Vehicule immatriculation={c.vehiculeId} affichee={c.immatriculationAffichee} /> },
          { cle: "libelle", libelle: "Infraction", rendu: (c) => <span className="font-medium">{c.libelle}</span> },
          { cle: "reference", libelle: "N° de PV", rendu: (c) => <span className="code whitespace-nowrap text-texte-2">{c.reference ?? "—"}</span> },
          { cle: "montant", libelle: "Montant", alignee: "droite", rendu: (c) => <span className="font-medium">{montant(c.montant)}</span> },
          { cle: "retenue", libelle: "Prise en charge", rendu: (c) => (c.retenue ? <Pastille ton="vigilance">retenue chauffeur</Pastille> : <Pastille ton="neutre">parc</Pastille>) },
        ]}
      />
    </Carte>
  );
}

/* ========================================================================== */
/* Incidents et sanctions                                                     */
/* ========================================================================== */

export function OngletIncidents({ selection, voitSanctions, cible, onAjouter }: { selection: Selection; voitSanctions: boolean; cible?: string; onAjouter?: Ajouter }) {
  const { surcharger, demander, creations, sujet } = useEdition();
  const chauffeurId = sujet.replace(/^chauffeur:/, "");
  const incidents = [...creations("incident", (c) => fabriquerIncidentChauffeur(c, chauffeurId)), ...selection.incidents.map((i) => ({ ...i, declaration: surcharger(i.declaration) }))];
  const sanctions = [...creations("sanction", (c) => fabriquerSanction(c, chauffeurId)), ...selection.sanctions.map(surcharger)];
  const accidents = incidents.filter((i) => i.declaration.nature === "accident").length;
  const cout = coutDeclarations(incidents);
  return (
    <div className="flex flex-col gap-5">
      <Carte
        titre="Incidents et accidents"
        precision={`${PRECISION_PERIODE(selection)} · ${incidents.length} déclaration${incidents.length > 1 ? "s" : ""}${accidents ? `, dont ${accidents} accident${accidents > 1 ? "s" : ""}` : ""}${cout ? ` · ${cout} de suites` : ""}`}
        action={
          <button type="button" onClick={() => onAjouter?.("incident")} disabled={!onAjouter} className="bouton-secondaire h-9 disabled:cursor-not-allowed disabled:opacity-50">
            <Plus className="size-4" strokeWidth={2} />
            Déclarer un incident
          </button>
        }
        sansMarge
      >
        <TableauSimple<IncidentChauffeur> reglages="fiche-chauffeur.incidents"
          cle={(i) => i.declaration.id}
          lignes={incidents}
          vide="Aucun incident déclaré sur la période."
          numero={(i) => i.declaration.numero}
          cible={cible}
          surModifier={(i) => demander({ type: "incident", numero: i.declaration.numero, titre: `${NATURE_INCIDENT[i.declaration.nature]} · ${TYPE_INCIDENT[i.declaration.type]}`, valeurs: i.declaration as unknown as Record<string, unknown> })}
          colonnes={[
            { cle: "numero", libelle: "Réf.", rendu: (i) => <Numero valeur={i.declaration.numero} /> },
            { cle: "date", libelle: "Date", rendu: (i) => <span className="code whitespace-nowrap">{date(i.declaration.dateHeure)}</span> },
            {
              cle: "nature",
              libelle: "Nature",
              rendu: (i) => <Pastille ton={i.declaration.nature === "accident" ? "defavorable" : "vigilance"}>{NATURE_INCIDENT[i.declaration.nature]}</Pastille>,
            },
            { cle: "type", libelle: "Type", rendu: (i) => <span className="font-medium">{TYPE_INCIDENT[i.declaration.type]}</span> },
            { cle: "vehicule", libelle: "Véhicule", rendu: (i) => <Vehicule immatriculation={i.declaration.vehiculeId} affichee={i.immatriculationAffichee} /> },
            { cle: "lieu", libelle: "Lieu", rendu: (i) => <span className="block max-w-[220px] truncate text-texte-2">{i.declaration.lieu}</span> },
            { cle: "mission", libelle: "Mission", rendu: (i) => (i.declaration.mission ? MISSION_INCIDENT[i.declaration.mission] : "—") },
            {
              cle: "resp",
              libelle: "Responsabilité",
              rendu: (i) => (i.declaration.responsabilite ? <span className={i.declaration.responsabilite === "sedima" ? "font-medium text-defavorable" : ""}>{RESPONSABILITE[i.declaration.responsabilite]}</span> : <span className="text-attenue-2">—</span>),
            },
            { cle: "immob", libelle: "Immob.", alignee: "droite", rendu: (i) => `${i.immobilisationJours} j` },
            { cle: "cout", libelle: "Coût", alignee: "droite", rendu: (i) => <span className="font-medium">{montant(i.cout)}</span> },
            {
              cle: "statut",
              libelle: "Statut",
              rendu: (i) => <Echeance ton={i.declaration.statut === "clos" ? "neutre" : "vigilance"}>{STATUT_DECLARATION[i.declaration.statut]}</Echeance>,
            },
          ]}
        />
      </Carte>

      {voitSanctions ? (
      <Carte
        titre="Sanctions"
        precision="Avertissements, blâmes, retenues et mises à pied — une trace, chacune renvoie à ce qui l'a motivée ; les montants retenus sont une donnée de paie, suivie aux RH"
        action={
          <button type="button" onClick={() => onAjouter?.("sanction")} disabled={!onAjouter} className="bouton-secondaire h-9 disabled:cursor-not-allowed disabled:opacity-50">
            <Plus className="size-4" strokeWidth={2} />
            Nouvelle sanction
          </button>
        }
        sansMarge
      >
        <TableauSimple<Sanction> reglages="fiche-chauffeur.sanctions"
          cle={(s) => s.id}
          lignes={sanctions}
          vide="Aucune sanction sur la période."
          numero={(s) => s.numero}
          cible={cible}
          surModifier={(s) => demander({ type: "sanction", numero: s.numero, titre: `Sanction · ${TYPE_SANCTION[s.type]}`, valeurs: s as unknown as Record<string, unknown> })}
          colonnes={[
            { cle: "numero", libelle: "Réf.", rendu: (s) => <Numero valeur={s.numero} /> },
            { cle: "date", libelle: "Date", rendu: (s) => <span className="code whitespace-nowrap">{date(s.date)}</span> },
            {
              cle: "type",
              libelle: "Type",
              rendu: (s) => <Pastille ton={s.type === "mise-a-pied" || s.type === "blame" ? "defavorable" : "vigilance"}>{TYPE_SANCTION[s.type]}</Pastille>,
            },
            { cle: "motif", libelle: "Motif", rendu: (s) => <span className="block max-w-[420px] truncate">{s.motif}</span> },
            { cle: "portee", libelle: "Durée", alignee: "droite", rendu: (s) => (s.jours ? `${s.jours} j` : "—") },
            { cle: "lien", libelle: "Rattachée à", rendu: (s) => <span className="text-texte-2">{s.incidentId ? "Déclaration d'incident" : s.depenseId ? "Contravention" : "—"}</span> },
          ]}
        />
      </Carte>
      ) : (
        <p className="meta flex items-center gap-2 px-1">
          <Lock className="size-3.5" strokeWidth={1.8} />
          Les sanctions sont réservées à la gestion de parc et à la direction.
        </p>
      )}
    </div>
  );
}

/* ========================================================================== */
/* Frais de route                                                             */
/* ========================================================================== */

export function OngletFraisDeRoute({ selection, cible }: { selection: Selection; cible?: string }) {
  const { surcharger, demander } = useEdition();
  const frais = selection.fraisDeRoute.map(surcharger);
  const total = frais.reduce((s, f) => s + f.montant, 0);
  const sansJustificatif = frais.filter((f) => !f.justificatif).length;
  return (
    <Carte
      titre="Frais de route"
      precision={`${PRECISION_PERIODE(selection)} · ${montant(total)} versés par la caisse parc${sansJustificatif ? ` · ${sansJustificatif} sans justificatif` : ""}`}
      sansMarge
    >
      <TableauSimple<FraisDeRoute> reglages="fiche-chauffeur.frais"
        cle={(f) => f.id}
        lignes={frais}
        vide="Aucun frais de route sur la période."
        numero={(f) => f.numero}
        cible={cible}
        surModifier={(f) => demander({ type: "depense", numero: f.numero, titre: `Frais de route · ${f.libelle}`, valeurs: f as unknown as Record<string, unknown>, champs: CHAMPS_FRAIS })}
        colonnes={[
          { cle: "numero", libelle: "Réf.", rendu: (f) => <Numero valeur={f.numero} /> },
          { cle: "date", libelle: "Date", rendu: (f) => <span className="code whitespace-nowrap">{date(f.date)}</span> },
          { cle: "vehicule", libelle: "Véhicule", rendu: (f) => <Vehicule immatriculation={f.vehiculeId} affichee={f.immatriculationAffichee} /> },
          { cle: "libelle", libelle: "Libellé", rendu: (f) => <span className="block max-w-[360px] truncate">{f.libelle}</span> },
          { cle: "reference", libelle: "Pièce caisse", rendu: (f) => <span className="code whitespace-nowrap text-texte-2">{f.reference ?? "—"}</span> },
          {
            cle: "justificatif",
            libelle: "Justificatif",
            rendu: (f) =>
              f.justificatif ? (
                <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-texte-2" title="La pièce est déclarée fournie. Sa consultation viendra avec le stockage des fichiers — rien n'en tient encore le contenu.">
                  <FileText className="size-3.5 text-attenue" strokeWidth={1.8} />
                  Fourni
                </span>
              ) : (
                <Echeance ton="vigilance">manquant</Echeance>
              ),
          },
          { cle: "montant", libelle: "Montant", alignee: "droite", rendu: (f) => <span className="font-medium">{montant(f.montant)}</span> },
        ]}
      />
    </Carte>
  );
}

/* ========================================================================== */
/* Journal — chronologie et indisponibilités                                  */
/* ========================================================================== */

const LIBELLE_CATEGORIE = { statut: "Situation", affectation: "Affectation", document: "Document", intervention: "Intervention", depense: "Contravention", releve: "Relevé", note: "Note" } as const;

export function OngletJournal({ fiche, voitSanctions, cible, onAjouter }: { fiche: FicheChauffeur; voitSanctions: boolean; cible?: string; onAjouter?: Ajouter }) {
  const { surcharger, demander, creations, sujet } = useEdition();
  const chauffeurId = sujet.replace(/^chauffeur:/, "");
  const journal = [...creations("aptitude", fabriquerEvenementAptitude), ...creations("indisponibilite", fabriquerEvenementIndisponibilite), ...fiche.journal.filter((e) => !e.confidentiel || voitSanctions)].sort((a, b) => b.date.localeCompare(a.date));
  const indisponibilites = [...creations("indisponibilite", (c) => fabriquerIndisponibilite(c, chauffeurId)), ...fiche.indisponibilites.map(surcharger)];
  return (
    <div className="flex flex-col gap-5">
      <Carte titre="Journal du chauffeur" precision="Tout ce qui le concerne, par qui, et quand — du plus récent au plus ancien">
        <ol className="relative flex flex-col gap-0 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-bordure">
          {journal.map((e, i) => (
            <li key={`${e.date}-${i}`} className="relative flex items-start gap-4 py-3">
              <span className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 text-[10.5px] font-semibold text-texte-2 ring-4 ring-surface">{e.initiales}</span>
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

      <Carte
        titre="Indisponibilités"
        precision="Périodes datées — un titulaire indisponible laisse son véhicule sans conducteur, sauf suppléant"
        action={
          <button type="button" onClick={() => onAjouter?.("indisponibilite")} disabled={!onAjouter} className="bouton-secondaire h-9 disabled:cursor-not-allowed disabled:opacity-50">
            <Plus className="size-4" strokeWidth={2} />
            Nouvelle indisponibilité
          </button>
        }
        sansMarge
      >
        <TableauSimple<Indisponibilite> reglages="fiche-chauffeur.indisponibilites"
          cle={(i) => i.id}
          lignes={indisponibilites}
          vide="Aucune indisponibilité enregistrée."
          numero={(i) => i.numero}
          cible={cible}
          surModifier={(i) => demander({ type: "indisponibilite", numero: i.numero, titre: `Indisponibilité · ${MOTIF_INDISPONIBILITE[i.motif]}`, valeurs: i as unknown as Record<string, unknown> })}
          colonnes={[
            { cle: "numero", libelle: "Réf.", rendu: (i) => <Numero valeur={i.numero} /> },
            { cle: "motif", libelle: "Motif", rendu: (i) => <Pastille ton={i.motif === "suspension-permis" ? "defavorable" : i.motif === "formation" ? "neutre" : "vigilance"}>{MOTIF_INDISPONIBILITE[i.motif]}</Pastille> },
            { cle: "debut", libelle: "Début", rendu: (i) => <span className="code">{date(i.debut)}</span> },
            { cle: "fin", libelle: "Fin", rendu: (i) => (i.fin ? <span className="code">{date(i.fin)}</span> : <span className="text-attenue">sans date</span>) },
            {
              cle: "jours",
              libelle: "Durée",
              alignee: "droite",
              rendu: (i) => (i.fin ? `${Math.round((new Date(i.fin).getTime() - new Date(i.debut).getTime()) / (24 * 3600 * 1000)) + 1} j` : "—"),
            },
            { cle: "commentaire", libelle: "Commentaire", rendu: (i) => <span className="block max-w-[420px] truncate text-texte-2">{i.commentaire ?? "—"}</span> },
          ]}
        />
      </Carte>
    </div>
  );
}
