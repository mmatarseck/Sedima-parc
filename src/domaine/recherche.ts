/* ============================================================================
 * Ce que la recherche globale rend — d'où qu'il vienne.
 *
 * Un résultat est une ligne à ouvrir : ce qu'elle est, ce qui la situe, et
 * l'adresse qui y mène. La catégorie range les résultats à l'écran ; elle
 * n'est pas un type de données — une demande d'achat et un bon de commande
 * Sage X3 sont tous deux « Achats & caisse ».
 * ==========================================================================*/

export type CategorieRecherche = "Transactions" | "Achats & caisse" | "Transporteurs" | "Prestataires" | "Pièces & pneus" | "Budget" | "Véhicules" | "Chauffeurs";

export const CATEGORIES_RECHERCHE: CategorieRecherche[] = ["Transactions", "Achats & caisse", "Transporteurs", "Prestataires", "Pièces & pneus", "Budget", "Véhicules", "Chauffeurs"];

export interface ResultatRecherche {
  cle: string;
  categorie: CategorieRecherche;
  titre: string;
  precision: string;
  href: string;
}
