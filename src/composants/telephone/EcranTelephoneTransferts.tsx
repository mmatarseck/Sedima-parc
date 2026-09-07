"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, PenLine } from "lucide-react";
import type { AccesCourant } from "@/domaine/acces";
import { libellePartie, statutTransfert, type Transfert } from "@/domaine/transferts";
import { lireAccesCourant } from "@/lib/acces-courant";
import { lireAcces } from "@/lib/acces-demo";
import { authentificationReelle } from "@/lib/session-demo";
import { lireTransferts } from "@/lib/transferts-demo";
import { Bloc, EnTeteTelephone, Ligne } from "./Telephone";

/* ============================================================================
 * Téléphone › Fiches de transfert : ce qui attend une signature, puis les
 * fiches complètes. La fiche s'ouvre en une colonne, signature comprise.
 * ==========================================================================*/

function heure(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")} à ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Les fiches d'un détenteur en démonstration : celles où il remet ou reçoit ; base branchée, les politiques font le tri. */
export function mesTransferts(liste: Transfert[], acces: AccesCourant): Transfert[] {
  if (acces.profil !== "detenteur" || authentificationReelle()) return liste;
  const fiche = lireAcces().find((a) => a.profil === "detenteur" && (a.chauffeurId || a.attributaireId));
  if (!fiche) return [];
  const moi = (p: Transfert["remettant"]) => (p.genre === "chauffeur" && p.id === fiche.chauffeurId) || (p.genre === "attributaire" && p.id === fiche.attributaireId);
  return liste.filter((t) => moi(t.remettant) || moi(t.recipiendaire));
}

export function EcranTelephoneTransferts({ initial }: { initial: Transfert[] }) {
  const [liste, setListe] = useState<Transfert[]>(initial);
  const [acces, setAcces] = useState<AccesCourant | null>(null);
  useEffect(() => {
    setListe(lireTransferts(initial));
    setAcces(lireAccesCourant());
  }, [initial]);

  const detenteur = acces?.profil === "detenteur";
  const miennes = useMemo(() => (acces ? mesTransferts(liste, acces) : []), [liste, acces]);
  const aSigner = miennes.filter((t) => { const s = statutTransfert(t); return s !== "complete" && s !== "annulee"; }).sort((a, b) => b.date.localeCompare(a.date));
  const completes = miennes.filter((t) => statutTransfert(t) === "complete").sort((a, b) => b.date.localeCompare(a.date));
  const cree = acces !== null && !detenteur && (acces.niveaux.transferts === "saisie" || acces.niveaux.transferts === "gestion");

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3 px-3 pb-24 pt-1">
      <EnTeteTelephone titre={detenteur ? "Mes transferts" : "Fiches de transfert"} retour="/telephone" />
      {cree ? (
        <Link href="/transferts/nouveau" className="carte flex items-center gap-2.5 px-3 py-2.5 text-[13px] font-semibold text-accent-fonce hover:bg-surface-2">
          <PenLine className="size-4" strokeWidth={2} />
          Dresser une fiche de transfert
        </Link>
      ) : null}

      <Bloc titre="À signer" accent={aSigner.length > 0}>
        {aSigner.length === 0 ? <p className="meta py-1">Aucune fiche n&apos;attend de signature.</p> : null}
        {aSigner.map((t) => (
          <Ligne key={t.id} icone={<PenLine className="size-4" strokeWidth={2} />} ton="vigilance" titre={`${t.vehicule.immatriculation} · ${t.motif}`} precision={`${libellePartie(t.remettant)} → ${libellePartie(t.recipiendaire)} · ${heure(t.date)}${t.signatureRemettant ? " · signée par le remettant" : t.signatureRecipiendaire ? " · signée par le récipiendaire" : ""}`} href={`/transferts/${t.id}`} valeur="›" />
        ))}
      </Bloc>

      <Bloc titre="Complètes">
        {completes.length === 0 ? <p className="meta py-1">Aucune fiche complète.</p> : null}
        {completes.slice(0, 12).map((t) => (
          <Ligne key={t.id} icone={<Check className="size-4" strokeWidth={2.2} />} titre={`${t.vehicule.immatriculation} · ${t.motif}`} precision={`${libellePartie(t.remettant)} → ${libellePartie(t.recipiendaire)} · ${heure(t.date)}${t.reserves.length ? ` · ${t.reserves.length} réserve${t.reserves.length > 1 ? "s" : ""}` : ""}`} href={`/transferts/${t.id}`} />
        ))}
      </Bloc>
    </div>
  );
}
