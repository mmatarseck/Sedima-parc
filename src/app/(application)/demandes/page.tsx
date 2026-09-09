import { EcranDemandes, type CibleDemande } from "@/composants/demandes/EcranDemandes";
import { titrePage } from "@/domaine/marque";
import { DATE_REFERENCE } from "@/donnees/chauffeurs-demo";
import { demandesServeur } from "@/donnees/demandes";
import { lignesFlotte } from "@/donnees/flotte";
import { parcLegerServeur } from "@/donnees/parc-leger";
import { sites } from "@/donnees/referentiels";
import { parametresServeur } from "@/lib/parametres-serveur";
import { authentificationReelle } from "@/lib/session-demo";

export const metadata = { title: titrePage("Demandes") };

/**
 * Les demandes poussées aux détenteurs. Les cibles possibles — un véhicule
 * engagé et son détenteur, titulaire ou attributaire — viennent de la liste
 * Flotte, déjà bornée au périmètre de la personne quand la base est branchée.
 */
export default async function PageDemandes() {
  const [parametres, listeSites, demandes] = await Promise.all([parametresServeur(), sites(), demandesServeur()]);
  const [lignes, parcLeger] = await Promise.all([lignesFlotte(parametres), parcLegerServeur(parametres)]);
  const parNom = new Map(parcLeger.attributaires.map((a) => [a.nom, a.id]));
  const cibles: CibleDemande[] = lignes.flatMap((l) => {
    const v = l.vehicule;
    if (!v.engage || v.statut === "a-recevoir") return [];
    const detenteur = l.chauffeurTitulaire ? { genre: "chauffeur" as const, id: l.chauffeurTitulaire.id, nom: l.chauffeurTitulaire.nom } : l.attributaire && !l.attributaire.pool ? { genre: "attributaire" as const, id: parNom.get(l.attributaire.nom) ?? l.attributaire.nom, nom: l.attributaire.nom } : null;
    if (!detenteur) return [];
    return [{ vehiculeId: v.id, immatriculation: v.immatriculationAffichee, libelle: `${v.marque} ${v.appellation}`, siteId: v.siteId, siteLibelle: l.site?.libelle ?? null, detenteur }];
  });
  /* Le moment : l'horloge quand la base est branchée, la date de référence du jeu de démonstration sinon. */
  const maintenant = authentificationReelle() ? new Date().toISOString() : `${DATE_REFERENCE}T12:00:00.000Z`;
  return <EcranDemandes initial={demandes} cibles={cibles} sites={listeSites.map((s) => ({ id: s.id, libelle: s.libelle }))} maintenant={maintenant} />;
}
