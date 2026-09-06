"use client";

import { useCallback, useMemo } from "react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { AideSurvol } from "@/composants/interface/AideSurvol";
import { Pastille } from "@/composants/interface/Pastille";
import { TableListe, type ColonneListe, type FiltreListe } from "@/composants/interface/TableListe";
import { ETAT_BUDGET, type EtatBudget } from "@/domaine/budget";
import { BUSINESS_UNIT, COULEUR_TON, POSTE_DEPENSE } from "@/domaine/libelles";
import type { DonneesBudget, SuiviPoste } from "@/donnees/budget-demo";
import { montant, montantCourt, pourcentage } from "@/lib/format";

/* ============================================================================
 * Le budget du parc.
 *
 * Ce que l'écran met en avant, et qui n'est pas le total : **le disponible**.
 * Un budget se lit par ce qu'il reste, non par ce qu'il valait — et ce qui
 * reste tient compte de ce qui est **déjà commandé**, pas seulement de ce qui
 * est payé. C'est le chiffre que le comptable connaît et que l'exploitation
 * découvre trop tard.
 *
 * Le second chiffre est l'**écart au rythme** : consommer 60 % de son carburant
 * en août n'est ni bon ni mauvais dans l'absolu — cela dépend de la saison. Le
 * profil mensuel de chaque enveloppe donne le point de comparaison.
 *
 * Refonte du 5 septembre 2026, à la demande du métier : la liste est celle des
 * écrans Flotte et Chauffeurs — état en filet de couleur en début de ligne,
 * poste figé à gauche, en-tête figé —, **une seule ligne par poste**, chaque
 * ligne ouvre la page du poste avec ses dépenses et son filtre par business
 * unit, les postes **hors budget** ont rejoint la même liste plutôt qu'un
 * tableau à part, et les pavés d'explication se lisent au survol d'un « i ».
 * ==========================================================================*/

/** L'ordre des filtres d'état : du plus alarmant au plus dormant. */
const ETATS: EtatBudget[] = ["depasse", "tendu", "conforme", "sous-consomme", "sans-budget"];

const IDENTIFIANT = {
  cle: "poste",
  libelle: "Poste",
  largeur: 220,
  rendu: (p: SuiviPoste) => <span className="block truncate">{POSTE_DEPENSE[p.poste]}</span>,
};

const COLONNES: ColonneListe<SuiviPoste>[] = [
  {
    cle: "bu",
    libelle: "Business units",
    parDefaut: true,
    largeur: 210,
    texte: (p) => p.parBu.map((s) => (s.enveloppe.businessUnit ? BUSINESS_UNIT[s.enveloppe.businessUnit] : "tout le parc")).join(", "),
    tri: (p) => p.parBu.length,
    rendu: (p) => (
      <span className="block truncate" title={p.parBu.map((s) => (s.enveloppe.businessUnit ? BUSINESS_UNIT[s.enveloppe.businessUnit] : "tout le parc")).join(" · ")}>
        {p.parBu.length === 1
          ? (p.parBu[0]!.enveloppe.businessUnit ? BUSINESS_UNIT[p.parBu[0]!.enveloppe.businessUnit] : "tout le parc")
          : `${p.parBu.length} business units`}
      </span>
    ),
  },
  {
    cle: "budget",
    libelle: "Budget",
    alignee: "droite",
    parDefaut: true,
    largeur: 138,
    tri: (p) => p.cumul.enveloppe.montant,
    rendu: (p) => (p.cumul.enveloppe.montant > 0 ? <span className="code font-medium">{montant(p.cumul.enveloppe.montant)}</span> : <span className="text-attenue-2">aucun</span>),
  },
  { cle: "consomme", libelle: "Consommé", alignee: "droite", parDefaut: true, largeur: 138, tri: (p) => p.cumul.consomme, rendu: (p) => <span className="code">{montant(p.cumul.consomme)}</span> },
  {
    cle: "engage",
    libelle: "Engagé",
    alignee: "droite",
    parDefaut: true,
    largeur: 130,
    tri: (p) => p.cumul.engage,
    rendu: (p) => (p.cumul.engage > 0 ? <span className="code text-vigilance">{montant(p.cumul.engage)}</span> : <span className="text-attenue-2">—</span>),
  },
  {
    cle: "disponible",
    libelle: "Disponible",
    alignee: "droite",
    parDefaut: true,
    largeur: 140,
    tri: (p) => (p.cumul.etat === "sans-budget" ? null : p.cumul.disponible),
    rendu: (p) =>
      p.cumul.etat === "sans-budget" ? (
        <span className="text-attenue-2">—</span>
      ) : (
        <span className={`code font-medium ${p.cumul.disponible < 0 ? "text-defavorable" : "text-texte"}`}>{montant(p.cumul.disponible)}</span>
      ),
  },
  {
    cle: "avancement",
    libelle: "Avancement",
    parDefaut: true,
    largeur: 180,
    tri: (p) => p.cumul.tauxConsommation,
    texte: (p) => (p.cumul.tauxConsommation === null ? "" : `${p.cumul.tauxConsommation}`),
    rendu: (p) => {
      const s = p.cumul;
      if (s.tauxConsommation === null) return <span className="text-attenue-2">—</span>;
      const taux = s.tauxConsommation;
      const attendu = s.enveloppe.montant > 0 ? (s.attendu / s.enveloppe.montant) * 100 : 0;
      return (
        <span className="flex items-center gap-2.5" title={`Attendu à date : ${pourcentage(attendu, 1)}`}>
          <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.max(2, taux))}%`,
                background: s.etat === "depasse" ? "var(--color-defavorable)" : s.etat === "tendu" ? "var(--color-vigilance)" : "var(--color-accent)",
              }}
            />
            {/* Le repère du rythme attendu : la barre se juge contre lui, pas contre 100 %. */}
            <span className="absolute top-0 h-full w-px bg-encre/50" style={{ left: `${Math.min(100, attendu)}%` }} />
          </span>
          <span className="code w-[46px] shrink-0 text-right text-[12px] text-texte-2">{pourcentage(taux, 0)}</span>
        </span>
      );
    },
  },
  {
    cle: "rythme",
    libelle: "Écart au rythme",
    alignee: "droite",
    parDefaut: true,
    largeur: 148,
    tri: (p) => p.cumul.ecartRythmePct,
    rendu: (p) =>
      p.cumul.ecartRythmePct === null ? (
        <span className="text-attenue-2">—</span>
      ) : (
        <span className={`code ${p.cumul.ecartRythmePct > 10 ? "text-defavorable" : p.cumul.ecartRythmePct < -20 ? "text-attenue" : "text-texte-2"}`}>
          {p.cumul.ecartRythmePct > 0 ? "+" : ""}
          {pourcentage(p.cumul.ecartRythmePct, 1)}
        </span>
      ),
  },
  /* Le filet de début de ligne porte déjà la couleur ; cette colonne en donne
     le nom, pour qui ne retient pas encore les cinq états. */
  {
    cle: "etat",
    libelle: "État",
    parDefaut: false,
    largeur: 158,
    texte: (p) => ETAT_BUDGET[p.cumul.etat].libelle,
    rendu: (p) => (
      <span title={ETAT_BUDGET[p.cumul.etat].precision}>
        <Pastille ton={ETAT_BUDGET[p.cumul.etat].ton}>{ETAT_BUDGET[p.cumul.etat].libelle}</Pastille>
      </span>
    ),
  },
  {
    cle: "enveloppes",
    libelle: "Enveloppes",
    alignee: "droite",
    parDefaut: false,
    largeur: 130,
    tri: (p) => p.parBu.filter((s) => s.enveloppe.montant > 0).length,
    rendu: (p) => <span className="code">{p.parBu.filter((s) => s.enveloppe.montant > 0).length}</span>,
  },
  {
    cle: "sansEnveloppe",
    libelle: "BU sans enveloppe",
    alignee: "droite",
    parDefaut: false,
    largeur: 170,
    tri: (p) => p.parBu.filter((s) => s.enveloppe.montant === 0).length,
    rendu: (p) => {
      const n = p.parBu.filter((s) => s.enveloppe.montant === 0).length;
      return n > 0 ? <Pastille ton="vigilance">{n}</Pastille> : <span className="text-attenue-2">—</span>;
    },
  },
  { cle: "base", libelle: "Base du montant", parDefaut: false, largeur: 340, rendu: (p) => <span className="block truncate text-texte-2">{p.cumul.enveloppe.base}</span> },
  {
    cle: "profil",
    libelle: "Saisonnalité",
    parDefaut: false,
    largeur: 170,
    rendu: (p) => (p.cumul.enveloppe.profil ? <Pastille ton="neutre">Profil saisonnier</Pastille> : <span className="text-attenue-2">au prorata du temps</span>),
  },
];

export function EcranBudget({ donnees }: { donnees: DonneesBudget }) {
  const { synthese, postes, horsBudget, exercice } = donnees;

  const ecartGlobal = synthese.budget > 0 ? Math.round(((synthese.consomme + synthese.engage - synthese.attendu) / synthese.budget) * 1000) / 10 : null;
  const budgetes = postes.filter((p) => p.cumul.etat !== "sans-budget").length;
  const engageTotal = postes.reduce((s, p) => s + p.cumul.engage, 0);
  const engageHorsBudget = postes.filter((p) => p.cumul.etat === "sans-budget").reduce((s, p) => s + p.cumul.engage, 0);

  const filtres = useMemo<FiltreListe<SuiviPoste>[]>(() => {
    const presents = ETATS.filter((e) => postes.some((p) => p.cumul.etat === e));
    return [{ cle: "tous", libelle: "Tous", retient: () => true }, ...presents.map((e) => ({ cle: e, libelle: ETAT_BUDGET[e].libelle, retient: (p: SuiviPoste) => p.cumul.etat === e }))];
  }, [postes]);

  const filet = useCallback(
    (p: SuiviPoste) => ({ couleur: COULEUR_TON[ETAT_BUDGET[p.cumul.etat].ton], libelle: ETAT_BUDGET[p.cumul.etat].libelle, precision: ETAT_BUDGET[p.cumul.etat].precision }),
    [],
  );

  const champsRecherche = useCallback(
    (p: SuiviPoste) => [POSTE_DEPENSE[p.poste], ...p.parBu.map((s) => (s.enveloppe.businessUnit ? BUSINESS_UNIT[s.enveloppe.businessUnit] : "tout le parc")), p.cumul.enveloppe.base],
    [],
  );

  return (
    <div className="flex flex-col gap-5 px-8 py-7 lg:h-full">
      <TitreEcran
        titre={`Budget ${exercice}`}
        sousTitre={`${postes.length} postes de dépense · ${budgetes} budgétés · ${montantCourt(synthese.budget)} pour l'exercice`}
        actions={
          <AideSurvol libelle="Comment lire ce budget" aligne="droite">
            <b className="text-texte">Le disponible tient compte de l&apos;engagé.</b> Une enveloppe est mangée dès le bon de commande, non au règlement : sans cela, on croit disposer de ce qui est
            déjà promis à un fournisseur, et l&apos;on redécouvre la dépense le jour de la facture. Et l&apos;écart se mesure au <b className="text-texte">rythme attendu à date</b>, profil de saison
            compris — consommer 60 % de son carburant en août n&apos;est ni bon ni mauvais dans l&apos;absolu.
            <br />
            <br />
            Un poste <b className="text-texte">dépassé</b> a un engagé et un consommé supérieurs à son budget de l&apos;exercice ; <b className="text-texte">tendu</b>, il est en avance de plus de dix
            points sur le rythme — à ce train, l&apos;enveloppe ne tiendra pas l&apos;année. <b className="text-texte">Hors budget</b> : le poste dépense sans qu&apos;aucune enveloppe ne l&apos;encadre.
            {horsBudget.length > 0 ? ` Aujourd'hui, ${horsBudget.length} couples poste × business unit sont dans ce cas, pour ${montantCourt(synthese.horsBudget)}.` : ""}
            <br />
            <br />
            <b className="text-texte">Une ligne par poste.</b> Les enveloppes, elles, se tiennent par poste <i>et</i> par business unit — le carburant de l&apos;Aliment ne se compense pas avec les
            pneumatiques de l&apos;Abattoir : la ventilation et son filtre se lisent dans la page du poste. Les montants sont <b className="text-texte">dérivés du réalisé</b>, annualisé ; chaque
            enveloppe porte sa base en clair.
          </AideSurvol>
        }
      />

      {/* ---- Les quatre chiffres ---- */}
      <div className="grid shrink-0 grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="carte px-4 py-3">
          <p className="label-champ">Budget de l&apos;exercice</p>
          <p className="code mt-1 text-[19px] font-bold text-texte">{montantCourt(synthese.budget)}</p>
          <p className="meta mt-0.5">{budgetes} postes budgétés</p>
        </div>
        <div className="carte px-4 py-3">
          <p className="label-champ">Consommé</p>
          <p className="code mt-1 text-[19px] font-bold text-texte">{montantCourt(synthese.consomme)}</p>
          <p className="meta mt-0.5">payé · attendu à date {montantCourt(synthese.attendu)}</p>
        </div>
        <div className="carte px-4 py-3">
          <p className="label-champ">Engagé</p>
          {/* L'engagé se compte sur **tous** les postes, budgétés ou non : un bon
              de commande passé sur un poste sans enveloppe engage la même
              trésorerie, et c'est justement celui qu'on ne voit pas venir. */}
          <p className="code mt-1 text-[19px] font-bold text-vigilance">{engageTotal > 0 ? montantCourt(engageTotal) : "—"}</p>
          <p className="meta mt-0.5">{engageHorsBudget > 0 ? `commandé, pas encore payé · dont ${montantCourt(engageHorsBudget)} hors budget` : "commandé, pas encore payé"}</p>
        </div>
        <div className="carte px-4 py-3">
          <p className="label-champ">Disponible</p>
          <p className={`code mt-1 text-[19px] font-bold ${synthese.disponible < 0 ? "text-defavorable" : "text-accent-tres-fonce"}`}>{montantCourt(synthese.disponible)}</p>
          <p className="meta mt-0.5">
            {ecartGlobal !== null ? (
              <>
                {ecartGlobal > 0 ? "en avance de " : ecartGlobal < 0 ? "en retard de " : "au rythme, à "}
                {pourcentage(Math.abs(ecartGlobal), 1)} sur le rythme
              </>
            ) : (
              "—"
            )}
          </p>
        </div>
      </div>

      <TableListe<SuiviPoste>
        ecran="budget"
        lignes={postes}
        cle={(p) => p.poste}
        href={(p) => `/budget/${p.poste}`}
        filet={filet}
        libelleFilet="État"
        identifiant={IDENTIFIANT}
        colonnes={COLONNES}
        filtres={filtres}
        champsRecherche={champsRecherche}
        placeholderRecherche="Poste, business unit…"
        libelleRecherche="Rechercher un poste budgétaire"
        libelleUnite="postes"
        vide="Aucun poste dans cet état."
      />
    </div>
  );
}
