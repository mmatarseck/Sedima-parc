"use client";

/* ============================================================================
 * Livraisons — les bons de livraison que le véhicule a portés, et ceux qu'on
 * saisit ici.
 *
 * Les bons viennent de Sage X3, par la plaque (0044). Métier, 22 septembre
 * 2026 : « possibilité de rajouter des livraisons, les éditer, avec les heures
 * de début et de fin en optionnel, et d'autres informations qualitatives » —
 * une livraison saisie (0064) se crée, se modifie et se supprime d'ici ; un
 * bon de Sage X3 se lit. Le résumé par mois a quitté l'onglet pour le rapport
 * « Livraisons ».
 * ==========================================================================*/

import { Plus } from "lucide-react";
import { Carte, TableauSimple } from "@/composants/interface/Carte";
import { CHAMPS } from "@/composants/transactions/champs";
import { useEdition } from "@/composants/transactions/ContexteEdition";
import type { Creation } from "@/domaine/cloture";
import type { FicheVehicule } from "@/domaine/fiche";
import { dureeLivraison, quantitesLisibles, resumeLivraisons, type LivraisonFiche } from "@/domaine/livraisons";
import { jourCourant } from "@/domaine/temps";
import { date, nombre } from "@/lib/format";

const tonnes = (kg: number | null) => (kg === null ? "—" : `${nombre(kg / 1000, 1)} t`);
const tiret = <span className="text-attenue-2">—</span>;

/** Une livraison créée dans le navigateur, avant que la base la confirme. */
function fabriquerLivraison(c: Creation): LivraisonFiche {
  const v = c.valeurs;
  const t = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);
  const poids = Number(String(v.poidsKg ?? "").replace(/\s/g, "").replace(",", "."));
  return { numero: c.numero, date: String(v.date ?? c.date.slice(0, 10)), site: String(v.site ?? ""), client: t(v.client), produits: t(v.produits), poidsKg: Number.isFinite(poids) && String(v.poidsKg ?? "") !== "" ? poids : null, quantites: {}, lignes: 1, transporteur: null, chauffeur: t(v.chauffeur), source: "saisie", heureDebut: t(v.heureDebut), heureFin: t(v.heureFin), observations: t(v.observations), saisie: true };
}

export function OngletLivraisons({ fiche, cible }: { fiche: FicheVehicule; cible?: string }) {
  const { creer, demander, creations, surcharger } = useEdition();
  const creees = creations("livraison", fabriquerLivraison);
  const vus = new Set<string>();
  const bons = [...creees, ...fiche.livraisons.map(surcharger)].filter((b) => (vus.has(b.numero) ? false : (vus.add(b.numero), true))).sort((a, b) => b.date.localeCompare(a.date) || b.numero.localeCompare(a.numero));

  function ajouter() {
    creer({ type: "livraison", titre: `Nouvelle livraison · ${fiche.ligne.vehicule.immatriculationAffichee}`, champs: CHAMPS.livraison, valeurs: { date: jourCourant() } });
  }
  function modifier(b: LivraisonFiche) {
    if (!b.saisie) return;
    demander({ type: "livraison", numero: b.numero, titre: `Livraison ${b.numero} · ${b.client ?? ""}`, champs: CHAMPS.livraison, valeurs: { date: b.date, site: b.site, client: b.client ?? "", produits: b.produits ?? "", poidsKg: b.poidsKg ?? "", chauffeur: b.chauffeur ?? "", heureDebut: b.heureDebut ?? "", heureFin: b.heureFin ?? "", observations: b.observations ?? "" } });
  }

  const r = bons.length ? resumeLivraisons(bons) : null;
  return (
    <Carte
      titre="Livraisons"
      precision={r ? `${nombre(r.bons)} bons du ${date(r.premier)} au ${date(r.dernier)} · ${tonnes(r.poidsKg)} · ${nombre(r.clients)} clients — le résumé par mois est dans les Rapports` : "Les bons de Sage X3 qui portent la plaque de ce véhicule, et les livraisons saisies ici"}
      action={
        <button type="button" onClick={ajouter} className="bouton-secondaire h-9" title="Le client, le poids, les heures et les observations au besoin">
          <Plus className="size-4" strokeWidth={2} />
          Ajouter une livraison
        </button>
      }
      sansMarge
    >
      <TableauSimple<LivraisonFiche>
        reglages="fiche-vehicule.livraisons.2"
        cle={(b) => b.numero}
        lignes={bons}
        fixe
        vide="Aucune livraison sur ce véhicule — « Ajouter une livraison » en saisit une."
        numero={(b) => b.numero}
        cible={cible}
        surModifier={(b) => (b.saisie ? modifier(b) : undefined)}
        colonnes={[
          { cle: "numero", libelle: "Bon", largeur: "150px", rendu: (b) => <span className="code whitespace-nowrap">{b.numero}</span> },
          { cle: "date", libelle: "Date", largeur: "110px", rendu: (b) => <span className="code whitespace-nowrap">{date(b.date)}</span> },
          { cle: "site", libelle: "Site", largeur: "130px", rendu: (b) => <span className="block truncate">{b.site}</span> },
          { cle: "client", libelle: "Client", rendu: (b) => <span className="block truncate font-medium">{b.client ?? "—"}</span> },
          { cle: "heures", libelle: "Heures", largeur: "130px", rendu: (b) => (b.heureDebut || b.heureFin ? <span className="code whitespace-nowrap">{b.heureDebut ?? "—"} → {b.heureFin ?? "—"}</span> : tiret) },
          { cle: "duree", libelle: "Durée", alignee: "droite", largeur: "90px", parDefaut: false, rendu: (b) => { const d = dureeLivraison(b); return d === null ? tiret : <span className="code">{Math.floor(d / 60)} h {String(d % 60).padStart(2, "0")}</span>; } },
          { cle: "produits", libelle: "Produits", parDefaut: false, rendu: (b) => <span className="block truncate text-texte-2">{b.produits ?? "—"}</span> },
          { cle: "chauffeur", libelle: "Chauffeur", largeur: "170px", rendu: (b) => <span className="block truncate">{b.chauffeur ?? "—"}</span> },
          { cle: "observations", libelle: "Observations", largeur: "220px", rendu: (b) => (b.observations ? <span className="block truncate text-texte-2" title={b.observations}>{b.observations}</span> : tiret) },
          { cle: "quantites", libelle: "Quantités", alignee: "droite", largeur: "180px", parDefaut: false, rendu: (b) => <span className="whitespace-nowrap text-texte-2">{quantitesLisibles(b.quantites, (n) => nombre(n))}</span> },
          { cle: "poids", libelle: "Poids", alignee: "droite", largeur: "100px", rendu: (b) => (b.poidsKg === null ? tiret : tonnes(b.poidsKg)) },
          { cle: "source", libelle: "Source", largeur: "130px", parDefaut: false, rendu: (b) => <span className="text-texte-2">{b.saisie ? "Saisie" : b.source}</span> },
        ]}
      />
    </Carte>
  );
}
