"use client";

import { LienRetour } from "@/composants/interface/LienRetour";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Lock, Minus, Trophy, TrendingDown, TrendingUp } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Carte, TableauSimple } from "@/composants/interface/Carte";
import { Echeance, Pastille } from "@/composants/interface/Pastille";
import { BAREME_PRIME, KPI_CHAUFFEUR, libelleMoisLong, type LigneClassement } from "@/domaine/performance";
import { voitSanctionsCourant } from "@/lib/acces-courant";
import { nombre } from "@/lib/format";

/* ============================================================================
 * Chauffeur du mois — le classement SQDCM.
 *
 * Un mois, tous les chauffeurs, un rang. Le podium en tête pour ce qui se
 * célèbre ; le tableau dessous pour ce qui se discute. Les non classables sont
 * listés après les autres, sans rang : on sait qu'ils existent, on sait
 * pourquoi si l'on y est habilité.
 * ==========================================================================*/

export interface IdentiteClassement {
  id: string;
  nom: string;
  initiales: string;
  vehicule: string | null;
  site: string | null;
}

function tonScore(score: number | null): "favorable" | "vigilance" | "defavorable" | "neutre" {
  if (score === null) return "neutre";
  if (score >= 90) return "favorable";
  if (score >= 60) return "vigilance";
  return "defavorable";
}


function Evolution({ rang, precedent }: { rang: number | null; precedent: number | null }) {
  if (rang === null) return null;
  if (precedent === null) return <span className="meta text-[11px]">nouveau</span>;
  const delta = precedent - rang;
  if (delta === 0) return <Minus className="size-3.5 text-attenue-2" strokeWidth={2} />;
  return delta > 0 ? (
    <span className="inline-flex items-center gap-0.5 text-[11.5px] font-medium text-favorable">
      <TrendingUp className="size-3.5" strokeWidth={2} />
      {delta}
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 text-[11.5px] font-medium text-defavorable">
      <TrendingDown className="size-3.5" strokeWidth={2} />
      {Math.abs(delta)}
    </span>
  );
}

export function Classement({
  mois,
  classements,
  identites,
}: {
  /** Les mois proposés, du plus récent au plus ancien. */
  mois: string[];
  classements: Record<string, LigneClassement[]>;
  identites: Record<string, IdentiteClassement>;
}) {
  const [moisChoisi, setMoisChoisi] = useState(mois[0]!);
  const [habilite, setHabilite] = useState(false);

  useEffect(() => {
    setHabilite(voitSanctionsCourant());
  }, []);

  const lignes = classements[moisChoisi] ?? [];
  const classes = lignes.filter((l) => l.rang !== null);
  const podium = classes.slice(0, 3);

  const motif = (l: LigneClassement) => {
    const e = l.evaluation;
    if (e.motifNonClassable === null) return null;
    return e.motifConfidentiel && !habilite ? "motif réservé" : e.motifNonClassable;
  };

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[12.5px] text-attenue">
        <LienRetour href="/chauffeurs" libelle="Chauffeurs" />
      </nav>

      <TitreEcran
        titre="Chauffeur du mois"
        sousTitre={`${classes.length} classés sur ${lignes.length} · score du mois : moyenne des ${KPI_CHAUFFEUR.length} indicateurs calculables`}
        actions={
          <div className="flex h-9 items-center gap-0.5 rounded-full bg-surface-3 p-1" role="group" aria-label="Mois">
            {mois.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={m === moisChoisi}
                onClick={() => setMoisChoisi(m)}
                className={`h-7 rounded-full px-3 text-[12.5px] whitespace-nowrap transition-colors ${
                  m === moisChoisi ? "bg-surface font-semibold text-texte shadow-onglet" : "font-medium text-texte-2 hover:text-texte"
                }`}
              >
                {libelleMoisLong(m)}
              </button>
            ))}
          </div>
        }
      />

      {/* ---- Podium ---- */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {podium.map((l, i) => {
          const id = identites[l.evaluation.chauffeurId]!;
          const e = l.evaluation;
          return (
            <Link key={id.id} href={`/chauffeurs/${id.id}?onglet=performance`} className={`carte flex items-start gap-4 px-5 py-4 transition-colors hover:bg-surface-2 ${i === 0 ? "border-accent-bordure bg-accent-fond/40" : ""}`}>
              <span className={`grid size-12 shrink-0 place-items-center rounded-full text-[15px] font-semibold ${i === 0 ? "bg-accent text-white" : "bg-accent-fond text-accent-tres-fonce"}`}>{id.initiales}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="code text-[12px] font-semibold text-texte-2">
                    {l.rang}
                    <sup>{l.rang === 1 ? "er" : "e"}</sup>
                  </span>
                  {i === 0 ? <Trophy className="size-4 text-accent-fonce" strokeWidth={1.8} /> : null}
                  <Evolution rang={l.rang} precedent={l.rangPrecedent} />
                </span>
                <span className="mt-0.5 block text-[15px] font-semibold text-texte">{id.nom}</span>
                <span className="meta block">{[id.vehicule, id.site].filter(Boolean).join(" · ")}</span>
                <span className="mt-2.5 flex items-center gap-2">
                  <span className={`text-[26px] leading-none font-semibold tracking-[-0.02em] tabular-nums ${tonScore(e.score) === "favorable" ? "text-favorable" : "text-texte"}`}>{e.score}</span>
                  <Pastille ton={tonScore(e.score)}>{e.tranche.libelle}</Pastille>
                  <span className="meta ml-auto">{nombre(e.kmParcourus)} km</span>
                </span>
              </span>
            </Link>
          );
        })}
        {podium.length === 0 ? <p className="corps col-span-full py-6 text-center text-attenue">Aucun chauffeur classable ce mois-ci.</p> : null}
      </div>

      {/* ---- Tableau ---- */}
      <Carte titre={`Classement — ${libelleMoisLong(moisChoisi)}`} precision="À score égal : les accidents, puis les kilomètres. Les non classables sont en fin de liste, sans rang." sansMarge>
        <TableauSimple<LigneClassement> reglages="chauffeurs.classement" figerEnTete="page"
          cle={(l) => l.evaluation.chauffeurId}
          lignes={lignes}
          vide="Aucun chauffeur sur ce mois."
          colonnes={[
            {
              cle: "rang",
              libelle: "Rang",
              largeur: "90px",
              rendu: (l) => (
                <span className="flex items-center gap-2">
                  <span className={`code ${l.rang !== null && l.rang <= 3 ? "font-semibold text-texte" : "text-texte-2"}`}>{l.rang ?? "—"}</span>
                  <Evolution rang={l.rang} precedent={l.rangPrecedent} />
                </span>
              ),
            },
            {
              cle: "chauffeur",
              libelle: "Chauffeur",
              rendu: (l) => {
                const id = identites[l.evaluation.chauffeurId]!;
                return (
                  <span className="flex items-center gap-2.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-fond text-[10.5px] font-semibold text-accent-tres-fonce">{id.initiales}</span>
                    <span className="flex flex-col">
                      <Link href={`/chauffeurs/${id.id}?onglet=performance`} className="font-medium text-accent-fonce hover:text-accent hover:underline">
                        {id.nom}
                      </Link>
                      <span className="meta">{[id.vehicule, id.site].filter(Boolean).join(" · ")}</span>
                    </span>
                  </span>
                );
              },
            },
            { cle: "km", libelle: "Km", alignee: "droite", rendu: (l) => nombre(l.evaluation.kmParcourus) },
            ...KPI_CHAUFFEUR.map((d) => ({
              cle: d.code,
              libelle: d.nom,
              alignee: "droite" as const,
              largeur: "110px",
              parDefaut: false,
              rendu: (l: LigneClassement) => {
                if (d.confidentiel && !habilite) return <span className="text-attenue-2">—</span>;
                const k = l.evaluation.kpis.find((x) => x.definition.code === d.code)?.score ?? null;
                return <span className={k !== null && k < 60 ? "font-semibold text-defavorable" : ""}>{k ?? "—"}</span>;
              },
            })),
            {
              cle: "score",
              libelle: "Score",
              alignee: "droite",
              rendu: (l) => <span className={`text-[14px] font-semibold ${l.evaluation.classable ? "text-texte" : "text-attenue"}`}>{l.evaluation.score ?? "—"}</span>,
            },
            {
              cle: "prime",
              libelle: "Prime",
              rendu: (l) => (l.evaluation.classable ? <Pastille ton={tonScore(l.evaluation.score)}>{`${l.evaluation.tranche.libelle} · ${l.evaluation.tranche.partPct} %`}</Pastille> : <Pastille ton="neutre">0 %</Pastille>),
            },
            {
              cle: "statut",
              libelle: "Situation",
              rendu: (l) =>
                l.evaluation.classable ? (
                  <Echeance ton="favorable">classé</Echeance>
                ) : (
                  <span className="flex items-center gap-2">
                    <Echeance ton="neutre">non classé</Echeance>
                    <span className="meta inline-flex items-center gap-1">
                      {l.evaluation.motifConfidentiel && !habilite ? <Lock className="size-3" strokeWidth={1.8} /> : null}
                      {motif(l)}
                    </span>
                  </span>
                ),
            },
          ]}
        />
      </Carte>

      <Carte titre="Comment le classement est établi" precision="Les mêmes règles pour tous, lisibles par chacun">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 text-[13px] leading-relaxed text-texte-2 md:grid-cols-3">
          <div>
            <p className="label-champ mb-1.5">Les six indicateurs</p>
            <ul className="flex flex-col gap-1">
              {KPI_CHAUFFEUR.map((d) => (
                <li key={d.code} className="text-texte" title={d.definition}>
                  {d.nom}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label-champ mb-1.5">Le score</p>
            <p>Chaque indicateur vaut 100 quand son objectif est tenu, puis descend en droite ligne jusqu&apos;à zéro à la tolérance. Le score est la moyenne simple des indicateurs calculables : un indicateur sans donnée ne compte pas.</p>
            <p className="mt-2">Éliminatoires : plus d&apos;un accident dans le mois (minimum de points), sanction lourde, inaptitude ou documents de conduite non valides, aucune affectation dans le mois.</p>
          </div>
          <div>
            <p className="label-champ mb-1.5">La prime variable</p>
            <ul className="flex flex-col gap-1">
              {BAREME_PRIME.map((t) => (
                <li key={t.cle} className="flex gap-2">
                  <span className="text-texte">{t.libelle}</span>
                  <span className="meta">score ≥ {t.seuil}</span>
                  <span className="code ml-auto">{t.partPct} %</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Carte>
    </div>
  );
}
