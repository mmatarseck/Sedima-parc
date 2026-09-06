import { nombre } from "@/lib/format";

/**
 * Graphique en barres, écrit à la main en SVG — charte §6, sans bibliothèque.
 *
 * Une série, une barre par mois, la valeur au-dessus, le libellé en dessous.
 * Une ligne de référence facultative (consommation attendue, budget) traverse
 * les barres ; celles qui la dépassent nettement passent en vigilance.
 */
export function GraphiqueBarres({
  points,
  reference,
  seuilPct = 15,
  unite = "",
  hauteur = 150,
}: {
  points: { libelle: string; valeur: number; precision?: string }[];
  /** Valeur de référence, dans la même unité que les points. */
  reference?: number;
  /** Écart au-delà duquel une barre est marquée en vigilance, en pourcentage. */
  seuilPct?: number;
  unite?: string;
  hauteur?: number;
}) {
  const largeur = 640;
  const margeBas = 26;
  const margeHaut = 22;
  const zone = hauteur - margeBas - margeHaut;
  const max = Math.max(reference ?? 0, ...points.map((p) => p.valeur)) * 1.08 || 1;
  const pas = largeur / Math.max(1, points.length);
  const largeurBarre = Math.min(44, pas * 0.56);

  return (
    <svg
      viewBox={`0 0 ${largeur} ${hauteur}`}
      className="block h-auto w-full"
      role="img"
      aria-label="Évolution mensuelle"
      style={{ maxHeight: hauteur * 1.4 }}
    >
      {/* Grille légère : trois traits, pour situer les hauteurs sans axe. */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={0}
          x2={largeur}
          y1={margeHaut + zone * (1 - f)}
          y2={margeHaut + zone * (1 - f)}
          stroke="var(--color-bordure)"
          strokeDasharray="2 4"
        />
      ))}

      {points.map((p, i) => {
        const h = (p.valeur / max) * zone;
        const x = i * pas + (pas - largeurBarre) / 2;
        const y = margeHaut + zone - h;
        const vigilance = reference !== undefined && p.valeur > reference * (1 + seuilPct / 100);
        return (
          <g key={p.libelle}>
            <rect
              x={x}
              y={y}
              width={largeurBarre}
              height={h}
              rx={6}
              fill={vigilance ? "var(--color-vigilance)" : "var(--color-accent)"}
              opacity={vigilance ? 0.85 : 0.9}
            >
              {/* Une seule chaîne : plusieurs nœuds texte dans un <title> SVG ne
                  s'hydratent pas à l'identique entre serveur et navigateur. */}
              <title>{`${p.libelle} : ${nombre(p.valeur)} ${unite}${p.precision ? ` — ${p.precision}` : ""}`}</title>
            </rect>
            <text
              x={x + largeurBarre / 2}
              y={y - 7}
              textAnchor="middle"
              fontSize="11"
              fontWeight="500"
              fill="var(--color-texte-2)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {nombre(p.valeur)}
            </text>
            <text
              x={x + largeurBarre / 2}
              y={hauteur - 8}
              textAnchor="middle"
              fontSize="10.5"
              fontWeight="500"
              letterSpacing="0.06em"
              fill="var(--color-attenue)"
            >
              {p.libelle}
            </text>
          </g>
        );
      })}

      {reference !== undefined ? (
        <g>
          <line
            x1={0}
            x2={largeur}
            y1={margeHaut + zone - (reference / max) * zone}
            y2={margeHaut + zone - (reference / max) * zone}
            stroke="var(--color-encre)"
            strokeWidth={1.2}
            strokeDasharray="4 4"
          />
          <text
            x={largeur - 4}
            y={margeHaut + zone - (reference / max) * zone - 5}
            textAnchor="end"
            fontSize="10.5"
            fontWeight="500"
            fill="var(--color-texte-2)"
          >
            référence {nombre(reference)} {unite}
          </text>
        </g>
      ) : null}
    </svg>
  );
}
