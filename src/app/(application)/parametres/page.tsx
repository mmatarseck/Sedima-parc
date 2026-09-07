import Link from "next/link";
import { BellRing, Car, ChevronRight, FileCheck2, Fuel, Gauge, ListChecks, LockKeyhole, Trophy, Truck, Users, Wrench } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { titrePage } from "@/domaine/marque";

export const metadata = { title: titrePage("Paramètres") };

/**
 * Paramètres — ce qui règle l'application plutôt que le parc.
 *
 * Les douze sections sont livrées. Trois d'entre elles **montrent sans laisser
 * modifier**, et c'est délibéré : les référentiels sont les clés des
 * enregistrements, les rôles ne se décident jamais dans le navigateur, et un
 * barème de prime ne se change pas en cours de période. Chacune dit pourquoi,
 * et ce qui viendra avec la base.
 */
const SECTIONS = [
  { href: "/parametres/clotures", libelle: "Clôture des mois", precision: "Fermer un mois, approuver les modifications demandées sur un mois clos", icone: LockKeyhole, livre: true },
  { href: "/parametres/documents", libelle: "Règles des documents", precision: "Liste des documents — ajout, renommage — validité, criticité, applicabilité, exemption des véhicules légers neufs", icone: FileCheck2, livre: true },
  { href: "/parametres/energie", libelle: "Énergie et carburant", precision: "Prix du litre de gasoil et d'essence, prix du kWh, prix du litre livré en cuve, contenance de la cuve", icone: Fuel, livre: true },
  { href: "/parametres/entretien", libelle: "Programmes d'entretien", precision: "Un gabarit par type de véhicule — opérations, périodicités au kilométrage ou aux heures, coût et immobilisation par cycle", icone: Wrench, livre: true },
  { href: "/parametres/referentiels", libelle: "Référentiels", precision: "Sites, catégories, typologies d'incident, postes de dépense — avec le nombre d'enregistrements qui en dépendent", icone: ListChecks, livre: true },
  { href: "/parametres/utilisateurs", libelle: "Utilisateurs et rôles", precision: "Les huit rôles, leur périmètre, qui voit les sanctions, qui clôture — et de quoi prendre un autre rôle", icone: Users, livre: true },
  /* Le réglage personnel des notifications est livré ; les **règles** de
     l'organisation — qui est destinataire par défaut de quoi — restent à faire
     et relèvent de l'administrateur, pas de chacun. */
  { href: "/parametres/notifications", libelle: "Mes notifications", precision: "Ce que vous recevez, et par quel canal — réglage de votre compte", icone: BellRing, livre: true },
  { href: "/parametres/alertes", libelle: "Règles d'alerte", precision: "Ce qu'un compte reçoit sans rien toucher : destinataires par famille et délai de prévenance, pour toute l'organisation", icone: BellRing, livre: true },
  { href: "/parametres/sqdcm", libelle: "Barème SQDCM des chauffeurs", precision: "Indicateurs, objectifs, tolérances, poids des piliers, tranches de prime — le barème que le chauffeur doit pouvoir lire", icone: Trophy, livre: true },
  { href: "/parametres/parc-leger", libelle: "Parc léger", precision: "Durée du plan car, forfait carburant mensuel des véhicules de fonction — les valeurs par défaut, que chaque dossier peut préciser", icone: Car, livre: true },
  { href: "/parametres/vehicules", libelle: "Véhicules", precision: "Marques, modèles et catégories proposés à la création d'un véhicule — la liste s'enrichit de ce qui se saisit", icone: Truck, livre: true },
  { href: "/parametres/pastilles", libelle: "Pastilles du tableau de bord", precision: "Les seuils en nombre au-delà desquels une pastille passe au rouge — hors service, prêts à charger, pannes, autonomie de la cuve", icone: Gauge, livre: true },
];

export default function PageParametres() {
  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <TitreEcran titre="Paramètres" sousTitre="Ce qui règle l'application — douze sections : neuf où l'on saisit, trois qui montrent et disent pourquoi" />
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.map((s) => {
          const Icone = s.icone;
          const contenu = (
            <>
              <span className={`grid size-10 shrink-0 place-items-center rounded-full ${s.livre ? "bg-accent-fond text-accent-tres-fonce" : "bg-surface-3 text-attenue-2"}`}>
                <Icone className="size-[18px]" strokeWidth={1.7} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[14px] font-semibold ${s.livre ? "text-texte" : "text-attenue"}`}>{s.libelle}</span>
                <span className="meta mt-0.5 block leading-snug">{s.precision}</span>
                {!s.livre ? <span className="badge-texte mt-2 inline-block rounded-full bg-surface-3 px-2 py-px text-attenue">au cadrage</span> : null}
              </span>
              {s.livre ? <ChevronRight className="size-4 shrink-0 text-attenue" strokeWidth={1.8} /> : null}
            </>
          );
          return (
            <li key={s.href}>
              {s.livre ? (
                <Link href={s.href} className="carte flex items-start gap-4 px-5 py-4 transition-colors hover:bg-surface-2">
                  {contenu}
                </Link>
              ) : (
                <div className="carte flex items-start gap-4 px-5 py-4 opacity-80" title="Prévu au cadrage, pas encore livré">
                  {contenu}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
