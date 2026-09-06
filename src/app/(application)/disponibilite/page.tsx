import { EcranDisponibilite } from "@/composants/disponibilite/EcranDisponibilite";
import { conducteurDuJour, etatDisponibilite, type LigneDisponibilite } from "@/domaine/disponibilite";
import { titrePage } from "@/domaine/marque";
import { DATE_REFERENCE, listeChauffeurs } from "@/donnees/chauffeurs-demo";
import { fichePourImmatriculation } from "@/donnees/fiche-demo";
import { parametresServeur } from "@/lib/parametres-serveur";
import { FLOTTE } from "@/donnees/parc-demo";

export const metadata = { title: titrePage("Disponibilité du jour") };

/**
 * La disponibilité du jour se déduit des fiches : statut effectif (documents
 * compris), affectations en cours, situation des chauffeurs. Rien n'est saisi
 * ici — c'est la lecture du matin, et le numérateur de D_TDPA.
 */
export default async function PageDisponibilite() {
  const parametres = await parametresServeur();
  const chauffeurs = new Map(listeChauffeurs().map((c) => [c.id, c]));
  const lignes: LigneDisponibilite[] = FLOTTE.map((l) => {
    const f = fichePourImmatriculation(l.vehicule.immatriculation, parametres);
    const v = l.vehicule;
    const immobilisation = f?.immobilisationAdministrative ?? null;
    const statutEffectif = immobilisation?.statut ?? v.statut;
    const conducteur = conducteurDuJour(f?.affectations ?? [], chauffeurs, DATE_REFERENCE);
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
      statutEffectif,
      immobilisation,
      engage: v.engage,
      chargeUtile: f?.identite.chargeUtile ?? null,
      conducteur,
    };
    const { etat, motif } = etatDisponibilite(base);
    return { ...base, etat, motif };
  });
  return <EcranDisponibilite lignes={lignes} aujourdhui={DATE_REFERENCE} />;
}
