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

export interface Apparies<I extends { numero: string }, D extends { numero: string }> {
  /** Une intervention et la dépense qui la règle. */
  paires: { intervention: I; depense: D }[];
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
export function apparierAtelier<I extends { numero: string }, D extends { numero: string }>(interventions: I[], depenses: D[]): Apparies<I, D> {
  const depensesParSuffixe = new Map<string, D>();
  for (const d of depenses) {
    const s = d.numero.startsWith("DEP-") ? suffixeDe(d.numero) : null;
    if (s && !depensesParSuffixe.has(s)) depensesParSuffixe.set(s, d);
  }
  const paires: { intervention: I; depense: D }[] = [];
  const interventionsSeules: I[] = [];
  const prises = new Set<string>();
  for (const i of interventions) {
    const s = i.numero.startsWith("INT-") ? suffixeDe(i.numero) : null;
    const d = s ? depensesParSuffixe.get(s) : undefined;
    if (d && !prises.has(d.numero)) {
      paires.push({ intervention: i, depense: d });
      prises.add(d.numero);
    } else interventionsSeules.push(i);
  }
  const depensesSeules = depenses.filter((d) => !prises.has(d.numero));
  return { paires, interventionsSeules, depensesSeules };
}
