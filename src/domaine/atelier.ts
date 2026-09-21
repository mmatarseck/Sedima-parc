/* ============================================================================
 * L'atelier d'un véhicule : une ligne par fait, même quand la base en tient deux.
 *
 * Le chargeur des bons de commande a créé, par bon, une **intervention** — ce
 * qu'on a fait, chez qui, au compteur, combien de jours — et une **dépense** —
 * le poste, le montant, l'origine, la facture. Jumelles par leur suffixe :
 * `INT-C-00034` et `DEP-C-00034`. C'est juste en base : les dépenses sont la
 * maille de toutes les analyses de coût, et l'intervention porte ce que le
 * garage seul sait. Mais c'est un seul fait, et le métier n'a pas à le lire
 * deux fois (16 septembre 2026, décision « A » : fusionner à l'affichage).
 *
 * L'appariement est exact sur la base réelle — 239 paires sur 298
 * interventions, même véhicule, même montant, même date pour toutes. Ce module
 * ne devine rien de plus : deux numéros qui ne se répondent pas restent deux
 * lignes.
 * ==========================================================================*/

/** Ce qui suit le préfixe : « INT-C-00034 » → « C-00034 ». Nul si le numéro n'a pas cette forme. */
export function suffixeDe(numero: string): string | null {
  const m = /^(?:INT|DEP)-(.+)$/.exec(numero);
  return m ? m[1]! : null;
}

type Numerote = { numero: string; reference?: string | null };

export interface Apparies<I extends Numerote, D extends Numerote> {
  /**
   * Une intervention et la dépense qui la règle. Une facture saisie dans
   * l'application en a plusieurs : `lignes` les porte toutes, `depense` est la
   * première — de quoi lire le poste, l'origine et la pièce jointe.
   */
  paires: { intervention: I; depense: D; lignes: D[] }[];
  /** Interventions sans dépense en face — saisies dans l'application, ou d'un autre chargement. */
  interventionsSeules: I[];
  /** Dépenses sans intervention en face — la caisse, les fournitures achetées sans passage à l'atelier. */
  depensesSeules: D[];
}

/**
 * Apparie interventions et dépenses par leur suffixe de numéro. Une dépense ne
 * se donne qu'une fois : deux interventions au même suffixe seraient une faute
 * de numérotation, et la seconde resterait seule plutôt que de compter la
 * dépense deux fois.
 */
export function apparierAtelier<I extends Numerote, D extends Numerote>(interventions: I[], depenses: D[]): Apparies<I, D> {
  /* Les lignes d'une facture saisie se rangent sous leur clé, et sortent du jeu
     des suffixes : `INT-2026-90005` et `DEP-2026-90005` peuvent porter le même
     suffixe sans être la même facture. */
  const lignesParCle = new Map<string, D[]>();
  for (const d of depenses) {
    const k = cleFactureDe(d.reference);
    if (k) lignesParCle.set(k, [...(lignesParCle.get(k) ?? []), d]);
  }
  const depensesParSuffixe = new Map<string, D>();
  for (const d of depenses) {
    if (cleFactureDe(d.reference)) continue;
    const s = d.numero.startsWith("DEP-") ? suffixeDe(d.numero) : null;
    if (s && !depensesParSuffixe.has(s)) depensesParSuffixe.set(s, d);
  }
  const paires: { intervention: I; depense: D; lignes: D[] }[] = [];
  const interventionsSeules: I[] = [];
  const prises = new Set<string>();
  for (const i of interventions) {
    const k = cleFactureDe(i.reference);
    if (k) {
      const lignes = (lignesParCle.get(k) ?? []).filter((d) => !prises.has(d.numero));
      if (lignes.length) {
        paires.push({ intervention: i, depense: lignes[0]!, lignes });
        for (const d of lignes) prises.add(d.numero);
      } else interventionsSeules.push(i);
      continue;
    }
    const s = i.numero.startsWith("INT-") ? suffixeDe(i.numero) : null;
    const d = s ? depensesParSuffixe.get(s) : undefined;
    if (d && !prises.has(d.numero)) {
      paires.push({ intervention: i, depense: d, lignes: [d] });
      prises.add(d.numero);
    } else interventionsSeules.push(i);
  }
  const depensesSeules = depenses.filter((d) => !prises.has(d.numero));
  return { paires, interventionsSeules, depensesSeules };
}

/* -- La facture saisie dans l'application -------------------------------------- */

/**
 * La clé d'une facture saisie : « FAC-260921-K3F9 », écrite dans la référence de
 * l'intervention et de chacune de ses lignes de dépense (21 septembre 2026).
 *
 * Le suffixe ne peut pas servir ici : une facture a plusieurs lignes, et les
 * numéros qu'attribue l'application se renumérotent quand la base les a déjà
 * pris — chaque table de son côté. La clé, elle, est posée une fois à la saisie
 * et ne bouge plus.
 */
const CLE_FACTURE = /\bFAC-\d{6}-[A-Z0-9]{4}\b/;

export function cleFactureDe(reference: string | null | undefined): string | null {
  return CLE_FACTURE.exec(reference ?? "")?.[0] ?? null;
}
