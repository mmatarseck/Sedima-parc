import { CreditCard, Radio } from "lucide-react";

/* ============================================================================
 * Les équipements d'un véhicule, en pastilles dans l'en-tête de sa fiche.
 *
 * Demande du métier du 3 octobre 2026 : « pour la présence de balise, il faut
 * une icône sur l'en-tête de la page du véhicule. Pareil pour les cartes
 * péage. » Une pastille par équipement présent — rien quand il manque : c'est
 * la présence qu'on cherche d'un coup d'œil, l'absence se lit dans l'onglet
 * Caractéristiques. Le numéro de la carte est au survol.
 *
 * Servent à la fiche d'un véhicule du parc comme à celle d'un camion de
 * transporteur.
 * ==========================================================================*/

export interface Equipements {
  balise?: boolean;
  carteSecaa?: boolean;
  numeroCarteSecaa?: string | null;
  carteAgeroute?: boolean;
  numeroCarteAgeroute?: string | null;
}

function Pastille({ icone, libelle, titre }: { icone: "balise" | "carte"; libelle: string; titre: string }) {
  const Icone = icone === "balise" ? Radio : CreditCard;
  return (
    <span title={titre} className="inline-flex h-6 items-center gap-1.5 rounded-full bg-accent-fond px-2.5 text-[12px] font-medium text-accent-fonce">
      <Icone className="size-3" strokeWidth={2} />
      {libelle}
    </span>
  );
}

export function PastillesEquipement({ e }: { e: Equipements }) {
  return (
    <>
      {e.balise ? <Pastille icone="balise" libelle="Balise" titre="Équipé d'une balise de géolocalisation" /> : null}
      {e.carteSecaa ? <Pastille icone="carte" libelle="SECAA" titre={`Carte péage SECAA${e.numeroCarteSecaa ? ` n° ${e.numeroCarteSecaa}` : " — numéro non renseigné"}`} /> : null}
      {e.carteAgeroute ? <Pastille icone="carte" libelle="Agéroute" titre={`Carte péage Agéroute${e.numeroCarteAgeroute ? ` n° ${e.numeroCarteAgeroute}` : " — numéro non renseigné"}`} /> : null}
    </>
  );
}
