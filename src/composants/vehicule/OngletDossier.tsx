"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText, Image as IconeImage } from "lucide-react";
import { Carte } from "@/composants/interface/Carte";
import { TYPE_DOCUMENT } from "@/domaine/libelles";
import type { FicheVehicule } from "@/domaine/fiche";
import { date as formaterDate } from "@/lib/format";
import { urlPhoto } from "@/lib/photos";

/* ============================================================================
 * Le dossier d'un véhicule : ses pièces, ouvertes sur place.
 *
 * Les scans étaient bien là — carte grise, assurance, procès-verbal de visite —
 * mais dispersés : une ligne de tableau dans l'onglet Conformité, un bouton
 * « Ouvrir » par ligne, et rien qui dise ce que le véhicule porte en tout.
 * Demande du métier du 15 septembre 2026 : un dossier, et la pièce qui s'ouvre
 * dans la page.
 *
 * SUR ORDINATEUR SEULEMENT, et c'est la demande. Lire une carte grise sur un
 * écran de téléphone, dans un cadre qui fait le tiers de l'écran, ne rend
 * service à personne : le bouton « Ouvrir » de la Conformité y reste le bon
 * geste, il confie la pièce au lecteur de PDF du téléphone, qui sait la
 * pincer et la tourner. L'onglet est donc masqué sous 1024 px.
 *
 * LES ADRESSES SE SIGNENT AU CLIC, jamais au chargement. Le seau est privé :
 * chaque pièce s'ouvre par une adresse signée, valable un temps. Signer les
 * trente pièces d'un véhicule pour n'en regarder aucune serait trente appels
 * pour rien — et trente adresses valides qui traînent.
 * ==========================================================================*/

/** Une pièce du dossier, telle que la vignette la montre. */
interface Piece {
  numero: string;
  libelle: string;
  precision: string;
  fichier: string;
  /** Vrai quand la pièce est une image : elle s'affiche alors dans une balise d'image plutôt que dans un cadre. */
  image: boolean;
}

function estImage(chemin: string): boolean {
  return /\.(jpe?g|png|webp|gif|avif)$/i.test(chemin);
}

export function OngletDossier({ fiche }: { fiche: FicheVehicule }) {
  const pieces = useMemo<Piece[]>(
    () =>
      fiche.documents
        .filter((d): d is typeof d & { fichier: string } => Boolean(d.fichier))
        .map((d) => ({
          numero: d.numero,
          libelle: TYPE_DOCUMENT[d.type] ?? d.type,
          precision: [d.numeroPiece, d.dateEffet ? `du ${formaterDate(d.dateEffet)}` : null, d.emetteur].filter(Boolean).join(" · ") || "sans référence",
          fichier: d.fichier,
          image: estImage(d.fichier),
        })),
    [fiche.documents],
  );

  const [choisie, setChoisie] = useState<Piece | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [etat, setEtat] = useState<"repos" | "signature" | "refus">("repos");

  /* La première pièce s'ouvre d'elle-même : un dossier qui s'ouvre vide
     demanderait un clic pour ne rien apprendre. */
  useEffect(() => {
    if (!choisie && pieces.length > 0) setChoisie(pieces[0]!);
  }, [pieces, choisie]);

  useEffect(() => {
    if (!choisie) return;
    let vivant = true;
    setEtat("signature");
    setUrl(null);
    void urlPhoto(choisie.fichier).then((adresse) => {
      if (!vivant) return;
      setUrl(adresse);
      setEtat(adresse ? "repos" : "refus");
    });
    return () => {
      vivant = false;
    };
  }, [choisie]);

  if (pieces.length === 0) {
    return (
      <Carte titre="Dossier" precision="Les pièces scannées de ce véhicule">
        <p className="text-[13px] leading-[1.5] text-texte-2">
          Aucune pièce n&apos;est attachée à ce véhicule. Une pièce s&apos;ajoute depuis l&apos;onglet Conformité, sur la ligne du document — « Modifier », puis « Le document ».
        </p>
      </Carte>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
      <Carte titre={`Dossier (${pieces.length})`} precision="Les pièces scannées de ce véhicule" sansMarge>
        <ul className="flex flex-col gap-1 px-3 pb-3">
          {pieces.map((p) => {
            const active = choisie?.numero === p.numero;
            return (
              <li key={p.numero}>
                <button
                  type="button"
                  onClick={() => setChoisie(p)}
                  aria-current={active}
                  className={`flex w-full items-start gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors ${
                    active ? "bg-accent-fond text-accent-tres-fonce" : "hover:bg-surface-3"
                  }`}
                >
                  {p.image ? <IconeImage className="mt-0.5 size-4 shrink-0 text-attenue" strokeWidth={1.8} /> : <FileText className="mt-0.5 size-4 shrink-0 text-attenue" strokeWidth={1.8} />}
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium">{p.libelle}</span>
                    <span className="meta block truncate">{p.precision}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Carte>

      <Carte
        titre={choisie?.libelle ?? "Pièce"}
        precision={choisie?.precision}
        action={
          url ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className="bouton-secondaire h-9">
              <ExternalLink className="size-4 text-texte-2" strokeWidth={1.7} />
              Ouvrir dans un onglet
            </a>
          ) : null
        }
        sansMarge
      >
        <div className="mx-5 mb-5 h-[70vh] min-h-[420px] overflow-hidden rounded-[12px] border border-bordure bg-surface-2">
          {etat === "signature" ? (
            <p className="grid h-full place-items-center text-[13px] text-texte-2">Ouverture de la pièce…</p>
          ) : etat === "refus" || !url ? (
            /* Pièce illisible : le seau a refusé de signer, ou la ligne cite un
               fichier qui n'y est plus. On le dit — un cadre vide laisserait
               croire à un document blanc. */
            <p className="grid h-full place-items-center px-6 text-center text-[13px] leading-[1.5] text-texte-2">
              Cette pièce n&apos;a pas pu être ouverte. Le fichier a peut-être été retiré du dossier, ou la session n&apos;a plus le droit de le lire.
            </p>
          ) : choisie?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={choisie.libelle} className="h-full w-full object-contain" />
          ) : (
            /* Le PDF s'affiche dans le lecteur du navigateur. Le titre porte le
               libellé de la pièce : c'est ce que les lecteurs d'écran annoncent. */
            <iframe src={url} title={choisie?.libelle ?? "Pièce"} className="h-full w-full" />
          )}
        </div>
      </Carte>
    </div>
  );
}
