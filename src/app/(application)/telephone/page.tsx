import { EcranTelephoneAccueil, type CompteursAtelier } from "@/composants/telephone/EcranTelephoneAccueil";
import { titrePage } from "@/domaine/marque";
import { jourCourant } from "@/domaine/temps";
import { demandesServeur } from "@/donnees/demandes";
import { lignesFlotte } from "@/donnees/flotte";
import { transfertsServeur } from "@/donnees/transferts";
import { travauxServeur } from "@/donnees/maintenance";
import { ordresServeur } from "@/donnees/ordres";
import { estOuvert } from "@/domaine/maintenance";
import { parametresServeur } from "@/lib/parametres-serveur";

export const metadata = { title: titrePage("Téléphone") };

/**
 * L'accueil du téléphone : le périmètre de la personne, ce qu'il y a à faire,
 * les gestes. Les lignes sont celles de la Flotte ; l'écran les borne au
 * périmètre de la fiche d'accès, comme les politiques le font en base.
 */
export default async function PageTelephone() {
  const [parametres, demandes, transferts] = await Promise.all([parametresServeur(), demandesServeur(), transfertsServeur()]);
  const maintenant = new Date().toISOString();
  /* L'atelier compte sur le jeu de démonstration tant que les ordres n'ont pas leur table. */
  const ordres = await ordresServeur();
  const atelier: CompteursAtelier = {
    enAtelier: ordres.filter((o) => o.statut === "en-atelier").length,
    planifies: ordres.filter((o) => o.statut === "planifie").length,
    aPlanifier: (await travauxServeur(parametres)).filter((t) => (t.urgence === "en-retard" || t.urgence === "a-planifier") && !ordres.some((o) => estOuvert(o.statut) && o.vehiculeId === t.vehiculeId)).length,
  };
  return <EcranTelephoneAccueil lignes={await lignesFlotte(parametres)} aujourdhui={jourCourant()} demandes={demandes} transferts={transferts} atelier={atelier} maintenant={maintenant} />;
}
