"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarRange, Check, ChevronDown } from "lucide-react";
import { PRESETS_ORDONNES, PRESET_PERIODE, resoudrePeriode, type Periode, type PresetPeriode } from "@/domaine/periodes";
import { date as formaterDate } from "@/lib/format";

/* ============================================================================
 * Choix de la période — jour, mois, trimestre, année, ou deux dates.
 *
 * Demande du métier du 4 septembre 2026 : choisir la date « de façon plus fine
 * — jour, mois, année, trimestre, période prédéfinie ». Le bouton affiche
 * toujours **le nom du réglage et l'intervalle qu'il donne** : « Ce trimestre ·
 * 01/07/2026 → 04/09/2026 ». Sans les dates, personne ne sait ce que « ce
 * trimestre » recouvre au juste ; sans le nom, on ne sait pas si l'intervalle
 * suivra le calendrier demain.
 *
 * Le préréglage est conservé tel quel, pas seulement les dates qu'il produit :
 * une vue enregistrée sur « le mois dernier » doit rester sur le mois dernier.
 * ==========================================================================*/

export function ChoixPeriode({ valeur, aujourdhui, onChange }: { valeur: Periode; aujourdhui: string; onChange: (p: Periode) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [du, setDu] = useState(valeur.debut ?? "");
  const [au, setAu] = useState(valeur.fin ?? "");
  const zone = useRef<HTMLDivElement>(null);
  const resolue = resoudrePeriode(valeur, aujourdhui);

  useEffect(() => {
    setDu(valeur.debut ?? resolue.debut);
    setAu(valeur.fin ?? resolue.fin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valeur.preset, valeur.debut, valeur.fin]);

  useEffect(() => {
    if (!ouvert) return;
    function dehors(e: MouseEvent) {
      if (zone.current && !zone.current.contains(e.target as Node)) setOuvert(false);
    }
    function echap(e: KeyboardEvent) {
      if (e.key === "Escape") setOuvert(false);
    }
    document.addEventListener("mousedown", dehors);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("mousedown", dehors);
      document.removeEventListener("keydown", echap);
    };
  }, [ouvert]);

  function choisir(preset: PresetPeriode) {
    if (preset === "personnalisee") {
      /* On ne referme pas : il reste deux dates à poser. */
      onChange({ preset, debut: du || resolue.debut, fin: au || resolue.fin });
      return;
    }
    onChange({ preset, debut: null, fin: null });
    setOuvert(false);
  }

  function appliquerPersonnalisee() {
    if (!du || !au) return;
    onChange({ preset: "personnalisee", debut: du, fin: au });
    setOuvert(false);
  }

  const champ = "code h-8 w-full rounded-[8px] border border-bordure-champ bg-surface px-2 text-[12.5px] text-texte outline-none focus:border-accent";

  return (
    <div ref={zone} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-haspopup="dialog"
        className="flex h-8 max-w-full items-center gap-2 rounded-full border border-bordure-champ bg-surface px-3 text-[12.5px] text-texte hover:border-accent"
      >
        <CalendarRange className="size-3.5 shrink-0 text-attenue" strokeWidth={1.9} />
        <span className="font-medium whitespace-nowrap">{resolue.libelle}</span>
        <span className="code hidden text-[11.5px] whitespace-nowrap text-texte-2 sm:inline">
          {formaterDate(resolue.debut)} → {formaterDate(resolue.fin)}
        </span>
        <ChevronDown className={`size-3.5 shrink-0 text-attenue transition-transform ${ouvert ? "rotate-180" : ""}`} strokeWidth={2} />
      </button>

      {ouvert ? (
        <div role="dialog" aria-label="Choisir la période" className="absolute top-full left-0 z-40 mt-1.5 w-[300px] overflow-hidden rounded-[12px] border border-bordure bg-surface shadow-modale">
          <ul className="defilement-discret max-h-[300px] overflow-y-auto py-1.5">
            {PRESETS_ORDONNES.map((p) => {
              const actif = valeur.preset === p;
              const apercu = p === "personnalisee" ? null : resoudrePeriode({ preset: p, debut: null, fin: null }, aujourdhui);
              return (
                <li key={p}>
                  <button
                    type="button"
                    onClick={() => choisir(p)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors ${actif ? "bg-accent-fond text-accent-fonce" : "text-texte hover:bg-surface-3"}`}
                  >
                    <Check className={`size-3.5 shrink-0 ${actif ? "" : "invisible"}`} strokeWidth={2.4} />
                    <span className="min-w-0 flex-1 truncate font-medium">{PRESET_PERIODE[p]}</span>
                    {apercu ? <span className="code shrink-0 text-[11px] text-attenue">{formaterDate(apercu.debut).slice(0, 5)}→{formaterDate(apercu.fin).slice(0, 5)}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-bordure bg-surface-2 px-3 py-2.5">
            <p className="label-champ">Du · au</p>
            <div className="mt-1.5 flex items-center gap-2">
              <input type="date" value={du} max={aujourdhui} onChange={(e) => setDu(e.target.value)} className={champ} aria-label="Début de la période" />
              <input type="date" value={au} max={aujourdhui} onChange={(e) => setAu(e.target.value)} className={champ} aria-label="Fin de la période" />
              <button type="button" onClick={appliquerPersonnalisee} disabled={!du || !au} className="bouton-principal h-8 shrink-0 px-3 text-[12.5px] disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-attenue-2">
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
