"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Carte, TableauSimple } from "@/composants/interface/Carte";
import { Echeance, Pastille } from "@/composants/interface/Pastille";
import { BAREME_PRIME, CATEGORIE_KPI, KM_MINIMAL_PAR_MOIS, KPI_CHAUFFEUR, PILIERS, type DefinitionKpiChauffeur, type Pilier } from "@/domaine/performance";
import { nombre, pourcentage } from "@/lib/format";

/* ============================================================================
 * Paramètres › Barème SQDCM des chauffeurs.
 *
 * Le barème qui décide de la prime : cinq piliers pondérés, une trentaine
 * d'indicateurs avec leur objectif et leur tolérance, quatre tranches de prime.
 *
 * Pourquoi il vit ici plutôt que dans un coin du module Chauffeurs : **un
 * chauffeur doit pouvoir lire son barème**. Une prime dont la règle n'est pas
 * publique n'est pas une prime, c'est une gratification — et elle cesse
 * d'orienter les comportements dès que personne ne sait comment elle se
 * calcule. Chaque indicateur porte donc sa définition, sa formule et sa source.
 *
 * Ce qui ne se modifie pas encore ici : les objectifs et les poids. Ils
 * décident d'une rémunération ; les changer en cours de période réécrirait des
 * primes déjà annoncées. Le jour où ils se règleront, ce sera **daté**, comme
 * les prix de l'énergie — un barème se valorise au barème de son mois.
 * ==========================================================================*/

const TON_CATEGORIE = { resultat: "favorable", performance: "vigilance", signal: "neutre" } as const;

export function EcranBaremeSqdcm() {
  const [pilier, setPilier] = useState<Pilier | "tous">("tous");

  const affiches = useMemo(() => (pilier === "tous" ? KPI_CHAUFFEUR : KPI_CHAUFFEUR.filter((k) => k.pilier === pilier)), [pilier]);
  const aVenir = KPI_CHAUFFEUR.filter((k) => k.prevu).length;
  const confidentiels = KPI_CHAUFFEUR.filter((k) => k.confidentiel).length;
  const totalPoids = PILIERS.reduce((s, p) => s + p.poids, 0);

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[12.5px] text-attenue">
        <Link href="/parametres" className="inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce">
          <ChevronLeft className="size-3.5" strokeWidth={1.8} />
          Paramètres
        </Link>
      </nav>

      <TitreEcran
        titre="Barème SQDCM des chauffeurs"
        sousTitre={`${KPI_CHAUFFEUR.length} indicateurs sur 5 piliers · ${aVenir} en attente de leur source · 4 tranches de prime`}
      />

      {/* ---- Les cinq piliers et leur poids ---- */}
      <div className="grid shrink-0 grid-cols-2 gap-4 xl:grid-cols-5">
        {PILIERS.map((p) => {
          const combien = KPI_CHAUFFEUR.filter((k) => k.pilier === p.code).length;
          return (
            <button
              key={p.code}
              type="button"
              onClick={() => setPilier((x) => (x === p.code ? "tous" : p.code))}
              aria-pressed={pilier === p.code}
              className={`carte px-4 py-3 text-left transition-colors hover:bg-surface-2 ${pilier === p.code ? "ring-1 ring-accent" : ""}`}
            >
              <p className="label-champ">
                <span className="code mr-1.5 text-accent-fonce">{p.code}</span>
                {p.libelle}
              </p>
              <p className="code mt-1 text-[19px] font-bold text-texte">{pourcentage(p.poids, 0)}</p>
              <p className="meta mt-0.5 truncate" title={p.precision}>
                {combien} indicateur{combien > 1 ? "s" : ""} · {p.precision}
              </p>
            </button>
          );
        })}
      </div>

      {totalPoids !== 100 ? (
        <p className="carte shrink-0 border-l-[3px] border-l-defavorable px-4 py-3 text-[13px] text-texte-2">
          Les poids des piliers font {pourcentage(totalPoids, 0)} et non 100 % : le score global serait faussé.
        </p>
      ) : null}

      <Carte
        titre="Les indicateurs"
        precision={
          pilier === "tous"
            ? "Chaque indicateur porte son objectif, sa tolérance et sa source. Entre l'objectif et la tolérance, le score descend en droite ligne : c'est ce qui rend le barème lisible par le chauffeur lui-même."
            : `Pilier ${PILIERS.find((p) => p.code === pilier)?.libelle} — cliquer à nouveau sur la carte pour revoir tous les piliers.`
        }
        sansMarge
      >
        <TableauSimple<DefinitionKpiChauffeur>
          reglages="parametres.sqdcm"
          cle={(k) => k.code}
          lignes={affiches}
          ajustable
          vide="Aucun indicateur sur ce pilier."
          colonnes={[
            { cle: "code", libelle: "Code", rendu: (k) => <span className="code text-[12px] text-texte-2">{k.code}</span> },
            {
              cle: "nom",
              libelle: "Indicateur",
              rendu: (k) => (
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium text-texte">{k.nom}</span>
                  {k.prevu ? (
                    <span title="Retenu au barème, mais sa source n'est pas encore branchée : il ne compte pas dans le score">
                      <Pastille ton="neutre">à venir</Pastille>
                    </span>
                  ) : null}
                  {k.confidentiel ? (
                    <span title="Visible seulement des rôles qui voient les sanctions">
                      <Pastille ton="vigilance">confidentiel</Pastille>
                    </span>
                  ) : null}
                </span>
              ),
            },
            { cle: "pilier", libelle: "Pilier", rendu: (k) => <span className="code">{k.pilier}</span> },
            { cle: "categorie", libelle: "Catégorie", rendu: (k) => <Echeance ton={TON_CATEGORIE[k.categorie]}>{CATEGORIE_KPI[k.categorie]}</Echeance> },
            {
              cle: "objectif",
              libelle: "Objectif",
              alignee: "droite",
              rendu: (k) => (
                <span className="code">
                  {k.regle === "inf_egal" ? "≤ " : "≥ "}
                  {nombre(k.objectif)} <span className="text-attenue">{k.unite}</span>
                </span>
              ),
            },
            {
              cle: "tolerance",
              libelle: "Tolérance",
              alignee: "droite",
              rendu: (k) => (
                <span className="code" title="Écart à l'objectif au-delà duquel le score de l'indicateur tombe à zéro">
                  {nombre(k.tolerance)} <span className="text-attenue">{k.unite}</span>
                </span>
              ),
            },
            {
              cle: "compteur",
              libelle: "Proratisé",
              parDefaut: false,
              rendu: (k) =>
                k.compteur ? (
                  <span title="Objectif et tolérance valent pour douze mois : ils se ramènent à la période évaluée">
                    <Echeance ton="neutre">Oui</Echeance>
                  </span>
                ) : (
                  <span className="text-attenue-2">—</span>
                ),
            },
            { cle: "definition", libelle: "Ce que l'indicateur mesure", rendu: (k) => <span className="block truncate text-texte-2">{k.definition}</span> },
            { cle: "formule", libelle: "Formule", parDefaut: false, rendu: (k) => <span className="block truncate text-texte-2">{k.formule}</span> },
            { cle: "source", libelle: "Source", parDefaut: false, rendu: (k) => <span className="block truncate text-texte-2">{k.source}</span> },
          ]}
        />
      </Carte>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Carte titre="Les tranches de prime" precision="Quatre seuils ronds, pour qu'un chauffeur sache où il en est sans calculatrice" sansMarge>
          <TableauSimple<(typeof BAREME_PRIME)[number]>
            reglages="parametres.tranches"
            cle={(t) => t.cle}
            lignes={BAREME_PRIME}
            filtrable={false}
            vide="Aucune tranche."
            colonnes={[
              { cle: "libelle", libelle: "Tranche", rendu: (t) => <span className="font-medium text-texte">{t.libelle}</span> },
              { cle: "seuil", libelle: "À partir de", alignee: "droite", rendu: (t) => <span className="code">{t.seuil} / 100</span> },
              {
                cle: "part",
                libelle: "Part de la prime versée",
                alignee: "droite",
                rendu: (t) => <span className={`code font-medium ${t.partPct === 0 ? "text-attenue" : "text-texte"}`}>{pourcentage(t.partPct, 0)}</span>,
              },
            ]}
          />
        </Carte>

        <Carte titre="Ce qui écarte du classement" precision="Un chauffeur non classable ne perçoit rien sur la période — et l'écran le dit, plutôt que d'afficher un zéro qui ressemblerait à une mauvaise note">
          <ul className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-texte-2">
            <li>
              <strong className="font-semibold text-texte">Moins de {nombre(KM_MINIMAL_PAR_MOIS)} km sur le mois</strong> — la période ne dit rien de sa conduite. Un chauffeur en congé ou sans
              véhicule n&apos;est pas un mauvais chauffeur.
            </li>
            <li>
              <strong className="font-semibold text-texte">Un accident responsable</strong> sur la période — le motif est écrit sur sa fiche, et il est opposable.
            </li>
            <li>
              <strong className="font-semibold text-texte">Une sanction lourde</strong> — le motif reste confidentiel pour les rôles qui ne voient pas les sanctions : ils lisent « motif
              confidentiel », jamais le détail.
            </li>
          </ul>
          <p className="meta mt-4 border-t border-bordure pt-3">
            {confidentiels} indicateur{confidentiels > 1 ? "s" : ""} sur {KPI_CHAUFFEUR.length} {confidentiels > 1 ? "sont réservés" : "est réservé"} aux rôles qui voient les sanctions. Le classement
            se lit sur{" "}
            <Link href="/chauffeurs" className="font-medium text-accent-fonce hover:text-accent">
              Chauffeurs
            </Link>
            , et le détail par chauffeur sur sa fiche.
          </p>
        </Carte>
      </div>

      <p className="meta shrink-0 rounded-[10px] border-l-[3px] border-l-vigilance bg-surface px-4 py-3 leading-relaxed">
        <strong className="font-semibold text-texte">Pourquoi ce barème ne se modifie pas encore ici.</strong> Objectifs, tolérances et poids décident d&apos;une rémunération : les changer en cours de
        période réécrirait des primes déjà annoncées. Le jour où ils se régleront, ce sera <strong className="font-semibold text-texte">daté</strong>, comme les prix de l&apos;énergie — un barème se
        valorise au barème de son mois, jamais à celui d&apos;aujourd&apos;hui.
      </p>
    </div>
  );
}
