"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import type { AccesCourant } from "@/domaine/acces";
import { lireAccesCourant } from "@/lib/acces-courant";
import { MAX_RACCOURCIS, REGLAGE_ACCUEIL_DEFAUT, WIDGETS, ecrireReglageAccueil, lireReglageAccueil, raccourcisDefaut, raccourcisPour, type CleRaccourci, type CleWidget } from "./accueil-widgets";
import { Bloc, EnTeteTelephone } from "./Telephone";

/**
 * Personnaliser l'accueil : cocher les widgets, les monter ou descendre. Le
 * réglage est celui du compte ; « Remettre l'ordre livré » ramène le défaut.
 */
export function EcranPersonnaliserAccueil() {
  const router = useRouter();
  const [ordre, setOrdre] = useState<CleWidget[]>([]);
  /* Nul tant que la personne n a rien choisi : c est ce qui distingue « le
     défaut de mon profil » de « j ai décoché tous les gestes ». */
  const [gestes, setGestes] = useState<CleRaccourci[] | null>(null);
  const [acces, setAcces] = useState<AccesCourant | null>(null);
  useEffect(() => {
    const r = lireReglageAccueil();
    setOrdre(r.ordre);
    setGestes(r.raccourcis ?? null);
    setAcces(lireAccesCourant());
  }, []);

  const detenteur = acces?.profil === "detenteur";
  const proposes = WIDGETS.filter((w) => !(w.detenteur === "seulement" && !detenteur) && !(w.detenteur === "jamais" && detenteur) && (!w.module || (acces && acces.niveaux[w.module] !== "aucun")));
  const affiches = ordre.filter((c) => proposes.some((w) => w.cle === c));
  const masques = proposes.filter((w) => !ordre.includes(w.cle));
  const gestesProposes = acces ? raccourcisPour(acces) : [];
  const gestesRetenus = gestes ?? (acces ? raccourcisDefaut(acces) : []);

  function deplacer(cle: CleWidget, sens: -1 | 1) {
    setOrdre((o) => {
      const i = o.indexOf(cle);
      const j = i + sens;
      if (i < 0 || j < 0 || j >= o.length) return o;
      const suite = [...o];
      [suite[i], suite[j]] = [suite[j]!, suite[i]!];
      return suite;
    });
  }
  function basculer(cle: CleWidget) {
    setOrdre((o) => (o.includes(cle) ? o.filter((x) => x !== cle) : [...o, cle]));
  }

  /* Décocher un geste fige la liste sur le choix de la personne : à partir de
     là, elle ne suit plus le défaut de son profil. « Revenir aux gestes par
     défaut » remet le réglage à nul, et le suivi reprend. */
  function basculerGeste(cle: CleRaccourci) {
    setGestes((g) => {
      const actuel = g ?? gestesRetenus;
      if (actuel.includes(cle)) return actuel.filter((x) => x !== cle);
      return actuel.length >= MAX_RACCOURCIS ? actuel : [...actuel, cle];
    });
  }
  function enregistrer() {
    ecrireReglageAccueil(gestes ? { ordre, raccourcis: gestes } : { ordre });
    router.push("/telephone");
  }

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3 px-3 pb-28 pt-1">
      <EnTeteTelephone titre="Personnaliser l'accueil" retour="/telephone" />
      <p className="meta -mt-2 px-4">Ce que votre accueil montre, dans l&apos;ordre. Le réglage est le vôtre.</p>

      <Bloc titre="Affichés, dans l'ordre">
        {affiches.length === 0 ? <p className="meta py-1">Aucun widget : cochez-en ci-dessous.</p> : null}
        {affiches.map((cle, i) => {
          const w = WIDGETS.find((x) => x.cle === cle)!;
          return (
            <div key={cle} className="flex items-center gap-2 border-t border-bordure py-2 first:border-t-0">
              <input type="checkbox" checked onChange={() => basculer(cle)} className="size-4 shrink-0 accent-accent" aria-label={`Afficher ${w.libelle}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-texte">{w.libelle}</span>
                <span className="meta block truncate">{w.precision}</span>
              </span>
              <button type="button" onClick={() => deplacer(cle, -1)} disabled={i === 0} aria-label="Monter" className="grid size-8 place-items-center rounded-full text-texte-2 hover:bg-surface-3 disabled:opacity-30">
                <ArrowUp className="size-4" strokeWidth={2} />
              </button>
              <button type="button" onClick={() => deplacer(cle, 1)} disabled={i === affiches.length - 1} aria-label="Descendre" className="grid size-8 place-items-center rounded-full text-texte-2 hover:bg-surface-3 disabled:opacity-30">
                <ArrowDown className="size-4" strokeWidth={2} />
              </button>
            </div>
          );
        })}
      </Bloc>

      {/* Les gestes de la rangée du haut. Bornés à deux lignes : au-delà,
          l'accueil s'ouvrirait sur un menu au lieu du travail du jour. */}
      <Bloc titre={`Gestes de la rangée du haut (${gestesRetenus.length} sur ${MAX_RACCOURCIS})`}>
        <p className="meta pb-1">Deux lignes au plus. Les autres gestes restent dans « Parcourir ».</p>
        {gestesProposes.map((r) => {
          const coche = gestesRetenus.includes(r.cle);
          const plein = !coche && gestesRetenus.length >= MAX_RACCOURCIS;
          return (
            <label key={r.cle} className={`flex items-center gap-2 border-t border-bordure py-2 first:border-t-0 ${plein ? "opacity-40" : ""}`}>
              <input type="checkbox" checked={coche} disabled={plein} onChange={() => basculerGeste(r.cle)} className="size-4 shrink-0 accent-accent" />
              <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-texte">{r.libelle}</span>
            </label>
          );
        })}
        {gestes !== null ? (
          <button type="button" onClick={() => setGestes(null)} className="mt-2 text-[12.5px] font-semibold text-accent-fonce hover:text-accent">
            Revenir aux gestes par défaut
          </button>
        ) : (
          <p className="meta mt-2">Ce sont les gestes livrés pour votre profil.</p>
        )}
      </Bloc>

      <Bloc titre="Masqués">
        {masques.length === 0 ? <p className="meta py-1">Tout est affiché.</p> : null}
        {masques.map((w) => (
          <label key={w.cle} className="flex items-center gap-2 border-t border-bordure py-2 first:border-t-0">
            <input type="checkbox" checked={false} onChange={() => basculer(w.cle)} className="size-4 shrink-0 accent-accent" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold text-texte">{w.libelle}</span>
              <span className="meta block truncate">{w.precision}</span>
            </span>
          </label>
        ))}
      </Bloc>

      <button type="button" onClick={() => setOrdre(REGLAGE_ACCUEIL_DEFAUT.ordre.filter((c) => proposes.some((w) => w.cle === c)))} className="bouton-secondaire h-10 w-full justify-center rounded-[12px]">
        Remettre l&apos;ordre livré
      </button>

      <div className="fixed inset-x-0 bottom-[60px] z-20 mx-auto max-w-[520px] px-3 lg:bottom-4">
        <button type="button" onClick={enregistrer} className="bouton-principal h-11 w-full justify-center rounded-[12px] text-[14px]">
          <Check className="size-4" strokeWidth={2.2} />
          Enregistrer
        </button>
      </div>
    </div>
  );
}
