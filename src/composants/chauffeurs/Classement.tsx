"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, Lock, Minus, Trophy, TrendingDown, TrendingUp } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Carte, TableauSimple } from "@/composants/interface/Carte";
import { Echeance, Pastille } from "@/composants/interface/Pastille";
import { BAREME_PRIME, KM_MINIMAL_PAR_MOIS, PILIERS, libelleMoisLong, type LigneClassement, type Pilier } from "@/domaine/performance";
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

const COULEUR_PILIER: Record<Pilier, string> = { S: "text-defavorable", Q: "text-vigilance", D: "text-accent-fonce", C: "text-encre", M: "text-attenue" };

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
        <Link href="/chauffeurs" className="inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce">
          <ChevronLeft className="size-3.5" strokeWidth={1.8} />
          Chauffeurs
        </Link>
      </nav>

      <TitreEcran
        titre="Chauffeur du mois"
        sousTitre={`${classes.length} classés sur ${lignes.length} · score SQDCM du mois, piliers pondérés ${PILIERS.map((p) => `${p.code} ${p.poids}`).join(" · ")}`}
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
      <Carte titre={`Classement — ${libelleMoisLong(moisChoisi)}`} precision="À score égal : le pilier Sécurité, puis les kilomètres. Les non classables sont en fin de liste, sans rang." sansMarge>
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
            ...PILIERS.map((p) => ({
              cle: p.code,
              libelle: p.code,
              alignee: "droite" as const,
              largeur: "64px",
              rendu: (l: LigneClassement) => {
                const s = l.evaluation.piliers.find((x) => x.pilier === p.code)?.score ?? null;
                return <span className={`${COULEUR_PILIER[p.code]} ${s !== null && s < 60 ? "font-semibold" : ""}`}>{s ?? "—"}</span>;
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
            <p className="label-champ mb-1.5">Les cinq piliers</p>
            <ul className="flex flex-col gap-1">
              {PILIERS.map((p) => (
                <li key={p.code} className="flex gap-2">
                  <span className={`w-4 shrink-0 font-semibold ${COULEUR_PILIER[p.code]}`}>{p.code}</span>
                  <span>
                    <span className="text-texte">{p.libelle}</span> · {p.poids} % — {p.precision.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label-champ mb-1.5">Le score</p>
            <p>Chaque indicateur vaut 100 quand son objectif est tenu, puis descend en droite ligne jusqu&apos;à zéro à la tolérance. Un pilier est la moyenne de ses indicateurs ; le score global, la moyenne pondérée des piliers.</p>
            <p className="mt-2">Éliminatoires : plus d&apos;un accident dans le mois (minimum de points), sanction lourde, inaptitude ou documents de conduite non valides, moins de {KM_MINIMAL_PAR_MOIS} km. Les indicateurs « à venir » (tonnage, coût par tonne) attendent les livraisons de SediLiv.</p>
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
            <p className="mt-2">Objectifs, poids et barème sont des paramètres, à porter dans Paramètres quand le module existera.</p>
          </div>
        </div>
      </Carte>
    </div>
  );
}
