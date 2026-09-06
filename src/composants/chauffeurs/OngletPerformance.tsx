"use client";

import Link from "next/link";
import { Lock, Trophy } from "lucide-react";
import { Carte } from "@/composants/interface/Carte";
import { Echeance, Pastille } from "@/composants/interface/Pastille";
import type { FicheChauffeur } from "@/domaine/chauffeur";
import {
  BAREME_PRIME,
  CATEGORIE_KPI,
  KM_MINIMAL_PAR_MOIS,
  PILIERS,
  libelleMoisLong,
  type EvaluationChauffeur,
  type Pilier,
  type ValeurKpi,
} from "@/domaine/performance";
import { date, montant, nombre } from "@/lib/format";

/* ============================================================================
 * Onglet Performance — la lecture SQDCM d'un chauffeur.
 *
 * Même grammaire que le tableau de bord de SEDIMA Opérations : cinq piliers,
 * des indicateurs typés résultat / performance / signal, une règle de
 * conformité et un objectif. Le score et la prime en découlent par un barème
 * que le chauffeur peut refaire lui-même. Rien ici n'est saisi : tout vient
 * des faits rattachés à ses affectations.
 * ==========================================================================*/

export interface ClassementDuMois {
  mois: string;
  rang: number | null;
  classes: number;
  total: number;
}

const COULEUR_PILIER: Record<Pilier, string> = {
  S: "bg-defavorable",
  Q: "bg-vigilance",
  D: "bg-accent",
  C: "bg-encre",
  M: "bg-attenue",
};

function tonScore(score: number | null): "favorable" | "vigilance" | "defavorable" | "neutre" {
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
  const u = k.definition.unite;
  if (u === "F") return montant(k.valeur);
  if (u === "%") return `${nombre(k.valeur, 1)} %`;
  if (u === "F/100 km") return `${nombre(k.valeur)} F`;
  if (u === "j") return `${nombre(k.valeur)} j`;
  return nombre(k.valeur, Number.isInteger(k.valeur) ? 0 : 1);
}

function objectifAffiche(k: ValeurKpi): string {
  const signe = k.definition.regle === "inf_egal" ? "≤" : "≥";
  const u = k.definition.unite;
  const v = k.objectif;
  const corps = u === "F" ? montant(v) : u === "%" ? `${nombre(v, 0)} %` : u === "F/100 km" ? `${nombre(v)} F` : u === "j" ? `${nombre(v, v < 1 ? 2 : 0)} j` : nombre(v, Number.isInteger(v) ? 0 : 2);
  return `${signe} ${corps}`;
}

function Jauge({ score, pilier }: { score: number | null; pilier: Pilier }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <div className={`h-full rounded-full ${COULEUR_PILIER[pilier]}`} style={{ width: `${score ?? 0}%`, opacity: score === null ? 0 : 0.85 }} />
    </div>
  );
}

export function OngletPerformance({
  fiche,
  evaluation,
  classement,
  voitSanctions,
}: {
  fiche: FicheChauffeur;
  evaluation: EvaluationChauffeur;
  classement: ClassementDuMois;
  voitSanctions: boolean;
}) {
  const e = evaluation;
  const motif = e.motifNonClassable === null ? null : e.motifConfidentiel && !voitSanctions ? "motif réservé à la gestion de parc" : e.motifNonClassable;

  return (
    <div className="flex flex-col gap-5">
      {/* ---- Score, prime, classement ---- */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Carte titre="Score SQDCM" precision={`du ${date(e.debut)} au ${date(e.fin)} · ${nombre(e.kmParcourus)} km`}>
          {/* Fin : le score et la prime sur une rangée, le classement en pied. */}
          <div className="flex items-center gap-4">
            <p className={`text-[34px] leading-none font-semibold tracking-[-0.03em] tabular-nums ${couleurTexte(e.score)}`}>{e.score === null ? "—" : e.score}</p>
            <div className="min-w-0 flex-1 border-l border-bordure pl-4">
              <p className="flex flex-wrap items-center gap-2">
                <span className="label-champ">Prime variable</span>
                <Pastille ton={e.classable ? tonScore(e.score) : "defavorable"}>{e.classable ? e.tranche.libelle : "Non attribuable"}</Pastille>
                <span className="text-[13px] font-medium text-texte">{e.classable ? `${e.tranche.partPct} % de la prime` : "0 %"}</span>
              </p>
              <p className="meta mt-1 leading-snug">{e.classable ? `Sur 100, piliers pondérés · tranche ${e.tranche.libelle.toLowerCase()} : score ≥ ${e.tranche.seuil}.` : `Non classable — ${motif}.`}</p>
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
            </div>
          </div>
        </Carte>

        <div className="carte h-full overflow-hidden bg-bordure">
          <div className="grid h-full grid-cols-2 gap-px sm:grid-cols-5">
            {e.piliers.map((p) => {
              const def = PILIERS.find((x) => x.code === p.pilier)!;
              return (
                <div key={p.pilier} className="flex h-full flex-col bg-surface px-4 py-3">
                  {/* Même structure dans les cinq cellules, pour que les jauges s'alignent :
                      en-tête, score et points pondérés, jauge, description sur deux lignes. */}
                  <div className="flex items-center gap-2">
                    <span className={`grid size-6 place-items-center rounded-full text-[11px] font-semibold text-white ${COULEUR_PILIER[p.pilier]}`}>{p.pilier}</span>
                    <span className="label-champ">{def.libelle}</span>
                    <span className="meta ml-auto text-[11px]" title="Poids du pilier dans le score">{def.poids} %</span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className={`text-[26px] leading-none font-semibold tracking-[-0.02em] tabular-nums ${couleurTexte(p.score)}`}>{p.score === null ? "—" : p.score}</span>
                    <span className="text-[11.5px] text-attenue">/ 100</span>
                    <span className="meta ml-auto text-[11.5px] tabular-nums" title="Contribution au score global : score × poids">{p.score === null ? "—" : `${nombre((p.score * def.poids) / 100, 1)} pts`}</span>
                  </div>
                  <div className="mt-2.5">
                    <Jauge score={p.score} pilier={p.pilier} />
                  </div>
                  <p className="meta mt-2 min-h-[2.6em] leading-snug">{def.precision}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ---- Indicateurs par pilier ---- */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {e.piliers.map((p) => {
          const def = PILIERS.find((x) => x.code === p.pilier)!;
          return (
            <Carte key={p.pilier} titre={`${p.pilier} — ${def.libelle}`} precision={`${def.anglais} · ${p.kpis.length} indicateurs · poids ${def.poids} %`} sansMarge>
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
                  {p.kpis.map((k) => {
                    const cache = k.definition.confidentiel && !voitSanctions;
                    const prevu = k.definition.prevu === true;
                    return (
                      <tr key={k.definition.code} className="hover:bg-surface-2">
                        <td className="border-b border-bordure px-5 py-2.5 last:border-b-0">
                          <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-texte">
                            <span className={prevu ? "text-texte-2" : ""}>{k.definition.nom}</span>
                            <span className="badge-texte rounded-full bg-surface-3 px-2 py-px font-medium text-texte-2">{CATEGORIE_KPI[k.definition.categorie]}</span>
                            {prevu ? <span className="badge-texte rounded-full bg-vigilance-fond px-2 py-px font-medium text-vigilance">à venir</span> : null}
                            {cache ? <Lock className="size-3 text-attenue" strokeWidth={1.8} /> : null}
                          </p>
                          <p className="meta mt-0.5 leading-snug" title={`${k.definition.definition}\n${k.definition.formule}`}>
                            {cache ? "Réservé à la gestion de parc et à la direction" : prevu ? k.definition.source : k.precision}
                          </p>
                        </td>
                        <td className="code border-b border-bordure px-3 py-2.5 text-right text-[13px] whitespace-nowrap last:border-b-0">
                          {cache ? <span className="text-attenue-2">réservé</span> : <span className={k.conforme === false ? "font-medium text-defavorable" : "font-medium text-texte"}>{valeurAffichee(k)}</span>}
                        </td>
                        <td className="code border-b border-bordure px-3 py-2.5 text-right text-[12.5px] whitespace-nowrap text-texte-2 last:border-b-0">{objectifAffiche(k)}</td>
                        <td className="border-b border-bordure px-5 py-2.5 text-right last:border-b-0">
                          {cache || k.score === null ? (
                            <span className="text-attenue-2">—</span>
                          ) : (
                            <Echeance ton={tonScore(k.score)}>{k.score}</Echeance>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Carte>
          );
        })}

        {/* ---- Barème ---- */}
        <Carte titre="Barème de la prime variable" precision="Quatre tranches à seuils ronds ; trois cas éliminatoires">
          <ul className="flex flex-col">
            {BAREME_PRIME.map((t) => {
              const active = e.classable && e.tranche.cle === t.cle;
              return (
                <li key={t.cle} className={`flex items-center gap-3 border-b border-bordure py-2.5 first:pt-0 last:border-b-0 last:pb-0 ${active ? "" : ""}`}>
                  <span className={`size-2 shrink-0 rounded-full ${active ? "bg-accent" : "bg-bordure-champ"}`} />
                  <span className={`text-[13px] ${active ? "font-semibold text-texte" : "text-texte-2"}`}>{t.libelle}</span>
                  <span className="meta">score ≥ {t.seuil}</span>
                  <span className={`code ml-auto text-[13px] ${active ? "font-semibold text-texte" : "text-texte-2"}`}>{t.partPct} %</span>
                </li>
              );
            })}
          </ul>
          <p className="meta mt-4 leading-relaxed">
            Éliminatoires : plus d&apos;un accident sur la période (minimum de points, score à zéro), une sanction lourde (blâme, mise à pied), une inaptitude ou des documents de conduite non valides, moins de {KM_MINIMAL_PAR_MOIS} km par mois. Un seul accident responsable ramène son indicateur à zéro sans éliminer.
          </p>
          <p className="meta mt-2 leading-relaxed">
            Score d&apos;un indicateur : 100 quand l&apos;objectif est tenu, puis descente en droite ligne jusqu&apos;à zéro à la tolérance. Score d&apos;un pilier : moyenne de ses indicateurs calculables. Score global : piliers pondérés {PILIERS.map((p) => `${p.code} ${p.poids}`).join(" · ")}.
          </p>
          {fiche.ligne.chauffeur.actif ? null : <p className="meta mt-2">Chauffeur sorti des effectifs : la lecture reste possible, la prime non.</p>}
        </Carte>
      </div>
    </div>
  );
}
