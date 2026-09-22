"use client";

import { Carte } from "@/composants/interface/Carte";
import { Courbe, type PointCourbe } from "@/composants/tableau/Graphiques";
import { consommationParMois, decalerMois, dernierPleinAPlein, type PleinConso, type ReleveConso } from "@/domaine/consommation";
import { date, kilometrage, nombre } from "@/lib/format";

/* ============================================================================
 * La consommation du véhicule en courbes (métier, 22 septembre 2026) : L/100 km
 * contre la référence de sa catégorie, F/100 km — ce que le carburant coûte à
 * la route —, les douze derniers mois complets au premier plan, les douze
 * d'avant en pointillé. Au-dessus, les repères qu'on cite : les moyennes de
 * l'année et le dernier plein à plein.
 * ==========================================================================*/

export function ConsommationCarburant({ pleins, releves, referenceL100, moisCourant }: { pleins: PleinConso[]; releves: ReleveConso[]; referenceL100: number; moisCourant: string }) {
  /* Vingt-quatre mois complets : les douze derniers, et les douze d'avant pour le fond. */
  const mois = Array.from({ length: 24 }, (_, i) => decalerMois(moisCourant, i - 24));
  const conso = consommationParMois(pleins, releves, mois);
  const recents = conso.slice(12);
  const anciens = conso.slice(0, 12);
  const points = (lire: (c: (typeof conso)[number]) => number | null): PointCourbe[] =>
    recents.map((c, i) => ({
      mois: c.mois,
      valeur: lire(c),
      precedent: lire(anciens[i]!),
      moisPrecedent: anciens[i]!.mois,
    }));

  const mesures = recents.filter((c) => c.l100 !== null);
  const km = mesures.reduce((s, c) => s + (c.km ?? 0), 0);
  const l100 = km > 0 ? Math.round((mesures.reduce((s, c) => s + c.litres, 0) / km) * 1000) / 10 : null;
  const f100 = km > 0 ? Math.round((mesures.reduce((s, c) => s + c.cout, 0) / km) * 100) : null;
  const pap = dernierPleinAPlein(pleins);
  const ecart = l100 !== null && referenceL100 > 0 ? Math.round(((l100 - referenceL100) / referenceL100) * 1000) / 10 : null;

  return (
    <Carte titre="Consommation" precision="Les pleins du mois sur les kilomètres du compteur · douze derniers mois complets, l'année d'avant en pointillé">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Repere
          libelle="L/100 km sur 12 mois"
          valeur={l100 === null ? "—" : nombre(l100, 1)}
          precision={ecart === null ? `référence ${nombre(referenceL100, 1)}` : `${ecart > 0 ? "+" : ""}${nombre(ecart, 1)} % sur la référence ${nombre(referenceL100, 1)}`}
          ton={ecart !== null && ecart > 10 ? "defavorable" : null}
        />
        <Repere libelle="F/100 km sur 12 mois" valeur={f100 === null ? "—" : nombre(f100)} precision={km > 0 ? `sur ${kilometrage(km)} mesurés` : "kilomètres non mesurés"} />
        <Repere
          libelle="Dernier plein à plein"
          valeur={pap ? nombre(pap.l100, 1) : "—"}
          precision={pap ? `L/100 · ${kilometrage(pap.km)} du ${date(pap.du)} au ${date(pap.au)}` : "deux pleins complets au compteur sont nécessaires"}
        />
        <Repere libelle="Plein à plein, en francs" valeur={pap ? nombre(pap.f100) : "—"} precision={pap ? `F/100 km · ${nombre(pap.litres, 1)} L` : "—"} />
      </div>
      {mesures.length === 0 ? (
        /* Sans compteur, pas de consommation aux cent : on montre ce qui se mesure — les litres et les francs du mois —, et on dit ce qui manque. */
        <>
          <p className="mt-4 rounded-[10px] bg-vigilance-fond px-4 py-2.5 text-[12.5px] leading-relaxed text-texte">
            Kilomètres non mesurés sur la période : les pleins ne portent pas le compteur, et les relevés sont trop rares. Le « Km relevé » saisi à chaque plein suffit à tracer les L/100 km et F/100 km.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="min-w-0">
              <p className="label-champ mb-1">Litres par mois</p>
              <Courbe points={points((c) => (c.litres > 0 ? c.litres : null))} cible={null} sens={null} teinte="var(--color-accent)" unite="L" />
            </div>
            <div className="min-w-0">
              <p className="label-champ mb-1">Francs par mois</p>
              <Courbe points={points((c) => (c.cout > 0 ? c.cout : null))} cible={null} sens={null} teinte="var(--color-vigilance)" unite="F" />
            </div>
          </div>
        </>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="min-w-0">
            <p className="label-champ mb-1">Litres aux 100 km</p>
            <Courbe points={points((c) => c.l100)} cible={referenceL100} sens="inf" teinte="var(--color-accent)" unite="L/100" decimales={1} />
          </div>
          <div className="min-w-0">
            <p className="label-champ mb-1">Francs aux 100 km</p>
            <Courbe points={points((c) => c.f100)} cible={null} sens="inf" teinte="var(--color-vigilance)" unite="F/100" />
          </div>
        </div>
      )}
    </Carte>
  );
}

function Repere({ libelle, valeur, precision, ton }: { libelle: string; valeur: string; precision: string; ton?: "defavorable" | null }) {
  return (
    <div className="min-w-0">
      <p className="label-champ">{libelle}</p>
      <p className={`mt-1.5 text-[22px] leading-none font-semibold tracking-[-0.02em] ${ton === "defavorable" ? "text-defavorable" : "text-texte"}`}>{valeur}</p>
      <p className="meta mt-1.5">{precision}</p>
    </div>
  );
}
