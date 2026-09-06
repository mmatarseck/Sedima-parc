"use client";

import { Info, SlidersHorizontal } from "lucide-react";
import { Carte, TableauSimple } from "@/composants/interface/Carte";
import { Echeance } from "@/composants/interface/Pastille";
import { useEdition } from "@/composants/transactions/ContexteEdition";
import {
  ETAT_ECHEANCE,
  GROUPE_OPERATION,
  libelleEcheance,
  libellePeriodicite,
  recalculerEcheance,
  type EcheanceEntretien,
} from "@/domaine/entretien";
import type { FicheVehicule } from "@/domaine/fiche";
import { date as formaterDate, montant, nombre } from "@/lib/format";

/* ============================================================================
 * Le plan d'entretien d'un véhicule.
 *
 * Le gabarit de sa catégorie, confronté à son compteur et à son historique. Ce
 * n'est plus une liste de périodicités : chaque ligne dit **où en est**
 * l'opération, et se règle pour ce véhicule sans toucher au gabarit des autres.
 *
 * L'ajustement passe par la modale de modification, comme tout le reste : il
 * est tracé, il porte un motif, et il se relit dans l'historique de la fiche.
 * ==========================================================================*/

export function PlanEntretien({ fiche }: { fiche: FicheVehicule }) {
  const { surcharger, demander } = useEdition();
  const plan = fiche.planEntretien;

  /*
   * Une ligne ajustée depuis l'application recouvre la ligne calculée. La
   * modale saisit des champs **plats** — km, heures, mois — parce qu'un
   * formulaire ne sait pas éditer un objet imbriqué ; on les replie donc sur la
   * périodicité, puis **on recalcule l'échéance**. Sans ce recalcul, la ligne
   * afficherait la nouvelle périodicité à côté de l'ancien état, et se
   * contredirait sous les yeux de celui qui vient de la régler.
   */
  const lignes = plan.echeances.map((e) => {
    const saisie = surcharger(e) as EcheanceEntretien & { km?: unknown; heures?: unknown; mois?: unknown; motif?: unknown };
    const change = ["km", "heures", "mois", "motif"].some((c) => saisie[c as "km"] !== undefined);
    if (!change) return e;
    const valeur = (brut: unknown, defaut: number | null): number | null => {
      if (brut === undefined) return defaut;
      if (brut === "" || brut === null) return null;
      const n = Number(brut);
      return Number.isFinite(n) ? n : defaut;
    };
    const periodicite = {
      km: valeur(saisie.km, e.periodicite.km),
      heures: valeur(saisie.heures, e.periodicite.heures),
      mois: valeur(saisie.mois, e.periodicite.mois),
    };
    const motif = typeof saisie.motif === "string" && saisie.motif.trim() ? saisie.motif.trim() : e.motifAjustement;
    const ajustee =
      periodicite.km !== e.periodicite.km || periodicite.heures !== e.periodicite.heures || periodicite.mois !== e.periodicite.mois || e.ajustee;
    return { ...recalculerEcheance(e, periodicite, plan.compteurs, plan.aujourdhui), ajustee, motifAjustement: motif };
  });

  const compte = (etat: EcheanceEntretien["etat"]) => lignes.filter((e) => e.etat === etat).length;
  const enRetard = compte("en-retard");
  const aPlanifier = compte("a-planifier");
  const sansReference = compte("sans-reference");
  const compteur =
    plan.base === "heures"
      ? plan.compteurs.heures === null
        ? "compteur horaire non relevé"
        : `${nombre(plan.compteurs.heures)} h au compteur`
      : plan.compteurs.km === null
        ? "kilométrage non relevé"
        : `${nombre(plan.compteurs.km)} km au compteur`;

  function ajuster(e: EcheanceEntretien) {
    demander({
      type: "entretien",
      numero: e.numero,
      titre: `Ajuster « ${e.libelle} » pour ce véhicule`,
      valeurs: { km: e.periodicite.km, heures: e.periodicite.heures, mois: e.periodicite.mois, motif: e.motifAjustement ?? "" },
    });
  }

  return (
    <Carte
      titre={`Plan d'entretien — ${plan.programmeLibelle}`}
      precision={`${plan.programmePrecision} · ${compteur}`}
      sansMarge
    >
      <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
        {enRetard > 0 ? <Echeance ton="defavorable">{enRetard} dépassée{enRetard > 1 ? "s" : ""}</Echeance> : null}
        {aPlanifier > 0 ? <Echeance ton="vigilance">{aPlanifier} à planifier</Echeance> : null}
        {sansReference > 0 ? (
          <span
            className="inline-flex items-center gap-1.5 text-[12.5px] text-texte-2"
            title="L'historique ne porte aucune trace de ces opérations. Ou elles n'ont jamais été faites, ou elles l'ont été sans être écrites — l'application ne peut pas trancher."
          >
            <Info className="size-3.5 shrink-0 text-attenue" strokeWidth={1.9} />
            {sansReference} sans passage relevé
          </span>
        ) : null}
        {enRetard === 0 && aPlanifier === 0 && sansReference === 0 ? <Echeance ton="favorable">Plan à jour</Echeance> : null}
        <span className="meta ml-auto flex items-center gap-1.5">
          <SlidersHorizontal className="size-3.5 shrink-0" strokeWidth={1.9} />
          Le crayon ajuste une périodicité pour ce véhicule seulement
        </span>
      </div>

      <TableauSimple<EcheanceEntretien>
        reglages="fiche-vehicule.plan-entretien"
        cle={(e) => e.numero}
        lignes={lignes}
        numero={(e) => e.numero}
        surModifier={ajuster}
        filtrable={false}
        colonnes={[
          {
            cle: "libelle",
            libelle: "Opération",
            rendu: (e) => (
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="truncate font-medium text-texte">{e.libelle}</span>
                {e.critique ? (
                  <span className="meta shrink-0" title="Opération de sécurité : elle ne se reporte pas">
                    sécurité
                  </span>
                ) : null}
              </span>
            ),
          },
          { cle: "groupe", libelle: "Ensemble", rendu: (e) => GROUPE_OPERATION[e.groupe] },
          {
            cle: "periodicite",
            libelle: "Périodicité",
            rendu: (e) => (
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="truncate">{libellePeriodicite(e.periodicite)}</span>
                {e.ajustee ? (
                  <span className="shrink-0 rounded-full bg-accent-fond px-1.5 text-[11px] font-medium text-accent-fonce" title={e.motifAjustement ?? "Ajustée pour ce véhicule"}>
                    ajustée
                  </span>
                ) : null}
              </span>
            ),
          },
          {
            cle: "dernier",
            libelle: "Dernier passage",
            rendu: (e) =>
              e.dernier === null ? (
                <span className="text-attenue">—</span>
              ) : (
                <span className="code" title={`${e.dernier.objet} · ${e.dernier.numero}`}>
                  {formaterDate(e.dernier.date)}
                  {e.dernier.km !== null ? <span className="text-attenue"> · {nombre(e.dernier.km)} km</span> : null}
                </span>
              ),
          },
          {
            cle: "due",
            libelle: "Due à",
            alignee: "droite",
            rendu: (e) =>
              e.dueA.km !== null ? (
                <span className="code">{nombre(e.dueA.km)} km</span>
              ) : e.dueA.heures !== null ? (
                <span className="code">{nombre(e.dueA.heures)} h</span>
              ) : e.dueA.date !== null ? (
                <span className="code">{formaterDate(e.dueA.date)}</span>
              ) : (
                <span className="text-attenue">—</span>
              ),
          },
          { cle: "echeance", libelle: "Échéance", alignee: "droite", rendu: (e) => <span className="code">{libelleEcheance(e)}</span> },
          {
            cle: "etat",
            libelle: "État",
            rendu: (e) => (
              <span title={ETAT_ECHEANCE[e.etat].precision}>
                <Echeance ton={ETAT_ECHEANCE[e.etat].ton}>{ETAT_ECHEANCE[e.etat].libelle}</Echeance>
              </span>
            ),
          },
          { cle: "duree", libelle: "Immobilisation", alignee: "droite", parDefaut: false, rendu: (e) => <span className="code">{e.dureeHeures} h</span> },
          { cle: "cout", libelle: "Coût estimé", alignee: "droite", parDefaut: false, rendu: (e) => <span className="code">{montant(e.coutEstime)}</span> },
          {
            cle: "motif",
            libelle: "Motif de l'ajustement",
            parDefaut: false,
            rendu: (e) => <span className="block truncate text-texte-2">{e.motifAjustement ?? "—"}</span>,
          },
        ]}
      />
    </Carte>
  );
}
