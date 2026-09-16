"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText, Image as IconeImage } from "lucide-react";
import { Carte } from "@/composants/interface/Carte";
import { FAMILLE_PIECE, type FicheVehicule, type PieceDossier } from "@/domaine/fiche";
import { date as formaterDate } from "@/lib/format";
import { urlPhoto } from "@/lib/photos";

/* ============================================================================
 * Le dossier d'un véhicule : ses pièces, en trois familles, ouvertes sur place.
 *
 * TROIS FAMILLES, DEMANDE DU MÉTIER DU 16 SEPTEMBRE 2026 : « la carte grise,
 * l'assurance en cours, le certificat de salubrité d'un côté ; les copies des
 * PV des visites techniques d'un autre ; les factures et autres documents
 * engendrant des coûts d'une autre part ». Ce n'est pas un rangement de
 * confort : on ne cherche pas la même chose au contrôle routier, au centre de
 * visite et en comité de coûts, et on ne veut pas lire les trois listes pour
 * trouver la bonne.
 *
 * Les pièces viennent de cinq sources — documents, visites, interventions,
 * dépenses, pleins — réunies par le lecteur de la fiche à une seule forme
 * (`PieceDossier`). L'onglet, lui, ne sait que grouper et ouvrir.
 *
 * LES ADRESSES SE SIGNENT AU CLIC, jamais au chargement. Le seau est privé :
 * chaque pièce s'ouvre par une adresse signée, valable un temps. Signer
 * trente pièces pour n'en regarder aucune serait trente appels pour rien.
 *
 * À TOUTE LARGEUR depuis le 16 septembre : réservé aux écrans larges la veille,
 * l'onglet disparaissait sous 1024 px sans qu'aucun message ne le dise. Sur un
 * écran étroit, la liste passe au-dessus du cadre.
 * ==========================================================================*/

const ORDRE: PieceDossier["famille"][] = ["reglementaire", "visite", "cout"];

function estImage(chemin: string): boolean {
  return /\.(jpe?g|png|webp|gif|avif)$/i.test(chemin);
}

export function OngletDossier({ fiche }: { fiche: FicheVehicule }) {
  const familles = useMemo(() => ORDRE.map((famille) => ({ famille, pieces: fiche.pieces.filter((p) => p.famille === famille) })), [fiche.pieces]);
  const [choisie, setChoisie] = useState<PieceDossier | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [etat, setEtat] = useState<"repos" | "signature" | "refus">("repos");

  /* La première pièce s'ouvre d'elle-même : un dossier qui s'ouvre vide
     demanderait un clic pour ne rien apprendre. */
  useEffect(() => {
    if (!choisie && fiche.pieces.length > 0) setChoisie(fiche.pieces[0]!);
  }, [fiche.pieces, choisie]);

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

  if (fiche.pieces.length === 0) {
    return (
      <Carte titre="Dossier" precision="Les pièces scannées de ce véhicule, en trois familles">
        <p className="text-[13px] leading-[1.5] text-texte-2">
          Aucune pièce n&apos;est attachée à ce véhicule. Une pièce s&apos;ajoute sur la ligne qui la porte — un document dans Conformité, une visite technique, une intervention, une dépense ou un plein — par « Modifier », puis le champ du fichier.
        </p>
      </Carte>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        {familles.map(({ famille, pieces }) => (
          <Carte key={famille} titre={`${FAMILLE_PIECE[famille].libelle} (${pieces.length})`} precision={FAMILLE_PIECE[famille].precision} sansMarge>
            {pieces.length === 0 ? (
              <p className="px-5 pb-4 text-[12.5px] text-texte-2">Aucune pièce.</p>
            ) : (
              <ul className="flex flex-col gap-1 px-3 pb-3">
                {pieces.map((p) => {
                  const active = choisie?.numero === p.numero && choisie.fichier === p.fichier;
                  return (
                    <li key={`${p.numero}-${p.fichier}`}>
                      <button
                        type="button"
                        onClick={() => setChoisie(p)}
                        aria-current={active}
                        className={`flex w-full items-start gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors ${active ? "bg-accent-fond text-accent-tres-fonce" : "hover:bg-surface-3"}`}
                      >
                        {estImage(p.fichier) ? <IconeImage className="mt-0.5 size-4 shrink-0 text-attenue" strokeWidth={1.8} /> : <FileText className="mt-0.5 size-4 shrink-0 text-attenue" strokeWidth={1.8} />}
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium">{p.libelle}</span>
                          <span className="meta block truncate">{[p.date ? formaterDate(p.date) : null, p.precision].filter(Boolean).join(" · ")}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Carte>
        ))}
      </div>

      <Carte
        titre={choisie?.libelle ?? "Pièce"}
        precision={choisie ? [choisie.date ? formaterDate(choisie.date) : null, choisie.precision].filter(Boolean).join(" · ") : undefined}
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
          ) : choisie && estImage(choisie.fichier) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={choisie.libelle} className="h-full w-full object-contain" />
          ) : (
            <iframe src={url} title={choisie?.libelle ?? "Pièce"} className="h-full w-full" />
          )}
        </div>
      </Carte>
    </div>
  );
}
