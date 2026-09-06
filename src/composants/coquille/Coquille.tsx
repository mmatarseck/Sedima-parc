"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NAVIGATION } from "./navigation";
import { BarreApplication } from "./BarreApplication";
import { HAUTEUR_BARRE, LARGEUR_RAIL, LARGEUR_RAIL_RETRACTE } from "./mesures";

const CLE_RAIL = "sedima.parc.rail-retracte";

/**
 * Coquille de l'application : barre d'application en haut sur toute la largeur,
 * puis rail de navigation à gauche et contenu à droite.
 *
 * Le rail est blanc, séparé du contenu par un seul filet, avec des entrées
 * hautes et arrondies — le traitement des références. Il se rétracte en une
 * colonne d'icônes centrées, le bouton restant en bas, pour rendre la largeur
 * aux tableaux.
 */
export function Coquille({ children }: { children: React.ReactNode }) {
  const chemin = usePathname();
  const [retracte, setRetracte] = useState(false);

  // Lu après le montage : le serveur ne connaît pas la préférence du navigateur.
  useEffect(() => {
    try {
      setRetracte(localStorage.getItem(CLE_RAIL) === "1");
    } catch {
      /* stockage indisponible : le rail reste déployé */
    }
  }, []);

  function basculer() {
    setRetracte((precedent) => {
      const suivant = !precedent;
      try {
        localStorage.setItem(CLE_RAIL, suivant ? "1" : "0");
      } catch {
        /* sans persistance, le choix vaut pour la session */
      }
      return suivant;
    });
  }

  const largeurRail = retracte ? LARGEUR_RAIL_RETRACTE : LARGEUR_RAIL;

  return (
    <div className="flex min-h-screen flex-col" style={{ ["--hauteur-barre" as string]: `${HAUTEUR_BARRE}px` }}>
      <BarreApplication />

      <div
        className="grid flex-1 grid-cols-1 lg:grid-cols-[var(--largeur-rail)_minmax(0,1fr)]"
        style={{ ["--largeur-rail" as string]: `${largeurRail}px` }}
      >
        {/* Le rail reste à l'écran pendant que la page défile : sur une liste de
            147 véhicules, on doit pouvoir changer de module sans remonter. */}
        <aside
          className={`hidden flex-col overflow-hidden border-r border-bordure bg-surface py-4 lg:sticky lg:flex ${
            retracte ? "px-3" : "px-4"
          }`}
          style={{ top: HAUTEUR_BARRE, height: `calc(100vh - ${HAUTEUR_BARRE}px)` }}
        >
          <nav className="sans-barre flex min-h-0 flex-col gap-5 overflow-y-auto">
            {NAVIGATION.map((groupe) => (
              /* Le groupe de tête n'a pas de titre : il ne porte que l'écran
                 d'entrée, qu'il serait absurde de nommer deux fois. Il ne prend
                 donc ni intitulé, ni séparateur quand le rail est rétracté. */
              <div key={groupe.titre ?? groupe.entrees[0]!.href} className="flex flex-col gap-1">
                {groupe.titre === null ? null : retracte ? (
                  <span className="mx-auto mb-1 h-px w-6 bg-bordure" aria-hidden="true" />
                ) : (
                  <h2 className="micro-sur-titre mb-1.5 px-3">{groupe.titre}</h2>
                )}

                {groupe.entrees.map((entree) => {
                  const Icone = entree.icone;
                  const actif = entree.href === "/" ? chemin === "/" : chemin.startsWith(entree.href);
                  const disposition = retracte ? "size-10 justify-center" : "h-9 gap-3 px-3";

                  if (!entree.livre) {
                    return (
                      <span
                        key={entree.href}
                        title={`${entree.libelle} — écran prévu au cadrage, pas encore livré`}
                        className={`flex cursor-default items-center rounded-[10px] text-[13px] text-attenue-2 ${disposition}`}
                      >
                        <Icone className="size-[18px] shrink-0" strokeWidth={1.6} />
                        {!retracte && (
                          <>
                            <span className="truncate">{entree.libelle}</span>
                            <span className="ml-auto size-1.5 shrink-0 rounded-full bg-bordure-champ" />
                          </>
                        )}
                      </span>
                    );
                  }

                  return (
                    <Link
                      key={entree.href}
                      href={entree.href}
                      aria-current={actif ? "page" : undefined}
                      title={retracte ? entree.libelle : undefined}
                      className={[
                        "flex items-center rounded-[10px] text-[13px] transition-colors",
                        disposition,
                        actif
                          ? "bg-accent-fond font-semibold text-accent-tres-fonce"
                          : "font-medium text-texte-2 hover:bg-surface-3 hover:text-texte",
                      ].join(" ")}
                    >
                      <Icone
                        className={`size-[18px] shrink-0 ${actif ? "text-accent-fonce" : ""}`}
                        strokeWidth={actif ? 1.9 : 1.6}
                      />
                      {!retracte && (
                        <>
                          <span className="truncate">{entree.libelle}</span>
                          {entree.compteur ? (
                            <span className="badge-texte ml-auto rounded-full bg-defavorable px-1.5 py-px text-white">
                              {entree.compteur}
                            </span>
                          ) : null}
                        </>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="mt-auto shrink-0 border-t border-bordure pt-3">
            <button
              type="button"
              onClick={basculer}
              aria-expanded={!retracte}
              title={retracte ? "Déployer le menu" : "Rétracter le menu"}
              className={`flex items-center gap-3 rounded-[10px] text-[12.5px] font-medium text-attenue transition-colors hover:bg-surface-3 hover:text-texte ${
                retracte ? "size-10 justify-center" : "h-9 w-full px-3"
              }`}
            >
              {retracte ? (
                <PanelLeftOpen className="size-[18px] shrink-0" strokeWidth={1.6} />
              ) : (
                <PanelLeftClose className="size-[18px] shrink-0" strokeWidth={1.6} />
              )}
              {!retracte && "Rétracter le menu"}
              <span className="sr-only">{retracte ? "Déployer le menu" : "Rétracter le menu"}</span>
            </button>
          </div>
        </aside>

        <main className="min-w-0 lg:h-[calc(100vh-var(--hauteur-barre))] lg:overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
