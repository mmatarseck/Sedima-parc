"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarOff, ChevronLeft, MapPin, Pencil, Phone, Trophy } from "lucide-react";
import { PanneauDiscussion, BoutonDiscussion } from "@/composants/discussion/PanneauDiscussion";
import { BandeauKpi } from "@/composants/interface/BandeauKpi";
import { Pastille } from "@/composants/interface/Pastille";
import { useCible } from "@/composants/interface/useCible";
import { CHAMPS_CREATION_CONTRAVENTION, champsCreation } from "@/composants/transactions/champs";
import { useEdition } from "@/composants/transactions/ContexteEdition";
import { libelleSite } from "@/composants/transactions/fabriques";
import { TYPE_TRANSACTION, type TypeTransaction } from "@/domaine/reference";
import { ENTREES_CHAUFFEUR, MenuAjout, type CibleAjout } from "@/composants/vehicule/MenuAjout";
import { PERIODES, debutPeriode, type FicheChauffeur as Fiche, type PeriodeMois } from "@/domaine/chauffeur";
import type { Personne } from "@/domaine/discussion";
import { APTITUDE, CONTRAT_CHAUFFEUR, MOTIF_INDISPONIBILITE } from "@/domaine/libelles";
import { evaluer, libelleMoisLong } from "@/domaine/performance";
import { voitSanctionsCourant } from "@/lib/acces-courant";
import { personnesUtilisateurs } from "@/lib/discussion-demo";
import { date, montantCourt, nombre } from "@/lib/format";
import { PastilleStatutChauffeur } from "./PastilleStatutChauffeur";
import { OngletPerformance, type ClassementDuMois } from "./OngletPerformance";
import {
  OngletAffectations,
  OngletApercu,
  OngletConsommation,
  OngletContraventions,
  OngletDocuments,
  OngletFraisDeRoute,
  OngletIdentite,
  OngletIncidents,
  OngletJournal,
  type Selection,
} from "./onglets";

type Onglet = "apercu" | "performance" | "identite" | "affectations" | "documents" | "consommation" | "contraventions" | "incidents" | "frais" | "journal";

/** Ce que le serveur calcule en comparant tous les chauffeurs, et que la fiche ne peut pas déduire seule. */
export interface ContexteFiche {
  /** Kilomètres moyens des chauffeurs qui ont roulé, par profondeur de période. */
  kmMoyenParPeriode: Record<PeriodeMois, number | null>;
  classement: ClassementDuMois;
}

/**
 * Même règle que la fiche véhicule : l'Aperçu porte ce qui s'agrège et alerte,
 * chaque autre onglet est une liste d'un seul type de fait.
 */
const ONGLETS: { cle: Onglet; libelle: string }[] = [
  { cle: "apercu", libelle: "Aperçu" },
  { cle: "performance", libelle: "Performance" },
  { cle: "identite", libelle: "Identité" },
  { cle: "affectations", libelle: "Affectations" },
  { cle: "documents", libelle: "Documents" },
  { cle: "consommation", libelle: "Consommation" },
  { cle: "contraventions", libelle: "Contraventions" },
  { cle: "incidents", libelle: "Incidents & sanctions" },
  { cle: "frais", libelle: "Frais de route" },
  { cle: "journal", libelle: "Journal" },
];

function estOnglet(valeur: string | undefined): valeur is Onglet {
  return ONGLETS.some((o) => o.cle === valeur);
}

const ONGLET_PAR_CIBLE: Partial<Record<CibleAjout, Onglet>> = {
  affectation: "affectations",
  document: "documents",
  indisponibilite: "journal",
  contravention: "contraventions",
  incident: "incidents",
  sanction: "incidents",
  aptitude: "identite",
};

/** Jours de [debut, fin] compris dans [depuis, jusqu'a]. */
function joursDans(debut: string, fin: string | null, depuis: string, jusqua: string): number {
  const d = debut > depuis ? debut : depuis;
  const f = (fin ?? jusqua) < jusqua ? (fin ?? jusqua) : jusqua;
  if (f < d) return 0;
  return Math.round((new Date(f).getTime() - new Date(d).getTime()) / (24 * 3600 * 1000)) + 1;
}

/**
 * Fiche chauffeur.
 *
 * Tout ce qui se lit ici se lit sur une période — trois, six ou douze mois —
 * choisie dans l'en-tête, parce que la question posée à un chauffeur est
 * toujours « sur combien de temps ? ». Les indicateurs, l'Aperçu et les listes
 * suivent la même période ; l'identité et les documents, non.
 */
export function FicheChauffeur({
  fiche,
  ongletInitial,
  aujourdhui,
  contexte,
  discussionInitiale = false,
  cible,
}: {
  fiche: Fiche;
  ongletInitial?: string;
  aujourdhui: string;
  contexte: ContexteFiche;
  discussionInitiale?: boolean;
  /** Numéro de transaction à souligner, venu de la recherche. */
  cible?: string;
}) {
  const [onglet, setOnglet] = useState<Onglet>(estOnglet(ongletInitial) ? ongletInitial : "apercu");
  useCible(cible, onglet);
  const [periode, setPeriode] = useState<PeriodeMois>(12);
  const [discussionOuverte, setDiscussionOuverte] = useState(discussionInitiale);
  const [nombreMessages, setNombreMessages] = useState<number | null>(null);

  /* Les sanctions ne se montrent qu'aux rôles habilités. Le rôle est lu après
     le montage : tant qu'il n'est pas connu, la fiche les tait. */
  const [voitSanctions, setVoitSanctions] = useState(false);
  useEffect(() => {
    setVoitSanctions(voitSanctionsCourant());
  }, []);

  const l = fiche.ligne;
  const { surcharger, creer, demander, creations } = useEdition();
  const numeroFiche = `CHA-${l.id}`;
  const chauffeurSurcharge = surcharger({ numero: numeroFiche, ...l.chauffeur });
  /* Une décision d'aptitude créée dans l'application prime sur celle du jeu de données. */
  const aptitudesCreees = creations("aptitude", (x) => ({ aptitude: String(x.valeurs.aptitude ?? "apte") as typeof l.chauffeur.aptitude, motif: (x.valeurs.motif as string | null) ?? null, date: (x.valeurs.date as string | null) ?? null })).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const c = aptitudesCreees[0] ? { ...chauffeurSurcharge, aptitude: aptitudesCreees[0].aptitude, aptitudeMotif: aptitudesCreees[0].motif, aptitudeDate: aptitudesCreees[0].date } : chauffeurSurcharge;
  const nomAffiche = `${c.prenom} ${c.nom}`.trim();
  const siteLibelle = c.siteId === l.chauffeur.siteId ? (l.site?.libelle ?? "Site non renseigné") : (libelleSite(c.siteId) ?? "Site non renseigné");
  const debut = debutPeriode(periode, new Date(`${aujourdhui}T00:00:00Z`));

  /* ---- Ce que la période retient ---- */
  const selection: Selection = useMemo(() => {
    const consommation = fiche.consommation.filter((x) => `${x.mois}-01` >= debut);
    const contraventions = fiche.contraventions.filter((x) => x.date >= debut);
    const incidents = fiche.incidents.filter((x) => x.declaration.dateHeure.slice(0, 10) >= debut);
    const sanctions = fiche.sanctions.filter((x) => x.date >= debut);
    const fraisDeRoute = fiche.fraisDeRoute.filter((x) => x.date >= debut);
    const affectations = fiche.affectations.filter((a) => a.fin === null || a.fin >= debut);
    const joursIndisponibles = fiche.indisponibilites.reduce((s, i) => s + joursDans(i.debut, i.fin, debut, aujourdhui), 0);
    return { debut, fin: aujourdhui, periode, consommation, contraventions, incidents, sanctions, fraisDeRoute, affectations, joursIndisponibles };
  }, [fiche, debut, aujourdhui, periode]);

  const km = selection.consommation.reduce((s, x) => s + x.kmParcourus, 0);
  const litres = selection.consommation.reduce((s, x) => s + x.litres, 0);
  const l100 = km > 0 ? Math.round((litres / km) * 1000) / 10 : null;
  /* Référence pondérée par les kilomètres de chaque véhicule : un chauffeur qui
     passe d'une camionnette à un camion n'est pas devenu gourmand. */
  const referenceKm = selection.consommation.reduce((s, x) => s + x.referenceL100 * x.kmParcourus, 0);
  const reference = km > 0 ? Math.round((referenceKm / km) * 10) / 10 : null;
  const ecart = l100 !== null && reference ? Math.round(((l100 - reference) / reference) * 100) : null;
  const montantContraventions = selection.contraventions.reduce((s, x) => s + x.montant, 0);
  const accidents = selection.incidents.filter((i) => i.declaration.nature === "accident").length;
  const montantFrais = selection.fraisDeRoute.reduce((s, x) => s + x.montant, 0);

  const evaluation = useMemo(() => evaluer(fiche, debut, aujourdhui, { kmMoyenCohorte: contexte.kmMoyenParPeriode[periode] }), [fiche, debut, aujourdhui, contexte, periode]);

  const entreesAjout = useMemo(() => ENTREES_CHAUFFEUR.filter((e) => e.cle !== "sanction" || voitSanctions), [voitSanctions]);

  const personnes: Personne[] = useMemo(
    () => [...personnesUtilisateurs(), { id: `chauffeur:${l.id}`, nom: l.nomComplet, initiales: l.initiales, precision: "Chauffeur" }],
    [l.id, l.nomComplet, l.initiales],
  );

  const TITRE_CREATION: Partial<Record<CibleAjout, string>> = {
    affectation: "Nouvelle affectation",
    document: "Nouveau document",
    indisponibilite: "Nouvelle indisponibilité",
    aptitude: "Décision d'aptitude",
    contravention: "Nouvelle contravention",
    incident: "Déclarer un incident ou un accident",
    sanction: "Nouvelle sanction",
  };
  function ajouter(cible: CibleAjout) {
    const titre = TITRE_CREATION[cible];
    if (titre) {
      const type: TypeTransaction = cible === "contravention" ? "depense" : (cible as TypeTransaction);
      if (type in TYPE_TRANSACTION) {
        creer({
          type,
          titre: `${titre} · ${nomAffiche}`,
          champs: cible === "contravention" ? CHAMPS_CREATION_CONTRAVENTION : champsCreation(type, { pour: "chauffeur" }),
          valeurs: {
            date: "2026-09-02",
            debut: "2026-09-02",
            dateEffet: "2026-09-02",
            dateHeure: "2026-09-02",
            statut: "declare",
            roulant: "oui",
            vehiculeId: l.vehiculeTitulaire?.vehiculeId ?? l.suppleances[0]?.vehiculeId ?? null,
            ...(cible === "contravention" ? { poste: "contravention", origine: "caisse" } : {}),
          },
        });
      }
    }
    setOnglet(ONGLET_PAR_CIBLE[cible] ?? "journal");
  }

  return (
    <div className="flex flex-col lg:h-full">
      {/* ---- En-tête fixe ---- */}
      <div className="flex shrink-0 flex-col gap-4 border-b border-bordure px-8 pt-6 pb-0">
        <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[12.5px] text-attenue">
          <Link href="/chauffeurs" className="inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce">
            <ChevronLeft className="size-3.5" strokeWidth={1.8} />
            Chauffeurs
          </Link>
        </nav>

        <div className="flex flex-wrap items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent-fond text-[15px] font-semibold text-accent-tres-fonce">{l.initiales}</span>
          <div className="min-w-0 flex-1 basis-[360px]">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="titre-page whitespace-nowrap">{nomAffiche}</h1>
              <PastilleStatutChauffeur statut={l.statut} />
              {c.aptitude !== "apte" ? (
                <span title={c.aptitudeMotif ?? undefined}>
                  <Pastille ton={APTITUDE[c.aptitude].ton}>{APTITUDE[c.aptitude].libelle}</Pastille>
                </span>
              ) : null}
              {c.contrat !== "salarie" ? (
                <span className="inline-flex h-6 items-center rounded-full bg-surface-3 px-2.5 text-[12px] font-medium text-texte-2">{CONTRAT_CHAUFFEUR[c.contrat]}</span>
              ) : null}
              {/* Le rang du mois révolu, toujours visible : c'est la première chose
                  que le chauffeur demande, et la première qu'on lui répond. */}
              {c.actif ? (
                <Link
                  href="/chauffeurs/classement"
                  title={`Classement SQDCM de ${libelleMoisLong(contexte.classement.mois).toLowerCase()} — voir le classement`}
                  className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition-colors ${
                    contexte.classement.rang === 1
                      ? "bg-accent text-white hover:bg-accent-fonce"
                      : contexte.classement.rang !== null
                        ? "bg-accent-fond text-accent-tres-fonce hover:bg-accent-bordure"
                        : "bg-surface-3 text-texte-2 hover:text-texte"
                  }`}
                >
                  <Trophy className="size-3.5" strokeWidth={1.9} />
                  {contexte.classement.rang !== null ? (
                    <span>
                      {contexte.classement.rang}
                      <sup>{contexte.classement.rang === 1 ? "er" : "e"}</sup> sur {contexte.classement.classes} · {libelleMoisLong(contexte.classement.mois).toLowerCase()}
                    </span>
                  ) : (
                    <span>non classé · {libelleMoisLong(contexte.classement.mois).toLowerCase()}</span>
                  )}
                </Link>
              ) : null}
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-texte-2">
              <span className="code font-medium text-texte">{c.matriculeRh ?? "Sans matricule"}</span>
              <span className="text-attenue-2">·</span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5 text-attenue" strokeWidth={1.8} />
                {siteLibelle}
              </span>
              <span className="text-attenue-2">·</span>
              <span className="code inline-flex items-center gap-1.5">
                <Phone className="size-3.5 text-attenue" strokeWidth={1.8} />
                {c.telephone ?? "—"}
              </span>
              {l.indisponibilite ? (
                <>
                  <span className="text-attenue-2">·</span>
                  <span className="inline-flex items-center gap-1.5 text-vigilance">
                    <CalendarOff className="size-3.5" strokeWidth={1.8} />
                    {MOTIF_INDISPONIBILITE[l.indisponibilite.motif]}
                    {l.indisponibilite.fin ? ` jusqu'au ${date(l.indisponibilite.fin)}` : " — sans date de retour"}
                  </span>
                </>
              ) : null}
              {c.dateSortie ? (
                <>
                  <span className="text-attenue-2">·</span>
                  <span>Sorti le {date(c.dateSortie)}</span>
                </>
              ) : null}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => demander({ type: "chauffeur", numero: numeroFiche, titre: `Fiche ${nomAffiche}`, valeurs: { ...fiche.identite, ...l.chauffeur, permisCategories: fiche.identite.permisCategories.join(" · ") } as unknown as Record<string, unknown> })}
              className="bouton-secondaire"
            >
              <Pencil className="size-4 text-texte-2" strokeWidth={1.7} />
              Modifier
            </button>
            <BoutonDiscussion nombre={nombreMessages} ouvert={discussionOuverte} onClick={() => setDiscussionOuverte((o) => !o)} />
            {c.actif ? <MenuAjout entrees={entreesAjout} onChoix={ajouter} /> : null}
          </div>
        </div>

        <BandeauKpi
          kpis={[
            { label: "Km parcourus", valeur: km > 0 ? nombre(km) : "—", unite: "km", precision: `${selection.affectations.length} affectation${selection.affectations.length > 1 ? "s" : ""} sur ${periode} mois` },
            {
              label: "Consommation",
              valeur: l100 === null ? "—" : nombre(l100, 1),
              unite: "L/100",
              precision: reference !== null ? `référence ${nombre(reference, 1)} · ${ecart !== null && ecart > 0 ? "+" : ""}${ecart ?? 0} %` : "aucun kilomètre attribué",
              ton: ecart !== null && ecart > 15 ? "vigilance" : ecart !== null && ecart < -5 ? "favorable" : "neutre",
            },
            {
              label: "Contraventions",
              valeur: `${selection.contraventions.length}`,
              precision: montantContraventions > 0 ? montantCourt(montantContraventions) : "aucune sur la période",
              ton: selection.contraventions.length >= 2 ? "vigilance" : "neutre",
            },
            {
              label: "Incidents",
              valeur: `${selection.incidents.length}`,
              precision: accidents > 0 ? `dont ${accidents} accident${accidents > 1 ? "s" : ""}` : "pannes et accidents",
              ton: accidents > 0 ? "defavorable" : selection.incidents.length >= 3 ? "vigilance" : "neutre",
            },
            { label: "Frais de route", valeur: montantCourt(montantFrais).replace(/\s?F$/, ""), unite: "F", precision: `${selection.fraisDeRoute.length} versement${selection.fraisDeRoute.length > 1 ? "s" : ""}` },
            {
              label: "Indisponibilité",
              valeur: `${selection.joursIndisponibles}`,
              unite: "j",
              precision: "congés, maladie, suspension, formation",
              ton: selection.joursIndisponibles > periode * 4 ? "vigilance" : "neutre",
            },
          ]}
        />

        <div className="-mb-px flex flex-wrap items-end gap-1">
          <div className="flex flex-wrap items-end gap-1" role="tablist" aria-label="Sections de la fiche">
            {ONGLETS.map((o) => {
              const actif = o.cle === onglet;
              return (
                <button
                  key={o.cle}
                  type="button"
                  role="tab"
                  aria-selected={actif}
                  onClick={() => setOnglet(o.cle)}
                  className={`relative shrink-0 border-b-2 px-2.5 pt-1 pb-3 text-[13px] whitespace-nowrap transition-colors ${
                    actif ? "border-accent font-semibold text-texte" : "border-transparent font-medium text-texte-2 hover:text-texte"
                  }`}
                >
                  {o.libelle}
                </button>
              );
            })}
          </div>

          {/* La période, à droite des onglets : elle vaut pour toute la fiche. */}
          <div className="mb-2 ml-auto flex h-8 items-center gap-0.5 rounded-full bg-surface-3 p-1" role="group" aria-label="Période de lecture">
            {PERIODES.map((p) => (
              <button
                key={p.valeur}
                type="button"
                aria-pressed={periode === p.valeur}
                onClick={() => setPeriode(p.valeur)}
                className={`h-6 rounded-full px-2.5 text-[12px] whitespace-nowrap transition-colors ${
                  periode === p.valeur ? "bg-surface font-semibold text-texte shadow-onglet" : "font-medium text-texte-2 hover:text-texte"
                }`}
              >
                {p.libelle}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Contenu de l'onglet : la seule zone qui défile ---- */}
      <div role="tabpanel" className="defilement-discret min-h-0 flex-1 px-8 py-6 lg:overflow-y-auto">
        {onglet === "apercu" && <OngletApercu fiche={fiche} selection={selection} voitSanctions={voitSanctions} />}
        {onglet === "performance" && <OngletPerformance fiche={fiche} evaluation={evaluation} classement={contexte.classement} voitSanctions={voitSanctions} />}
        {onglet === "identite" && <OngletIdentite fiche={fiche} />}
        {onglet === "affectations" && <OngletAffectations fiche={fiche} selection={selection} cible={cible} onAjouter={ajouter} />}
        {onglet === "documents" && <OngletDocuments fiche={fiche} cible={cible} onAjouter={ajouter} />}
        {onglet === "consommation" && <OngletConsommation selection={selection} />}
        {onglet === "contraventions" && <OngletContraventions selection={selection} cible={cible} onAjouter={ajouter} />}
        {onglet === "incidents" && <OngletIncidents selection={selection} voitSanctions={voitSanctions} cible={cible} onAjouter={ajouter} />}
        {onglet === "frais" && <OngletFraisDeRoute selection={selection} cible={cible} />}
        {onglet === "journal" && <OngletJournal fiche={fiche} voitSanctions={voitSanctions} cible={cible} onAjouter={ajouter} />}
      </div>

      <PanneauDiscussion
        sujet={`chauffeur:${l.id}`}
        libelle={l.nomComplet}
        href={`/chauffeurs/${l.id}`}
        personnes={personnes}
        ouvert={discussionOuverte}
        onFermer={() => setDiscussionOuverte(false)}
        onNombre={setNombreMessages}
      />
    </div>
  );
}
