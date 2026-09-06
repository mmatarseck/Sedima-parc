import {
  BarChart3,
  CalendarRange,
  ClipboardList,
  Fuel,
  Handshake,
  LayoutGrid,
  PiggyBank,
  Settings,
  ShieldCheck,
  Store,
  TriangleAlert,
  Truck,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface EntreeNavigation {
  href: string;
  libelle: string;
  icone: LucideIcon;
  /** Compteur d'éléments à traiter, affiché en pastille. */
  compteur?: number;
  /** Faux tant que l'écran n'est pas livré : l'entrée reste visible mais inerte. */
  livre: boolean;
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
      { href: "/flotte", libelle: "Flotte", icone: Truck, livre: true },
      { href: "/disponibilite", libelle: "Disponibilité du jour", icone: ClipboardList, livre: true },
      { href: "/chauffeurs", libelle: "Chauffeurs", icone: Users, livre: true },
      { href: "/affectations", libelle: "Affectations", icone: CalendarRange, livre: true },
      { href: "/transporteurs", libelle: "Transporteurs", icone: Handshake, livre: true },
    ],
  },
  {
    titre: "Suivi",
    entrees: [
      { href: "/conformite", libelle: "Conformité", icone: ShieldCheck, livre: true },
      { href: "/maintenance", libelle: "Maintenance", icone: Wrench, livre: true },
      { href: "/incidents", libelle: "Incidents & sinistres", icone: TriangleAlert, livre: true },
      { href: "/carburant", libelle: "Carburant", icone: Fuel, livre: true },
      { href: "/caisse", libelle: "Caisse & achats", icone: Wallet, livre: true },
      { href: "/prestataires", libelle: "Prestataires", icone: Store, livre: true },
    ],
  },
  {
    titre: "Pilotage",
    entrees: [
      { href: "/budget", libelle: "Budget", icone: PiggyBank, livre: true },
      { href: "/rapports", libelle: "Rapports", icone: BarChart3, livre: true },
    ],
  },
  {
    titre: "Administration",
    entrees: [{ href: "/parametres", libelle: "Paramètres", icone: Settings, livre: true }],
  },
];
