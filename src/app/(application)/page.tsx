import { EcranTableauBord } from "@/composants/tableau/EcranTableauBord";
import { titrePage } from "@/domaine/marque";
import { situationsServeur } from "@/donnees/situations";
import { donneesTableauServeur } from "@/donnees/tableau-bord";
import { DATE_REFERENCE } from "@/donnees/tableau-bord-demo";
import { parametresServeur } from "@/lib/parametres-serveur";
import { authentificationReelle } from "@/lib/session-demo";

export const metadata = { title: titrePage("Tableau de bord") };

/**
 * Tableau de bord SQDCM — l'écran d'entrée de l'application, conforme à la
 * maquette « Parc SEDIMA » de la Direction des Opérations.
 *
 * Les faits se calculent une fois côté serveur, à la maille véhicule × mois ;
 * l'écran filtre, cumule et affiche. Rien ne s'y saisit.
 */
export default async function PageTableauBord() {
  /* Les pastilles lisent l'état du moment : les situations journalières des
     quatre dernières semaines (décision du métier du 8 septembre 2026), et
     leurs seuils viennent des paramètres. Base branchée, les situations
     viennent de `situation_journaliere()` (0010), les courbes et la
     troisième rangée de `lire_tableau()` (0024) — jusqu'à aujourd'hui, pas
     jusqu'à la date de référence de la démonstration. */
  const aujourdhui = authentificationReelle() ? new Date().toISOString().slice(0, 10) : DATE_REFERENCE;
  const parametres = await parametresServeur();
  /* Base branchée, les courbes viennent de lire_tableau() (0024), agrégées par le domaine ; en démonstration, du jeu. */
  const [d, situations] = await Promise.all([donneesTableauServeur(parametres), situationsServeur(aujourdhui)]);
  /* `d.semaine` et `d.flotteSemaine` ne sont plus passés : le tableau de bord
     n'a plus de sélecteur de période depuis le 10 septembre 2026. Le lecteur
     continue de les produire — ils ne coûtent aucune requête de plus, et le
     banc `tester-tableau.mts` les éprouve encore, base contre démonstration.
     Ils sont donc là, vérifiés, à un accessoire près si une vue hebdomadaire
     revient un jour. */
  return <EcranTableauBord mois={d.mois} vehicules={d.vehicules} faits={d.faits} flotte={d.flotte} jour={d.jour} alertes={d.alertes} aujourdhui={aujourdhui} situations={situations} seuils={parametres.pastilles.seuils} />;
}
