/* ============================================================================
 * Le nom d'un fournisseur, et sa clé de rapprochement.
 *
 * Deux règles, partagées par les chargements de la maintenance et du
 * transport, parce qu'elles doivent être les mêmes des deux côtés — un
 * fournisseur créé sous une graphie et cherché sous une autre laisse une
 * intervention sans garage, et une prestation sans prestataire (10 septembre
 * 2026, deux fois de suite).
 * ==========================================================================*/

/**
 * Le nom, débarrassé de ce que l'extraction y a laissé.
 *
 * Le classeur des bons porte « MOUSSA SENE RÉF PROFORMA : » — un fragment de
 * la cellule voisine collé au nom. Un prestataire ainsi nommé encombre le
 * référentiel pour toujours ; on coupe donc au premier mot-clé qui
 * n'appartient pas à un nom d'entreprise.
 */
export function nomPropre(brut: string): string {
  return brut
    .replace(/\s*(R[ÉE]F\.?\s*PROFORMA|N[°O]\s*FACTURE|FACTURE\s*:|DEVIS)[\s\S]*$/i, "")
    .replace(/[\s:;,-]+$/, "")
    .trim();
}

/**
 * La clé de rapprochement : majuscules, sans ponctuation ni espaces.
 *
 * Le classeur écrit « TATA PIKINE » là où le référentiel porte « TATA
 * Pikine ». Une comparaison exacte les tenait pour deux fournisseurs
 * différents ; celle-ci les réunit, en TypeScript comme en SQL — la requête
 * d'appariement applique la même transformation avec `regexp_replace`.
 */
export function cleFournisseur(nom: string): string {
  return nomPropre(nom).toUpperCase().replace(/[^A-Z0-9]/g, "");
}
