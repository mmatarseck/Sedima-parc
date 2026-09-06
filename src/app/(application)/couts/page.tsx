import { redirect } from "next/navigation";

/**
 * « Coûts & analyses » est devenu **Rapports** (décision du métier du
 * 4 septembre 2026). L'adresse survit à la décision : les liens déjà donnés,
 * les favoris du navigateur et les notifications émises avant le changement
 * mènent au catalogue plutôt qu'à une page morte.
 *
 * Ce que l'écran portait s'y retrouve : le coût au kilomètre avec son verdict
 * (« Coût par véhicule »), les postes par mois, la consommation, la comparaison
 * par catégorie et par business unit. Ses graphiques de synthèse, eux,
 * rejoignent le tableau de bord — c'est lui qui donne le coup d'œil.
 */
export default function PageCouts() {
  redirect("/rapports");
}
