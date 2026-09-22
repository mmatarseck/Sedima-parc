"use client";

import Link from "next/link";
import { Lock, Trophy } from "lucide-react";
import { Carte } from "@/composants/interface/Carte";
import { Echeance, Pastille } from "@/composants/interface/Pastille";
import { libelleMoisLong, type EvaluationChauffeur, type ValeurKpi } from "@/domaine/performance";
import { date, nombre } from "@/lib/format";

/* ============================================================================
 * Onglet Performance — le mois en cours (métier, 22 septembre 2026).
 *
 * Le score global en tête, puis les six indicateurs avec leur score. Tout se
 * calcule des faits du parc et des événements saisis dans l'onglet Événements ;
 * un indicateur sans donnée ne compte pas dans la moyenne. L'évolution mois
 * par mois est sur l'Aperçu.
 * ==========================================================================*/

export interface ClassementDuMois {
  mois: string;
  rang: number | null;
  classes: number;
  total: number;
}

export function tonScore(score: number | null): "favorable" | "vigilance" | "defavorable" | "neutre" {
  if (score === null) return "neutre";
  if (score >= 90) return "favorable";
  if (score >= 60) return "vigilance";
  return "defavorable";
}

function couleurTexte(score: number | null): string {
  const ton = tonScore(score);
  return ton === "favorable" ? "text-favorable" : ton === "vigilance" ? "text-vigilance" : ton === "defavorable" ? "text-defavorable" : "text-attenue-2";
}

function valeurAffichee(k: ValeurKpi): string {
  if (k.valeur === null) return "—";
  if (k.definition.unite === "%") return `${nombre(k.valeur, 1)} %`;
  return nombre(k.valeur, Number.isInteger(k.valeur) ? 0 : 1);
}

function objectifAffiche(k: ValeurKpi): string {
  const signe = k.definition.regle === "inf_egal" ? "≤" : "≥";
  return `${signe} ${k.definition.unite === "%" ? `${nombre(k.objectif, 0)} %` : nombre(k.objectif, Number.isInteger(k.objectif) ? 0 : 1)}`;
}

export function OngletPerformance({ evaluation, classement, voitSanctions, actif }: { evaluation: EvaluationChauffeur; classement: ClassementDuMois; voitSanctions: boolean; actif: boolean }) {
  const e = evaluation;
  const motif = e.motifNonClassable === null ? null : e.motifConfidentiel && !voitSanctions ? "motif réservé à la gestion de parc" : e.motifNonClassable;
  const calcules = e.kpis.filter((k) => k.score !== null).length;

  return (
    <div className="flex flex-col gap-5">
      {/* ---- Le score du mois en cours ---- */}
      <Carte titre={`Score de ${libelleMoisLong(e.debut.slice(0, 7)).toLowerCase()}`} precision={`Mois en cours, du ${date(e.debut)} au ${date(e.fin)} · moyenne de ${calcules} indicateur${calcules > 1 ? "s" : ""} calculable${calcules > 1 ? "s" : ""} sur ${e.kpis.length}`}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <p className={`text-[40px] leading-none font-semibold tracking-[-0.03em] tabular-nums ${couleurTexte(e.score)}`}>
            {e.score === null ? "—" : e.score}
            <span className="ml-1 text-[14px] font-medium text-attenue">/ 100</span>
          </p>
          <div className="min-w-0 flex-1 border-l border-bordure pl-5">
            <p className="flex flex-wrap items-center gap-2">
              <span className="label-champ">Prime variable</span>
              <Pastille ton={e.classable ? tonScore(e.score) : "defavorable"}>{e.classable ? e.tranche.libelle : "Non attribuable"}</Pastille>
              <span className="text-[13px] font-medium text-texte">{e.classable ? `${e.tranche.partPct} % de la prime` : "0 %"}</span>
            </p>
            <p className="meta mt-1 leading-snug">{e.classable ? "Excellent ≥ 90 (100 %) · Bon ≥ 75 (75 %) · Acceptable ≥ 60 (50 %) · en dessous, rien." : `Non classable — ${motif}.`}</p>
            <p className="mt-2 flex items-center gap-2 text-[12.5px] text-texte-2">
              <Trophy className="size-3.5 text-attenue" strokeWidth={1.8} />
              {classement.rang !== null ? (
                <span>
                  <span className="font-medium text-texte">
                    {classement.rang}
                    <sup>{classement.rang === 1 ? "er" : "e"}</sup> sur {classement.classes}
                  </span>{" "}
                  en {libelleMoisLong(classement.mois).toLowerCase()}
                </span>
              ) : (
                <span>Non classé en {libelleMoisLong(classement.mois).toLowerCase()}</span>
              )}
              <Link href="/chauffeurs/classement" className="ml-auto font-medium text-accent-fonce hover:text-accent hover:underline">
                Voir le classement
              </Link>
            </p>
            {actif ? null : <p className="meta mt-1">Chauffeur sorti des effectifs : la lecture reste possible, la prime non.</p>}
          </div>
        </div>
      </Carte>

      {/* ---- Les six indicateurs ---- */}
      <Carte titre="Indicateurs" precision="100 quand l'objectif est tenu, puis en droite ligne jusqu'à zéro · les compteurs s'entendent par mois" sansMarge>
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="en-tete-colonne h-10 border-y border-bordure bg-surface-2 px-5 text-left">Indicateur</th>
              <th className="en-tete-colonne h-10 border-y border-bordure bg-surface-2 px-3 text-right whitespace-nowrap">Valeur</th>
              <th className="en-tete-colonne h-10 border-y border-bordure bg-surface-2 px-3 text-right whitespace-nowrap">Objectif</th>
              <th className="en-tete-colonne h-10 border-y border-bordure bg-surface-2 px-5 text-right whitespace-nowrap">Score</th>
            </tr>
          </thead>
          <tbody>
            {e.kpis.map((k) => {
              const cache = k.definition.confidentiel && !voitSanctions;
              return (
                <tr key={k.definition.code} className="hover:bg-surface-2">
                  <td className="border-b border-bordure px-5 py-2.5">
                    <p className="flex items-center gap-2 text-[13px] font-medium text-texte" title={k.definition.definition}>
                      {k.definition.nom}
                      {cache ? <Lock className="size-3 text-attenue" strokeWidth={1.8} /> : null}
                    </p>
                    <p className="meta mt-0.5 leading-snug">{cache ? "Réservé à la gestion de parc et à la direction" : k.precision}</p>
                  </td>
                  <td className="code border-b border-bordure px-3 py-2.5 text-right text-[13px] whitespace-nowrap">
                    {cache ? <span className="text-attenue-2">réservé</span> : <span className={k.conforme === false ? "font-medium text-defavorable" : "font-medium text-texte"}>{valeurAffichee(k)}</span>}
                  </td>
                  <td className="code border-b border-bordure px-3 py-2.5 text-right text-[12.5px] whitespace-nowrap text-texte-2">{objectifAffiche(k)}</td>
                  <td className="border-b border-bordure px-5 py-2.5 text-right">{cache || k.score === null ? <span className="text-attenue-2">—</span> : <Echeance ton={tonScore(k.score)}>{k.score}</Echeance>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Carte>
    </div>
  );
}
