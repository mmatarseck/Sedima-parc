/* ============================================================================
 * L'index de la recherche globale — chargé à la première frappe, pas avec la
 * mise en page (revue de performance du 8 septembre 2026) : il embarque la
 * flotte, les chauffeurs et le catalogue des références de la démonstration,
 * que la barre d'application n'a aucune raison de faire télécharger à chaque
 * page. Au branchement de la base, il deviendra une route serveur.
 * ==========================================================================*/

import { listeChauffeurs } from "@/donnees/chauffeurs-demo";
import { FLOTTE } from "@/donnees/parc-demo";
import { catalogueReferences } from "@/composants/transactions/ChampReference";
import { fabriquerLigneFlotte } from "@/composants/transactions/fabriques";
import { lireToutesCreations } from "@/lib/clotures-demo";
import { STATUT_CHAUFFEUR } from "@/domaine/chauffeur";
import { BUSINESS_UNIT, STATUT_VEHICULE } from "@/domaine/libelles";
import type { LigneFlotte } from "@/domaine/types";

export interface Resultat {
  cle: string;
  categorie: "Transactions" | "Véhicules" | "Chauffeurs";
  titre: string;
  precision: string;
  href: string;
}

const LIMITE_PAR_CATEGORIE = 5;

function normaliserNumero(texte: string): string {
  return texte.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function chercher(terme: string): Resultat[] {
  const t = terme.trim().toLowerCase();
  if (t.length < 2) return [];

  /* Les véhicules créés dans le navigateur passent devant : on vient de les
     saisir, c'est souvent eux que l'on cherche. */
  const crees: LigneFlotte[] = lireToutesCreations("vehicule").map(fabriquerLigneFlotte);
  const vehicules: Resultat[] = [...crees, ...FLOTTE].filter((l) =>
    [l.vehicule.immatriculation, l.vehicule.immatriculationAffichee, l.vehicule.vin ?? "", l.vehicule.marque, l.vehicule.appellation]
      .join(" ")
      .toLowerCase()
      .includes(t),
  )
    .slice(0, LIMITE_PAR_CATEGORIE)
    .map((l) => ({
      cle: `v-${l.vehicule.id}`,
      categorie: "Véhicules" as const,
      titre: `${l.vehicule.immatriculationAffichee} · ${l.vehicule.marque} ${l.vehicule.appellation}`,
      precision: [
        STATUT_VEHICULE[l.vehicule.statut].libelle,
        l.vehicule.businessUnit ? BUSINESS_UNIT[l.vehicule.businessUnit] : null,
        l.site?.libelle ?? null,
      ]
        .filter(Boolean)
        .join(" · "),
      href: `/flotte/${l.vehicule.immatriculation}`,
    }));

  const chauffeurs: Resultat[] = listeChauffeurs()
    .filter((c) => [c.nomComplet, c.chauffeur.matriculeRh ?? "", c.chauffeur.telephone ?? ""].join(" ").toLowerCase().includes(t))
    .slice(0, LIMITE_PAR_CATEGORIE)
    .map((c) => ({
      cle: `c-${c.id}`,
      categorie: "Chauffeurs" as const,
      titre: c.nomComplet,
      precision: [
        STATUT_CHAUFFEUR[c.statut].libelle,
        c.vehiculeTitulaire ? `titulaire de ${c.vehiculeTitulaire.immatriculationAffichee}` : c.suppleances.length ? `suppléant de ${c.suppleances[0]!.immatriculationAffichee}` : null,
        c.site?.libelle ?? null,
      ]
        .filter(Boolean)
        .join(" · "),
      href: `/chauffeurs/${c.id}`,
    }));

  /* Les numéros de référence : « DEP-2026-15012 », ou n'importe quel bout du
     numéro. C'est ce que l'équipe parc cite dans une demande d'achat, et ce
     qu'on retrouve d'abord. Le catalogue réunit l'index du serveur et les
     créations du navigateur — le même que celui des champs « transaction
     d'origine », pour qu'un numéro proposé là se retrouve ici. */
  const numero = normaliserNumero(terme);
  const transactions: Resultat[] =
    numero.length < 3
      ? []
      : catalogueReferences()
          .filter((e) => normaliserNumero(e.numero).includes(numero))
          .slice(0, LIMITE_PAR_CATEGORIE + 1)
          .map((e) => ({
            cle: `t-${e.numero}`,
            categorie: "Transactions" as const,
            titre: `${e.numero} · ${e.titre}`,
            precision: e.precision,
            href: e.href,
          }))
          /* Une création faite hors d'une fiche véhicule n'a pas d'adresse :
             la proposer mènerait nulle part. */
          .filter((r) => r.href !== "");

  return [...transactions, ...vehicules, ...chauffeurs];
}
