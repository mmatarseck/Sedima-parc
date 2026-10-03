/* ============================================================================
 * Les voyages d'une période, les grilles et les rattachements — de quoi bâtir
 * la grille de la semaine et la facturation calculée (3 octobre 2026).
 * ==========================================================================*/

import { afficher } from "@/domaine/immatriculation";
import type { Rattachement, TarifZone, VoyageReleve } from "@/domaine/volumes-transport";
import { clientServeur } from "@/lib/supabase";
import { lignesLues } from "./lecture";

interface LigneVoyageBase {
  numero: string;
  date: string;
  mode: string;
  chauffeur: string | null;
  origine: string;
  destination: string;
  tonnage: number | string;
  immatriculation_libre: string | null;
  prestataire: { numero: string; raison_sociale: string } | null;
  vehicule: { immatriculation: string; categorie: string; usage: string | null; charge_utile: number | null } | null;
  camion_tiers: { immatriculation: string; categorie: string; capacite_tonnes: number | string | null; type_contrat: string | null } | null;
}

const TYPES: Record<string, string> = { tracteur: "plateau", "semi-remorque": "plateau", camionnette: "pick-up", "vehicule-leger": "véhicule léger", camion: "camion", engin: "engin", bus: "bus" };

function voyageDepuis(l: LigneVoyageBase): VoyageReleve {
  const parc = l.mode === "parc";
  const plaque = l.vehicule?.immatriculation ?? l.camion_tiers?.immatriculation ?? l.immatriculation_libre ?? "—";
  const capacite = parc ? (l.vehicule?.charge_utile ? Math.round(l.vehicule.charge_utile / 100) / 10 : null) : l.camion_tiers?.capacite_tonnes != null ? Number(l.camion_tiers.capacite_tonnes) : null;
  const categorie = l.vehicule?.categorie ?? l.camion_tiers?.categorie ?? "camion";
  const contrat = l.camion_tiers?.type_contrat;
  return {
    numero: l.numero,
    date: l.date,
    transporteurNumero: parc ? null : (l.prestataire?.numero ?? null),
    transporteur: parc ? "SEDIMA" : (l.prestataire?.raison_sociale ?? "Transporteur"),
    plaque,
    plaqueAffichee: plaque === "—" ? "—" : afficher(plaque),
    camionConnu: parc || Boolean(l.camion_tiers),
    type: l.vehicule?.usage === "vrac" ? "vrac" : (TYPES[categorie] ?? "camion"),
    capaciteTonnes: capacite,
    typeContrat: parc ? "parc" : contrat === "mise-a-disposition" || contrat === "forfait" ? contrat : "voyage",
    chauffeur: l.chauffeur,
    origine: l.origine,
    destination: l.destination,
    tonnage: Number(l.tonnage),
  };
}

export interface DonneesVolumes {
  voyages: VoyageReleve[];
  tarifs: TarifZone[];
  rattachements: Rattachement[];
}

export async function volumesServeur(du: string, au: string): Promise<DonneesVolumes> {
  const client = await clientServeur();
  const [voyages, tarifs, rattachements] = await Promise.all([
    client
      .from("releve_transport")
      .select("numero, date, mode, chauffeur, origine, destination, tonnage, immatriculation_libre, prestataire (numero, raison_sociale), vehicule (immatriculation, categorie, usage, charge_utile), camion_tiers (immatriculation, categorie, capacite_tonnes, type_contrat)")
      .gte("date", du)
      .lte("date", au)
      .order("date")
      .limit(10000)
      .returns<LigneVoyageBase[]>(),
    client
      .from("ligne_tarif")
      .select("origine, destination, unite, prix, minimum, debut, fin, prestataire (numero)")
      .limit(5000)
      .returns<{ origine: string; destination: string; unite: TarifZone["unite"]; prix: number; minimum: number | null; debut: string; fin: string | null; prestataire: { numero: string } | null }[]>(),
    client.from("rattachement_localite").select("localite, destination, motif").limit(5000).returns<Rattachement[]>(),
  ]);
  return {
    voyages: lignesLues("Relevé de transport", voyages).map(voyageDepuis),
    tarifs: lignesLues("Grilles tarifaires", tarifs).map((t) => ({ transporteurNumero: t.prestataire?.numero ?? "", origine: t.origine, destination: t.destination, unite: t.unite, prix: Number(t.prix), minimum: t.minimum === null ? null : Number(t.minimum), debut: t.debut, fin: t.fin })),
    rattachements: lignesLues("Rattachements des localités", rattachements),
  };
}
