import { EcranDisponibilite } from "@/composants/disponibilite/EcranDisponibilite";
import { conducteurDuJour, etatDisponibilite, type LigneDisponibilite } from "@/domaine/disponibilite";
import type { ImmobilisationAdministrative } from "@/domaine/documents";
import { titrePage } from "@/domaine/marque";
import { jourCourant } from "@/domaine/temps";
import { lignesChauffeurs } from "@/donnees/chauffeurs";
import { lignesFlotte, parcServeur } from "@/donnees/flotte";
import { affectationsDepuisLeParc } from "@/donnees/rapports";
import { parametresServeur } from "@/lib/parametres-serveur";

export const metadata = { title: titrePage("Disponibilité du jour") };

/* Rendu à la demande : cette page lit la base avec la session des cookies. */
export const dynamic = "force-dynamic";

/**
 * La disponibilité du jour se déduit de la flotte : statut, affectations en
 * cours, situation des chauffeurs. Rien n'est saisi ici — c'est la lecture du
 * matin, et le numérateur de D_TDPA.
 *
 * TOUT VIENT DE LA BASE DEPUIS LE 15 SEPTEMBRE 2026. La page lisait trois jeux
 * de démonstration — le parc, les fiches, les chauffeurs. Elle annonçait donc
 * chaque matin la disponibilité d'un parc qui n'est pas celui-ci, sur des
 * chauffeurs qui n'y travaillent pas. Les affectations de tout le parc se
 * tirent du parc déjà lu, comme le font les rapports, plutôt que d'assembler
 * cent soixante-sept fiches complètes pour n'en garder que les périodes.
 */
export default async function PageDisponibilite() {
  const parametres = await parametresServeur();
  const [flotte, parc, listeConducteurs] = await Promise.all([lignesFlotte(parametres), parcServeur(), lignesChauffeurs()]);
  const chauffeurs = new Map(listeConducteurs.map((c) => [c.id, c]));
  const affectationsPar = affectationsDepuisLeParc(parc);
  const aujourdhui = jourCourant();

  const lignes: LigneDisponibilite[] = flotte.map((l) => {
    const v = l.vehicule;
    /*
     * Les documents critiques en cause, quand il y en a. Ils n'imposent plus
     * l'état du véhicule depuis le 15 septembre 2026 — c'est l'équipe parc qui
     * sait si le camion roule, pas un échéancier —, mais ils restent la raison
     * qu'on affiche et le bouton « Régulariser » qui mène à sa conformité.
     * Le statut effectif est donc le statut saisi, et rien d'autre.
     */
    const enCause = l.immobilisationAdministrative ?? [];
    const immobilisation: ImmobilisationAdministrative | null = enCause.length > 0 ? { statut: "hors-service", motif: "administratif", documents: enCause } : null;
    const conducteur = conducteurDuJour(affectationsPar.get(v.immatriculation) ?? [], chauffeurs, aujourdhui);
    const base = {
      vehiculeId: v.id,
      immatriculation: v.immatriculation,
      immatriculationAffichee: v.immatriculationAffichee,
      marque: v.marque,
      appellation: v.appellation,
      categorie: v.categorie,
      categorieFlotte: v.categorieFlotte,
      businessUnit: v.businessUnit,
      usage: v.usage,
      transportSpecial: v.transportSpecial,
      site: l.site?.libelle ?? null,
      statutSaisi: v.statut,
      statutEffectif: v.statut,
      immobilisation,
      engage: v.engage,
      chargeUtile: v.chargeUtile,
      conducteur,
    };
    const { etat, motif } = etatDisponibilite(base);
    return { ...base, etat, motif };
  });
  return <EcranDisponibilite lignes={lignes} aujourdhui={aujourdhui} />;
}
