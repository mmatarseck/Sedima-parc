/* ============================================================================
 * Ce qu'écrit la clôture d'un service de maintenance.
 *
 * Rien de nouveau pour le reste de l'application : l'atelier, les coûts, le
 * budget et les rapports lisent déjà des interventions et des dépenses. La
 * clôture les écrit, et le service garde son numéro :
 *
 *   * **une intervention** — le travail : le prestataire, le compteur, les
 *     jours d'immobilisation, et le coût du service ;
 *   * **une dépense par part de ligne** — main-d'œuvre, pièces achetées (leur
 *     part du TTC), pièces du magasin (origine « stock », que le budget ne
 *     recompte pas) — avec la facture jointe ;
 *   * **une sortie de stock** par pièce prise au magasin, au prix de référence ;
 *   * enfin le service passe « clos » — et la base résout ses signalements.
 *
 * Toutes portent la même clé de facture dans leur référence : l'atelier du
 * véhicule les lit en une ligne (`domaine/atelier`).
 *
 * Pur : le banc le lit sans navigateur ; l'écran applique ce qu'il rend.
 * ==========================================================================*/

import { calculerService, depensesDuService } from "./service";
import { factureDe, type LigneOrdre } from "./maintenance";

export interface EcritureCloture {
  type: "intervention" | "depense" | "mouvement";
  sujet: string;
  valeurs: Record<string, unknown>;
}

function joursEntre(debut: string | null, fin: string): number | null {
  if (!debut) return null;
  return Math.max(1, Math.round((Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`)) / 86_400_000) + 1);
}

/**
 * Les écritures de la clôture, dans l'ordre : l'intervention, les dépenses, les
 * sorties de stock. \`vehiculeUuid\` est l'identifiant de table du véhicule (la
 * sortie de stock le cite) ; \`cle\` la clé de facture qui les rassemble.
 */
export function ecrituresDeCloture(o: LigneOrdre, jour: string, cle: string, vehiculeUuid: string | null): EcritureCloture[] {
  const facture = factureDe(o);
  const totaux = calculerService(facture);
  const sujet = `vehicule:${o.immatriculation}`;
  const date = o.dateFin ?? jour;
  const reference = [o.numero, o.numeroFacture, o.numeroBc ? `BC ${o.numeroBc}` : null, cle].filter(Boolean).join(" · ");
  /* Le règlement du service (0063) donne l'origine de ses dépenses ; réglé par la caisse, c'est le service que la sortie cite, pas chaque dépense. */
  const origineFacture = o.modeReglement ?? "caisse";
  const pieceBc = o.modeReglement === "bon-de-commande" ? ((o.piecesReglement ?? [])[0] ?? null) : null;
  const piece = (o.pieces ?? [])[0] ?? null;

  const ecritures: EcritureCloture[] = [
    {
      type: "intervention",
      sujet,
      valeurs: {
        date,
        type: o.type,
        objet: o.objet,
        garage: o.garage,
        km: o.kilometrage ?? null,
        immobilisationJours: joursEntre(o.dateDebut ?? o.datePrevue, date) ?? o.immobilisationPrevueJours,
        montant: facture.lignes.length ? totaux.coutTotal : (o.montantEstime ?? 0),
        reference,
      },
    },
  ];
  for (const d of depensesDuService(facture, o.type)) {
    ecritures.push({
      type: "depense",
      sujet,
      valeurs: {
        date,
        poste: d.poste,
        libelle: d.libelle,
        montant: d.montant,
        beneficiaire: d.origine === "stock" ? "Magasin SEDIMA" : o.garage,
        reference,
        origine: d.origine === "stock" ? "stock" : origineFacture,
        ...(d.origine !== "stock" && o.numeroBc ? { numeroBc: o.numeroBc, fichierBc: pieceBc } : {}),
        justificatif: Boolean(piece) || d.origine === "stock",
        photo: d.origine === "stock" ? null : piece,
        km: null,
      },
    });
  }
  for (const l of facture.lignes) {
    for (const p of l.piecesStock) {
      if (!(p.quantite > 0)) continue;
      ecritures.push({
        type: "mouvement",
        sujet: "pieces",
        valeurs: {
          date,
          nature: "sortie",
          pieceNumero: p.pieceNumero,
          quantite: p.quantite,
          prixUnitaire: p.prixUnitaire,
          vehiculeId: vehiculeUuid,
          ordreNumero: o.numero,
          motif: `${o.numero} · ${l.libelle}`,
        },
      });
    }
  }
  return ecritures;
}
