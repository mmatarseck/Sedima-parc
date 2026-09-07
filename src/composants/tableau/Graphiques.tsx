"use client";

import { useState } from "react";
import Link from "next/link";
import { nombre } from "@/lib/format";

/* ============================================================================
 * Les trois figures du tableau de bord.
 *
 * Écrites à la main en SVG, comme tout le reste de l'application (charte §6 :
 * aucune bibliothèque de graphiques). Chacune répond à une question distincte,
 * et c'est pourquoi il y en a trois et pas une :
 *
 *  - la **courbe** répond à « est-ce que ça va mieux ou moins bien ? » — d'où la
 *    période précédente en arrière-plan, sans laquelle une pente ne se juge pas ;
 *  - l'**anneau** répond à « où passe l'argent ? » — une part se lit d'un coup
 *    d'œil, une colonne de chiffres non ;
 *  - les **barres de contribution** répondent à « par où commencer ? » — le
 *    total ne dit jamais qui le fait.
 * ==========================================================================*/

const MOIS_COURT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export function libelleMoisCourt(mois: string): string {
  const [a, m] = mois.split("-");
  return `${MOIS_COURT[Number(m) - 1]} ${a!.slice(2)}`;
}

/* -- La courbe  -------------------------------------------------------------- */

/**
 * Un chemin lissé qui **ne dépasse jamais les valeurs mesurées**.
 *
 * Le lissage naïf — une Bézier dont les tangentes suivent les voisins — fait
 * bomber la courbe entre deux points : un taux de disponibilité mesuré à 100 %
 * puis 96 % passerait visuellement au-dessus de 100 %, et une consommation
 * pourrait plonger sous zéro. Sur un tableau de bord, une courbe qui invente
 * des valeurs entre deux mesures est un défaut, pas une élégance.
 *
 * D'où l'interpolation cubique **monotone** (tangentes de Fritsch–Carlson) :
 * elle arrondit les angles sans jamais sortir de l'intervalle des deux points
 * qu'elle relie. Entre deux mois, la courbe reste bornée par eux.
 */
function lisser(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0]!.x.toFixed(1)},${pts[0]!.y.toFixed(1)}`;
  if (pts.length === 2) return `M${pts[0]!.x.toFixed(1)},${pts[0]!.y.toFixed(1)} L${pts[1]!.x.toFixed(1)},${pts[1]!.y.toFixed(1)}`;

  const n = pts.length;
  /* Pentes des segments, puis tangentes en chaque point. */
  const pentes: number[] = [];
  for (let i = 0; i < n - 1; i++) pentes.push((pts[i + 1]!.y - pts[i]!.y) / (pts[i + 1]!.x - pts[i]!.x || 1));

  const tangentes: number[] = new Array(n).fill(0);
  tangentes[0] = pentes[0]!;
  tangentes[n - 1] = pentes[n - 2]!;
  for (let i = 1; i < n - 1; i++) {
    const avant = pentes[i - 1]!;
    const apres = pentes[i]!;
    /* Un extremum local garde une tangente nulle : c'est ce qui empêche le
       dépassement, et ce qui donne au sommet son arrondi net. */
    tangentes[i] = avant * apres <= 0 ? 0 : (avant + apres) / 2;
  }
  /* Bride de Fritsch–Carlson : la tangente ne peut excéder trois fois la pente
     du segment, sans quoi la courbe repart en arrière. */
  for (let i = 0; i < n - 1; i++) {
    const pente = pentes[i]!;
    if (pente === 0) {
      tangentes[i] = 0;
      tangentes[i + 1] = 0;
      continue;
    }
    const a = tangentes[i]! / pente;
    const b = tangentes[i + 1]! / pente;
    const norme = Math.hypot(a, b);
    if (norme > 3) {
      tangentes[i] = ((3 / norme) * a) * pente;
      tangentes[i + 1] = ((3 / norme) * b) * pente;
    }
  }

  let d = `M${pts[0]!.x.toFixed(1)},${pts[0]!.y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p = pts[i]!;
    const q = pts[i + 1]!;
    const dx = (q.x - p.x) / 3;
    d += ` C${(p.x + dx).toFixed(1)},${(p.y + tangentes[i]! * dx).toFixed(1)} ${(q.x - dx).toFixed(1)},${(q.y - tangentes[i + 1]! * dx).toFixed(1)} ${q.x.toFixed(1)},${q.y.toFixed(1)}`;
  }
  return d;
}

export interface PointCourbe {
  mois: string;
  valeur: number | null;
  /** La même dimension douze mois plus tôt — le fond de comparaison. */
  precedent: number | null;
  /** Le mois auquel `precedent` se rapporte, pour le dire dans l'infobulle. */
  moisPrecedent: string | null;
}

/**
 * Une courbe mensuelle sur deux séries.
 *
 * Au premier plan, les douze derniers mois : aire, points remarquables, dernière
 * valeur détachée. En arrière-plan, **les douze mois d'avant**, en pointillé
 * gris — parce qu'une pente ne se juge pas seule : −8 % sur un mois ne veut rien
 * dire tant qu'on ne sait pas ce que faisait la même période un an plus tôt.
 *
 * L'infobulle suit le survol et donne les deux valeurs et leur écart. Elle
 * remplace les `<title>` natifs, qui n'apparaissaient qu'au bout d'une seconde
 * et ne comparaient rien.
 *
 * L'échelle est propre à chaque courbe : deux dimensions n'ont ni la même unité
 * ni le même ordre de grandeur, et les superposer ne dirait rien.
 */
export function Courbe({
  points,
  cible,
  sens,
  teinte,
  unite,
  decimales = 0,
  sansLegende = false,
}: {
  points: PointCourbe[];
  cible: number | null;
  sens: "inf" | "sup" | null;
  teinte: string;
  unite?: string;
  decimales?: number;
  /** Vrai quand la légende est portée une fois pour toutes par le bloc qui aligne plusieurs courbes. */
  sansLegende?: boolean;
}) {
  const [survol, setSurvol] = useState<number | null>(null);

  const largeur = 520;
  const hauteur = 210;
  const gauche = 46;
  const droite = 14;
  const haut = 16;
  const bas = 30;

  const valeurs = points.map((v) => v.valeur).filter((v): v is number => v !== null);
  if (valeurs.length === 0) return <p className="meta py-10 text-center">Rien à tracer sur la période.</p>;

  const anciennes = points.map((v) => v.precedent).filter((v): v is number => v !== null);
  const bornes = [...valeurs, ...anciennes, ...(cible !== null ? [cible] : [])];
  const min = Math.min(...bornes);
  const max = Math.max(...bornes);
  const etendue = max - min || Math.abs(max) || 1;
  const basEchelle = min - etendue * 0.15;
  const hautEchelle = max + etendue * 0.15;
  const y = (v: number) => haut + (hauteur - haut - bas) * (1 - (v - basEchelle) / (hautEchelle - basEchelle));
  const x = (i: number) => gauche + ((largeur - gauche - droite) * i) / Math.max(1, points.length - 1);
  /* L'échelle descend un peu sous le minimum pour aérer : sur une série qui
     touche zéro, le repère du bas valait « -0 ». Un zéro n'a pas de signe. */
  const format = (v: number) => {
    const texte = nombre(v, Math.abs(v) >= 1000 ? 0 : decimales);
    return /^-0([.,]0+)?$/.test(texte) ? texte.slice(1) : texte;
  };

  /** Les segments continus d'une série : un trou ne se relie pas d'un trait. */
  const tracer = (lire: (p: PointCourbe) => number | null): string[] => {
    const traces: string[] = [];
    let courant: { x: number; y: number }[] = [];
    points.forEach((pt, i) => {
      const v = lire(pt);
      if (v === null) {
        if (courant.length) traces.push(lisser(courant));
        courant = [];
        return;
      }
      courant.push({ x: x(i), y: y(v) });
    });
    if (courant.length) traces.push(lisser(courant));
    return traces;
  };

  const traces = tracer((p) => p.valeur);
  const tracesAvant = tracer((p) => p.precedent);

  /*
   * L'aire se remplit **sous** la courbe, du trait jusqu'au bas du cadre,
   * dense au contact du trait et s'effaçant en descendant ; au-dessus, rien.
   * Décision du métier du 7 septembre 2026, à la refonte du tableau de bord :
   * le haut du cadre reste transparent, la teinte tient à la courbe.
   *
   * Elle ne se dessine que sur un trait continu : un trou dans la série ne doit
   * pas se remplir comme s'il valait quelque chose.
   */
  const premier = points.findIndex((pt) => pt.valeur !== null);
  const dernier = points.length - 1 - [...points].reverse().findIndex((pt) => pt.valeur !== null);
  const plancher = hauteur - bas;
  const aire = traces.length === 1 ? `${traces[0]} L${x(dernier).toFixed(1)},${plancher.toFixed(1)} L${x(premier).toFixed(1)},${plancher.toFixed(1)} Z` : null;

  const iMax = points.findIndex((pt) => pt.valeur === max);
  const iMin = points.findIndex((pt) => pt.valeur === min);
  const derniereValeur = points[dernier]?.valeur ?? null;
  const tenue = cible === null || sens === null || derniereValeur === null ? null : sens === "inf" ? derniereValeur <= cible : derniereValeur >= cible;
  const couleurDernier = tenue === false ? "var(--color-defavorable)" : tenue === true ? "var(--color-favorable)" : teinte;
  const identifiant = `aire-${points[0]?.mois ?? "x"}-${Math.round(min)}-${Math.round(max)}`;

  const vise = survol !== null ? points[survol] : null;
  const ecart = vise && vise.valeur !== null && vise.precedent !== null && vise.precedent !== 0 ? Math.round(((vise.valeur - vise.precedent) / Math.abs(vise.precedent)) * 1000) / 10 : null;
  const mieux = ecart === null || sens === null ? null : sens === "inf" ? ecart < 0 : ecart > 0;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${largeur} ${hauteur}`} className="block h-auto w-full" role="img" aria-label="Évolution mensuelle, comparée à la période précédente">
        <defs>
          <linearGradient id={identifiant} x1="0" y1="0" x2="0" y2="1">
            {/* Soutenu **au contact du trait**, transparent en descendant vers
                le bas du cadre : la teinte tient à la courbe, elle ne pèse pas
                sur l'échelle. Le dégradé court sur la boîte du remplissage, du
                point le plus haut de la série au plancher. */}
            <stop offset="0%" stopColor={teinte} stopOpacity="0.28" />
            <stop offset="100%" stopColor={teinte} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Trois repères chiffrés : on lit le niveau sans compter les carreaux. */}
        {[0, 0.5, 1].map((f) => {
          const v = basEchelle + (hautEchelle - basEchelle) * f;
          return (
            <g key={f}>
              <line x1={gauche} x2={largeur - droite} y1={y(v)} y2={y(v)} stroke="var(--color-bordure)" strokeDasharray={f === 0 ? undefined : "2 4"} />
              <text x={gauche - 6} y={y(v) + 3} textAnchor="end" fontSize="9.5" fill="var(--color-attenue)">
                {format(v)}
              </text>
            </g>
          );
        })}

        {aire ? <path d={aire} fill={`url(#${identifiant})`} /> : null}

        {/* La période précédente, en retrait : elle sert de fond, jamais de sujet. */}
        {tracesAvant.map((d) => (
          <path key={`avant-${d.slice(0, 24)}`} d={d} fill="none" stroke="var(--color-attenue-2)" strokeWidth={1.4} strokeDasharray="4 3" strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {cible !== null ? (
          <g>
            <line x1={gauche} x2={largeur - droite} y1={y(cible)} y2={y(cible)} stroke="var(--color-attenue)" strokeWidth={1.2} strokeDasharray="5 3" />
            <text x={largeur - droite} y={y(cible) - 5} textAnchor="end" fontSize="9.5" fontWeight="500" fill="var(--color-texte-2)">
              cible {sens === "inf" ? "≤" : "≥"} {format(cible)}
            </text>
          </g>
        ) : null}

        {traces.map((d) => (
          <path key={d.slice(0, 24)} d={d} fill="none" stroke={teinte} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {/* Le repère de survol : un pointillé qui traverse tout le cadre, du haut
            jusqu'à l'axe. Il rattache la valeur à son mois d'un seul trait. */}
        {survol !== null && points[survol]?.valeur !== null ? (
          <line x1={x(survol)} x2={x(survol)} y1={haut} y2={hauteur - bas} stroke="var(--color-attenue)" strokeWidth={1} strokeDasharray="3 3" />
        ) : null}

        {/* Deux points seulement : le dernier, et celui qu'on survole. Douze
            pastilles alignées encombraient le trait sans rien apprendre. */}
        {points.map((pt, i) => {
          if (pt.valeur === null || (i !== dernier && i !== survol)) return null;
          return (
            <circle
              key={pt.mois}
              cx={x(i)}
              cy={y(pt.valeur)}
              r={i === survol ? 5 : 4}
              fill={i === dernier ? couleurDernier : teinte}
              stroke="var(--color-surface)"
              strokeWidth={2}
            />
          );
        })}

        {/* Le plus haut et le plus bas de la période, chiffrés. */}
        {[iMax, iMin].map((i, rang) =>
          i < 0 || points[i]?.valeur === null || i === dernier ? null : (
            <text key={rang} x={x(i)} y={y(points[i]!.valeur!) + (rang === 0 ? -9 : 15)} textAnchor="middle" fontSize="9.5" fontWeight="500" fill="var(--color-attenue)">
              {format(points[i]!.valeur!)}
            </text>
          ),
        )}

        {/* La dernière valeur, détachée : c'est celle qu'on regarde en premier. */}
        {derniereValeur !== null ? (
          <text x={x(dernier)} y={y(derniereValeur) - 11} textAnchor="end" fontSize="11.5" fontWeight="700" fill={couleurDernier}>
            {format(derniereValeur)}
          </text>
        ) : null}

        {/* Les mois en abscisse : douze libellés ne tiendraient pas. */}
        {points.map((pt, i) =>
          /* Un mois sur deux, plus le dernier — mais jamais son voisin immédiat,
             les deux libellés se chevaucheraient. */
          i !== survol && (i === points.length - 1 || (i % 2 === 0 && i !== points.length - 2)) ? (
            /* Le premier et le dernier libellé s'ancrent sur le bord : centrés, ils
               déborderaient du cadre. */
            <text key={`${pt.mois}-x`} x={x(i)} y={hauteur - 10} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fontSize="9.5" fill="var(--color-attenue)">
              {libelleMoisCourt(pt.mois).replace(" ", " ")}
            </text>
          ) : null,
        )}

        {/* Le mois survolé, en pastille : l'œil retrouve sa colonne sans compter. */}
        {survol !== null ? (
          <g>
            <rect x={Math.min(largeur - droite - 56, Math.max(gauche, x(survol) - 28))} y={hauteur - 23} width={56} height={17} rx={8.5} fill="var(--color-encre)" />
            <text x={Math.min(largeur - droite - 28, Math.max(gauche + 28, x(survol)))} y={hauteur - 11} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#fff">
              {libelleMoisCourt(points[survol]!.mois)}
            </text>
          </g>
        ) : null}

        {/* Bandes de survol : toute la hauteur, pour n'avoir pas à viser le point. */}
        {points.map((pt, i) => (
          <rect
            key={`${pt.mois}-survol`}
            x={i === 0 ? gauche : (x(i - 1) + x(i)) / 2}
            y={haut}
            width={i === 0 || i === points.length - 1 ? (x(1) - x(0)) / 2 : x(1) - x(0)}
            height={hauteur - haut - bas}
            fill="transparent"
            onMouseEnter={() => setSurvol(i)}
            onFocus={() => setSurvol(i)}
            onMouseLeave={() => setSurvol(null)}
            onBlur={() => setSurvol(null)}
          />
        ))}
      </svg>

      {/*
        L'infobulle **s'ancre au point**, pas au haut du cadre : c'est ce qui la
        rattache à la mesure qu'elle commente. Elle se pose au-dessus, sauf tout
        en haut du cadre où elle passerait hors-champ — elle bascule alors sous
        le point. Aux bords, elle se recentre pour ne pas déborder de la carte.
      */}
      {vise && vise.valeur !== null ? (
        (() => {
          const px = (x(survol!) / largeur) * 100;
          const py = (y(vise.valeur) / hauteur) * 100;
          const dessous = y(vise.valeur) < haut + 52;
          const ancrage = px < 18 ? "0%" : px > 82 ? "-100%" : "-50%";
          return (
            <div
              className="pointer-events-none absolute z-10 rounded-[10px] bg-encre px-2.5 py-1.5 shadow-carte"
              style={{ left: `${px}%`, top: `${py}%`, transform: `translate(${ancrage}, ${dessous ? "14px" : "calc(-100% - 14px)"})` }}
            >
              <p className="text-[10px] font-semibold tracking-[0.06em] text-white/60 uppercase">{libelleMoisCourt(vise.mois)}</p>
              <p className="code mt-0.5 text-[13.5px] font-bold whitespace-nowrap text-white">
                {format(vise.valeur)}
                {unite ? <span className="ml-0.5 text-[10px] font-medium text-white/60">{unite}</span> : null}
              </p>
              {vise.precedent !== null ? (
                <p className="mt-0.5 text-[11px] whitespace-nowrap text-white/60">
                  {vise.moisPrecedent ? `${libelleMoisCourt(vise.moisPrecedent)} : ` : "un an plus tôt : "}
                  {format(vise.precedent)}
                  {ecart !== null ? (
                    <span className="ml-1.5 font-semibold" style={{ color: mieux === true ? "#9fd66b" : mieux === false ? "#ff9a8f" : "#fff" }}>
                      {ecart > 0 ? "↑" : "↓"} {nombre(Math.abs(ecart), 1)} %
                    </span>
                  ) : null}
                </p>
              ) : (
                <p className="mt-0.5 text-[11px] whitespace-nowrap text-white/60">Rien un an plus tôt</p>
              )}
            </div>
          );
        })()
      ) : null}

      {sansLegende ? null : (
        <p className="meta mt-1 flex items-center gap-3 px-1">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: teinte }} />
            douze derniers mois
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0 w-4 border-t-[1.4px] border-dashed border-attenue-2" />
            période précédente
          </span>
        </p>
      )}
    </div>
  );
}

/* -- Les barres mensuelles -------------------------------------------------- */

/**
 * La même série, mais **posée** au lieu d'être reliée.
 *
 * Pour un dénombrement — accidents, contraventions, pannes en ligne — ou pour un
 * flux du mois — dépenses, heures d'immobilisation —, la courbe ment par
 * construction : elle dessine des valeurs entre deux mois, là où il n'y a rien
 * à mesurer. La barre dit ce qui s'est passé dans le mois, et rien d'autre.
 *
 * La période précédente n'y est pas une seconde barre — deux barres par mois
 * sur douze mois deviennent illisibles — mais un **trait posé sur la barre**, à
 * la hauteur de l'an dernier : l'écart se lit d'un coup d'œil.
 */
export function BarresMensuelles({
  points,
  cible,
  sens,
  teinte,
  unite,
  decimales = 0,
  sansLegende = false,
}: {
  points: PointCourbe[];
  cible: number | null;
  sens: "inf" | "sup" | null;
  teinte: string;
  unite?: string;
  decimales?: number;
  sansLegende?: boolean;
}) {
  const [survol, setSurvol] = useState<number | null>(null);

  const largeur = 520;
  const hauteur = 210;
  const gauche = 46;
  const droite = 14;
  const haut = 16;
  const bas = 30;

  const valeurs = points.map((v) => v.valeur).filter((v): v is number => v !== null);
  if (valeurs.length === 0) return <p className="meta py-10 text-center">Rien à tracer sur la période.</p>;

  const anciennes = points.map((v) => v.precedent).filter((v): v is number => v !== null);
  /* Une barre part de zéro : l'échelle aussi, sinon la hauteur ment. */
  const max = Math.max(...valeurs, ...anciennes, ...(cible !== null ? [cible] : []), 0);
  const hautEchelle = max === 0 ? 1 : max * 1.18;
  const y = (v: number) => haut + (hauteur - haut - bas) * (1 - v / hautEchelle);
  const pas = (largeur - gauche - droite) / points.length;
  const largeurBarre = Math.min(26, pas * 0.62);
  const centre = (i: number) => gauche + pas * (i + 0.5);
  const format = (v: number) => nombre(v, Math.abs(v) >= 1000 ? 0 : decimales);

  /* Un compte se gradue en entiers ; une grandeur continue, en tiers d'échelle. */
  const entiers = decimales === 0 && max <= 6 && Number.isInteger(max);
  const graduations = entiers ? Array.from({ length: Math.max(2, Math.ceil(max) + 1) }, (_, k) => k) : [0, 0.5, 1].map((f) => hautEchelle * f);

  const zero = y(0);
  const dernier = points.length - 1 - [...points].reverse().findIndex((pt) => pt.valeur !== null);
  const vise = survol !== null ? points[survol] : null;
  const ecart = vise && vise.valeur !== null && vise.precedent !== null && vise.precedent !== 0 ? Math.round(((vise.valeur - vise.precedent) / Math.abs(vise.precedent)) * 1000) / 10 : null;
  const mieux = ecart === null || sens === null ? null : sens === "inf" ? ecart < 0 : ecart > 0;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${largeur} ${hauteur}`} className="block h-auto w-full" role="img" aria-label="Mois par mois, comparé à la période précédente">
        {/*
          Sur un dénombrement, les graduations tombent sur des **entiers**.
          Trois repères pris au tiers de l'échelle donnaient « 0 · 1 · 1 » quand
          le maximum valait un : deux fois le même chiffre, et une échelle qui
          semble cassée. Un compte se gradue en comptant.
        */}
        {graduations.map((v) => (
          <g key={v}>
            <line x1={gauche} x2={largeur - droite} y1={y(v)} y2={y(v)} stroke="var(--color-bordure)" strokeDasharray={v === 0 ? undefined : "2 4"} />
            <text x={gauche - 6} y={y(v) + 3} textAnchor="end" fontSize="9.5" fill="var(--color-attenue)">
              {format(v)}
            </text>
          </g>
        ))}

        {cible !== null && cible <= hautEchelle ? (
          <g>
            <line x1={gauche} x2={largeur - droite} y1={y(cible)} y2={y(cible)} stroke="var(--color-attenue)" strokeWidth={1.2} strokeDasharray="5 3" />
            <text x={largeur - droite} y={y(cible) - 5} textAnchor="end" fontSize="9.5" fontWeight="500" fill="var(--color-texte-2)">
              cible {sens === "inf" ? "≤" : "≥"} {format(cible)}
            </text>
          </g>
        ) : null}

        {points.map((pt, i) => {
          if (pt.valeur === null) return null;
          const x0 = centre(i) - largeurBarre / 2;
          const h = Math.max(pt.valeur > 0 ? 2 : 0, zero - y(pt.valeur));
          const yb = zero - h;
          const r = Math.min(4, largeurBarre / 2, h);
          /* Coins arrondis en haut seulement : un `rx` arrondirait aussi le pied
             de la barre, qui doit s'asseoir franchement sur l'axe. */
          const d =
            h <= 0
              ? ""
              : `M${x0},${zero} L${x0},${yb + r} Q${x0},${yb} ${x0 + r},${yb} L${x0 + largeurBarre - r},${yb} Q${x0 + largeurBarre},${yb} ${x0 + largeurBarre},${yb + r} L${x0 + largeurBarre},${zero} Z`;
          const tenue = cible === null || sens === null ? null : sens === "inf" ? pt.valeur <= cible : pt.valeur >= cible;
          const couleur = tenue === false ? "var(--color-defavorable)" : teinte;
          return (
            <g key={pt.mois}>
              {d ? <path d={d} fill={couleur} opacity={survol === null || survol === i ? 1 : 0.35} /> : null}
              {/* L'an dernier, posé sur la barre : l'écart se lit sans calcul. */}
              {pt.precedent !== null ? (
                <line x1={x0 - 2} x2={x0 + largeurBarre + 2} y1={y(pt.precedent)} y2={y(pt.precedent)} stroke="var(--color-attenue)" strokeWidth={1.4} strokeDasharray="3 2" />
              ) : null}
            </g>
          );
        })}

        {points.map((pt, i) =>
          /* Un mois sur deux, plus le dernier — jamais son voisin immédiat. */
          i !== survol && (i === points.length - 1 || (i % 2 === 0 && i !== points.length - 2)) ? (
            <text key={`${pt.mois}-x`} x={centre(i)} y={hauteur - 10} textAnchor="middle" fontSize="9.5" fill="var(--color-attenue)">
              {libelleMoisCourt(pt.mois)}
            </text>
          ) : null,
        )}

        {survol !== null ? (
          <g>
            <rect x={Math.min(largeur - droite - 56, Math.max(gauche, centre(survol) - 28))} y={hauteur - 23} width={56} height={17} rx={8.5} fill="var(--color-encre)" />
            <text x={Math.min(largeur - droite - 28, Math.max(gauche + 28, centre(survol)))} y={hauteur - 11} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#fff">
              {libelleMoisCourt(points[survol]!.mois)}
            </text>
          </g>
        ) : null}

        {/* La dernière valeur, chiffrée — sauf si elle vaut zéro : le chiffre se
            poserait sur l'axe, par-dessus la ligne de cible, et il n'y a de
            toute façon aucune barre à désigner. */}
        {points[dernier] !== undefined && points[dernier]!.valeur !== null && points[dernier]!.valeur !== 0 ? (
          <text x={centre(dernier)} y={y(points[dernier]!.valeur!) - 7} textAnchor="middle" fontSize="11.5" fontWeight="700" fill={teinte}>
            {format(points[dernier]!.valeur!)}
          </text>
        ) : null}

        {points.map((pt, i) => (
          <rect
            key={`${pt.mois}-survol`}
            x={gauche + pas * i}
            y={haut}
            width={pas}
            height={hauteur - haut - bas}
            fill="transparent"
            onMouseEnter={() => setSurvol(i)}
            onFocus={() => setSurvol(i)}
            onMouseLeave={() => setSurvol(null)}
            onBlur={() => setSurvol(null)}
          />
        ))}
      </svg>

      {vise && vise.valeur !== null ? (
        (() => {
          const px = (centre(survol!) / largeur) * 100;
          const py = (y(vise.valeur) / hauteur) * 100;
          const dessous = y(vise.valeur) < haut + 52;
          const ancrage = px < 18 ? "0%" : px > 82 ? "-100%" : "-50%";
          return (
            <div
              className="pointer-events-none absolute z-10 rounded-[10px] bg-encre px-2.5 py-1.5 shadow-carte"
              style={{ left: `${px}%`, top: `${py}%`, transform: `translate(${ancrage}, ${dessous ? "14px" : "calc(-100% - 14px)"})` }}
            >
              <p className="text-[10px] font-semibold tracking-[0.06em] text-white/60 uppercase">{libelleMoisCourt(vise.mois)}</p>
              <p className="code mt-0.5 text-[13.5px] font-bold whitespace-nowrap text-white">
                {format(vise.valeur)}
                {unite ? <span className="ml-0.5 text-[10px] font-medium text-white/60">{unite}</span> : null}
              </p>
              {vise.precedent !== null ? (
                <p className="mt-0.5 text-[11px] whitespace-nowrap text-white/60">
                  {vise.moisPrecedent ? `${libelleMoisCourt(vise.moisPrecedent)} : ` : "un an plus tôt : "}
                  {format(vise.precedent)}
                  {ecart !== null ? (
                    <span className="ml-1.5 font-semibold" style={{ color: mieux === true ? "#9fd66b" : mieux === false ? "#ff9a8f" : "#fff" }}>
                      {ecart > 0 ? "↑" : "↓"} {nombre(Math.abs(ecart), 1)} %
                    </span>
                  ) : null}
                </p>
              ) : (
                <p className="mt-0.5 text-[11px] whitespace-nowrap text-white/60">Rien un an plus tôt</p>
              )}
            </div>
          );
        })()
      ) : null}

      {sansLegende ? null : (
        <p className="meta mt-1 flex items-center gap-3 px-1">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-[3px]" style={{ background: teinte }} />
            mois par mois
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0 w-4 border-t-[1.4px] border-dashed border-attenue" />
            même mois l&apos;an dernier
          </span>
        </p>
      )}
    </div>
  );
}

/* -- L'anneau de répartition ------------------------------------------------ */

export interface PartAnneau {
  cle: string;
  libelle: string;
  valeur: number;
  teinte: string;
  precision?: string;
  href?: string;
}

/**
 * Un anneau de répartition, avec sa légende chiffrée.
 *
 * Le trou du milieu n'est pas décoratif : il porte le total, qui serait sinon à
 * reconstituer de tête. Les parts sont dessinées par `stroke-dasharray` sur un
 * seul cercle — un arc par part, sans un seul chemin à calculer.
 *
 * Une part sous 2 % n'est pas lisible en angle ; elle reste dans la légende,
 * qui est de toute façon l'endroit où l'on lit les chiffres.
 */
export function Anneau({ parts, total, libelleTotal, formater }: { parts: PartAnneau[]; total: number; libelleTotal: string; formater: (v: number) => string }) {
  const [survol, setSurvol] = useState<string | null>(null);
  const rayon = 54;
  const circonference = 2 * Math.PI * rayon;
  let cumul = 0;

  if (total <= 0) return <p className="meta py-10 text-center">Rien à répartir sur la période.</p>;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <svg viewBox="0 0 140 140" className="h-[150px] w-[150px] shrink-0" role="img" aria-label={`Répartition — ${libelleTotal}`}>
        <circle cx="70" cy="70" r={rayon} fill="none" stroke="var(--color-surface-3)" strokeWidth="18" />
        {parts.map((p) => {
          const part = p.valeur / total;
          const longueur = part * circonference;
          const decalage = -cumul * circonference;
          cumul += part;
          if (p.valeur <= 0) return null;
          return (
            <circle
              key={p.cle}
              cx="70"
              cy="70"
              r={rayon}
              fill="none"
              stroke={p.teinte}
              strokeWidth={survol === p.cle ? 22 : 18}
              strokeDasharray={`${longueur.toFixed(2)} ${(circonference - longueur).toFixed(2)}`}
              strokeDashoffset={decalage.toFixed(2)}
              transform="rotate(-90 70 70)"
              className="transition-[stroke-width]"
              onMouseEnter={() => setSurvol(p.cle)}
              onMouseLeave={() => setSurvol(null)}
            />
          );
        })}
        <text x="70" y="66" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--color-texte)">
          {formater(total)}
        </text>
        <text x="70" y="80" textAnchor="middle" fontSize="8.5" fill="var(--color-attenue)">
          {libelleTotal}
        </text>
      </svg>

      <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
        {parts.map((p) => {
          const part = total > 0 ? (p.valeur / total) * 100 : 0;
          const contenu = (
            <>
              <span className="mt-[5px] size-2.5 shrink-0 rounded-[3px]" style={{ background: p.teinte }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-texte">{p.libelle}</span>
                {p.precision ? <span className="meta block truncate">{p.precision}</span> : null}
              </span>
              <span className="shrink-0 text-right">
                <span className="code block text-[12.5px] font-medium text-texte">{formater(p.valeur)}</span>
                <span className="meta code block">{nombre(part, 1)} %</span>
              </span>
            </>
          );
          return (
            <li
              key={p.cle}
              onMouseEnter={() => setSurvol(p.cle)}
              onMouseLeave={() => setSurvol(null)}
              className={`flex items-start gap-2.5 rounded-[8px] px-1.5 py-1 transition-colors ${survol === p.cle ? "bg-surface-2" : ""}`}
            >
              {p.href ? (
                <Link href={p.href} className="flex min-w-0 flex-1 items-start gap-2.5">
                  {contenu}
                </Link>
              ) : (
                contenu
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* -- Les barres de contribution --------------------------------------------- */

export interface LigneContribution {
  cle: string;
  libelle: string;
  precision?: string;
  valeur: number;
  href?: string;
}

/**
 * Qui fait le total.
 *
 * Un coût de parc ne se corrige pas en bloc : il se corrige sur les trois ou
 * quatre véhicules qui le font. Les barres sont classées, chacune porte sa part,
 * et la note du bas donne le **cumul** — « six véhicules sur dix-neuf font la
 * moitié de la dépense » est la phrase qui décide par où commencer.
 */
export function BarresContribution({
  lignes,
  total,
  formater,
  teinte,
  universLibelle,
  universTotal,
}: {
  lignes: LigneContribution[];
  total: number;
  formater: (v: number) => string;
  teinte: string;
  /** Ce que le classement échantillonne : « 19 véhicules ». */
  universLibelle: string;
  universTotal: number;
}) {
  if (lignes.length === 0 || total <= 0) return <p className="meta py-10 text-center">Rien à classer sur la période.</p>;
  const plafond = Math.max(...lignes.map((l) => l.valeur));
  const cumul = lignes.reduce((s, l) => s + l.valeur, 0);
  const partCumul = total > 0 ? (cumul / total) * 100 : 0;

  return (
    <div className="flex flex-col gap-2.5">
      {lignes.map((l) => {
        const part = total > 0 ? (l.valeur / total) * 100 : 0;
        const contenu = (
          <>
            <span className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[13px] font-medium text-texte">{l.libelle}</span>
              <span className="code shrink-0 text-[12.5px] text-texte">
                {formater(l.valeur)}
                <span className="ml-1.5 text-attenue">{nombre(part, 1)} %</span>
              </span>
            </span>
            <span className="mt-1 block h-2 w-full overflow-hidden rounded-full bg-surface-3">
              <span className="block h-full rounded-full transition-[width]" style={{ width: `${Math.max(2, (l.valeur / plafond) * 100)}%`, background: teinte }} />
            </span>
            {l.precision ? <span className="meta mt-0.5 block truncate">{l.precision}</span> : null}
          </>
        );
        return (
          <div key={l.cle} className="min-w-0">
            {l.href ? (
              <Link href={l.href} className="block rounded-[8px] px-1 py-0.5 transition-colors hover:bg-surface-2">
                {contenu}
              </Link>
            ) : (
              <div className="px-1">{contenu}</div>
            )}
          </div>
        );
      })}
      <p className="meta border-t border-bordure pt-2">
        Ces {lignes.length} font <strong className="font-semibold text-texte">{nombre(partCumul, 1)} %</strong> du total, sur {universTotal} {universLibelle}.
      </p>
    </div>
  );
}
