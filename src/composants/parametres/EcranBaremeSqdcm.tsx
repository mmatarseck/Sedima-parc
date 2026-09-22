"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Carte, TableauSimple } from "@/composants/interface/Carte";
import { Echeance, Pastille } from "@/composants/interface/Pastille";
import { BAREME_PRIME, KPI_CHAUFFEUR, type DefinitionKpiChauffeur } from "@/domaine/performance";
import { nombre, pourcentage } from "@/lib/format";

/* ============================================================================
 * Paramètres › Barème de performance des chauffeurs.
 *
 * Le barème qui décide de la prime : six indicateurs calculés automatiquement,
 * leur objectif et leur tolérance, un score qui en est la moyenne simple, quatre
 * tranches de prime (refonte du 22 septembre 2026 : plus de piliers SQDCM).
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

export function EcranBaremeSqdcm() {
  const confidentiels = KPI_CHAUFFEUR.filter((k) => k.confidentiel).length;

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[12.5px] text-attenue">
        <Link href="/parametres" className="inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce">
          <ChevronLeft className="size-3.5" strokeWidth={1.8} />
          Paramètres
        </Link>
      </nav>

      <TitreEcran
        titre="Barème de performance des chauffeurs"
        sousTitre={`${KPI_CHAUFFEUR.length} indicateurs calculés automatiquement · score = moyenne des indicateurs calculables · 4 tranches de prime`}
      />

      <Carte
        titre="Les indicateurs"
        precision="Chaque indicateur porte son objectif, sa tolérance et sa source. Entre l'objectif et la tolérance, le score descend en droite ligne. Les compteurs s'entendent par mois."
        sansMarge
      >
        <TableauSimple<DefinitionKpiChauffeur>
          reglages="parametres.sqdcm"
          cle={(k) => k.code}
          lignes={KPI_CHAUFFEUR}
          ajustable
          vide="Aucun indicateur."
          colonnes={[
            {
              cle: "nom",
              libelle: "Indicateur",
              rendu: (k) => (
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium text-texte">{k.nom}</span>
                  {k.confidentiel ? (
                    <span title="Visible seulement des rôles qui voient les sanctions">
                      <Pastille ton="vigilance">confidentiel</Pastille>
                    </span>
                  ) : null}
                </span>
              ),
            },
            {
              cle: "objectif",
              libelle: "Objectif",
              alignee: "droite",
              rendu: (k) => (
                <span className="code">
                  {k.regle === "inf_egal" ? "≤ " : "≥ "}
                  {nombre(k.objectif)} <span className="text-attenue">{k.unite === "#" ? (k.compteur ? "/ mois" : "") : k.unite}</span>
                </span>
              ),
            },
            {
              cle: "tolerance",
              libelle: "Tolérance",
              alignee: "droite",
              rendu: (k) => (
                <span className="code" title="Écart à l'objectif au-delà duquel le score de l'indicateur tombe à zéro">
                  {nombre(k.tolerance)} <span className="text-attenue">{k.unite === "#" ? (k.compteur ? "/ mois" : "") : k.unite}</span>
                </span>
              ),
            },
            {
              cle: "compteur",
              libelle: "Par mois",
              parDefaut: false,
              rendu: (k) =>
                k.compteur ? (
                  <span title="Objectif et tolérance valent pour un mois : ils se multiplient par les mois lus">
                    <Echeance ton="neutre">Oui</Echeance>
                  </span>
                ) : (
                  <span className="text-attenue-2">—</span>
                ),
            },
            { cle: "definition", libelle: "Ce que l'indicateur mesure", rendu: (k) => <span className="block truncate text-texte-2">{k.definition}</span> },
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
              <strong className="font-semibold text-texte">Aucune affectation sur le mois</strong> — la période ne dit rien de sa conduite. Un chauffeur en congé ou sans véhicule
              n&apos;est pas un mauvais chauffeur.
            </li>
            <li>
              <strong className="font-semibold text-texte">Plus d&apos;un accident</strong> sur la période, quelle qu&apos;en soit la responsabilité — minimum de points.
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
        <strong className="font-semibold text-texte">Pourquoi ce barème ne se modifie pas encore ici.</strong> Objectifs et tolérances décident d&apos;une rémunération : les changer en cours de
        période réécrirait des primes déjà annoncées. Le jour où ils se régleront, ce sera <strong className="font-semibold text-texte">daté</strong>, comme les prix de l&apos;énergie — un barème se
        valorise au barème de son mois, jamais à celui d&apos;aujourd&apos;hui.
      </p>
    </div>
  );
}
