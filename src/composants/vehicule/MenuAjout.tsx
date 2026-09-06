"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  CalendarOff,
  ChevronDown,
  Link2,
  ClipboardPen,
  ShieldCheck,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Fuel,
  Gauge,
  Gavel,
  Plus,
  Receipt,
  TriangleAlert,
  UserPlus,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type CibleAjout =
  | "affectation"
  | "plein"
  | "depense"
  | "intervention"
  | "incident"
  | "document"
  | "releve"
  | "statut"
  | "inspection"
  | "ordre-de-travail"
  | "contravention"
  | "sanction"
  | "indisponibilite"
  | "aptitude"
  | "attelage"
  | "visite"
  | "observation";

export interface EntreeAjout {
  cle: CibleAjout;
  libelle: string;
  precision: string;
  icone: LucideIcon;
  /** Faux tant que le formulaire n'est pas livré : l'entrée reste visible mais inerte. */
  livre: boolean;
}

/**
 * Tout ce qu'on peut saisir sur un véhicule, au même endroit. L'ordre suit la
 * fréquence du geste : le plein et la dépense tous les jours, l'affectation et
 * l'intervention chaque semaine, le reste plus rarement. Les deux dernières
 * entrées sont au cadrage (Lot 2) et pas encore livrées.
 */
export const ENTREES_VEHICULE: EntreeAjout[] = [
  { cle: "plein", libelle: "Plein de carburant", precision: "Litres, bon de sortie, compteur", icone: Fuel, livre: true },
  { cle: "depense", libelle: "Dépense", precision: "Caisse parc, bon de commande ou facture", icone: Wallet, livre: true },
  { cle: "intervention", libelle: "Intervention", precision: "Préventive ou curative, garage, immobilisation", icone: Wrench, livre: true },
  { cle: "affectation", libelle: "Affectation", precision: "Chauffeur titulaire ou suppléant, sur période", icone: UserPlus, livre: true },
  { cle: "attelage", libelle: "Attelage", precision: "Tracteur et remorque, sur période ou définitif", icone: Link2, livre: true },
  { cle: "incident", libelle: "Incident ou accident", precision: "Déclaration en quatre étapes", icone: TriangleAlert, livre: true },
  { cle: "document", libelle: "Document", precision: "Assurance, carte grise, salubrité…", icone: FileText, livre: true },
  { cle: "visite", libelle: "Rendez-vous de visite technique", precision: "Visite ou contre-visite au centre agréé", icone: CalendarCheck, livre: true },
  { cle: "observation", libelle: "Observation de visite technique", precision: "Défaut relevé par le centre, à corriger", icone: ClipboardPen, livre: true },
  { cle: "releve", libelle: "Relevé kilométrique", precision: "Lecture du compteur, contrôlée", icone: Gauge, livre: true },
  { cle: "statut", libelle: "Changement de statut", precision: "Ouvre une période horodatée", icone: ArrowLeftRight, livre: true },
  { cle: "inspection", libelle: "Inspection", precision: "Check-list avant départ ou au retour — Lot 2", icone: ClipboardList, livre: false },
  { cle: "ordre-de-travail", libelle: "Ordre de travail", precision: "Depuis une échéance d'entretien — Lot 2", icone: ClipboardCheck, livre: false },
];

/**
 * Ce qu'on saisit sur un chauffeur. Tout ce qui se conduit — plein, relevé,
 * intervention — reste sur le véhicule : le chauffeur n'en est que le
 * conducteur du moment, et sa fiche le retrouve par l'affectation.
 */
export const ENTREES_CHAUFFEUR: EntreeAjout[] = [
  { cle: "affectation", libelle: "Affectation", precision: "Titulaire ou suppléant d'un véhicule, sur période", icone: UserPlus, livre: true },
  { cle: "document", libelle: "Document", precision: "Permis de conduire, visite médicale", icone: FileText, livre: true },
  { cle: "indisponibilite", libelle: "Indisponibilité", precision: "Congé, maladie, suspension, formation", icone: CalendarOff, livre: true },
  { cle: "aptitude", libelle: "Décision d'aptitude", precision: "Apte, apte avec réserve, inapte — avec motif", icone: ShieldCheck, livre: true },
  { cle: "contravention", libelle: "Contravention", precision: "Sur le véhicule conduit, avec ou sans retenue", icone: Receipt, livre: true },
  { cle: "incident", libelle: "Incident ou accident", precision: "Déclaration en quatre étapes, sur le véhicule", icone: TriangleAlert, livre: true },
  { cle: "sanction", libelle: "Sanction", precision: "Avertissement, blâme, retenue, mise à pied", icone: Gavel, livre: true },
];

/**
 * Menu « Ajouter » d'une fiche.
 *
 * Tant que les formulaires ne sont pas livrés, choisir une entrée conduit à
 * l'onglet qui liste ce type de transaction — le geste garde un sens, et le
 * jour où le formulaire arrive, seul `onChoix` change.
 */
export function MenuAjout({ entrees = ENTREES_VEHICULE, onChoix }: { entrees?: EntreeAjout[]; onChoix: (cible: CibleAjout) => void }) {
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    function surEchap(e: KeyboardEvent) {
      if (e.key === "Escape") setOuvert(false);
    }
    document.addEventListener("keydown", surEchap);
    return () => document.removeEventListener("keydown", surEchap);
  }, []);

  function choisir(cible: CibleAjout) {
    setOuvert(false);
    onChoix(cible);
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert} aria-haspopup="menu" className="bouton-principal">
        <Plus className="size-4" strokeWidth={2.2} />
        Ajouter
        <ChevronDown className="size-3.5 opacity-80" strokeWidth={2.2} />
      </button>

      {ouvert ? (
        <>
          <button type="button" aria-label="Fermer le menu" onClick={() => setOuvert(false)} className="fixed inset-0 z-30 cursor-default" />
          <div role="menu" className="absolute top-full right-0 z-40 mt-2 w-[300px] rounded-[14px] border border-bordure bg-surface p-2 shadow-flottante">
            <ul className="flex flex-col">
              {entrees.map((entree, index) => {
                const Icone = entree.icone;
                const premiereNonLivree = !entree.livre && (index === 0 || entrees[index - 1]!.livre);
                return (
                  <li key={entree.cle} className={premiereNonLivree ? "mt-1.5 border-t border-bordure pt-1.5" : ""}>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={!entree.livre}
                      onClick={() => choisir(entree.cle)}
                      title={entree.livre ? undefined : "Prévu au cadrage, pas encore livré"}
                      className="flex w-full items-start gap-3 rounded-[10px] px-3 py-2 text-left hover:bg-surface-3 disabled:cursor-default disabled:hover:bg-transparent"
                    >
                      <span className={`grid size-8 shrink-0 place-items-center rounded-full ${entree.livre ? "bg-accent-fond text-accent-tres-fonce" : "bg-surface-3 text-attenue-2"}`}>
                        <Icone className="size-4" strokeWidth={1.7} />
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-[13px] font-medium ${entree.livre ? "text-texte" : "text-attenue-2"}`}>{entree.libelle}</span>
                        <span className="meta block truncate">{entree.precision}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}
