"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, Play, Wrench, X } from "lucide-react";
import { CHAMPS, champsCreation } from "@/composants/transactions/champs";
import { FournisseurEdition, useEdition } from "@/composants/transactions/ContexteEdition";
import { fabriquerLigneOrdre } from "@/composants/transactions/fabriques";
import type { AccesCourant } from "@/domaine/acces";
import { STATUT_ORDRE, estOuvert, type LigneOrdre, type LigneTravail } from "@/domaine/maintenance";
import type { StatutVehicule } from "@/domaine/types";
import { lireAccesCourant } from "@/lib/acces-courant";
import { enregistrerCreation, enregistrerModification, lireCreations } from "@/lib/clotures-demo";
import { date as formaterDate, montant as formaterMontant, nombre } from "@/lib/format";
import { Bloc, Chiffre, EnTeteTelephone, Ligne } from "./Telephone";

/* ============================================================================
 * Téléphone › Atelier — pour la maintenance, depuis la fosse : les ordres en
 * atelier à clôturer, les ordres planifiés à faire entrer, ce qui reste à
 * planifier. Clôturer crée l'intervention sur la fiche du véhicule, referme
 * l'ordre et, d'un même geste, remet le véhicule en service (cadrage du
 * 7 septembre 2026 : « clôture d'une intervention depuis la fosse, retour en
 * service en un geste »). Les mêmes transactions que le bureau.
 * ==========================================================================*/

const OPERATIONNELS = new Set<StatutVehicule>(["en-service", "en-backup"]);

export function EcranTelephoneAtelier({ ordres, travaux, statuts, aujourdhui }: { ordres: LigneOrdre[]; travaux: LigneTravail[]; statuts: Record<string, StatutVehicule>; aujourdhui: string }) {
  return (
    <FournisseurEdition sujet="maintenance" href="/telephone/atelier">
      <Interieur ordres={ordres} travaux={travaux} statuts={statuts} aujourdhui={aujourdhui} />
    </FournisseurEdition>
  );
}

function Interieur({ ordres, travaux, statuts, aujourdhui }: { ordres: LigneOrdre[]; travaux: LigneTravail[]; statuts: Record<string, StatutVehicule>; aujourdhui: string }) {
  const router = useRouter();
  const { surcharger, version, actualiser } = useEdition();
  const [acces, setAcces] = useState<AccesCourant | null>(null);
  const [monte, setMonte] = useState(false);
  const [aCloturer, setACloturer] = useState<LigneOrdre | null>(null);
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

  /* Entrer au garage : l'ordre passe en atelier, le véhicule en réparation. */
  function demarrer(o: LigneOrdre) {
    const r = enregistrerModification({
      numero: o.numero,
      type: "ordre",
      titre: `Ordre de travail ${o.numero} · ${o.objet}`,
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
      enregistrerCreation({ sujet: `vehicule:${o.immatriculation}`, type: "statut", champs: champsCreation("statut", { pour: "vehicule" }), valeurs: { statut: "en-reparation", motif: o.type === "preventif" ? "maintenance-preventive" : "maintenance-corrective", debut: aujourdhui, commentaire: `Ordre de travail ${o.numero}` }, motif: "Entrée au garage depuis l'atelier" });
    }
    actualiser();
    router.refresh();
  }

  /* Clôturer : l'intervention sur la fiche, l'ordre refermé, le retour en service. */
  function cloturer(o: LigneOrdre, saisie: { montant: number; km: number | null; commentaire: string | null; remettreEnService: boolean }): string | null {
    const immobilisation = o.dateDebut ? Math.max(1, joursEntre(o.dateDebut, aujourdhui) + 1) : (o.immobilisationPrevueJours ?? 1);
    const creation = enregistrerCreation({
      sujet: `vehicule:${o.vehiculeId}`,
      type: "intervention",
      champs: champsCreation("intervention", { pour: "vehicule" }),
      valeurs: { date: aujourdhui, type: o.type, objet: o.objet, garage: o.garage, km: saisie.km, immobilisationJours: immobilisation, montant: saisie.montant, reference: saisie.commentaire },
      motif: `Clôture de l'ordre ${o.numero} depuis l'atelier`,
    });
    if (creation.issue === "mois-clos") return `Le mois ${creation.mois} est clos.`;
    if (creation.issue !== "creee") return "L'intervention n'a pas pu être enregistrée.";
    enregistrerModification({
      numero: o.numero,
      type: "ordre",
      titre: `Ordre de travail ${o.numero} · ${o.objet}`,
      href: `/maintenance?vue=ordres&ref=${o.numero}`,
      champs: CHAMPS.ordre,
      avant: o as unknown as Record<string, unknown>,
      apres: { ...(o as unknown as Record<string, unknown>), statut: "clos", dateCloture: aujourdhui, interventionNumero: creation.creation.numero },
      motif: `Clos par l'intervention ${creation.creation.numero}, depuis l'atelier`,
    });
    if (saisie.remettreEnService) {
      enregistrerCreation({ sujet: `vehicule:${o.immatriculation}`, type: "statut", champs: champsCreation("statut", { pour: "vehicule" }), valeurs: { statut: "en-service", motif: null, debut: aujourdhui, commentaire: `Retour d'atelier — intervention ${creation.creation.numero}` }, motif: "Retour en service depuis l'atelier" });
    }
    actualiser();
    router.refresh();
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3 px-3 pb-24 pt-1">
      <EnTeteTelephone titre="Atelier" retour="/telephone" />
      {!agit && acces ? <p className="meta -mt-2 px-4">Lecture seule : la clôture relève de la maintenance.</p> : null}
      {erreur ? <p className="rounded-[8px] bg-defavorable-fond px-3 py-2 text-[12.5px] text-defavorable">{erreur}</p> : null}

      <div className="grid grid-cols-3 gap-2">
        <Chiffre valeur={enAtelier.length} libelle="en atelier" />
        <Chiffre valeur={planifies.length} libelle="planifiés" />
        <Chiffre valeur={aPlanifier.length} libelle="à planifier" alerte={aPlanifier.some((t) => t.urgence === "en-retard")} />
      </div>

      <Bloc titre="En atelier" accent={enAtelier.length > 0}>
        {enAtelier.length === 0 ? <p className="meta py-1">Aucun véhicule au garage.</p> : null}
        {enAtelier.map((o) => (
          <button key={o.numero} type="button" onClick={() => (agit ? setACloturer(o) : undefined)} disabled={!agit} className="block w-full text-left">
            <Ligne icone={<Wrench className="size-4" strokeWidth={2} />} ton="vigilance" titre={`${o.immatriculationAffichee} · ${o.objet}`} precision={`${o.garage} · entré le ${formaterDate(o.dateDebut ?? o.datePrevue)}${o.montantEstime !== null ? ` · ${formaterMontant(o.montantEstime)} estimés` : ""}`} valeur={agit ? "Clôturer" : undefined} />
          </button>
        ))}
      </Bloc>

      <Bloc titre="Planifiés">
        {planifies.length === 0 ? <p className="meta py-1">Aucun rendez-vous pris.</p> : null}
        {planifies.map((o) => (
          <div key={o.numero} className="flex items-center gap-2 border-t border-bordure py-2 first:border-t-0">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-texte">
                {o.immatriculationAffichee} · {o.objet}
              </span>
              <span className="block truncate text-[11.5px] text-attenue">
                {o.garage} · prévu le {formaterDate(o.datePrevue)}
                {o.datePrevue < aujourdhui ? " · en retard" : ""}
              </span>
            </span>
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
        {aPlanifier.slice(0, 6).map((t) => (
          <Ligne key={t.cle} icone={t.type === "preventif" ? "P" : "C"} ton={t.urgence === "en-retard" ? "defavorable" : "vigilance"} titre={`${t.immatriculationAffichee} · ${t.objet}`} precision={t.echeance} href="/maintenance" />
        ))}
        {aPlanifier.length > 0 ? (
          <Link href="/maintenance" className="mt-1.5 inline-block text-[12.5px] font-semibold text-accent-fonce">
            Planifier au bureau
          </Link>
        ) : null}
      </Bloc>

      {closAujourdhui.length > 0 ? (
        <Bloc titre="Clos aujourd'hui">
          {closAujourdhui.map((o) => (
            <Ligne key={o.numero} icone={<Check className="size-4" strokeWidth={2.2} />} titre={`${o.immatriculationAffichee} · ${o.objet}`} precision={`${o.garage}${o.interventionNumero ? ` · ${o.interventionNumero}` : ""}`} href={`/flotte/${o.vehiculeId}?onglet=entretien`} />
          ))}
        </Bloc>
      ) : null}

      {aCloturer ? (
        <PanneauCloture
          ordre={aCloturer}
          aujourdhui={aujourdhui}
          immobilise={!OPERATIONNELS.has(statuts[aCloturer.vehiculeId] ?? "en-service")}
          onFermer={() => setACloturer(null)}
          onCloturer={(saisie) => {
            const refus = cloturer(aCloturer, saisie);
            if (!refus) setACloturer(null);
            return refus;
          }}
        />
      ) : null}
    </div>
  );
}

function PanneauCloture({ ordre, aujourdhui, immobilise, onFermer, onCloturer }: { ordre: LigneOrdre; aujourdhui: string; immobilise: boolean; onFermer: () => void; onCloturer: (saisie: { montant: number; km: number | null; commentaire: string | null; remettreEnService: boolean }) => string | null }) {
  const [montant, setMontant] = useState(ordre.montantEstime === null ? "" : String(ordre.montantEstime));
  const [km, setKm] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [remettre, setRemettre] = useState(immobilise);
  const [erreur, setErreur] = useState<string | null>(null);
  const m = Number(montant.replace(/\s/g, ""));
  const k = km.trim() === "" ? null : Number(km.replace(/\s/g, ""));
  const valide = Number.isFinite(m) && m >= 0 && (k === null || (Number.isFinite(k) && k >= 0));
  const champ = "h-11 w-full rounded-[12px] border border-bordure-champ bg-surface px-3.5 text-[15px] text-texte outline-none focus:border-accent";
  const jours = ordre.dateDebut ? Math.max(1, joursEntre(ordre.dateDebut, aujourdhui) + 1) : (ordre.immobilisationPrevueJours ?? 1);

  return (
    <>
      <button type="button" aria-label="Fermer" onClick={onFermer} className="fixed inset-0 z-30 cursor-default bg-encre/40" />
      <div role="dialog" aria-modal="true" aria-labelledby="cloture-titre" className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-h-[92vh] w-full max-w-[520px] flex-col rounded-t-[18px] bg-surface shadow-flottante">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <h2 id="cloture-titre" className="min-w-0 flex-1 text-[17px] font-bold text-texte">
            Clôturer {ordre.numero}
          </h2>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="grid size-9 place-items-center rounded-full text-texte-2 hover:bg-surface-3">
            <X className="size-5" strokeWidth={2} />
          </button>
        </div>
        <div className="defilement-discret flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
          <p className="text-[13px] leading-[1.5] text-texte-2">
            <span className="code font-semibold text-texte">{ordre.immatriculationAffichee}</span> · {ordre.vehicule}
            <br />
            {ordre.objet} · {ordre.garage} · {jours} jour{jours > 1 ? "s" : ""} d&apos;immobilisation
          </p>
          <label className="block">
            <span className="label-champ mb-1.5 block">Montant de l&apos;intervention</span>
            <span className="flex items-center gap-2">
              <input type="text" inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value)} className={`${champ} text-right tabular-nums`} autoFocus />
              <span className="meta w-6">F</span>
            </span>
          </label>
          <label className="block">
            <span className="label-champ mb-1.5 block">Compteur relevé (facultatif)</span>
            <span className="flex items-center gap-2">
              <input type="text" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} placeholder={nombre(0)} className={`${champ} text-right tabular-nums`} />
              <span className="meta w-6">km</span>
            </span>
          </label>
          <label className="block">
            <span className="label-champ mb-1.5 block">Pièce ou remarque (facultatif)</span>
            <input type="text" value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="Facture n°…, pièces changées" className={champ} />
          </label>
          <label className={`flex items-center gap-3 rounded-[12px] border px-3.5 py-3 ${remettre ? "border-accent-bordure bg-accent-fond" : "border-bordure bg-surface-2"}`}>
            <input type="checkbox" checked={remettre} onChange={(e) => setRemettre(e.target.checked)} className="size-5 accent-accent" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-texte">Remettre en service</span>
              <span className="meta block">{immobilise ? "Le véhicule est immobilisé : le statut repasse « en service » à la clôture." : "Le véhicule roule déjà : rien à changer."}</span>
            </span>
          </label>
          {erreur ? <p className="text-[12.5px] text-defavorable">{erreur}</p> : null}
        </div>
        <div className="border-t border-bordure px-4 py-3">
          <button
            type="button"
            onClick={() => {
              if (!valide) return;
              const refus = onCloturer({ montant: Math.round(m), km: k === null ? null : Math.round(k), commentaire: commentaire.trim() || null, remettreEnService: remettre });
              if (refus) setErreur(refus);
            }}
            disabled={!valide}
            className="bouton-principal h-11 w-full justify-center rounded-[12px] text-[14px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check className="size-4" strokeWidth={2.2} />
            {remettre ? "Clôturer et remettre en service" : "Clôturer"}
          </button>
          <p className="meta mt-2 text-center">{STATUT_ORDRE.clos} : l&apos;intervention s&apos;inscrit sur la fiche du véhicule.</p>
        </div>
      </div>
    </>
  );
}

function joursEntre(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);
}
