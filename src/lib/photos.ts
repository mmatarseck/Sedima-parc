/* ============================================================================
 * Les photos des pièces justificatives, côté navigateur.
 *
 * Une photo prise au téléphone pèse plusieurs mégaoctets : elle est réduite
 * ici avant de partir (1 280 px de côté, JPEG). Base branchée, elle monte
 * dans le seau privé « pieces » de Supabase (migration 0014) et la ligne
 * garde son chemin ; on la relit par une adresse signée, avec sa session.
 * En démonstration, une vignette (640 px) vit dans le navigateur sous un
 * identifiant local — assez pour montrer le geste, pas pour archiver.
 *
 * Une référence est donc soit « pieces/… » (la base), soit « local:… » (la
 * démonstration), soit un simple nom de fichier venu d'avant ce module.
 * ==========================================================================*/

import { authentificationReelle } from "@/lib/session-demo";
import { clientNavigateur } from "@/lib/supabase";

export type ReferencePhoto = string;

/** Réduit une image à `cote` px de côté au plus, en JPEG. Une image déjà petite ressort telle quelle. */
export async function reduireImage(fichier: File, cote: number, qualite: number): Promise<Blob> {
  const bitmap = await createImageBitmap(fichier);
  const echelle = Math.min(1, cote / Math.max(bitmap.width, bitmap.height));
  if (echelle === 1 && fichier.type === "image/jpeg" && fichier.size < 400_000) return fichier;
  const toile = document.createElement("canvas");
  toile.width = Math.round(bitmap.width * echelle);
  toile.height = Math.round(bitmap.height * echelle);
  const ctx = toile.getContext("2d");
  if (!ctx) return fichier;
  ctx.drawImage(bitmap, 0, 0, toile.width, toile.height);
  return new Promise((resoudre) => toile.toBlob((b) => resoudre(b ?? fichier), "image/jpeg", qualite));
}

function lireEnDataUrl(blob: Blob): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resoudre(String(lecteur.result));
    lecteur.onerror = () => rejeter(lecteur.error);
    lecteur.readAsDataURL(blob);
  });
}

/**
 * Dépose une photo. `dossier` range la pièce : « demandes », « transferts »,
 * « pleins », « depenses ». Rend la référence à garder sur la ligne, ou le
 * motif du refus.
 */
export async function televerserPhoto(fichier: File, dossier: string): Promise<{ ref: ReferencePhoto } | { refus: string }> {
  if (!fichier.type.startsWith("image/")) return { refus: "Ce fichier n'est pas une image." };
  try {
    if (!authentificationReelle()) {
      const vignette = await reduireImage(fichier, 640, 0.6);
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(`sedima.parc.photos.${id}`, await lireEnDataUrl(vignette));
      return { ref: `local:${id}` };
    }
    const reduite = await reduireImage(fichier, 1280, 0.75);
    const jour = new Date().toISOString().slice(0, 10);
    const chemin = `${dossier}/${jour.slice(0, 4)}/${jour.slice(5, 7)}/${jour}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const depot = await clientNavigateur().storage.from("pieces").upload(chemin, reduite, { contentType: "image/jpeg", upsert: false });
    if (depot.error) return { refus: `Photo refusée : ${depot.error.message}` };
    return { ref: `pieces/${chemin}` };
  } catch (e) {
    return { refus: e instanceof Error ? (/quota/i.test(e.message) ? "Le navigateur n'a plus de place pour cette photo." : e.message) : "La photo n'a pas pu être lue." };
  }
}

/** Une adresse à afficher pour une référence ; nulle si la photo n'est pas accessible (un nom d'avant, un chemin sans session). */
export async function urlPhoto(ref: ReferencePhoto | null | undefined): Promise<string | null> {
  if (!ref) return null;
  if (ref.startsWith("local:")) {
    try {
      return localStorage.getItem(`sedima.parc.photos.${ref.slice(6)}`);
    } catch {
      return null;
    }
  }
  if (ref.startsWith("pieces/") && authentificationReelle()) {
    const r = await clientNavigateur().storage.from("pieces").createSignedUrl(ref.slice(7), 3600);
    return r.data?.signedUrl ?? null;
  }
  return null;
}

/** Vrai quand la référence désigne une vraie image, et non un simple nom d'avant ce module. */
export function photoAffichable(ref: string | null | undefined): boolean {
  return Boolean(ref && (ref.startsWith("local:") || ref.startsWith("pieces/")));
}
