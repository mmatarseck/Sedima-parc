import { BarChart3, CalendarRange, ClipboardList, Fuel, Handshake, LayoutGrid, Package, PiggyBank, Settings, ShieldCheck, Store, TriangleAlert, Truck, Users, Wallet, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Module } from "@/domaine/acces";

export interface EntreeNavigation {
  href: string;
  libelle: string;
  icone: LucideIcon;
  /** Compteur d'éléments à traiter, affiché en pastille. */
  compteur?: number;
  /** Faux tant que l'écran n'est pas livré : l'entrée reste visible mais inerte. */
  livre: boolean;
  /** Le module dont dépend l'entrée : elle disparaît pour qui n'y a aucun accès. Absent : toujours visible. */
  module?: Module;
}

export interface GroupeNavigation {
  /** Nul pour le groupe de tête : l'écran d'entrée n'a pas besoin d'être nommé. */
  titre: string | null;
  entrees: EntreeNavigation[];
}

/**
 * Le rail, revu avec le métier le 4 septembre 2026. Les groupes répondent à
 * **la question que l'on se pose**, pas au genre de la donnée :
 *
 *  - en tête, sans titre, le **tableau de bord** : c'est l'écran d'entrée, et
 *    un tableau de bord n'est pas une tâche d'exploitation ;
 *  - **Exploitation** — « qu'est-ce qui roule aujourd'hui, et avec qui ? » : la
 *    flotte, la disponibilité du jour, les chauffeurs, les affectations, et
 *    l'affrètement chez un transporteur quand le parc ne suffit pas ;
 *  - **Suivi** — « quels processus sont en cours, et où en sont-ils ? » :
 *    conformité, maintenance, incidents, carburant, caisse et achats, et les
 *    prestataires que l'on consulte dans le fil des deux derniers ;
 *  - **Pilotage** — « qu'est-ce que ça donne, en chiffres ? » : les rapports,
 *    que le module de questions sur la flotte rejoindra ;
 *  - **Administration** — régler l'application n'est pas piloter le parc.
 *
 * Les entrées non livrées restent affichées : l'équipe voit où va
 * l'application, et ce qui manque encore.
 */
export const NAVIGATION: GroupeNavigation[] = [
  {
    titre: null,
    entrees: [{ href: "/", libelle: "Tableau de bord", icone: LayoutGrid, livre: true }],
  },
  {
    titre: "Exploitation",
    entrees: [
      /* La Flotte porte tout le parc depuis le 7 septembre 2026 — transport,
         service, fonction, plan car, et les véhicules commandés à recevoir —,
         distingués par le régime d'usage. L'écran « Parc léger » a été retiré
         le soir même à la demande du métier : une seule liste, des filtres. */
      { module: "flotte", href: "/flotte", libelle: "Flotte", icone: Truck, livre: true },
      { module: "flotte", href: "/disponibilite", libelle: "Disponibilité du jour", icone: ClipboardList, livre: true },
      { module: "chauffeurs", href: "/chauffeurs", libelle: "Chauffeurs", icone: Users, livre: true },
      { module: "chauffeurs", href: "/affectations", libelle: "Affectations", icone: CalendarRange, livre: true },
      /* Les fiches de transfert n'ont plus d'entrée au rail (9 septembre 2026) :
         une remise de véhicule se lit et se dresse depuis la fiche du véhicule,
         onglet Affectations — c'est l'affectation qu'elle ouvre et qu'elle
         ferme. La liste `/transferts` reste, à un clic de là et du téléphone. */
      { module: "transporteurs", href: "/transporteurs", libelle: "Transporteurs", icone: Handshake, livre: true },
    ],
  },
  {
    titre: "Suivi",
    entrees: [
      { module: "documents", href: "/conformite", libelle: "Conformité", icone: ShieldCheck, livre: true },
      { module: "maintenance", href: "/maintenance", libelle: "Maintenance", icone: Wrench, livre: true },
      /* Les pièces de rechange vivent avec la maintenance — mêmes droits, même atelier (décisions du 9 septembre 2026). */
      { module: "maintenance", href: "/pieces", libelle: "Pièces de rechange", icone: Package, livre: true },
      { module: "incidents", href: "/incidents", libelle: "Incidents & sinistres", icone: TriangleAlert, livre: true },
      { module: "releves", href: "/carburant", libelle: "Carburant", icone: Fuel, livre: true },
      /* Les demandes ont quitté le rail le 10 septembre 2026 : ce n'est pas un
         référentiel où l'on entre pour chercher, c'est une corbeille qui se
         regarde en passant. Elle vit dans la barre du haut, à côté de la
         cloche, avec le nombre de celles qui attendent (`LienDemandes`). La
         route `/demandes` reste, et le téléphone garde la sienne. */
      { module: "couts", href: "/caisse", libelle: "Caisse & achats", icone: Wallet, livre: true },
      { module: "transporteurs", href: "/prestataires", libelle: "Prestataires", icone: Store, livre: true },
    ],
  },
  {
    titre: "Pilotage",
    entrees: [
      { module: "couts", href: "/budget", libelle: "Budget", icone: PiggyBank, livre: true },
      { module: "couts", href: "/rapports", libelle: "Rapports", icone: BarChart3, livre: true },
    ],
  },
  {
    titre: "Administration",
    entrees: [{ module: "parametres", href: "/parametres", libelle: "Paramètres", icone: Settings, livre: true }],
  },
];
