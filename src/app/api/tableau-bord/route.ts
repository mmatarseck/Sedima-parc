import { NextResponse } from "next/server";
import { situationsServeur } from "@/donnees/situations";
import { donneesTableauServeur } from "@/donnees/tableau-bord";
import { DATE_REFERENCE } from "@/donnees/tableau-bord-demo";
import { compteServeur } from "@/lib/compte-serveur";
import { parametresServeur } from "@/lib/parametres-serveur";
import { authentificationReelle } from "@/lib/session-demo";

/**
 * Le calcul du tableau de bord, rendu une fois et gardé par le navigateur.
 *
 * C'est le travail que la page faisait à chaque ouverture — deux ans de faits,
 * vingt-huit jours de situations —, déplacé ici pour ne se faire qu'à la
 * connexion ou sur demande (11 septembre 2026). La réponse porte le compte et
 * l'instant du calcul : ce qui permet ensuite de dire s'il est dépassé.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const aujourdhui = authentificationReelle() ? new Date().toISOString().slice(0, 10) : DATE_REFERENCE;
  const compte = await compteServeur();
  /* Le garde de l'application laisse passer /api : sans compte, rien à calculer. */
  if (compte === "anonyme") return NextResponse.json({ erreur: "non connecté" }, { status: 401 });
  const parametres = await parametresServeur();
  const [d, situations] = await Promise.all([donneesTableauServeur(parametres), situationsServeur(aujourdhui)]);
  /* `d.semaine` et `d.flotteSemaine` ne sont pas rendus : le tableau de bord n'a plus de sélecteur de période
     depuis le 10 septembre 2026. Le lecteur les produit encore — sans requête de plus —, et `tester-tableau.mts` les éprouve. */
  return NextResponse.json({
    compte,
    calculeLe: new Date().toISOString(),
    aujourdhui,
    donnees: { mois: d.mois, vehicules: d.vehicules, faits: d.faits, flotte: d.flotte, jour: d.jour, alertes: d.alertes, aujourdhui, situations, seuils: parametres.pastilles.seuils },
  });
}
