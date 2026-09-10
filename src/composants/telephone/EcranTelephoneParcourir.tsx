"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeftRight, BarChart3, CalendarRange, ClipboardList, Fuel, Inbox, QrCode, ScanLine, Settings, ShieldCheck, TriangleAlert, Truck, Users, Wallet, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AccesCourant, Module } from "@/domaine/acces";
import { lireAccesCourant } from "@/lib/acces-courant";
import { EnTeteTelephone } from "./Telephone";

/* ============================================================================
 * Téléphone › Parcourir — la grille des modules, comme le « Browse » de
 * Fleetio Go : ce que la personne a le droit de voir, rien d'autre. Les
 * écrans pensés pour le téléphone sont en tête ; les autres ouvrent le
 * bureau, qui se lit aussi sur un écran étroit.
 * ==========================================================================*/

interface Tuile {
  href: string;
  libelle: string;
  precision: string;
  icone: LucideIcon;
  module?: Module;
  /** Réservé au détenteur, ou caché au détenteur. */
  detenteur?: "seulement" | "jamais";
}

const TUILES: { titre: string; tuiles: Tuile[] }[] = [
  {
    titre: "Sur le terrain",
    tuiles: [
      { href: "/telephone/scanner", libelle: "Scanner", precision: "Le QR code d'un véhicule", icone: ScanLine },
      { href: "/telephone/vehicules", libelle: "Véhicules", precision: "Fiche rapide, statut, relevé, plein, panne", icone: Truck, module: "flotte", detenteur: "jamais" },
      { href: "/telephone/demandes", libelle: "Demandes", precision: "Poussées aux détenteurs", icone: Inbox, module: "demandes" },
      { href: "/telephone/transferts", libelle: "Transferts", precision: "Fiches à signer", icone: ArrowLeftRight, module: "transferts" },
      { href: "/telephone/atelier", libelle: "Atelier", precision: "Ordres en cours, clôture", icone: Wrench, module: "maintenance", detenteur: "jamais" },
    ],
  },
  {
    titre: "Le parc",
    tuiles: [
      /* Le tableau de bord n'est plus proposé ici (métier, 10 septembre 2026 :
         « à l'ouverture de l'app mobile, on voit le tableau de bord — à
         retirer »). Il n'est pas dessiné pour un écran étroit, et l'accueil du
         téléphone dit déjà ce qu'il y a à faire aujourd'hui. La tuile partie,
         « Disponibilité » ouvre la rangée : c'est elle que le terrain demande
         le matin. La route `/` redirige de toute façon vers `/telephone` quand
         la requête vient d'un téléphone. */
      { href: "/disponibilite", libelle: "Disponibilité", precision: "Ce qui roule aujourd'hui", icone: ClipboardList, module: "flotte", detenteur: "jamais" },
      { href: "/conformite", libelle: "Conformité", precision: "Documents et échéances", icone: ShieldCheck, module: "documents", detenteur: "jamais" },
      { href: "/incidents", libelle: "Incidents", precision: "Pannes, accidents, sinistres", icone: TriangleAlert, module: "incidents", detenteur: "jamais" },
      { href: "/carburant", libelle: "Carburant", precision: "Pleins, cuve, bons", icone: Fuel, module: "releves", detenteur: "jamais" },
      { href: "/maintenance", libelle: "Maintenance", precision: "Plans, ordres, interventions", icone: Wrench, module: "maintenance", detenteur: "jamais" },
      { href: "/chauffeurs", libelle: "Chauffeurs", precision: "Fiches et disponibilités", icone: Users, module: "chauffeurs", detenteur: "jamais" },
      { href: "/affectations", libelle: "Affectations", precision: "Le planning", icone: CalendarRange, module: "chauffeurs", detenteur: "jamais" },
      { href: "/caisse", libelle: "Caisse", precision: "Dépenses et achats", icone: Wallet, module: "couts", detenteur: "jamais" },
      { href: "/rapports", libelle: "Rapports", precision: "Chiffres et exports", icone: BarChart3, module: "couts", detenteur: "jamais" },
    ],
  },
  {
    titre: "Réglages",
    tuiles: [
      { href: "/flotte/etiquettes", libelle: "Étiquettes QR", precision: "À imprimer et coller", icone: QrCode, module: "flotte", detenteur: "jamais" },
      { href: "/parametres", libelle: "Paramètres", precision: "Règles de l'application", icone: Settings, module: "parametres", detenteur: "jamais" },
    ],
  },
];

export function EcranTelephoneParcourir() {
  const [acces, setAcces] = useState<AccesCourant | null>(null);
  useEffect(() => setAcces(lireAccesCourant()), []);
  const detenteur = acces?.profil === "detenteur";
  const visible = (t: Tuile) => acces !== null && !(t.detenteur === "seulement" && !detenteur) && !(t.detenteur === "jamais" && detenteur) && (!t.module || acces.niveaux[t.module] !== "aucun");

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4 px-3 pb-24 pt-1">
      <EnTeteTelephone titre="Parcourir" />
      {TUILES.map((g) => {
        const tuiles = g.tuiles.filter(visible);
        if (tuiles.length === 0) return null;
        return (
          <section key={g.titre}>
            <h2 className="micro-sur-titre mb-2 px-1">{g.titre}</h2>
            <div className="grid grid-cols-2 gap-2">
              {tuiles.map((t) => {
                const Icone = t.icone;
                return (
                  <Link key={t.href} href={t.href} className="carte flex items-start gap-3 px-3 py-3 hover:bg-surface-2">
                    <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-accent-fond text-accent-fonce">
                      <Icone className="size-[18px]" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-semibold text-texte">{t.libelle}</span>
                      <span className="meta block leading-snug">{t.precision}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
