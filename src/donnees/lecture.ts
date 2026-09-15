/* ============================================================================
 * Une lecture qui échoue arrête la page. Elle ne rend pas zéro.
 *
 * CE QUE CE MODULE CORRIGE. Quinze lecteurs traitaient l'échec de la même
 * façon : un avertissement dans le journal du serveur, puis une liste vide.
 * L'écran affichait alors « 0 dépense », « aucune visite technique », « 0 F de
 * maintenance » — des chiffres qu'on lit comme des faits. Personne ne lit le
 * journal du serveur, et personne ne pouvait distinguer « il n'y en a pas » de
 * « je n'ai pas pu regarder ».
 *
 * C'est la faute la plus coûteuse qu'un tableau de bord puisse commettre : on
 * décide sur un zéro. Un budget qu'on croit tenu, une échéance qu'on croit
 * lointaine, un véhicule qu'on croit sans incident.
 *
 * LE MOTIF QUI JUSTIFIAIT LE SILENCE A DISPARU. Les commentaires disaient
 * « table pas encore jouée : aucune ligne, pas d'erreur » — vrai quand les
 * migrations arrivaient une à une. Elles sont toutes jouées depuis le
 * 15 septembre 2026 : une lecture qui échoue aujourd'hui signale autre chose —
 * une table absente, un droit retiré, une requête fautive, le réseau.
 *
 * CE QUE VOIT L'UTILISATEUR. L'écran d'erreur de l'application
 * (`app/(application)/error.tsx`) : une phrase en français, le repère qui
 * retrouve l'erreur dans le journal de l'hébergeur, et un bouton « Réessayer ».
 * C'est laid, et c'est le but — mieux vaut une page qui refuse qu'une page qui
 * ment.
 *
 * CE QUI N'EST PAS CONCERNÉ. Les lectures qui **retombent sur un autre chemin**
 * quand la fonction d'un coup n'est pas jouée (`lire_prestataires()`,
 * `lire_transporteurs()`, `lire_tableau()`) : elles avertissent puis relisent
 * table par table, et rendent les mêmes données. Ce n'est pas un silence, c'est
 * un détour.
 * ==========================================================================*/

/** Ce que rend PostgREST : des lignes, ou une erreur. */
interface Lecture<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export class ErreurLecture extends Error {
  constructor(quoi: string, detail: string) {
    super(`${quoi} : lecture impossible — ${detail}`);
    this.name = "ErreurLecture";
  }
}

/**
 * Les lignes d'une lecture, ou une erreur qui arrête la page.
 *
 * `quoi` nomme ce qu'on lisait, en français et au pluriel : c'est la première
 * chose que lira celui qui ouvre le journal.
 */
export function lignesLues<T>(quoi: string, lecture: Lecture<T>): T[] {
  if (lecture.error) throw new ErreurLecture(quoi, lecture.error.message);
  return lecture.data ?? [];
}
