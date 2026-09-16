"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText, Image as IconeImage, Plus, Trash2 } from "lucide-react";
import { Carte } from "@/composants/interface/Carte";
import { CHAMPS } from "@/composants/transactions/champs";
import { useEdition } from "@/composants/transactions/ContexteEdition";
import { FAMILLE_PIECE, type FicheVehicule, type PieceDossier } from "@/domaine/fiche";
import { date as formaterDate } from "@/lib/format";
import { urlPhoto } from "@/lib/photos";
import { useAjoutVehicule } from "./ajout";

/* ============================================================================
 * Le dossier d'un véhicule : ses pièces, en deux familles, ouvertes sur place.
 *
 * DEUX FAMILLES, TOUJOURS LÀ. Le réglementaire — carte grise, assurance,
 * salubrité — et les procès-verbaux de visite. Les cartes sont là pour chaque
 * véhicule, vides ou non (métier, 16 septembre 2026 : « tous les véhicules
 * n'ont pas les sous-dossiers ») : un dossier vide dit ce qui manque, et c'est
 * depuis chaque famille qu'on dépose ce qui lui revient.
 *
 * LES FACTURES N'Y SONT PLUS. Elles y ont vécu quelques heures, en troisième
 * famille ; le métier les a voulues « sur chaque ligne de dépense équivalente »
 * et a retiré la rubrique le soir même. C'est plus juste : une facture se
 * cherche à côté du montant qu'elle justifie, pas dans un classeur à part. Elle
 * s'ouvre depuis la ligne, dans l'atelier et dans les dépenses.
 *
 * DÉPOSER, C'EST CRÉER LA LIGNE QUI PORTE LA PIÈCE. Une pièce n'existe pas
 * seule : un scan d'assurance est un document, un PV est une visite. Le bouton
 * ouvre donc le formulaire de la ligne, avec son champ de fichier — et la
 * pièce arrive au dossier avec ce qui la nomme.
 *
 * RETIRER, C'EST VIDER LE CHAMP SUR LA LIGNE, pas effacer la ligne : la
 * dépense reste, la visite reste ; seul le fichier s'en va. Le formulaire
 * s'ouvre sur ce seul champ, et sa trace dit qui l'a retiré.
 *
 * LES ADRESSES SE SIGNENT AU CLIC, jamais au chargement : le seau est privé,
 * et signer trente pièces pour n'en regarder aucune serait trente appels pour
 * rien.
 * ==========================================================================*/

const ORDRE: PieceDossier["famille"][] = ["reglementaire", "visite"];

/** La ligne qu'on crée pour déposer dans une famille. */
const DEPOT: Record<PieceDossier["famille"], { cible: "document" | "visite" | "depense"; libelle: string }> = {
  reglementaire: { cible: "document", libelle: "Déposer un document" },
  visite: { cible: "visite", libelle: "Déposer un procès-verbal" },
};

function estImage(chemin: string): boolean {
  return /\.(jpe?g|png|webp|gif|avif)$/i.test(chemin);
}

export function OngletDossier({ fiche }: { fiche: FicheVehicule }) {
  const ajouter = useAjoutVehicule(fiche);
  const { demander } = useEdition();
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

  /* Retirer : le formulaire de la ligne porteuse, réduit à son champ de fichier,
     ouvert avec la pièce en place — on l'efface, on enregistre, la trace le dit. */
  function retirer(p: PieceDossier) {
    /* Une licence n'a pas de transaction porteuse : sa pièce se lit ici, elle
       se change dans le référentiel des licences. */
    if (p.type === "licence") return;
    const champ = CHAMPS[p.type].find((c) => c.cle === p.champFichier);
    if (!champ) return;
    demander({ type: p.type, numero: p.numero, titre: `Retirer la pièce · ${p.libelle}`, champs: [champ], valeurs: { [p.champFichier]: p.fichier } });
  }

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        {familles.map(({ famille, pieces }) => (
          <Carte
            key={famille}
            titre={`${FAMILLE_PIECE[famille].libelle} (${pieces.length})`}
            precision={FAMILLE_PIECE[famille].precision}
            action={
              <button type="button" onClick={() => ajouter(DEPOT[famille].cible)} className="bouton-discret h-8 px-2 text-[12px]" title={`${DEPOT[famille].libelle} — la pièce se joint sur la ligne qui la porte`}>
                <Plus className="size-3.5" strokeWidth={2} />
                Déposer
              </button>
            }
            sansMarge
          >
            {pieces.length === 0 ? (
              <p className="px-5 pb-4 text-[12.5px] text-texte-2">Aucune pièce — « Déposer » ouvre la ligne qui la portera.</p>
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
        precision={choisie ? [choisie.date ? formaterDate(choisie.date) : null, choisie.precision].filter(Boolean).join(" · ") : "Choisissez une pièce dans une famille, ou déposez-en une"}
        action={
          choisie ? (
            <span className="flex items-center gap-2">
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="bouton-secondaire h-9">
                  <ExternalLink className="size-4 text-texte-2" strokeWidth={1.7} />
                  Ouvrir dans un onglet
                </a>
              ) : null}
              {choisie.type !== "licence" ? (
                <button type="button" onClick={() => retirer(choisie)} className="bouton-secondaire h-9 text-defavorable" title="Retire le fichier de la ligne ; la ligne reste">
                  <Trash2 className="size-4" strokeWidth={1.7} />
                  Retirer
                </button>
              ) : null}
            </span>
          ) : null
        }
        sansMarge
      >
        <div className="mx-5 mb-5 h-[70vh] min-h-[420px] overflow-hidden rounded-[12px] border border-bordure bg-surface-2">
          {!choisie ? (
            <p className="grid h-full place-items-center px-6 text-center text-[13px] leading-[1.5] text-texte-2">Aucune pièce n&apos;est attachée à ce véhicule.</p>
          ) : etat === "signature" ? (
            <p className="grid h-full place-items-center text-[13px] text-texte-2">Ouverture de la pièce…</p>
          ) : etat === "refus" || !url ? (
            /* Pièce illisible : le seau a refusé de signer, ou la ligne cite un
               fichier qui n'y est plus. On le dit — un cadre vide laisserait
               croire à un document blanc. */
            <p className="grid h-full place-items-center px-6 text-center text-[13px] leading-[1.5] text-texte-2">
              Cette pièce n&apos;a pas pu être ouverte. Le fichier a peut-être été retiré du dossier, ou la session n&apos;a plus le droit de le lire.
            </p>
          ) : estImage(choisie.fichier) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={choisie.libelle} className="h-full w-full object-contain" />
          ) : (
            <iframe src={url} title={choisie.libelle} className="h-full w-full" />
          )}
        </div>
      </Carte>
    </div>
  );
}
