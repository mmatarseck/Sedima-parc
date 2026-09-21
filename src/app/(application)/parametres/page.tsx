import Link from "next/link";
import { Activity, BellRing, Car, ChevronRight, ClipboardList, FileCheck2, Fuel, Gauge, ListChecks, LockKeyhole, Trophy, Truck, Users, Wallet, Wrench } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { titrePage } from "@/domaine/marque";

export const metadata = { title: titrePage("Paramètres") };

/**
 * Paramètres — ce qui règle l'application plutôt que le parc.
 *
 * Quinze sections, rangées par groupe (métier, 21 septembre 2026 : « grouper
 * les modules dans Paramètres par groupe ») : le parc, la maintenance,
 * l'énergie et la caisse, les chauffeurs, les alertes, puis l'administration.
 */
type Section = { href: string; libelle: string; precision: string; icone: typeof Wrench };

const GROUPES: { titre: string; precision: string; sections: Section[] }[] = [
  {
    titre: "Parc et véhicules",
    precision: "Ce qui décrit un véhicule et ses pièces réglementaires",
    sections: [
      { href: "/parametres/vehicules", libelle: "Véhicules", precision: "Marques, modèles et catégories proposés à la création d'un véhicule — la liste s'enrichit de ce qui se saisit", icone: Truck },
      { href: "/parametres/documents", libelle: "Règles des documents", precision: "Liste des documents — ajout, renommage — validité, criticité, applicabilité, exemption des véhicules légers neufs", icone: FileCheck2 },
      { href: "/parametres/parc-leger", libelle: "Parc léger", precision: "Durée du plan car, forfait carburant mensuel des véhicules de fonction — les valeurs par défaut, que chaque dossier peut préciser", icone: Car },
      { href: "/parametres/referentiels", libelle: "Référentiels", precision: "Sites, catégories, typologies d'incident, postes de dépense — avec le nombre d'enregistrements qui en dépendent", icone: ListChecks },
    ],
  },
  {
    titre: "Maintenance",
    precision: "Ce que l'atelier planifie et ce que citent les services",
    sections: [
      { href: "/parametres/entretien", libelle: "Programmes d'entretien", precision: "Un gabarit par type de véhicule — tâches, périodicités au kilométrage, aux heures ou aux mois, coût et immobilisation par cycle", icone: Wrench },
      { href: "/parametres/taches", libelle: "Catalogue des tâches de service", precision: "Les tâches de maintenance classées comme Fleetio — catégorie, système, ensemble — et leurs utilisations dans le parc", icone: ClipboardList },
    ],
  },
  {
    titre: "Énergie et caisse",
    precision: "Les prix et les stocks de départ",
    sections: [
      { href: "/parametres/energie", libelle: "Énergie et carburant", precision: "Prix du litre de gasoil et d'essence, prix du kWh, prix du litre livré en cuve, contenance de la cuve", icone: Fuel },
      { href: "/parametres/caisse", libelle: "Caisse et cuve", precision: "Le solde reporté et le seuil de réapprovisionnement de la caisse parc, le stock reporté de la cuve interne", icone: Wallet },
    ],
  },
  {
    titre: "Chauffeurs",
    precision: "Ce qui mesure et rémunère la conduite",
    sections: [{ href: "/parametres/sqdcm", libelle: "Barème SQDCM des chauffeurs", precision: "Indicateurs, objectifs, tolérances, poids des piliers, tranches de prime — le barème que le chauffeur doit pouvoir lire", icone: Trophy }],
  },
  {
    titre: "Alertes et notifications",
    precision: "Qui est prévenu de quoi, et quand une pastille rougit",
    sections: [
      { href: "/parametres/notifications", libelle: "Mes notifications", precision: "Ce que vous recevez, et par quel canal — réglage de votre compte", icone: BellRing },
      { href: "/parametres/alertes", libelle: "Règles d'alerte", precision: "Ce qu'un compte reçoit sans rien toucher : destinataires par famille et délai de prévenance, pour toute l'organisation", icone: BellRing },
      { href: "/parametres/pastilles", libelle: "Pastilles du tableau de bord", precision: "Les seuils en nombre au-delà desquels une pastille passe au rouge — hors service, prêts à charger, pannes, autonomie de la cuve", icone: Gauge },
    ],
  },
  {
    titre: "Administration",
    precision: "Les comptes, les clôtures et l'état de la base",
    sections: [
      { href: "/parametres/utilisateurs", libelle: "Utilisateurs et rôles", precision: "Les huit rôles, leur périmètre, qui voit les sanctions, qui clôture — et de quoi prendre un autre rôle", icone: Users },
      { href: "/parametres/clotures", libelle: "Clôture des mois", precision: "Fermer un mois, approuver les modifications demandées sur un mois clos", icone: LockKeyhole },
      { href: "/parametres/diagnostic", libelle: "Diagnostic", precision: "Chaque lecture de la base chronométrée, avec son erreur s'il y en a une — réservé à l'administrateur et à la direction", icone: Activity },
    ],
  },
];

export default function PageParametres() {
  const total = GROUPES.reduce((s, g) => s + g.sections.length, 0);
  return (
    <div className="defilement-discret flex flex-col gap-7 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <TitreEcran titre="Paramètres" sousTitre={`Ce qui règle l'application — ${total} sections en ${GROUPES.length} groupes`} />
      {GROUPES.map((g) => (
        <section key={g.titre} className="flex flex-col gap-3">
          <div>
            <h2 className="titre-bloc">{g.titre}</h2>
            <p className="meta">{g.precision}</p>
          </div>
          <ul className="grid auto-rows-fr grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {g.sections.map((s) => {
              const Icone = s.icone;
              return (
                <li key={s.href}>
                  <Link href={s.href} className="carte flex h-full items-start gap-4 px-5 py-4 transition-colors hover:bg-surface-2">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-fond text-accent-tres-fonce">
                      <Icone className="size-[18px]" strokeWidth={1.7} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold text-texte">{s.libelle}</span>
                      <span className="meta mt-0.5 block leading-snug">{s.precision}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-attenue" strokeWidth={1.8} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
