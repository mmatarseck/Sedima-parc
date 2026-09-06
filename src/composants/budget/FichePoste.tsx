"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Carte, TableauSimple } from "@/composants/interface/Carte";
import { Pastille } from "@/composants/interface/Pastille";
import { ETAT_BUDGET } from "@/domaine/budget";
import { BUSINESS_UNIT, POSTE_DEPENSE } from "@/domaine/libelles";
import type { BusinessUnit } from "@/domaine/types";
import type { DepenseBudget, EngagementBudget, FichePoste as Fiche } from "@/donnees/budget-demo";
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

export function FichePoste({ fiche }: { fiche: Fiche }) {
  const { suivi, depenses, engagements, parMois } = fiche;
  const cumul = suivi.cumul;
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

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_400px]">
        <Carte titre="La consommation, mois par mois" precision="Le cumul dépensé depuis janvier, contre le rythme que le budget prévoyait à la même date — tout le poste, business units confondues">
          <CourbeCumul parMois={parMois} budget={cumul.enveloppe.montant} />
        </Carte>

        <Carte titre="La ventilation" precision="La maille des enveloppes : le carburant de l'Aliment ne se compense pas avec les pneumatiques de l'Abattoir" sansMarge>
          <TableauSimple<(typeof suivi.parBu)[number]>
            reglages="budget.ventilation"
            cle={(s) => s.enveloppe.businessUnit ?? "parc"}
            lignes={suivi.parBu}
            filtrable={false}
            vide="Aucune ventilation."
            colonnes={[
              { cle: "bu", libelle: "Business unit", rendu: (s) => <span className="block truncate font-medium text-texte">{libelleBu(s.enveloppe.businessUnit)}</span> },
              {
                cle: "budget",
                libelle: "Budget",
                alignee: "droite",
                rendu: (s) => (s.enveloppe.montant > 0 ? <span className="code">{montantCourt(s.enveloppe.montant)}</span> : <span className="text-attenue-2">aucun</span>),
              },
              { cle: "consomme", libelle: "Consommé", alignee: "droite", rendu: (s) => <span className="code">{montantCourt(s.consomme)}</span> },
              {
                cle: "etat",
                libelle: "État",
                rendu: (s) => <Pastille ton={ETAT_BUDGET[s.etat].ton}>{ETAT_BUDGET[s.etat].libelle}</Pastille>,
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
              rendu: (d) => <span className="block truncate">{d.origine === "bon-de-commande" ? "Bon de commande" : d.origine === "facture" ? "Facture" : "Caisse"}</span>,
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
 * La courbe du cumul contre le rythme attendu.
 *
 * Deux traits sur la même échelle — le consommé en plein, l'attendu en
 * pointillé — parce que c'est leur écart, et lui seul, qui dit si l'enveloppe
 * tiendra. Le trait horizontal est le budget de l'exercice : quand le plein le
 * franchit, l'année est jouée.
 * --------------------------------------------------------------------------*/
function CourbeCumul({ parMois, budget }: { parMois: Fiche["parMois"]; budget: number }) {
  if (parMois.length === 0) return <p className="meta">Aucun mois écoulé sur l&apos;exercice.</p>;

  const largeur = 640;
  const hauteur = 220;
  const gauche = 58;
  const droite = 16;
  const haut = 14;
  const bas = 28;

  const maxi = Math.max(budget, ...parMois.map((p) => Math.max(p.consomme, p.attendu)), 1);
  const x = (i: number) => gauche + (parMois.length === 1 ? (largeur - gauche - droite) / 2 : (i * (largeur - gauche - droite)) / (parMois.length - 1));
  const y = (v: number) => haut + (1 - v / maxi) * (hauteur - haut - bas);

  const trace = (cle: "consomme" | "attendu") => parMois.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p[cle]).toFixed(1)}`).join(" ");
  const aire = `${trace("consomme")} L${x(parMois.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  const dernier = parMois[parMois.length - 1]!;

  return (
    <div className="flex flex-col gap-3">
      <svg viewBox={`0 0 ${largeur} ${hauteur}`} className="w-full" role="img" aria-label="Consommation cumulée contre le rythme attendu">
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

        <path d={aire} fill="url(#degradeBudget)" />
        <path d={trace("attendu")} fill="none" stroke="var(--color-attenue)" strokeWidth="1.5" strokeDasharray="4 3" />
        <path d={trace("consomme")} fill="none" stroke="var(--color-accent)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />

        {parMois.map((p, i) => (
          <g key={p.mois}>
            <circle cx={x(i)} cy={y(p.consomme)} r={i === parMois.length - 1 ? 4 : 2.5} fill="var(--color-accent)" />
            <text x={x(i)} y={hauteur - 8} textAnchor="middle" className="fill-attenue text-[10px]">
              {libelleMois(p.mois)}
            </text>
            <title>{`${libelleMois(p.mois)} — consommé ${montant(p.consomme)} · attendu ${montant(p.attendu)}`}</title>
          </g>
        ))}
      </svg>

      <p className="meta flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-[3px] w-4 rounded-full bg-accent" /> consommé cumulé — {montant(dernier.consomme)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-px w-4 border-t border-dashed border-attenue" /> rythme attendu — {montant(dernier.attendu)}
        </span>
      </p>
    </div>
  );
}
