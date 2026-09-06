import { EcranAffectations } from "@/composants/affectations/EcranAffectations";
import type { VehiculePlanning } from "@/domaine/affectations";
import { titrePage } from "@/domaine/marque";
import { DATE_REFERENCE, listeChauffeurs } from "@/donnees/chauffeurs-demo";
import { fichePourImmatriculation } from "@/donnees/fiche-demo";
import { parametresServeur } from "@/lib/parametres-serveur";
import { FLOTTE } from "@/donnees/parc-demo";
import { camionsTiers, chauffeursTiers } from "@/donnees/flotte-tierce-demo";
import { listePrestataires } from "@/donnees/prestataires-demo";

export const metadata = { title: titrePage("Affectations") };

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
 */
export default async function PageAffectations() {
  const parametres = await parametresServeur();
  const vehicules: VehiculePlanning[] = FLOTTE.map((l) => {
    const f = fichePourImmatriculation(l.vehicule.immatriculation, parametres);
    const v = l.vehicule;
    return {
      id: v.id,
      immatriculation: v.immatriculation,
      immatriculationAffichee: v.immatriculationAffichee,
      marque: v.marque,
      appellation: v.appellation,
      categorie: v.categorie,
      statut: f?.immobilisationAdministrative?.statut ?? v.statut,
      engage: v.engage,
      site: l.site?.libelle ?? null,
      siteId: v.siteId,
      affectations: (f?.affectations ?? []).map((a) => ({ numero: a.numero, chauffeurId: a.chauffeurId, chauffeur: a.chauffeur, role: a.role, debut: a.debut, fin: a.fin, motif: a.motif })),
      tiers: null,
    };
  });

  /* Les camions des transporteurs, dans le même planning. Leur « affectation »
     est l'attelage habituel du référentiel : un camion tiers change peu de
     conducteur, et c'est ce couple-là que l'exploitation appelle. Elle porte un
     numéro préfixé qui n'est pas celui d'une transaction — parce que ce n'en
     est pas une. */
  const chauffeurs = chauffeursTiers();
  const noms = new Map(listePrestataires().map((p) => [p.numero, p.raisonSociale]));
  const depuis = (() => {
    const d = new Date(`${DATE_REFERENCE}T00:00:00Z`);
    d.setUTCFullYear(d.getUTCFullYear() - 1);
    return d.toISOString().slice(0, 10);
  })();

  const tiers: VehiculePlanning[] = camionsTiers().map((c) => {
    const habituel = c.chauffeurHabituelId ? (chauffeurs.find((x) => x.id === c.chauffeurHabituelId) ?? null) : null;
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
      affectations: habituel
        ? [{ numero: `HAB-${c.immatriculation}`, chauffeurId: habituel.id, chauffeur: habituel.nom, role: "titulaire", debut: depuis, fin: null, motif: "Chauffeur habituel du transporteur" }]
        : [],
      tiers: { transporteurNumero: c.transporteurNumero, transporteur: noms.get(c.transporteurNumero) ?? c.transporteurNumero },
    };
  });

  return (
    <EcranAffectations
      vehicules={[...vehicules, ...tiers]}
      chauffeurs={listeChauffeurs()}
      chauffeursTiers={chauffeurs.map((c) => ({ id: c.id, nom: c.nom, transporteur: noms.get(c.transporteurNumero) ?? c.transporteurNumero }))}
      aujourdhui={DATE_REFERENCE}
    />
  );
}
