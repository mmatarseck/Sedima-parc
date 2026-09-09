"use client";

import Link from "next/link";
import { HandCoins, Info, Plus, Star } from "lucide-react";
import { Carte, TableauSimple } from "@/composants/interface/Carte";
import { Echeance, Pastille } from "@/composants/interface/Pastille";
import {
  AGE_DETTE,
  CRITERES,
  CRITERE_EVALUATION,
  DIMENSION_PRESTATAIRE,
  NIVEAU_PRESTATAIRE,
  ORIGINE_DETTE,
  ageDette,
  avanceOuverte,
  moyenneEvaluation,
  niveauPrestataire,
  solde,
  type Avance,
  type Evaluation,
  type LigneDette,
  type NotationPrestataire,
} from "@/domaine/compte-prestataire";
import { date as formaterDate, montant, montantCourt, nombre } from "@/lib/format";

/* ============================================================================
 * Le compte d'un prestataire, à l'écran : ce qu'on lui doit, ce qu'on lui a
 * avancé, ce que valent ses services.
 *
 * Trois cartes, dans l'ordre où la question se pose quand on décroche le
 * téléphone : **combien**, **depuis quand**, et **est-ce qu'on continue avec
 * lui**.
 * ==========================================================================*/

export function ComptePrestataire({ dettes, avances, aujourdhui, onNouvelleAvance }: { dettes: LigneDette[]; avances: Avance[]; aujourdhui: string; onNouvelleAvance?: () => void }) {
  const s = solde(dettes, avances);
  const enRetard = dettes.filter((d) => ageDette(d.echeance, aujourdhui) === "en-retard");
  const ouvertes = avances.filter(avanceOuverte);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid shrink-0 grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="carte px-4 py-3">
          <p className="label-champ">Dette</p>
          <p className="code mt-1 text-[19px] font-bold text-texte">{s.dette > 0 ? montantCourt(s.dette) : "—"}</p>
          <p className="meta mt-0.5">
            {dettes.length} pièce{dettes.length > 1 ? "s" : ""} · travail fait, non réglé
          </p>
        </div>
        <div className="carte px-4 py-3">
          <p className="label-champ">Dont en retard</p>
          <p className={`code mt-1 text-[19px] font-bold ${enRetard.length > 0 ? "text-defavorable" : "text-texte"}`}>
            {enRetard.length > 0 ? montantCourt(enRetard.reduce((t, d) => t + d.montant, 0)) : "—"}
          </p>
          <p className="meta mt-0.5">au-delà de l&apos;échéance convenue</p>
        </div>
        <div className="carte px-4 py-3">
          <p className="label-champ">Avances ouvertes</p>
          <p className={`code mt-1 text-[19px] font-bold ${ouvertes.length > 0 ? "text-vigilance" : "text-texte"}`}>{s.avancesOuvertes > 0 ? montantCourt(s.avancesOuvertes) : "—"}</p>
          <p className="meta mt-0.5">versées, non encore imputées</p>
        </div>
        <div className="carte px-4 py-3">
          <p className="label-champ">Solde net</p>
          <p className="code mt-1 text-[19px] font-bold text-texte">{montantCourt(Math.abs(s.net))}</p>
          <p className="meta mt-0.5">{s.net >= 0 ? "nous devons" : "il nous doit un service"}</p>
        </div>
      </div>

      {ouvertes.length > 0 ? (
        <div className="carte flex shrink-0 items-start gap-3 border-l-[3px] border-l-vigilance px-4 py-3 text-[13px] leading-relaxed text-texte-2">
          <HandCoins className="mt-0.5 size-4 shrink-0 text-vigilance" strokeWidth={1.9} />
          <span>
            <strong className="font-semibold text-texte">
              {ouvertes.length} avance{ouvertes.length > 1 ? "s" : ""} ouverte{ouvertes.length > 1 ? "s" : ""} — {montant(s.avancesOuvertes)}
            </strong>{" "}
            . Une avance qui traîne dit l&apos;une de deux choses : ou le service n&apos;a jamais été rendu, ou il l&apos;a été et personne ne l&apos;a rapproché. Dans les deux cas il faut aller
            voir.
          </span>
        </div>
      ) : null}

      <Carte titre="Ce que nous lui devons" precision="Déduit des demandes d'achat, affrètements, mises à disposition et prestations — rien n'est saisi ici" sansMarge>
        <TableauSimple<LigneDette>
          reglages="prestataire.dettes"
          cle={(d) => d.numero}
          lignes={dettes}
          numero={(d) => d.numero}
          ajustable
          vide="Rien à régler : tout ce qui a été fait a été payé."
          colonnes={[
            { cle: "numero", libelle: "Pièce", rendu: (d) => <span className="code text-accent-fonce">{d.numero}</span> },
            {
              cle: "origine",
              libelle: "Origine",
              rendu: (d) => (
                <Link href={ORIGINE_DETTE[d.origine].href} className="text-texte-2 hover:text-accent-fonce">
                  {ORIGINE_DETTE[d.origine].libelle}
                </Link>
              ),
            },
            { cle: "date", libelle: "Depuis le", rendu: (d) => <span className="code">{formaterDate(d.date)}</span> },
            { cle: "objet", libelle: "Objet", rendu: (d) => <span className="block truncate">{d.objet}</span> },
            { cle: "facture", libelle: "Facture reçue", rendu: (d) => (d.facture ? <Echeance ton="favorable">Oui</Echeance> : <Pastille ton="neutre">Pas encore</Pastille>) },
            { cle: "echeance", libelle: "Échéance", rendu: (d) => (d.echeance ? <span className="code">{formaterDate(d.echeance)}</span> : <span className="text-attenue">—</span>) },
            {
              cle: "age",
              libelle: "État",
              rendu: (d) => {
                const age = ageDette(d.echeance, aujourdhui);
                return (
                  <span title={AGE_DETTE[age].precision}>
                    <Echeance ton={AGE_DETTE[age].ton}>{AGE_DETTE[age].libelle}</Echeance>
                  </span>
                );
              },
            },
            { cle: "montant", libelle: "Montant", alignee: "droite", rendu: (d) => <span className="code font-medium">{montant(d.montant)}</span> },
          ]}
        />
      </Carte>

      <Carte
        titre="Avances"
        precision="Un décaissement fait avant le service : il n'éteint rien tant qu'il n'est pas imputé sur une pièce"
        action={
          onNouvelleAvance ? (
            <button type="button" onClick={onNouvelleAvance} className="bouton-secondaire h-9">
              <Plus className="size-4" strokeWidth={2} />
              Nouvelle avance
            </button>
          ) : undefined
        }
        sansMarge
      >
        <TableauSimple<Avance>
          reglages="prestataire.avances"
          cle={(a) => a.numero}
          lignes={avances}
          numero={(a) => a.numero}
          ajustable
          vide="Aucune avance versée à ce prestataire."
          colonnes={[
            { cle: "numero", libelle: "Réf.", rendu: (a) => <span className="code text-accent-fonce">{a.numero}</span> },
            { cle: "date", libelle: "Versée le", rendu: (a) => <span className="code">{formaterDate(a.date)}</span> },
            { cle: "montant", libelle: "Montant", alignee: "droite", rendu: (a) => <span className="code font-medium">{montant(a.montant)}</span> },
            { cle: "motif", libelle: "Motif", rendu: (a) => <span className="block truncate">{a.motif}</span> },
            {
              cle: "etat",
              libelle: "Imputation",
              rendu: (a) =>
                a.imputeeSur ? (
                  <span className="flex items-baseline gap-2">
                    <Echeance ton="favorable">Imputée</Echeance>
                    <span className="code text-attenue">{a.imputeeSur}</span>
                  </span>
                ) : (
                  <Echeance ton="vigilance">Ouverte</Echeance>
                ),
            },
            { cle: "imputation", libelle: "Imputée le", parDefaut: false, rendu: (a) => (a.dateImputation ? <span className="code">{formaterDate(a.dateImputation)}</span> : <span className="text-attenue">—</span>) },
            { cle: "autorise", libelle: "Autorisée par", parDefaut: false, rendu: (a) => a.autorisePar },
          ]}
        />
      </Carte>
    </div>
  );
}

/* -- L'évaluation ------------------------------------------------------------------ */

export function EvaluationPrestataire({ evaluations, notation, onEvaluer }: { evaluations: Evaluation[]; notation: NotationPrestataire; onEvaluer?: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="carte flex shrink-0 items-start gap-3 px-4 py-3 text-[13px] leading-relaxed text-texte-2">
        <Info className="mt-0.5 size-4 shrink-0 text-attenue" strokeWidth={1.9} />
        <span>
          <strong className="font-semibold text-texte">Ici, la note se saisit — et c&apos;est assumé.</strong> La qualité d&apos;une réparation ne se déduit d&apos;aucune donnée. L&apos;évaluation se
          fait donc à la réception du service, quand l&apos;avis est frais, sur <strong className="font-semibold text-texte">trois critères seulement</strong> : au-delà, personne ne remplit. Deux
          dimensions se calculent en revanche toutes seules — les reprises et l&apos;ancienneté.
          {notation.niveau === null ? (
            <>
              {" "}
              Faute d&apos;assez de matière ({notation.mesurees} dimension{notation.mesurees > 1 ? "s" : ""} sur 5), <strong className="font-semibold text-texte">aucune note n&apos;est publiée</strong>.
            </>
          ) : null}
        </span>
      </div>

      <Carte
        titre="Notation"
        precision={
          notation.niveau
            ? `${NIVEAU_PRESTATAIRE[notation.niveau].libelle} · ${notation.score} sur 100 · ${NIVEAU_PRESTATAIRE[notation.niveau].precision}`
            : "Pas encore de note — il faut au moins trois dimensions mesurées"
        }
        sansMarge
      >
        <ul className="flex flex-col">
          {notation.dimensions.map((d) => (
            <li key={d.cle} className="flex flex-wrap items-center gap-4 border-b border-bordure px-5 py-3.5 last:border-b-0">
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="text-[13px] font-medium text-texte">{DIMENSION_PRESTATAIRE[d.cle].libelle}</span>
                  <span className="meta">poids {DIMENSION_PRESTATAIRE[d.cle].poids} %</span>
                  {DIMENSION_PRESTATAIRE[d.cle].saisie ? <span className="meta">· saisie</span> : <span className="meta">· calculée</span>}
                </span>
                <span className="meta mt-0.5 block">{d.constat}</span>
              </span>
              <span className="w-[220px] shrink-0">
                {d.score === null ? (
                  <span className="meta">non mesurée</span>
                ) : (
                  <span className="flex items-center gap-2.5">
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                      <span className="block h-full rounded-full" style={{ width: `${Math.max(2, d.score)}%`, background: NIVEAU_PRESTATAIRE[niveauPrestataire(d.score)].couleur }} />
                    </span>
                    <span className="code w-[34px] text-right text-[12.5px] font-semibold text-texte">{d.score}</span>
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Carte>

      <Carte
        titre="Évaluations des services"
        precision={`${evaluations.length} évaluation${evaluations.length > 1 ? "s" : ""} · saisies à la réception du service`}
        action={
          onEvaluer ? (
            <button type="button" onClick={onEvaluer} className="bouton-secondaire h-9">
              <Plus className="size-4" strokeWidth={2} />
              Évaluer un service
            </button>
          ) : undefined
        }
        sansMarge
      >
        <TableauSimple<Evaluation>
          reglages="prestataire.evaluations"
          cle={(e) => e.numero}
          lignes={evaluations}
          numero={(e) => e.numero}
          ajustable
          vide="Aucun service évalué pour l'instant."
          colonnes={[
            { cle: "date", libelle: "Date", rendu: (e) => <span className="code">{formaterDate(e.date)}</span> },
            { cle: "piece", libelle: "Service", rendu: (e) => <span className="block truncate font-medium text-texte">{e.pieceLibelle}</span> },
            { cle: "reference", libelle: "Pièce", parDefaut: false, rendu: (e) => <span className="code text-attenue">{e.pieceNumero}</span> },
            ...CRITERES.map((c) => ({
              cle: c,
              libelle: CRITERE_EVALUATION[c].libelle,
              alignee: "droite" as const,
              rendu: (e: Evaluation) => (
                <span className="inline-flex items-center gap-1" title={CRITERE_EVALUATION[c].question}>
                  <Star className={`size-3.5 ${e.notes[c] >= 4 ? "text-accent" : e.notes[c] >= 3 ? "text-vigilance" : "text-defavorable"}`} strokeWidth={2} fill="currentColor" />
                  <span className="code">{e.notes[c]}</span>
                </span>
              ),
            })),
            { cle: "moyenne", libelle: "Moyenne", alignee: "droite", rendu: (e) => <span className="code font-semibold">{nombre(moyenneEvaluation(e), 1)}</span> },
            { cle: "commentaire", libelle: "Commentaire", rendu: (e) => <span className="block truncate text-texte-2">{e.commentaire ?? "—"}</span> },
            { cle: "auteur", libelle: "Par", parDefaut: false, rendu: (e) => e.auteur },
          ]}
        />
      </Carte>
    </div>
  );
}
