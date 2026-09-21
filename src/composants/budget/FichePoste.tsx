"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Carte, TableauSimple } from "@/composants/interface/Carte";
import { Pastille } from "@/composants/interface/Pastille";
import { CHAMPS } from "@/composants/transactions/champs";
import { useEdition } from "@/composants/transactions/ContexteEdition";
import { cumulDuPoste, type DepenseBudget, type EngagementBudget, type FichePoste as Fiche } from "@/domaine/assembler-budget";
import { ETAT_BUDGET, PROFIL_PAR_POSTE, attenduADate, suivre, type Enveloppe, type SuiviEnveloppe } from "@/domaine/budget";
import type { Creation } from "@/domaine/cloture";
import { BUSINESS_UNIT, POSTE_DEPENSE } from "@/domaine/libelles";
import type { BusinessUnit, PosteDepense } from "@/domaine/types";
import { date as formaterDate, montant, montantCourt, pourcentage } from "@/lib/format";

/* ============================================================================
 * La page d'un poste budgétaire — ce qui a mangé l'enveloppe.
 *
 * Demande du métier du 5 septembre 2026 : « on doit pouvoir rentrer sur un
 * poste et voir la fiche du poste de dépense avec les dépenses qui l'ont
 * impacté ». Un budget qui ne se justifie pas ligne à ligne ne se discute pas :
 * on ne peut ni contester un dépassement, ni le comprendre.
 *
 * Quatre lectures, dans cet ordre : **où en est-on** (les chiffres), **par
 * quelle business unit** (la ventilation, qui est la maille des enveloppes),
 * **comment on y est arrivé** (la courbe du cumul contre le rythme attendu),
 * **par quoi** (les dépenses et les engagements). Le filtre par business unit
 * s'applique ici — la liste des postes, elle, ne porte qu'une ligne par poste.
 * ==========================================================================*/

const MOIS_COURT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function libelleMois(mois: string): string {
  return MOIS_COURT[Number(mois.slice(5, 7)) - 1] ?? mois;
}

const libelleBu = (bu: BusinessUnit | null) => (bu ? BUSINESS_UNIT[bu] : "tout le parc");

/* La pastille de la ventilation tient sur un mot : « Sous-consommé » débordait
   de sa colonne (métier, 16 septembre 2026). Le libellé entier reste en infobulle. */
const ETAT_COURT: Record<keyof typeof ETAT_BUDGET, string> = { depasse: "Dépassé", tendu: "Tendu", conforme: "Conforme", "sous-consomme": "En retard", "sans-budget": "Hors budget" };

/** Une enveloppe posée depuis la page, à la forme du domaine. */
function fabriquerEnveloppe(exercice: string, poste: PosteDepense) {
  return (c: Creation): Enveloppe | null => {
    const v = c.valeurs as Record<string, string | undefined>;
    const montant = Number(String(v.montant ?? "").replace(/\s/g, ""));
    if (!Number.isFinite(montant) || montant < 0 || !v.base) return null;
    return { numero: c.numero, exercice, poste, businessUnit: (v.businessUnit as BusinessUnit | undefined) || null, montant: Math.round(montant), profil: PROFIL_PAR_POSTE[poste] ?? null, base: v.base, commentaire: v.commentaire || null };
  };
}

export function FichePoste({ fiche }: { fiche: Fiche }) {
  const { depenses, engagements } = fiche;
  const { surcharger, demander, creer, creations } = useEdition();

  /*
   * L'enveloppe se pose et se corrige ici, business unit par business unit.
   * Ce que le navigateur a saisi — un montant revu, une enveloppe posée sur
   * un couple hors budget — se rejoue sur le suivi du serveur avec la même
   * arithmétique : l'état de la ligne, le cumul du poste et la courbe
   * disent alors la même chose que la liste au prochain chargement.
   */
  const posees = creations("budget", fabriquerEnveloppe(fiche.exercice, fiche.poste));
  const suivi = useMemo(() => {
    const mois = Number(fiche.aujourdhui.slice(5, 7));
    const jour = Number(fiche.aujourdhui.slice(8, 10));
    const joursDuMois = new Date(Date.UTC(Number(fiche.exercice), mois, 0)).getUTCDate();
    const rejouer = (s: SuiviEnveloppe, e: Enveloppe): SuiviEnveloppe => suivre(e, s.consomme, s.engage, attenduADate(e, mois, jour, joursDuMois));
    let change = false;
    const parBu = fiche.suivi.parBu.map((s) => {
      if (s.enveloppe.numero) {
        const e = surcharger(s.enveloppe);
        if (e.montant === s.enveloppe.montant && e.base === s.enveloppe.base && e.commentaire === s.enveloppe.commentaire) return s;
        change = true;
        return rejouer(s, { ...e, montant: Number(e.montant) });
      }
      const posee = posees.find((e) => e.businessUnit === s.enveloppe.businessUnit);
      if (!posee) return s;
      change = true;
      return rejouer(s, posee);
    });
    return change ? { ...fiche.suivi, parBu, cumul: cumulDuPoste(fiche.exercice, fiche.poste, parBu) } : fiche.suivi;
  }, [fiche, posees, surcharger]);
  const cumul = suivi.cumul;

  function modifierEnveloppe(s: SuiviEnveloppe) {
    const e = s.enveloppe;
    if (e.numero) {
      demander({ type: "budget", numero: e.numero, titre: `Enveloppe ${e.numero} · ${POSTE_DEPENSE[e.poste]} · ${libelleBu(e.businessUnit)}`, valeurs: e as unknown as Record<string, unknown>, champs: CHAMPS.budget });
      return;
    }
    creer({
      type: "budget",
      titre: `Poser une enveloppe · ${POSTE_DEPENSE[e.poste]} · ${libelleBu(e.businessUnit)}`,
      champs: CHAMPS.budget,
      valeurs: { date: `${fiche.exercice}-01-01`, exercice: fiche.exercice, poste: e.poste, businessUnit: e.businessUnit ?? "", base: `posée en cours d'exercice ${fiche.exercice}` },
    });
  }
  const etat = ETAT_BUDGET[cumul.etat];
  const horsBudget = cumul.etat === "sans-budget";

  /* Le filtre par business unit : il vaut pour la ventilation, les dépenses et
     les engagements — trois vues du même périmètre, qui doivent s'accorder. */
  const [bu, setBu] = useState<BusinessUnit | "toutes" | "parc">("toutes");
  const retient = (x: BusinessUnit | null) => bu === "toutes" || (bu === "parc" ? x === null : x === bu);

  const buChoisi = suivi.parBu.find((s) => (bu === "parc" ? s.enveloppe.businessUnit === null : s.enveloppe.businessUnit === bu));
  const vue = bu === "toutes" ? cumul : (buChoisi ?? cumul);

  const depensesVues = useMemo(() => depenses.filter((d) => retient(d.businessUnit)), [depenses, bu]);
  const engagementsVus = useMemo(() => engagements.filter((g) => retient(g.businessUnit)), [engagements, bu]);

  /*
   * La courbe suit le filtre, comme les chiffres et les listes (métier, 16
   * septembre 2026 : « connecter la courbe aux différents filtres »). Le serveur
   * livre le cumul du poste entier ; ici on le recompose depuis les dépenses
   * retenues, mois par mois sur les mois écoulés, et l'attendu se recalcule sur
   * l'enveloppe du périmètre — corrigée depuis la page s'il y a lieu. Quand le
   * filtre est « Toutes », ce calcul redonne la série du serveur.
   */
  const parMoisVus = useMemo(() => {
    const moisCourant = Number(fiche.aujourdhui.slice(5, 7));
    const parMoisDepense = new Map<string, number>();
    for (const d of depensesVues) {
      const m = d.date.slice(0, 7);
      parMoisDepense.set(m, (parMoisDepense.get(m) ?? 0) + d.montant);
    }
    let cumule = 0;
    return fiche.parMois.map((p, i) => {
      const m = i + 1;
      cumule += parMoisDepense.get(p.mois) ?? 0;
      const joursDuMoisM = new Date(Date.UTC(Number(fiche.exercice), m, 0)).getUTCDate();
      const jourM = m === moisCourant ? Number(fiche.aujourdhui.slice(8, 10)) : joursDuMoisM;
      return { mois: p.mois, consomme: cumule, attendu: attenduADate(vue.enveloppe, m, jourM, joursDuMoisM) };
    });
  }, [fiche, depensesVues, vue.enveloppe]);

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[12.5px] text-attenue">
        <Link href="/budget" className="inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce">
          <ChevronLeft className="size-3.5" strokeWidth={1.8} />
          Budget {cumul.enveloppe.exercice}
        </Link>
      </nav>

      {/* ---- En-tête ---- */}
      <header className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-3 text-[24px] font-bold text-texte">
            {POSTE_DEPENSE[fiche.poste]}
            <Pastille ton={etat.ton}>{etat.libelle}</Pastille>
          </h1>
          <p className="meta mt-1">
            Exercice {cumul.enveloppe.exercice} · {suivi.parBu.length} business unit{suivi.parBu.length > 1 ? "s" : ""} · {etat.precision.toLowerCase()}
          </p>
        </div>
      </header>

      {/* ---- Filtre par business unit ---- */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <span className="label-champ mr-1">Business unit</span>
        <BoutonBu actif={bu === "toutes"} onClick={() => setBu("toutes")} libelle="Toutes" compte={depenses.length} />
        {suivi.parBu.map((s) => {
          const k = s.enveloppe.businessUnit;
          const cible = k ?? "parc";
          return (
            <BoutonBu
              key={cible}
              actif={bu === cible}
              onClick={() => setBu(cible)}
              libelle={libelleBu(k)}
              compte={depenses.filter((d) => d.businessUnit === k).length}
              alerte={s.enveloppe.montant === 0}
            />
          );
        })}
      </div>

      {/* ---- Les chiffres qui décident, sur le périmètre choisi ---- */}
      <div className="grid shrink-0 grid-cols-2 gap-4 xl:grid-cols-5">
        {[
          { libelle: "Budget", valeur: vue.enveloppe.montant > 0 ? montantCourt(vue.enveloppe.montant) : "aucun", precision: vue.enveloppe.montant > 0 ? "pour l'exercice" : "pas d'enveloppe" },
          { libelle: "Consommé", valeur: montantCourt(vue.consomme), precision: `${depensesVues.length} dépenses` },
          { libelle: "Engagé", valeur: vue.engage > 0 ? montantCourt(vue.engage) : "—", precision: `${engagementsVus.length} bons de commande` },
          {
            libelle: "Disponible",
            valeur: vue.enveloppe.montant > 0 ? montantCourt(vue.disponible) : "—",
            precision: vue.enveloppe.montant === 0 ? "rien ne l'encadre" : vue.disponible < 0 ? "l'enveloppe est dépassée" : "avant la fin de l'exercice",
            ton: vue.enveloppe.montant > 0 && vue.disponible < 0 ? "defavorable" : "accent",
          },
          {
            libelle: "Écart au rythme",
            valeur: vue.ecartRythmePct === null ? "—" : `${vue.ecartRythmePct > 0 ? "+" : ""}${pourcentage(vue.ecartRythmePct, 1)}`,
            precision: vue.enveloppe.montant > 0 ? `attendu à date ${montantCourt(vue.attendu)}` : "sans référence",
          },
        ].map((k) => (
          <div key={k.libelle} className="carte px-4 py-3">
            <p className="label-champ">{k.libelle}</p>
            <p className={`code mt-1 text-[19px] font-bold ${k.ton === "defavorable" ? "text-defavorable" : k.ton === "accent" ? "text-accent-tres-fonce" : "text-texte"}`}>{k.valeur}</p>
            <p className="meta mt-0.5">{k.precision}</p>
          </div>
        ))}
      </div>

      {/*
        * La courbe et la ventilation côte à côte dès les écrans moyens, et la
        * ventilation à largeur bornée : elle prenait 400 px fixes et ses colonnes
        * débordaient, si bien qu'on la lisait en défilant à l'horizontale
        * (métier, 16 septembre 2026 : « mieux voir la ventilation à droite sans
        * scroll »). La courbe prend le reste et ne dépasse pas la hauteur d'une
        * carte de chiffres.
        */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(560px,680px)]">
        <Carte
          titre="La consommation, mois par mois"
          precision={`Le cumul dépensé depuis janvier, contre le rythme que le budget prévoyait à la même date — ${bu === "toutes" ? "tout le poste, business units confondues" : bu === "parc" ? "le parc, hors business unit" : libelleBu(bu)}`}
        >
          <CourbeCumul parMois={parMoisVus} budget={vue.enveloppe.montant} vue={vue} exercice={fiche.exercice} aujourdhui={fiche.aujourdhui} depenses={depensesVues} />
        </Carte>

        <Carte titre="La ventilation" precision="La maille des enveloppes : le carburant de l'Aliment ne se compense pas avec les pneumatiques de l'Abattoir. Chaque ligne se corrige ici, ou se pose quand elle manque" sansMarge>
          <TableauSimple<(typeof suivi.parBu)[number]>
            reglages="budget.ventilation.2"
            cle={(s) => s.enveloppe.businessUnit ?? "parc"}
            lignes={suivi.parBu}
            /* Quatre colonnes à largeur fixée, la business unit prenant le reste :
               le tableau tient dans sa carte au lieu d'y défiler en largeur. Huit
               lignes n'ont pas besoin d'un en-tête qui suit la page. */
            figerEnTete={false}
            filtrable={false}
            fixe
            vide="Aucune ventilation."
            numero={(s) => s.enveloppe.numero || `${s.enveloppe.poste}:${s.enveloppe.businessUnit ?? "parc"}`}
            surModifier={modifierEnveloppe}
            colonnes={[
              { cle: "bu", libelle: "Business unit", largeur: "170px", rendu: (s) => <span className="block truncate font-medium text-texte">{libelleBu(s.enveloppe.businessUnit)}</span> },
              {
                cle: "budget",
                libelle: "Budget",
                alignee: "droite",
                largeur: "88px",
                rendu: (s) => (s.enveloppe.montant > 0 ? <span className="code">{montantCourt(s.enveloppe.montant)}</span> : <span className="text-attenue-2">aucun</span>),
              },
              { cle: "consomme", libelle: "Consommé", alignee: "droite", largeur: "92px", rendu: (s) => <span className="code">{montantCourt(s.consomme)}</span> },
              {
                cle: "etat",
                libelle: "État",
                largeur: "112px",
                rendu: (s) => (
                  <span title={`${ETAT_BUDGET[s.etat].libelle} — ${ETAT_BUDGET[s.etat].precision}`}>
                    <Pastille ton={ETAT_BUDGET[s.etat].ton}>{ETAT_COURT[s.etat]}</Pastille>
                  </span>
                ),
              },
            ]}
          />
          <p className="meta px-5 py-3">{cumul.enveloppe.base}</p>
        </Carte>
      </div>

      <Carte
        titre="Les dépenses de l'exercice"
        precision={`${depensesVues.length} dépenses payées${bu === "toutes" ? "" : ` sur ${libelleBu(bu === "parc" ? null : bu)}`}, de la plus récente à la plus ancienne — c'est ce qui a consommé le budget`}
        sansMarge
      >
        <TableauSimple<DepenseBudget>
          reglages="budget.depenses"
          cle={(d) => d.numero}
          lignes={depensesVues}
          numero={(d) => d.numero}
          ajustable
          vide="Aucune dépense sur ce poste depuis le début de l'exercice."
          colonnes={[
            { cle: "date", libelle: "Date", rendu: (d) => <span className="code">{formaterDate(d.date)}</span> },
            {
              cle: "vehicule",
              libelle: "Véhicule",
              rendu: (d) => (
                <Link href={`/flotte/${d.immatriculation}`} className="code font-medium text-accent-fonce hover:underline">
                  {d.immatriculationAffichee}
                </Link>
              ),
            },
            { cle: "modele", libelle: "Modèle", parDefaut: false, rendu: (d) => <span className="block truncate text-texte-2">{d.vehicule}</span> },
            { cle: "bu", libelle: "Business unit", rendu: (d) => <span className="block truncate">{libelleBu(d.businessUnit)}</span> },
            { cle: "libelle", libelle: "Libellé", rendu: (d) => <span className="block truncate">{d.libelle}</span> },
            { cle: "beneficiaire", libelle: "Bénéficiaire", rendu: (d) => <span className="block truncate">{d.beneficiaire ?? <span className="text-attenue-2">—</span>}</span> },
            {
              cle: "origine",
              libelle: "Origine",
              parDefaut: false,
              rendu: (d) => <span className="block truncate">{d.origine === "bon-de-commande" ? "Bon de commande" : d.origine === "facture" ? "Facture" : d.origine === "stock" ? "Magasin" : "Caisse"}</span>,
            },
            {
              cle: "justificatif",
              libelle: "Justificatif",
              parDefaut: false,
              rendu: (d) => (d.justificatif ? <Pastille ton="favorable">Oui</Pastille> : <Pastille ton="vigilance">Manquant</Pastille>),
            },
            { cle: "montant", libelle: "Montant", alignee: "droite", rendu: (d) => <span className="code font-medium">{montant(d.montant)}</span> },
          ]}
        />
      </Carte>

      {engagementsVus.length > 0 ? (
        <Carte titre="Les engagements en cours" precision="Commandés et non réglés — le budget en est déjà mangé, même si rien n'est sorti de la caisse" sansMarge>
          <TableauSimple<EngagementBudget>
            reglages="budget.engagements"
            cle={(g) => g.numero}
            lignes={engagementsVus}
            numero={(g) => g.numero}
            ajustable
            vide="Aucun engagement en cours sur ce poste."
            colonnes={[
              { cle: "date", libelle: "Date", rendu: (g) => <span className="code">{formaterDate(g.date)}</span> },
              { cle: "objet", libelle: "Objet", rendu: (g) => <span className="block truncate">{g.objet}</span> },
              {
                cle: "fournisseur",
                libelle: "Fournisseur",
                rendu: (g) =>
                  g.prestataireNumero ? (
                    <Link href={`/prestataires/${g.prestataireNumero}`} className="block truncate font-medium text-accent-fonce hover:underline">
                      {g.fournisseur ?? g.prestataireNumero}
                    </Link>
                  ) : (
                    <span className="block truncate">{g.fournisseur ?? <span className="text-attenue-2">—</span>}</span>
                  ),
              },
              { cle: "bu", libelle: "Business unit", parDefaut: false, rendu: (g) => <span className="block truncate">{libelleBu(g.businessUnit)}</span> },
              { cle: "bon", libelle: "Bon de commande", rendu: (g) => <span className="code">{g.bonCommande}</span> },
              { cle: "vehicule", libelle: "Véhicule", parDefaut: false, rendu: (g) => <span className="code">{g.immatriculationAffichee ?? <span className="text-attenue-2">—</span>}</span> },
              { cle: "montant", libelle: "Montant", alignee: "droite", rendu: (g) => <span className="code font-medium text-vigilance">{montant(g.montant)}</span> },
            ]}
          />
        </Carte>
      ) : null}

      {horsBudget ? (
        <p className="meta shrink-0 rounded-[10px] border-l-[3px] border-l-vigilance bg-surface px-4 py-3 leading-relaxed">
          Ce poste dépense sans enveloppe : son réalisé annualisé était sous le seuil qui déclenche un budget. Un poste qui apparaît ainsi deux exercices de suite doit être budgété — c&apos;est le trou
          dans la raquette du suivi.
        </p>
      ) : null}
    </div>
  );
}

function BoutonBu({ actif, onClick, libelle, compte, alerte }: { actif: boolean; onClick: () => void; libelle: string; compte: number; alerte?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onClick}
      title={alerte ? "Cette business unit dépense sans enveloppe" : undefined}
      className={`h-8 rounded-full border px-3 text-[12.5px] whitespace-nowrap transition-colors ${
        actif ? "border-accent bg-accent font-medium text-white" : alerte ? "border-vigilance/50 bg-surface text-texte-2 hover:border-accent" : "border-bordure-champ bg-surface text-texte-2 hover:border-accent"
      }`}
    >
      {libelle}
      <span className={`ml-1.5 ${actif ? "text-white/70" : "text-attenue"}`}>{compte}</span>
    </button>
  );
}

/* ----------------------------------------------------------------------------
 * La courbe du cumul contre le rythme attendu — et ce qu'elle annonce.
 *
 * Deux traits sur la même échelle — le consommé en plein, l'attendu en
 * pointillé — parce que c'est leur écart, et lui seul, qui dit si l'enveloppe
 * tiendra. Le trait horizontal est le budget de l'exercice : quand le plein le
 * franchit, l'année est jouée.
 *
 * L'AXE VA JUSQU'À DÉCEMBRE, même en septembre : c'est la fin de l'exercice
 * qui juge, pas le mois courant. Au-delà du dernier mois écoulé, un trait
 * léger prolonge le consommé au rythme tenu depuis janvier — la projection —
 * et rencontre, ou non, la ligne du budget. Sous la courbe, les barres disent
 * chaque mois pour lui-même : le cumul lisse, elles montrent le mois qui a
 * pesé.
 *
 * LA COURBE SE LIT AU CURSEUR (métier, 16 septembre 2026 : « en mettant le
 * curseur, je dois pouvoir voir des infos détaillées ») : le mois le plus
 * proche se marque d'un guide vertical, et une bulle dit ce qu'il porte — le
 * cumul, l'attendu, l'écart, ce qui a été dépensé dans le mois, en combien de
 * dépenses, et la plus grosse. Sur un écran tactile, un appui fait de même.
 *
 * LES CHIFFRES SOUS LA COURBE sont ceux qu'un suivi budgétaire demande à
 * chaque revue : le rythme mensuel tenu contre celui que le budget permet, le
 * mois le plus lourd, où l'on finirait à ce rythme, le taux engagé-consommé,
 * et ce qu'il reste à dépenser par mois pour tenir. Tout suit le filtre par
 * business unit, comme la courbe.
 * --------------------------------------------------------------------------*/
interface DetailMois {
  nombre: number;
  total: number;
  plusGrosse: { libelle: string; montant: number; immatriculation: string | null } | null;
}

function detailsParMois(depenses: DepenseBudget[]): Map<string, DetailMois> {
  const m = new Map<string, DetailMois>();
  for (const d of depenses) {
    const mois = d.date.slice(0, 7);
    const x = m.get(mois) ?? { nombre: 0, total: 0, plusGrosse: null };
    x.nombre++;
    x.total += d.montant;
    if (!x.plusGrosse || d.montant > x.plusGrosse.montant) x.plusGrosse = { libelle: d.libelle, montant: d.montant, immatriculation: d.immatriculationAffichee };
    m.set(mois, x);
  }
  return m;
}

function CourbeCumul({ parMois, budget, vue, exercice, aujourdhui, depenses }: { parMois: Fiche["parMois"]; budget: number; vue: SuiviEnveloppe; exercice: string; aujourdhui: string; depenses: DepenseBudget[] }) {
  const [survol, setSurvol] = useState<number | null>(null);
  const details = useMemo(() => detailsParMois(depenses), [depenses]);
  if (parMois.length === 0) return <p className="meta">Aucun mois écoulé sur l&apos;exercice.</p>;

  /* Le rapport de la boîte de dessin suit celui de la carte — large et basse —
     sinon le SVG, à hauteur plafonnée, se centrait avec de larges marges vides
     de chaque côté (métier, 16 septembre 2026 : « éviter tout le vide autour »). */
  const largeur = 960;
  /* Plus haute que large ne l'exigerait : dans la colonne réduite, la courbe
     grandit vers le bas et la bande de chiffres descend (16 septembre 2026). */
  const hauteur = 380;
  const gauche = 58;
  const droite = 16;
  const haut = 14;
  const bas = 28;

  /* Ce que les mois écoulés disent. */
  const n = parMois.length;
  const dernier = parMois[n - 1]!;
  const mensuels = parMois.map((p, i) => ({ mois: p.mois, montant: p.consomme - (parMois[i - 1]?.consomme ?? 0) }));
  const plusFort = mensuels.reduce((m, x) => (x.montant > m.montant ? x : m), mensuels[0]!);
  const moyenne = Math.round(dernier.consomme / n);
  const permisParMois = budget > 0 ? Math.round(budget / 12) : null;

  /* La projection : le consommé à date, ramené à l'année au prorata des jours
     écoulés. Un exercice achevé ne se projette plus — il est ce qu'il est. */
  const annee = Number(exercice);
  const joursAnnee = (Date.UTC(annee + 1, 0, 1) - Date.UTC(annee, 0, 1)) / 86_400_000;
  const enCours = aujourdhui.startsWith(exercice);
  const jourAnnee = enCours ? Math.round((Date.UTC(annee, Number(aujourdhui.slice(5, 7)) - 1, Number(aujourdhui.slice(8, 10))) - Date.UTC(annee, 0, 1)) / 86_400_000) + 1 : joursAnnee;
  const projection = enCours && jourAnnee < joursAnnee && n < 12 ? Math.round((dernier.consomme * joursAnnee) / jourAnnee) : dernier.consomme;
  const moisRestants = 12 - n;
  const resteParMois = budget > 0 && moisRestants > 0 ? Math.round(Math.max(0, vue.disponible) / moisRestants) : null;

  /* Douze pas sur l'axe, quoi qu'il ait été consommé : la fin de l'exercice est toujours en vue. */
  const maxi = Math.max(budget, projection, ...parMois.map((p) => Math.max(p.consomme, p.attendu)), 1);
  const pas = (largeur - gauche - droite) / 11;
  const x = (i: number) => gauche + i * pas;
  const y = (v: number) => haut + (1 - v / maxi) * (hauteur - haut - bas);
  const largeurBarre = pas * 0.42;

  const trace = (cle: "consomme" | "attendu") => parMois.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p[cle]).toFixed(1)}`).join(" ");
  const aire = `${trace("consomme")} L${x(n - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  const traceProjection = n < 12 ? `M${x(n - 1).toFixed(1)},${y(dernier.consomme).toFixed(1)} L${x(11).toFixed(1)},${y(projection).toFixed(1)}` : null;

  /* Le mois sous le curseur : le pas le plus proche, parmi les mois écoulés. */
  function viser(e: React.MouseEvent<SVGRectElement> | React.TouchEvent<SVGRectElement>) {
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const boite = svg.getBoundingClientRect();
    const clientX = "touches" in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
    const px = ((clientX - boite.left) / boite.width) * largeur;
    const i = Math.max(0, Math.min(n - 1, Math.round((px - gauche) / pas)));
    setSurvol(i);
  }
  const vise = survol === null ? null : parMois[survol]!;
  const detail = vise ? (details.get(vise.mois) ?? { nombre: 0, total: mensuels[survol!]!.montant, plusGrosse: null }) : null;
  const ecart = vise ? vise.consomme - vise.attendu : 0;
  const bulleADroite = survol !== null && survol < 7;

  const stats: { libelle: string; valeur: string; precision: string; ton?: "defavorable" | "favorable" }[] = [
    { libelle: "Rythme mensuel", valeur: montantCourt(moyenne), precision: permisParMois === null ? `sur ${n} mois écoulé${n > 1 ? "s" : ""}` : `le budget permet ${montantCourt(permisParMois)} par mois` },
    { libelle: "Mois le plus lourd", valeur: montantCourt(plusFort.montant), precision: `en ${libelleMois(plusFort.mois)}` },
    {
      libelle: "Projection fin d'exercice",
      valeur: montantCourt(projection),
      precision: budget === 0 ? "sans enveloppe pour comparer" : projection > budget ? `dépasserait le budget de ${montantCourt(projection - budget)}` : `resterait sous le budget de ${montantCourt(budget - projection)}`,
      ton: budget === 0 ? undefined : projection > budget ? "defavorable" : "favorable",
    },
    { libelle: "Taux de consommation", valeur: vue.tauxConsommation === null ? "—" : pourcentage(vue.tauxConsommation, 0), precision: `consommé et engagé ${montantCourt(vue.consomme + vue.engage)}` },
    { libelle: "Reste par mois", valeur: resteParMois === null ? "—" : montantCourt(resteParMois), precision: moisRestants > 0 ? `pour tenir sur ${moisRestants} mois` : "exercice achevé" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <svg viewBox={`0 0 ${largeur} ${hauteur}`} className="w-full" role="img" aria-label="Consommation cumulée contre le rythme attendu, et projection à fin d'exercice">
          <defs>
            <linearGradient id="degradeBudget" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.26" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* L'axe des montants : trois graduations suffisent à donner l'ordre de grandeur. */}
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={gauche} y1={y(maxi * f)} x2={largeur - droite} y2={y(maxi * f)} stroke="var(--color-bordure)" strokeWidth="1" />
              <text x={gauche - 8} y={y(maxi * f) + 3} textAnchor="end" className="fill-attenue text-[10px]">
                {montantCourt(maxi * f)}
              </text>
            </g>
          ))}

          {/* Le budget de l'exercice : la ligne qu'on ne veut pas franchir. */}
          {budget > 0 ? (
            <>
              <line x1={gauche} y1={y(budget)} x2={largeur - droite} y2={y(budget)} stroke="var(--color-defavorable)" strokeWidth="1" strokeDasharray="2 3" opacity="0.7" />
              <text x={largeur - droite} y={y(budget) - 5} textAnchor="end" className="fill-defavorable text-[10px]">
                budget {montantCourt(budget)}
              </text>
            </>
          ) : null}

          {/* Chaque mois pour lui-même, derrière le cumul. */}
          {mensuels.map((m, i) => (
            <rect key={m.mois} x={x(i) - largeurBarre / 2} y={y(m.montant)} width={largeurBarre} height={Math.max(0, y(0) - y(m.montant))} fill="var(--color-accent)" opacity={survol === i ? 0.32 : 0.16} rx="1.5" />
          ))}

          <path d={aire} fill="url(#degradeBudget)" />
          <path d={trace("attendu")} fill="none" stroke="var(--color-attenue)" strokeWidth="1.5" strokeDasharray="4 3" />
          {traceProjection ? <path d={traceProjection} fill="none" stroke={projection > budget && budget > 0 ? "var(--color-defavorable)" : "var(--color-accent)"} strokeWidth="1.5" strokeDasharray="1.5 4" strokeLinecap="round" opacity="0.8" /> : null}
          <path d={trace("consomme")} fill="none" stroke="var(--color-accent)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />

          {/* Le guide du mois visé. */}
          {survol !== null ? (
            <>
              <line x1={x(survol)} y1={haut} x2={x(survol)} y2={hauteur - bas} stroke="var(--color-texte-2)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
              <circle cx={x(survol)} cy={y(parMois[survol]!.attendu)} r={4} fill="var(--color-surface)" stroke="var(--color-attenue)" strokeWidth="1.5" />
            </>
          ) : null}

          {parMois.map((p, i) => (
            <circle key={p.mois} cx={x(i)} cy={y(p.consomme)} r={survol === i ? 5.5 : i === n - 1 ? 4 : 2.5} fill="var(--color-accent)" stroke={survol === i ? "var(--color-surface)" : "none"} strokeWidth="2" />
          ))}
          {traceProjection ? <circle cx={x(11)} cy={y(projection)} r={3} fill="none" stroke={projection > budget && budget > 0 ? "var(--color-defavorable)" : "var(--color-accent)"} strokeWidth="1.5" /> : null}

          {Array.from({ length: 12 }, (_, i) => (
            <text key={i} x={x(i)} y={hauteur - 8} textAnchor="middle" className={`text-[10px] ${survol === i ? "fill-texte font-semibold" : "fill-attenue"}`} opacity={i < n ? 1 : 0.5}>
              {MOIS_COURT[i]}
            </text>
          ))}

          {/* La surface qui écoute le curseur, par-dessus tout le reste. */}
          <rect x={gauche - pas / 2} y={0} width={(n - 1) * pas + pas} height={hauteur} fill="transparent" style={{ cursor: "crosshair" }} onMouseMove={viser} onMouseLeave={() => setSurvol(null)} onTouchStart={viser} onTouchMove={viser} />
        </svg>

        {vise && detail ? (
          <div
            role="status"
            className="pointer-events-none absolute top-2 z-10 w-[240px] rounded-[12px] border border-bordure bg-surface p-3 text-[12px] shadow-modale"
            style={{ left: `${(x(survol!) / largeur) * 100}%`, transform: bulleADroite ? "translateX(12px)" : "translateX(calc(-100% - 12px))" }}
          >
            <p className="font-semibold text-texte">
              {libelleMois(vise.mois)} {exercice}
            </p>
            <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-texte-2">Consommé cumulé</dt>
              <dd className="code text-right font-medium">{montant(vise.consomme)}</dd>
              <dt className="text-texte-2">Attendu à date</dt>
              <dd className="code text-right">{montant(vise.attendu)}</dd>
              <dt className="text-texte-2">Écart au rythme</dt>
              <dd className={`code text-right font-medium ${ecart > 0 ? "text-defavorable" : "text-favorable"}`}>
                {ecart > 0 ? "+" : ""}
                {montant(ecart)}
                {vise.attendu > 0 ? ` (${ecart > 0 ? "+" : ""}${Math.round((ecart / vise.attendu) * 100)} %)` : ""}
              </dd>
              <dt className="text-texte-2">Dépensé dans le mois</dt>
              <dd className="code text-right">{montant(detail.total)}</dd>
              <dt className="text-texte-2">Dépenses</dt>
              <dd className="code text-right">{detail.nombre}</dd>
            </dl>
            {detail.plusGrosse ? (
              <p className="meta mt-1.5 truncate" title={detail.plusGrosse.libelle}>
                La plus grosse : {montantCourt(detail.plusGrosse.montant)}
                {detail.plusGrosse.immatriculation ? ` · ${detail.plusGrosse.immatriculation}` : ""} — {detail.plusGrosse.libelle}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="meta flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-[3px] w-4 rounded-full bg-accent" /> consommé cumulé — {montant(dernier.consomme)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-px w-4 border-t border-dashed border-attenue" /> rythme attendu — {montant(dernier.attendu)}
        </span>
        {traceProjection ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-px w-4 border-t border-dotted border-accent" /> projection à décembre — {montant(projection)}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-2 rounded-[2px] bg-accent/20" /> dépensé dans le mois
        </span>
        <span className="text-attenue">· survolez un mois pour le détail</span>
      </p>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-bordure pt-3 sm:grid-cols-3 2xl:grid-cols-5">
        {stats.map((s) => (
          <div key={s.libelle} className="min-w-0">
            <dt className="label-champ">{s.libelle}</dt>
            <dd className={`code mt-0.5 text-[15px] font-bold ${s.ton === "defavorable" ? "text-defavorable" : s.ton === "favorable" ? "text-favorable" : "text-texte"}`}>{s.valeur}</dd>
            <dd className="meta mt-0.5 truncate" title={s.precision}>
              {s.precision}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
