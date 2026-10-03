"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Check, Play, Wrench } from "lucide-react";
import { CHAMPS, champsCreation } from "@/composants/transactions/champs";
import { FournisseurEdition, useEdition } from "@/composants/transactions/ContexteEdition";
import { fabriquerLigneOrdre } from "@/composants/transactions/fabriques";
import type { AccesCourant } from "@/domaine/acces";
import { estOuvert, type LigneOrdre, type LigneTravail } from "@/domaine/maintenance";
import type { LigneSignalement } from "@/domaine/signalements";
import type { StatutVehicule } from "@/domaine/types";
import { lireAccesCourant } from "@/lib/acces-courant";
import { enregistrerCreation, enregistrerModification, lireCreations } from "@/lib/clotures-demo";
import { date as formaterDate, montant as formaterMontant } from "@/lib/format";
import { Bloc, Chiffre, EnTeteTelephone, Ligne } from "./Telephone";

/* ============================================================================
 * Téléphone › Atelier — pour la maintenance, depuis la fosse : les services en
 * atelier à clôturer, les services planifiés à faire entrer, ce qui reste à
 * planifier.
 *
 * Depuis le 3 octobre 2026, le téléphone ouvre **le formulaire de service**,
 * le même qu'au bureau : clôturer un service en atelier, c'est remplir ses
 * lignes (tâches, main-d'œuvre, pièces), son règlement, puis « Clôturer le
 * service » — qui écrit l'intervention, les dépenses et les sorties de stock,
 * et résout les pannes incluses. L'ancien geste, qui écrivait une intervention
 * d'un montant global à côté du service, est retiré : il laissait le service
 * sans ses lignes ni ses dépenses.
 *
 * Le retour en service reste en un geste (cadrage du 7 septembre 2026) : un
 * service clos aujourd'hui sur un véhicule immobilisé propose « Remettre en
 * service ». « Planifier » ouvre un service neuf, tâches du plan déjà remplies
 * pour une échéance, comme sur la page Maintenance.
 * ==========================================================================*/

const OPERATIONNELS = new Set<StatutVehicule>(["en-service", "en-backup"]);

type Proprietes = { ordres: LigneOrdre[]; travaux: LigneTravail[]; signalements: LigneSignalement[]; statuts: Record<string, StatutVehicule>; aujourdhui: string };

export function EcranTelephoneAtelier(props: Proprietes) {
  return (
    <FournisseurEdition sujet="maintenance" href="/telephone/atelier">
      <Interieur {...props} />
    </FournisseurEdition>
  );
}

function Interieur({ ordres, travaux, signalements, statuts, aujourdhui }: Proprietes) {
  const router = useRouter();
  const { surcharger, version, actualiser, ouvrirService } = useEdition();
  const [acces, setAcces] = useState<AccesCourant | null>(null);
  const [monte, setMonte] = useState(false);
  const [remis, setRemis] = useState<Set<string>>(() => new Set());
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    setMonte(true);
    setAcces(lireAccesCourant());
  }, []);

  const tous = useMemo(() => {
    const crees = monte ? lireCreations("maintenance").filter((c) => c.type === "ordre").map(fabriquerLigneOrdre).filter((o): o is LigneOrdre => o !== null) : [];
    return [...crees, ...ordres.filter((o) => !crees.some((c) => c.numero === o.numero))].map((o) => surcharger(o));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordres, surcharger, version, monte]);

  const enAtelier = tous.filter((o) => o.statut === "en-atelier").sort((a, b) => (a.dateDebut ?? a.datePrevue).localeCompare(b.dateDebut ?? b.datePrevue));
  const planifies = tous.filter((o) => o.statut === "planifie").sort((a, b) => a.datePrevue.localeCompare(b.datePrevue));
  const closAujourdhui = tous.filter((o) => o.statut === "clos" && o.dateCloture === aujourdhui);
  const aPlanifier = travaux.filter((t) => (t.urgence === "en-retard" || t.urgence === "a-planifier") && !tous.some((o) => estOuvert(o.statut) && o.vehiculeId === t.vehiculeId && (t.origineNumero ? o.origineNumero === t.origineNumero : o.objet === t.objet)));
  const agit = acces ? acces.niveaux.maintenance === "saisie" || acces.niveaux.maintenance === "gestion" : false;
  const aRemettre = (o: LigneOrdre) => !remis.has(o.vehiculeId) && !OPERATIONNELS.has(statuts[o.vehiculeId] ?? "en-service");

  /* Ouvrir le service : le formulaire du bureau, pannes du véhicule proposées. */
  function ouvrir(o: LigneOrdre) {
    ouvrirService({ service: o, signalements, services: tous });
  }

  /* Planifier depuis la fosse : un service neuf ; une échéance amène les autres échéances dues du véhicule, tâches en ligne. */
  function planifier(t: LigneTravail) {
    const dues = t.nature === "echeance" && t.operationCode ? aPlanifier.filter((x) => x.nature === "echeance" && x.vehiculeId === t.vehiculeId && x.operationCode) : [];
    const liste = dues.length ? [t, ...dues.filter((x) => x.cle !== t.cle)] : [t];
    ouvrirService({
      signalements,
      services: tous,
      propose: {
        type: t.type,
        objet: liste.length > 1 ? `Entretien préventif — ${liste.map((x) => x.objet.toLowerCase()).join(", ")}` : t.objet,
        origineNumero: t.origineNumero,
        priorite: liste.some((x) => x.urgence === "en-retard") ? "urgent" : "planifie",
        vehiculeImmatriculation: t.immatriculation,
        operations: dues.length ? liste.map((x) => x.operationCode!) : undefined,
      },
    });
  }

  /* Entrer au garage : le service passe en atelier, le véhicule en réparation. */
  function demarrer(o: LigneOrdre) {
    const r = enregistrerModification({
      numero: o.numero,
      type: "ordre",
      titre: `Service ${o.numero} · ${o.objet}`,
      href: `/maintenance?vue=ordres&ref=${o.numero}`,
      champs: CHAMPS.ordre,
      avant: o as unknown as Record<string, unknown>,
      apres: { ...(o as unknown as Record<string, unknown>), statut: "en-atelier", dateDebut: aujourdhui },
      motif: "Véhicule entré au garage, depuis l'atelier",
    });
    if (r.issue === "en-attente") {
      setErreur("Le mois est clos : l'entrée au garage attend une approbation.");
      return;
    }
    if (OPERATIONNELS.has(statuts[o.vehiculeId] ?? "en-service")) {
      enregistrerCreation({ sujet: `vehicule:${o.immatriculation}`, type: "statut", champs: champsCreation("statut", { pour: "vehicule" }), valeurs: { statut: "en-reparation", motif: o.type === "preventif" ? "maintenance-preventive" : "maintenance-corrective", debut: aujourdhui, commentaire: `Service ${o.numero}` }, motif: "Entrée au garage depuis l'atelier" });
    }
    actualiser();
    router.refresh();
  }

  /* Le retour en service, en un geste, une fois le service clos. */
  function remettreEnService(o: LigneOrdre) {
    enregistrerCreation({ sujet: `vehicule:${o.immatriculation}`, type: "statut", champs: champsCreation("statut", { pour: "vehicule" }), valeurs: { statut: "en-service", motif: null, debut: aujourdhui, commentaire: `Retour d'atelier — service ${o.numero}${o.interventionNumero ? `, intervention ${o.interventionNumero}` : ""}` }, motif: "Retour en service depuis l'atelier" });
    setRemis((r) => new Set(r).add(o.vehiculeId));
    actualiser();
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3 px-3 pb-24 pt-1">
      <EnTeteTelephone titre="Atelier" retour="/telephone" />
      {!agit && acces ? <p className="meta -mt-2 px-4">Lecture seule : les services relèvent de la maintenance.</p> : null}
      {erreur ? <p className="rounded-[8px] bg-defavorable-fond px-3 py-2 text-[12.5px] text-defavorable">{erreur}</p> : null}

      <div className="grid grid-cols-3 gap-2">
        <Chiffre valeur={enAtelier.length} libelle="en atelier" />
        <Chiffre valeur={planifies.length} libelle="planifiés" />
        <Chiffre valeur={aPlanifier.length} libelle="à planifier" alerte={aPlanifier.some((t) => t.urgence === "en-retard")} />
      </div>

      <Bloc titre="En atelier" accent={enAtelier.length > 0}>
        {enAtelier.length === 0 ? <p className="meta py-1">Aucun véhicule au garage.</p> : null}
        {enAtelier.map((o) => (
          <button key={o.numero} type="button" onClick={() => ouvrir(o)} className="block w-full text-left">
            <Ligne icone={<Wrench className="size-4" strokeWidth={2} />} ton="vigilance" titre={`${o.immatriculationAffichee} · ${o.objet}`} precision={`${o.garage} · entré le ${formaterDate(o.dateDebut ?? o.datePrevue)}${o.montantEstime !== null ? ` · ${formaterMontant(o.montantEstime)} estimés` : ""}`} valeur={agit ? "Clôturer" : "Voir"} />
          </button>
        ))}
      </Bloc>

      {agit ? (
        /* Les pièces, depuis la fosse : sortir pour le véhicule qu'on répare,
           recevoir une livraison (décisions du 9 septembre 2026). */
        <div className="grid grid-cols-2 gap-2">
          <Link href="/telephone/pieces?geste=sortie" className="bouton-secondaire h-11 justify-center rounded-[12px] text-[13px]">
            <ArrowUpFromLine className="size-4 text-texte-2" strokeWidth={2} />
            Sortir une pièce
          </Link>
          <Link href="/telephone/pieces?geste=entree" className="bouton-secondaire h-11 justify-center rounded-[12px] text-[13px]">
            <ArrowDownToLine className="size-4 text-texte-2" strokeWidth={2} />
            Recevoir
          </Link>
        </div>
      ) : null}

      <Bloc titre="Planifiés">
        {planifies.length === 0 ? <p className="meta py-1">Aucun rendez-vous pris.</p> : null}
        {planifies.map((o) => (
          <div key={o.numero} className="flex items-center gap-2 border-t border-bordure py-2 first:border-t-0">
            <button type="button" onClick={() => ouvrir(o)} className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[13px] font-semibold text-texte">
                {o.immatriculationAffichee} · {o.objet}
              </span>
              <span className="block truncate text-[11.5px] text-attenue">
                {o.garage} · prévu le {formaterDate(o.datePrevue)}
                {o.datePrevue < aujourdhui ? " · en retard" : ""}
              </span>
            </button>
            {agit ? (
              <button type="button" onClick={() => demarrer(o)} className="bouton-secondaire h-8 shrink-0 px-2.5 text-[12px]">
                <Play className="size-3.5" strokeWidth={2} />
                Entrer
              </button>
            ) : null}
          </div>
        ))}
      </Bloc>

      <Bloc titre="À planifier">
        {aPlanifier.length === 0 ? <p className="meta py-1">Rien en attente de rendez-vous.</p> : null}
        {aPlanifier.slice(0, 8).map((t) =>
          agit ? (
            <button key={t.cle} type="button" onClick={() => planifier(t)} className="block w-full text-left">
              <Ligne icone={t.type === "preventif" ? "P" : "C"} ton={t.urgence === "en-retard" ? "defavorable" : "vigilance"} titre={`${t.immatriculationAffichee} · ${t.objet}`} precision={t.echeance} valeur="Planifier" />
            </button>
          ) : (
            <Ligne key={t.cle} icone={t.type === "preventif" ? "P" : "C"} ton={t.urgence === "en-retard" ? "defavorable" : "vigilance"} titre={`${t.immatriculationAffichee} · ${t.objet}`} precision={t.echeance} href="/maintenance" />
          ),
        )}
        {aPlanifier.length > 8 ? (
          <Link href="/maintenance" className="mt-1.5 inline-block text-[12.5px] font-semibold text-accent-fonce">
            Les {aPlanifier.length} au bureau
          </Link>
        ) : null}
      </Bloc>

      {closAujourdhui.length > 0 ? (
        <Bloc titre="Clos aujourd'hui">
          {closAujourdhui.map((o) => (
            <div key={o.numero}>
              <Ligne icone={<Check className="size-4" strokeWidth={2.2} />} titre={`${o.immatriculationAffichee} · ${o.objet}`} precision={`${o.garage}${o.interventionNumero ? ` · ${o.interventionNumero}` : ""}`} href={`/flotte/${o.vehiculeId}?onglet=entretien`} />
              {agit && aRemettre(o) ? (
                <button type="button" onClick={() => remettreEnService(o)} className="bouton-principal mb-2 h-10 w-full justify-center rounded-[12px] text-[13px]">
                  <Check className="size-4" strokeWidth={2.2} />
                  Remettre {o.immatriculationAffichee} en service
                </button>
              ) : null}
            </div>
          ))}
        </Bloc>
      ) : null}

    </div>
  );
}
