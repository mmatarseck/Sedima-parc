"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Info } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Carte, TableauSimple } from "@/composants/interface/Carte";
import { Echeance } from "@/composants/interface/Pastille";
import { GROUPE_OPERATION, libellePeriodicite, type OperationEntretien, type ProgrammeEntretien } from "@/domaine/entretien";
import { CATEGORIE_VEHICULE } from "@/domaine/libelles";
import { montant, nombre } from "@/lib/format";

/* ============================================================================
 * Les programmes d'entretien standards.
 *
 * Un gabarit par type de véhicule, tenu ici une fois pour toutes : c'est la
 * première moitié de la demande du métier. La seconde — l'ajustement véhicule
 * par véhicule — se fait sur la fiche, dans l'onglet Maintenance, sans jamais
 * toucher au gabarit des autres.
 *
 * L'écran montre ce que le programme **coûte** et **immobilise** sur un cycle
 * de référence : c'est ce qui permet de discuter d'une périodicité autrement
 * qu'en principe. Resserrer une vidange n'est pas gratuit, et le chiffre doit
 * être sous les yeux au moment où on en décide.
 * ==========================================================================*/

export function EcranProgrammesEntretien({ programmes, comptes }: { programmes: ProgrammeEntretien[]; comptes: Record<string, number> }) {
  const [choisi, setChoisi] = useState(programmes[0]?.code ?? "");
  const programme = programmes.find((p) => p.code === choisi) ?? programmes[0]!;

  /* Le coût d'un cycle de référence : ce que le programme demande par an, sur
     un véhicule qui parcourt 60 000 km ou travaille 1 500 heures. */
  const REFERENCE_KM = 60_000;
  const REFERENCE_HEURES = 1_500;
  const passagesAnnuels = (o: OperationEntretien): number => {
    if (programme.base === "heures" && o.periodicite.heures !== null) return REFERENCE_HEURES / o.periodicite.heures;
    if (o.periodicite.km !== null) return REFERENCE_KM / o.periodicite.km;
    if (o.periodicite.mois !== null) return 12 / o.periodicite.mois;
    return 0;
  };
  const coutAnnuel = programme.operations.reduce((s, o) => s + passagesAnnuels(o) * o.coutEstime, 0);
  const heuresAnnuelles = programme.operations.reduce((s, o) => s + passagesAnnuels(o) * o.dureeHeures, 0);

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <TitreEcran
        titre="Programmes d'entretien"
        sousTitre={`${programmes.length} gabarits — un par type de véhicule · appliqués automatiquement à la création d'un véhicule, ajustables ensuite fiche par fiche`}
      />

      <p className="meta">
        <Link href="/parametres" className="inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce">
          <ChevronLeft className="size-3.5" strokeWidth={2} />
          Paramètres
        </Link>
      </p>

      <div className="sans-barre flex flex-wrap items-center gap-1.5" role="group" aria-label="Programme">
        {programmes.map((p) => (
          <button
            key={p.code}
            type="button"
            aria-pressed={p.code === programme.code}
            onClick={() => setChoisi(p.code)}
            className={`h-8 rounded-full px-3 text-[12.5px] whitespace-nowrap transition-colors ${
              p.code === programme.code ? "bg-surface font-semibold text-texte shadow-onglet" : "bg-surface-3 font-medium text-texte-2 hover:text-texte"
            }`}
          >
            {p.libelle}
            <span className="ml-1.5 text-attenue">{comptes[p.code] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="flex items-start gap-3 rounded-[12px] border border-bordure bg-surface px-4 py-3">
        <Info className="mt-0.5 size-4 shrink-0 text-attenue" strokeWidth={1.9} />
        <div className="min-w-0 text-[13px] leading-relaxed text-texte">
          <p>
            <span className="font-medium">{programme.libelle}</span> — {programme.precision} S&apos;applique à{" "}
            {programme.categories.map((c) => CATEGORIE_VEHICULE[c]).join(", ").toLowerCase()}, soit{" "}
            <strong className="font-semibold">{comptes[programme.code] ?? 0} véhicules</strong> du parc.
          </p>
          <p className="meta mt-1">
            Sur un cycle de référence de {programme.base === "heures" ? `${nombre(REFERENCE_HEURES)} heures` : `${nombre(REFERENCE_KM)} km`} par an, ce programme représente{" "}
            <strong className="font-semibold text-texte">{montant(Math.round(coutAnnuel))}</strong> et{" "}
            <strong className="font-semibold text-texte">{Math.round(heuresAnnuelles)} heures d&apos;atelier</strong> par véhicule. Resserrer une périodicité se paie : le
            chiffre est là pour qu&apos;on en décide en connaissance de cause.
          </p>
        </div>
      </div>

      <Carte titre="Opérations du programme" precision="Ce que le gabarit prévoit — la fiche de chaque véhicule peut s'en écarter, avec motif" sansMarge>
        <TableauSimple<OperationEntretien>
          reglages="parametres.programmes-entretien"
          cle={(o) => o.code}
          lignes={programme.operations}
          ajustable
          filtrable={false}
          colonnes={[
            {
              cle: "libelle",
              libelle: "Opération",
              rendu: (o) => (
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate font-medium text-texte">{o.libelle}</span>
                  {o.critique ? (
                    <span className="meta shrink-0" title="Opération de sécurité : elle ne se reporte pas">
                      sécurité
                    </span>
                  ) : null}
                </span>
              ),
            },
            { cle: "groupe", libelle: "Ensemble", rendu: (o) => GROUPE_OPERATION[o.groupe] },
            { cle: "periodicite", libelle: "Périodicité", rendu: (o) => libellePeriodicite(o.periodicite) },
            {
              cle: "frequence",
              libelle: programme.base === "heures" ? "Passages / 1 500 h" : "Passages / 60 000 km",
              alignee: "droite",
              rendu: (o) => <span className="code">{passagesAnnuels(o).toFixed(1)}</span>,
            },
            { cle: "duree", libelle: "Immobilisation", alignee: "droite", rendu: (o) => <span className="code">{o.dureeHeures} h</span> },
            { cle: "cout", libelle: "Coût par passage", alignee: "droite", rendu: (o) => <span className="code">{montant(o.coutEstime)}</span> },
            {
              cle: "annuel",
              libelle: "Coût sur le cycle",
              alignee: "droite",
              rendu: (o) => <span className="code font-medium">{montant(Math.round(passagesAnnuels(o) * o.coutEstime))}</span>,
            },
            {
              cle: "reconnaissance",
              libelle: "Reconnue dans l'historique par",
              parDefaut: false,
              rendu: (o) => <span className="block truncate text-texte-2">{o.motsCles.join(", ")}</span>,
            },
            {
              cle: "critique",
              libelle: "Sécurité",
              parDefaut: false,
              rendu: (o) => (o.critique ? <Echeance ton="defavorable">Ne se reporte pas</Echeance> : <span className="text-attenue">—</span>),
            },
          ]}
        />
      </Carte>

      <p className="meta shrink-0">
        Les gabarits sont livrés en lecture : leur modification se fera ici même, une fois tranché qui, du responsable de parc ou de l&apos;atelier, en a la main. Les
        ajustements par véhicule, eux, se font déjà sur la fiche.
      </p>
    </div>
  );
}
