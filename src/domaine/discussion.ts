/* ============================================================================
 * Discussion — le fil de conversation attaché à un objet du parc.
 *
 * Une fiche véhicule ou une fiche chauffeur porte un fil horodaté où l'équipe
 * échange : une remarque sur une panne, une question au correspondant de site,
 * un rappel avant une échéance. On y cite quelqu'un avec « @ » ; la personne
 * citée est prévenue. Le fil ne remplace pas le journal — le journal dit ce qui
 * est arrivé, la discussion dit ce qu'on en pense et ce qu'on décide.
 * ==========================================================================*/

/** Quelqu'un qu'on peut citer : un utilisateur de l'application ou un chauffeur. */
export interface Personne {
  id: string;
  nom: string;
  initiales: string;
  /** « Gestionnaire de parc », « Chauffeur — AA 032 EA ». */
  precision: string;
}

export interface Message {
  id: string;
  /** Objet du fil : « vehicule:AA032EA », « chauffeur:babacar-ndiaye ». */
  sujet: string;
  auteurId: string;
  auteur: string;
  initiales: string;
  /** ISO, à la seconde. */
  date: string;
  texte: string;
  /** Identifiants des personnes citées, résolus à l'envoi. */
  mentions: string[];
}

export type Segment = { type: "texte"; valeur: string } | { type: "mention"; valeur: string; personne: Personne };

/**
 * Découpe un texte en segments, les mentions à part. Une mention est « @ » suivi
 * du nom exact d'une personne connue — c'est ce que le sélecteur insère, et ce
 * qui évite de prendre un simple « @ » d'adresse pour une citation.
 */
export function segmenter(texte: string, personnes: Personne[]): Segment[] {
  const segments: Segment[] = [];
  const parNom = [...personnes].sort((a, b) => b.nom.length - a.nom.length);
  let reste = texte;
  while (reste.length > 0) {
    const arobase = reste.indexOf("@");
    if (arobase === -1) {
      segments.push({ type: "texte", valeur: reste });
      break;
    }
    const apres = reste.slice(arobase + 1);
    const personne = parNom.find((p) => apres.startsWith(p.nom));
    if (!personne) {
      segments.push({ type: "texte", valeur: reste.slice(0, arobase + 1) });
      reste = apres;
      continue;
    }
    if (arobase > 0) segments.push({ type: "texte", valeur: reste.slice(0, arobase) });
    segments.push({ type: "mention", valeur: personne.nom, personne });
    reste = apres.slice(personne.nom.length);
  }
  return segments;
}

export function mentionsDe(texte: string, personnes: Personne[]): string[] {
  const ids = new Set<string>();
  for (const s of segmenter(texte, personnes)) if (s.type === "mention") ids.add(s.personne.id);
  return [...ids];
}
