"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeftRight, ChevronRight, ClipboardList, Fuel, Package, QrCode, ScanLine, Settings, ShieldCheck, SlidersHorizontal, TriangleAlert, Truck, Users, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AccesCourant, Module } from "@/domaine/acces";
import { lireAccesCourant } from "@/lib/acces-courant";
import { EnTeteTelephone } from "./Telephone";

/* ============================================================================
 * Téléphone › Parcourir — la grille des modules devenue **une liste**.
 *
 * Refondu le 10 septembre 2026 à la demande du métier : « garder en liste
 * comme sur Fleetio, et par section, en retirant les rubriques non nécessaires
 * en version mobile ».
 *
 * Pourquoi la liste plutôt que la grille de cartes. Deux colonnes sur 375 px
 * laissaient moins de la moitié de la largeur au texte : « Fiche rapide,
 * statut, relevé, plein, panne » se cassait sur quatre lignes, et une rubrique
 * occupait la hauteur d'un paragraphe. En liste, chaque entrée tient sur deux
 * lignes, la précision se lit d'un trait, et l'écran entier se parcourt d'un
 * coup d'œil au lieu de deux colonnes à balayer en zigzag.
 *
 * **Ce qui a été retiré, et pourquoi.** Un écran conçu pour le bureau n'est
 * pas « adapté au mobile » parce qu'il s'y affiche : un tableau de vingt
 * colonnes, un planning à la semaine ou neuf sections de paramètres ne se
 * conduisent pas au pouce. Sont donc sortis de cette liste — sans être
 * supprimés, ils restent au bureau :
 *
 *   * **Affectations** : un planning en grille, illisible sous 900 px ;
 *   * **Rapports** : des tableaux et des exports, faits pour un écran large ;
 *   * **Caisse** : la saisie passe par les gestes de l'accueil, la lecture est
 *     un tableau de mouvements ;
 *   * **Étiquettes QR** : un écran d'impression ;
 *   * **Paramètres** : neuf sections de réglages, qui se posent au bureau.
 *
 * Reste ce qui se consulte debout, devant un camion : l'état du parc, les
 * échéances, les pannes, le carburant, l'atelier, les chauffeurs.
 * ==========================================================================*/

interface Entree {
  href: string;
  libelle: string;
  precision: string;
  icone: LucideIcon;
  module?: Module;
  /** Réservé au détenteur, ou caché au détenteur. */
  detenteur?: "seulement" | "jamais";
}

const SECTIONS: { titre: string; entrees: Entree[] }[] = [
  {
    titre: "Sur le terrain",
    entrees: [
      { href: "/telephone/scanner", libelle: "Scanner", precision: "Le QR code d'un véhicule", icone: ScanLine },
      { href: "/telephone/vehicules", libelle: "Véhicules", precision: "Fiche rapide, statut, relevé, plein, panne", icone: Truck, module: "flotte", detenteur: "jamais" },
      { href: "/telephone/transferts", libelle: "Transferts", precision: "Fiches à signer", icone: ArrowLeftRight, module: "transferts" },
      { href: "/telephone/atelier", libelle: "Atelier", precision: "Ordres en cours, clôture", icone: Wrench, module: "maintenance", detenteur: "jamais" },
      { href: "/telephone/pieces", libelle: "Pièces", precision: "Sorties et réceptions", icone: Package, module: "maintenance", detenteur: "jamais" },
    ],
  },
  {
    titre: "Le parc",
    entrees: [
      { href: "/disponibilite", libelle: "Disponibilité", precision: "Ce qui roule aujourd'hui", icone: ClipboardList, module: "flotte", detenteur: "jamais" },
      { href: "/conformite", libelle: "Conformité", precision: "Documents et échéances", icone: ShieldCheck, module: "documents", detenteur: "jamais" },
      { href: "/incidents", libelle: "Incidents", precision: "Pannes, accidents, sinistres", icone: TriangleAlert, module: "incidents", detenteur: "jamais" },
      { href: "/carburant", libelle: "Carburant", precision: "Pleins, cuve, bons", icone: Fuel, module: "releves", detenteur: "jamais" },
      { href: "/maintenance", libelle: "Maintenance", precision: "Plans, ordres, interventions", icone: Wrench, module: "maintenance", detenteur: "jamais" },
      { href: "/chauffeurs", libelle: "Chauffeurs", precision: "Fiches et disponibilités", icone: Users, module: "chauffeurs", detenteur: "jamais" },
    ],
  },
  {
    titre: "Mon application",
    entrees: [
      { href: "/telephone/personnaliser", libelle: "Personnaliser l'accueil", precision: "Les gestes et les blocs affichés", icone: SlidersHorizontal },
      { href: "/telephone/reglages", libelle: "Réglages et profil", precision: "Compte, accès, installation", icone: Settings },
      { href: "/flotte/etiquettes", libelle: "Étiquettes QR", precision: "À imprimer et coller — plutôt au bureau", icone: QrCode, module: "flotte", detenteur: "jamais" },
    ],
  },
];

export function EcranTelephoneParcourir() {
  const [acces, setAcces] = useState<AccesCourant | null>(null);
  useEffect(() => setAcces(lireAccesCourant()), []);
  const detenteur = acces?.profil === "detenteur";
  const visible = (e: Entree) =>
    acces !== null && !(e.detenteur === "seulement" && !detenteur) && !(e.detenteur === "jamais" && detenteur) && (!e.module || acces.niveaux[e.module] !== "aucun");

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4 px-3 pt-1 pb-24">
      <EnTeteTelephone titre="Parcourir" />
      {SECTIONS.map((s) => {
        const entrees = s.entrees.filter(visible);
        if (entrees.length === 0) return null;
        return (
          <section key={s.titre}>
            <h2 className="micro-sur-titre mb-2 px-1">{s.titre}</h2>
            {/* Une seule carte par section, les entrées séparées par un filet :
                c'est la liste groupée des applications de téléphone, et non
                six cartes qui flottent. */}
            <div className="carte overflow-hidden px-0 py-0">
              {entrees.map((e) => {
                const Icone = e.icone;
                return (
                  <Link key={e.href} href={e.href} className="flex items-center gap-3 border-t border-bordure px-3 py-3 transition-colors first:border-t-0 hover:bg-surface-2 active:bg-surface-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-accent-fond text-accent-fonce">
                      <Icone className="size-[18px]" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-texte">{e.libelle}</span>
                      <span className="meta block truncate">{e.precision}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-attenue-2" strokeWidth={2} />
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Ce qui n'est pas ici, et où le trouver. Le dire vaut mieux que de
          laisser chercher une rubrique qu'on a sciemment retirée. */}
      {!detenteur ? (
        <p className="meta px-2 leading-[1.6]">
          Les affectations, les rapports, la caisse et les paramètres se conduisent au bureau : ce sont des plannings, des tableaux et des exports, que le pouce ne mène pas.
        </p>
      ) : null}
    </div>
  );
}
