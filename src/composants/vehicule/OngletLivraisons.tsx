"use client";

/* ============================================================================
 * Livraisons — les bons de livraison que le véhicule a portés.
 *
 * Demande du métier (11 septembre 2026) : « préparer les données de livraison
 * et associer aux différents véhicules ». Les bons viennent de Sage X3, par la
 * plaque (0044). Le mois dit combien de bons, de jours et de tonnes ; la liste
 * dit à qui. Un bon en sacs ou en unités n'a pas de poids : il se compte à
 * part, et un mois sans bon pesé n'affiche pas « 0 t ».
 * ==========================================================================*/

import { Carte, TableauSimple } from "@/composants/interface/Carte";
import type { FicheVehicule } from "@/domaine/fiche";
import { livraisonsParMois, quantitesLisibles, resumeLivraisons, type LivraisonFiche, type MoisLivraisons } from "@/domaine/livraisons";
import { date, nombre } from "@/lib/format";

const MOIS = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const libelleMois = (m: string) => MOIS.format(new Date(`${m}-01T12:00:00`));
const tonnes = (kg: number | null) => (kg === null ? "—" : `${nombre(kg / 1000, 1)} t`);
const tiret = <span className="text-attenue-2">—</span>;

export function OngletLivraisons({ fiche, cible }: { fiche: FicheVehicule; cible?: string }) {
  const bons = fiche.livraisons;
  if (bons.length === 0) {
    return (
      <Carte titre="Livraisons" precision="Les bons de livraison Sage X3 qui portent la plaque de ce véhicule">
        <p className="meta">
          Aucun bon de livraison ne porte cette plaque. Les extractions chargées couvrent l&apos;UAB de novembre 2025 à août 2026 (sauf du 9 juillet au 2 août), la minoterie et l&apos;abattoir de janvier au 8 juillet 2026.
        </p>
      </Carte>
    );
  }
  const r = resumeLivraisons(bons);
  const mois = livraisonsParMois(bons);
  return (
    <div className="flex flex-col gap-5">
      <Carte
        titre="Livraisons par mois"
        precision={`${nombre(r.bons)} bons du ${date(r.premier)} au ${date(r.dernier)} · ${tonnes(r.poidsKg)}${r.bonsSansPoids > 0 ? ` · ${nombre(r.bonsSansPoids)} sans poids (sacs ou unités)` : ""} · ${nombre(r.clients)} clients`}
        sansMarge
      >
        <TableauSimple<MoisLivraisons>
          reglages="fiche-vehicule.livraisons-mois"
          cle={(m) => m.mois}
          lignes={mois}
          filtrable={false}
          colonnes={[
            { cle: "mois", libelle: "Mois", rendu: (m) => <span className="font-medium first-letter:uppercase">{libelleMois(m.mois)}</span> },
            { cle: "bons", libelle: "Bons", alignee: "droite", rendu: (m) => nombre(m.bons) },
            { cle: "jours", libelle: "Jours de livraison", alignee: "droite", rendu: (m) => nombre(m.jours) },
            { cle: "poids", libelle: "Tonnage", alignee: "droite", rendu: (m) => (m.poidsKg === null ? tiret : <span className="font-medium">{tonnes(m.poidsKg)}</span>) },
            { cle: "sans-poids", libelle: "Bons sans poids", alignee: "droite", rendu: (m) => (m.bonsSansPoids > 0 ? nombre(m.bonsSansPoids) : tiret) },
            { cle: "clients", libelle: "Clients", alignee: "droite", rendu: (m) => nombre(m.clients) },
          ]}
        />
      </Carte>
      <Carte titre="Bons de livraison" precision="Du plus récent au plus ancien — la plaque et le chauffeur sont ceux que Sage X3 écrit sur le bon" sansMarge>
        <TableauSimple<LivraisonFiche>
          reglages="fiche-vehicule.livraisons"
          cle={(b) => b.numero}
          lignes={bons}
          fixe
          numero={(b) => b.numero}
          cible={cible}
          colonnes={[
            { cle: "numero", libelle: "Bon", largeur: "150px", rendu: (b) => <span className="code whitespace-nowrap">{b.numero}</span> },
            { cle: "date", libelle: "Date", largeur: "110px", rendu: (b) => <span className="code whitespace-nowrap">{date(b.date)}</span> },
            { cle: "site", libelle: "Site", largeur: "130px", rendu: (b) => <span className="block truncate">{b.site}</span> },
            { cle: "client", libelle: "Client", rendu: (b) => <span className="block truncate font-medium">{b.client ?? "—"}</span> },
            { cle: "produits", libelle: "Produits", parDefaut: false, rendu: (b) => <span className="block truncate text-texte-2">{b.produits ?? "—"}</span> },
            { cle: "chauffeur", libelle: "Chauffeur", largeur: "170px", rendu: (b) => <span className="block truncate">{b.chauffeur ?? "—"}</span> },
            { cle: "quantites", libelle: "Quantités", alignee: "droite", largeur: "180px", parDefaut: false, rendu: (b) => <span className="whitespace-nowrap text-texte-2">{quantitesLisibles(b.quantites, (n) => nombre(n))}</span> },
            { cle: "poids", libelle: "Poids", alignee: "droite", largeur: "100px", rendu: (b) => (b.poidsKg === null ? tiret : tonnes(b.poidsKg)) },
            { cle: "source", libelle: "Source", largeur: "150px", parDefaut: false, rendu: (b) => <span className="text-texte-2">{b.source}</span> },
          ]}
        />
      </Carte>
    </div>
  );
}
