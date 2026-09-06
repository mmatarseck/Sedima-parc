import { Echeance } from "@/composants/interface/Pastille";
import { estEtat, type ColonneRapport, type ValeurRapport } from "@/domaine/rapports";
import { date as formaterDate, kilometrage, montant, nombre, pourcentage } from "@/lib/format";

/* ============================================================================
 * Le rendu d'une valeur de rapport — un seul endroit.
 *
 * La table d'un rapport et l'aperçu du constructeur montrent les mêmes lignes :
 * si chacun formatait les siennes, ils finiraient par diverger, et l'aperçu ne
 * serait plus un aperçu. Le type de la colonne décide de tout : l'unité,
 * l'alignement, la fonte, le signe.
 * ==========================================================================*/

export const ALIGNEE_DROITE: ColonneRapport["type"][] = ["nombre", "montant", "pourcentage", "ecart", "distance", "volume", "duree", "poids"];
export const MONOSPACE: ColonneRapport["type"][] = ["nombre", "montant", "pourcentage", "ecart", "distance", "volume", "duree", "poids", "date"];

export function formaterValeur(v: ValeurRapport, type: ColonneRapport["type"]): string {
  if (v === null || v === "") return "—";
  if (estEtat(v)) return v.libelle;
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  switch (type) {
    case "montant":
      return typeof v === "number" ? montant(v) : String(v);
    case "distance":
      return typeof v === "number" ? kilometrage(v) : String(v);
    case "volume":
      return typeof v === "number" ? `${nombre(v, Number.isInteger(v) ? 0 : 1)} L` : String(v);
    case "poids":
      return typeof v === "number" ? `${nombre(v)} kg` : String(v);
    case "duree":
      return typeof v === "number" ? `${nombre(v, Number.isInteger(v) ? 0 : 1)} j` : String(v);
    case "pourcentage":
      return typeof v === "number" ? pourcentage(v, 1) : String(v);
    /* Un écart se lit avec son signe : « +12 % » ne dit pas la même chose que « 12 % ». */
    case "ecart":
      return typeof v === "number" ? `${v > 0 ? "+" : ""}${pourcentage(v, 1)}` : String(v);
    case "nombre":
      return typeof v === "number" ? nombre(v, Number.isInteger(v) ? 0 : 1) : String(v);
    case "date":
      return typeof v === "string" ? formaterDate(v) : String(v);
    default:
      return String(v);
  }
}

/** Le contenu d'une cellule : une pastille pour un état, le texte formaté sinon. */
export function CelluleRapport({ valeur, colonne }: { valeur: ValeurRapport; colonne: ColonneRapport }) {
  if (estEtat(valeur)) return <Echeance ton={valeur.ton}>{valeur.libelle}</Echeance>;
  return <span className={valeur === null ? "text-attenue-2" : ""}>{formaterValeur(valeur, colonne.type)}</span>;
}

export function classesCellule(colonne: ColonneRapport): string {
  return `${ALIGNEE_DROITE.includes(colonne.type) ? "text-right" : ""} ${MONOSPACE.includes(colonne.type) ? "code" : ""}`;
}
