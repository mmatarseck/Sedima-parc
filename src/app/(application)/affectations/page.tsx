import { EcranAffectations } from "@/composants/affectations/EcranAffectations";
import type { VehiculePlanning } from "@/domaine/affectations";
import { titrePage } from "@/domaine/marque";
import { jourCourant } from "@/domaine/temps";
import { lignesChauffeurs } from "@/donnees/chauffeurs";
import { lignesFlotte, parcServeur } from "@/donnees/flotte";
import { affectationsDepuisLeParc } from "@/donnees/rapports";
import { transporteursServeur } from "@/donnees/transporteurs";
import { parametresServeur } from "@/lib/parametres-serveur";

export const metadata = { title: titrePage("Affectations") };

/* Rendu à la demande : cette page lit la base avec la session des cookies. */
export const dynamic = "force-dynamic";

/**
 * Planning des affectations. Les affectations viennent des fiches véhicules —
 * une seule source — et les chauffeurs de leur liste ; l'écran, côté client,
 * y ajoute ce qui a été créé dans l'application.
 *
 * **Les camions des transporteurs y figurent aussi** (demande du métier du
 * 5 septembre 2026), avec leur chauffeur habituel comme attelage courant. Ce
 * n'est pas une affectation au sens du parc — personne ne l'a décidée, elle est
 * constatée — et l'écran le dit : la barre est en pointillé, elle ne s'ouvre
 * pas, et une vraie affectation peut être programmée par-dessus.
 *
 * TOUT VIENT DE LA BASE DEPUIS LE 15 SEPTEMBRE 2026. La page lisait encore
 * quatre jeux de démonstration — le parc, les fiches, les chauffeurs, la flotte
 * tierce. On y programmait donc des affectations sur des camions et des
 * conducteurs qui n'existent pas, et l'écriture les refusait ensuite faute de
 * retrouver l'identifiant. Le planning montrait un parc, la Flotte en montrait
 * un autre.
 *
 * LES AFFECTATIONS DE TOUT LE PARC EN UNE LECTURE. Dresser la fiche complète de
 * chaque véhicule pour n'en tirer que ses périodes coûterait cent soixante-sept
 * assemblages ; `affectationsDepuisLeParc()` les tire du parc déjà lu, à la
 * forme que la fiche donne — c'est ce que font déjà les rapports.
 */
export default async function PageAffectations() {
  const parametres = await parametresServeur();
  const [flotte, parc, chauffeurs, tiers] = await Promise.all([lignesFlotte(parametres), parcServeur(), lignesChauffeurs(), transporteursServeur()]);
  const affectationsPar = affectationsDepuisLeParc(parc);

  const vehicules: VehiculePlanning[] = flotte.map((l) => {
    const v = l.vehicule;
    return {
      id: v.id,
      immatriculation: v.immatriculation,
      immatriculationAffichee: v.immatriculationAffichee,
      marque: v.marque,
      appellation: v.appellation,
      categorie: v.categorie,
      /* Le statut de la ligne, et rien d'autre : depuis le 15 septembre 2026,
         un document échu avertit sans imposer d'état — c'est l'équipe parc qui
         sait si le camion roule. */
      statut: v.statut,
      engage: v.engage,
      site: l.site?.libelle ?? null,
      siteId: v.siteId,
      regime: v.regime ?? "exploitation",
      affectations: (affectationsPar.get(v.immatriculation) ?? []).map((a) => ({ numero: a.numero, chauffeurId: a.chauffeurId, chauffeur: a.chauffeur, role: a.role, debut: a.debut, fin: a.fin, motif: a.motif })),
      tiers: null,
    };
  });

  /* Les camions des transporteurs, dans le même planning. Leur « affectation »
     est l'attelage habituel du référentiel : un camion tiers change peu de
     conducteur, et c'est ce couple-là que l'exploitation appelle. Elle porte un
     numéro préfixé qui n'est pas celui d'une transaction — parce que ce n'en
     est pas une. */
  const noms = new Map(tiers.prestataires.map((p) => [p.numero, p.raisonSociale]));
  const depuis = (() => {
    const d = new Date(`${jourCourant()}T00:00:00Z`);
    d.setUTCFullYear(d.getUTCFullYear() - 1);
    return d.toISOString().slice(0, 10);
  })();

  const camions: VehiculePlanning[] = tiers.camions.map((c) => {
    const habituel = c.chauffeurHabituelId ? (tiers.chauffeurs.find((x) => x.id === c.chauffeurHabituelId) ?? null) : null;
    return {
      id: `tiers:${c.immatriculation}`,
      immatriculation: c.immatriculation,
      immatriculationAffichee: c.immatriculationAffichee,
      marque: noms.get(c.transporteurNumero) ?? "Transporteur",
      appellation: c.capaciteTonnes !== null ? `${c.capaciteTonnes} t` : "",
      categorie: c.categorie,
      /* Un camion tiers n'a ni carte grise à notre nom ni immobilisation à notre
         charge : son seul état connu est « il roule pour nous, ou non ». */
      statut: c.actif ? "en-service" : "hors-service",
      engage: false,
      site: null,
      siteId: null,
      regime: "exploitation",
      affectations: habituel
        ? [{ numero: `HAB-${c.immatriculation}`, chauffeurId: habituel.id, chauffeur: habituel.nom, role: "titulaire", debut: depuis, fin: null, motif: "Chauffeur habituel du transporteur" }]
        : [],
      tiers: { transporteurNumero: c.transporteurNumero, transporteur: noms.get(c.transporteurNumero) ?? c.transporteurNumero },
    };
  });

  return (
    <EcranAffectations
      vehicules={[...vehicules, ...camions]}
      chauffeurs={chauffeurs}
      chauffeursTiers={tiers.chauffeurs.map((c) => ({ id: c.id, nom: c.nom, transporteur: noms.get(c.transporteurNumero) ?? c.transporteurNumero }))}
      aujourdhui={jourCourant()}
    />
  );
}
