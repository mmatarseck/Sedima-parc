"use client";

import { useState } from "react";
import { montantCourt, nombre } from "@/lib/format";

/* ============================================================================
 * Graphique en barres **empilées**, écrit à la main en SVG — charte §6.
 *
 * Une barre par mois, découpée en tranches : on lit d'un coup le total du mois
 * **et** ce qui le compose. Sur les dépenses d'un véhicule, c'est la seule
 * lecture utile — un mois à trois millions ne dit rien tant qu'on ignore s'il
 * s'agit de carburant ou d'une réparation.
 *
 * **La légende est le filtre.** Cliquer « Carburant » n'affiche que le
 * carburant ; c'est là qu'on cherche naturellement à cliquer, et cela évite une
 * rangée de cases au-dessus du graphique. L'échelle se recalcule sur ce qui
 * reste affiché : isoler un poste minoritaire donnerait sinon des barres
 * écrasées en bas du cadre, illisibles.
 *
 * Les tranches nulles ne se dessinent pas : une bande de zéro pixel laisse une
 * couture visible sur la barre et fait croire à une valeur.
 * ==========================================================================*/

export interface SerieEmpilee {
  cle: string;
  libelle: string;
  /** Une couleur CSS de la charte — jamais une valeur en dur ailleurs. */
  couleur: string;
}

export function GraphiqueBarresEmpilees({
  points,
  series,
  unite = "",
  hauteur = 170,
  /** Vrai quand les valeurs sont des montants : la légende et les infobulles s'écrivent alors en francs. */
  montants = true,
}: {
  points: { libelle: string; valeurs: Record<string, number>; precision?: string }[];
  series: SerieEmpilee[];
  unite?: string;
  hauteur?: number;
  montants?: boolean;
}) {
  /* Nul tant qu'on n'a rien filtré : toutes les séries sont affichées. */
  const [retenues, setRetenues] = useState<string[] | null>(null);
  const visibles = retenues === null ? series : series.filter((s) => retenues.includes(s.cle));

  function basculer(cle: string) {
    setRetenues((actuelles) => {
      /* Premier clic sur une légende complète : on **isole** la série cliquée.
         C'est ce qu'on veut neuf fois sur dix, et cela évite de décocher les
         autres une à une. */
      if (actuelles === null) return [cle];
      const suivantes = actuelles.includes(cle) ? actuelles.filter((c) => c !== cle) : [...actuelles, cle];
      /* Plus rien de retenu, ou tout retenu : on revient à l'affichage complet
         plutôt que de montrer un cadre vide. */
      return suivantes.length === 0 || suivantes.length === series.length ? null : suivantes;
    });
  }

  const largeur = 640;
  const margeBas = 26;
  const margeHaut = 22;
  const zone = hauteur - margeBas - margeHaut;
  const totaux = points.map((p) => visibles.reduce((s, serie) => s + (p.valeurs[serie.cle] ?? 0), 0));
  const max = Math.max(...totaux, 1) * 1.08;
  const pas = largeur / Math.max(1, points.length);
  const largeurBarre = Math.min(44, pas * 0.56);
  const ecrire = (v: number) => (montants ? montantCourt(v) : `${nombre(v)} ${unite}`.trim());
  const filtre = retenues !== null;

  return (
    <div className="min-w-0">
      <svg
        viewBox={`0 0 ${largeur} ${hauteur}`}
        className="block h-auto w-full"
        role="img"
        aria-label={filtre ? `Évolution mensuelle — ${visibles.map((s) => s.libelle).join(", ")}` : "Évolution mensuelle par famille de charges"}
        style={{ maxHeight: hauteur * 1.4 }}
      >
        {/* Grille légère : trois traits, pour situer les hauteurs sans axe. */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={largeur} y1={margeHaut + zone * (1 - f)} y2={margeHaut + zone * (1 - f)} stroke="var(--color-bordure)" strokeDasharray="2 4" />
        ))}

        {points.map((p, i) => {
          const total = totaux[i]!;
          const x = i * pas + (pas - largeurBarre) / 2;
          const hauteurTotale = (total / max) * zone;
          /* On empile du bas vers le haut, dans l'ordre déclaré des séries : la
             même famille se retrouve toujours au même étage d'un mois à l'autre. */
          let cumul = 0;
          const tranches = visibles
            .map((serie) => {
              const valeur = p.valeurs[serie.cle] ?? 0;
              if (valeur <= 0) return null;
              const h = (valeur / max) * zone;
              const y = margeHaut + zone - cumul - h;
              cumul += h;
              return { serie, valeur, y, h };
            })
            .filter((t): t is NonNullable<typeof t> => t !== null);

          return (
            <g key={p.libelle}>
              {tranches.map(({ serie, valeur, y, h }, rang) => {
                /*
                 * Seule la tranche du sommet s'arrondit, et **par le haut
                 * seulement**. Un `rx` sur un rectangle arrondit ses quatre
                 * coins : la tranche haute se détachait alors de celle du
                 * dessous, et la barre paraissait cassée en deux. D'où le
                 * chemin tracé à la main pour cette tranche-là.
                 */
                const sommet = rang === tranches.length - 1;
                const r = Math.min(5, h / 2, largeurBarre / 2);
                const infobulle = (
                  /* Une seule chaîne : plusieurs nœuds texte dans un <title> SVG
                     ne s'hydratent pas à l'identique entre serveur et navigateur. */
                  <title>{`${p.libelle} · ${serie.libelle} : ${ecrire(valeur)}${p.precision ? ` — ${p.precision}` : ""}`}</title>
                );
                if (!sommet || r <= 0) {
                  return (
                    <rect key={serie.cle} x={x} y={y} width={largeurBarre} height={h} fill={serie.couleur}>
                      {infobulle}
                    </rect>
                  );
                }
                const d = `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + largeurBarre - r},${y} Q${x + largeurBarre},${y} ${x + largeurBarre},${y + r} L${x + largeurBarre},${y + h} Z`;
                return (
                  <path key={serie.cle} d={d} fill={serie.couleur}>
                    {infobulle}
                  </path>
                );
              })}
              {total > 0 ? (
                <text x={x + largeurBarre / 2} y={margeHaut + zone - hauteurTotale - 7} textAnchor="middle" fontSize="11" fontWeight="500" fill="var(--color-texte-2)" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {ecrire(total)}
                </text>
              ) : null}
              <text x={x + largeurBarre / 2} y={hauteur - 8} textAnchor="middle" fontSize="10.5" fontWeight="500" letterSpacing="0.06em" fill="var(--color-attenue)">
                {p.libelle}
              </text>
            </g>
          );
        })}
      </svg>

      {/* La légende, qui est aussi le filtre : sans elle, trois teintes empilées
          ne disent pas ce qu'elles portent — et rien ne permettrait d'isoler. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {series.map((s) => {
          const affichee = visibles.some((v) => v.cle === s.cle);
          return (
            <button
              key={s.cle}
              type="button"
              aria-pressed={affichee}
              onClick={() => basculer(s.cle)}
              title={affichee && filtre ? `Masquer ${s.libelle.toLowerCase()}` : `N'afficher que ${s.libelle.toLowerCase()}`}
              className={`inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-[12px] transition-colors ${
                affichee ? "border-bordure-champ text-texte-2 hover:border-accent hover:text-texte" : "border-transparent text-attenue-2 hover:text-texte-2"
              }`}
            >
              <span className={`size-2.5 shrink-0 rounded-[3px] ${affichee ? "" : "opacity-30"}`} style={{ background: s.couleur }} />
              {s.libelle}
            </button>
          );
        })}
        {filtre ? (
          <button type="button" onClick={() => setRetenues(null)} className="bouton-discret h-6 px-2 text-[12px]">
            Tout afficher
          </button>
        ) : (
          <span className="meta">Cliquez une famille pour l&apos;isoler</span>
        )}
      </div>
    </div>
  );
}
