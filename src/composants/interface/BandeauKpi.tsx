/**
 * Bandeau de KPI — une seule carte, les valeurs en colonnes séparées par des
 * filets. Parti pris repris des références de mise en page retenues par la
 * Direction des Opérations : plus compact et plus lisible qu'une rangée de
 * cartes détachées, parce que l'œil compare les colonnes entre elles.
 *
 * Les filets sont obtenus par une grille à interstices d'un pixel sur fond de
 * bordure : ils restent justes à toutes les largeurs, sans règle conditionnelle.
 *
 * Destiné au tableau de bord, structuré par axe SQDCM. Les écrans de liste s'en
 * passent : on y cherche et on y compare des lignes, on n'y lit pas d'agrégats.
 */

export interface Kpi {
  label: string;
  valeur: string;
  unite?: string;
  precision?: string;
  ton?: "favorable" | "defavorable" | "vigilance" | "neutre";
}

const COULEUR_VALEUR: Record<NonNullable<Kpi["ton"]>, string> = {
  favorable: "text-favorable",
  defavorable: "text-defavorable",
  vigilance: "text-vigilance",
  neutre: "text-texte",
};

export function BandeauKpi({ kpis }: { kpis: Kpi[] }) {
  return (
    /* `shrink-0` : le bandeau vit dans une colonne de hauteur fixe, et
       `overflow-hidden` ramène sa taille minimale automatique à zéro — sans
       cela, une vue un peu chargée l'écrase à un filet d'un pixel. */
    <div className="carte shrink-0 overflow-hidden bg-bordure">
      {/* Colonnes explicites plutôt qu'auto-fit : avec six tuiles, l'auto-fit
          casse en 5 + 1 dès que la place manque, et la sixième reste seule sur
          sa ligne. Ici la rupture se fait en 3 + 3, puis 2 + 2 + 2. */}
      <div
        className={`grid gap-px ${
          kpis.length === 6
            ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6"
            : kpis.length === 4
              ? "grid-cols-2 xl:grid-cols-4"
              : "grid-cols-[repeat(auto-fit,minmax(160px,1fr))]"
        }`}
      >
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-surface px-5 py-4">
            <div className="label-champ">{kpi.label}</div>
            <div
              className={`mt-2 text-[26px] leading-none font-semibold tracking-[-0.02em] tabular-nums ${
                COULEUR_VALEUR[kpi.ton ?? "neutre"]
              }`}
            >
              {kpi.valeur}
              {kpi.unite ? <span className="ml-1 text-[13px] font-medium text-attenue">{kpi.unite}</span> : null}
            </div>
            {kpi.precision ? <div className="meta mt-1.5">{kpi.precision}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
