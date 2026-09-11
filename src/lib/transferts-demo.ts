/* ============================================================================
 * Les fiches de transfert, côté navigateur.
 *
 * En démonstration, la liste vit dans le stockage du navigateur, à partir
 * des fiches livrées ; une fiche complète ouvre l'affectation du
 * récipiendaire par la même transaction que le planning, et le détenteur
 * est prévenu par la cloche d'une fiche à signer. Base branchée, l'écriture
 * part vers le serveur (`transferts-actions.ts`), qui répond par un motif
 * de refus s'il y en a un.
 * ==========================================================================*/

import { champsCreation } from "@/composants/transactions/champs";
import { normaliser } from "@/domaine/immatriculation";
import { affectationSuivante, normaliserTransfert, statutTransfert, type Signature, type Transfert } from "@/domaine/transferts";
import { transfertsDemo } from "@/donnees/transferts-demo";
import { enregistrerCreation } from "@/lib/clotures-demo";
import { ajouterNotification } from "@/lib/notifications-demo";
import { authentificationReelle } from "@/lib/session-demo";
import { annulerTransfert, enregistrerTransfert, signerTransfert } from "@/lib/transferts-actions";

const CLE = "sedima.parc.transferts";

export function lireTransferts(initial: Transfert[]): Transfert[] {
  if (authentificationReelle()) return initial;
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return transfertsDemo().map((t) => ({ ...t }));
    return (JSON.parse(brut) as unknown[]).map(normaliserTransfert).filter((t): t is Transfert => t !== null);
  } catch {
    return transfertsDemo().map((t) => ({ ...t }));
  }
}

function ecrireListe(liste: Transfert[]): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(liste));
  } catch {
    /* sans stockage, la valeur ne vaut que pour la page courante */
  }
}

/* Une fiche complète ouvre l'affectation qui suit, par la transaction du planning. */
function appliquerEnDemo(t: Transfert): Transfert {
  if (statutTransfert(t) !== "complete" || t.appliquee) return t;
  const a = affectationSuivante(t);
  if (a) {
    enregistrerCreation({
      sujet: `vehicule:${normaliser(t.vehicule.immatriculation)}`,
      type: "affectation",
      champs: champsCreation("affectation", { pour: "vehicule" }),
      valeurs: { chauffeurId: a.chauffeurId, role: "titulaire", debut: a.debut, fin: null, motif: a.motif },
      motif: `Fiche de transfert ${t.numero}`,
    });
  }
  return { ...t, appliquee: true };
}

/** Crée une fiche. Nul quand c'est fait ; sinon le motif du refus. */
export async function creerTransfert(t: Transfert, courantes: Transfert[]): Promise<string | null> {
  if (authentificationReelle()) return enregistrerTransfert(t);
  const fiche = appliquerEnDemo(t);
  ecrireListe([fiche, ...courantes]);
  if (statutTransfert(fiche) !== "complete") {
    ajouterNotification("detenteur", {
      id: `transfert-${fiche.id}`,
      date: fiche.creeLe,
      auteur: fiche.creePar,
      initiales: fiche.creePar.split(/\s+/).map((m) => m[0] ?? "").join("").slice(0, 2).toUpperCase() || "SP",
      sujetLibelle: `Fiche de transfert · ${fiche.vehicule.immatriculation}`,
      extrait: `${fiche.motif} — à signer sur votre téléphone.`,
      href: `/transferts/${fiche.id}`,
    });
  }
  return null;
}

/** Pose une signature. Nul quand c'est fait ; sinon le motif du refus. */
export async function signer(id: string, partie: "remettant" | "recipiendaire", signature: Signature, courantes: Transfert[]): Promise<string | null> {
  if (authentificationReelle()) return signerTransfert(id, partie, signature);
  ecrireListe(courantes.map((t) => (t.id === id ? appliquerEnDemo({ ...t, [partie === "remettant" ? "signatureRemettant" : "signatureRecipiendaire"]: signature }) : t)));
  return null;
}

export async function annuler(id: string, courantes: Transfert[]): Promise<string | null> {
  if (authentificationReelle()) return annulerTransfert(id);
  ecrireListe(courantes.map((t) => (t.id === id ? { ...t, annuleeLe: new Date().toISOString() } : t)));
  return null;
}
