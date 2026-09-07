"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, ChevronLeft, RotateCcw } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Carte } from "@/composants/interface/Carte";
import { peutCloturer } from "@/domaine/cloture";
import { PARAMETRES_DEFAUT, type Parametres } from "@/domaine/parametres";
import { PASTILLES, SEUILS_DEFAUT, seuilFranchi, texteSeuil } from "@/domaine/pastilles";
import { trouverRole } from "@/domaine/roles";
import { AXES } from "@/domaine/tableau-bord";
import { nombre } from "@/lib/format";
import { ecrireParametres, lireParametres } from "@/lib/parametres-demo";
import { lireRole } from "@/lib/session-demo";

/**
 * Paramètres › Pastilles du tableau de bord — les seuils au-delà desquels une
 * pastille passe au rouge. Décision du métier du 8 septembre 2026 : des seuils
 * **en nombre**, jamais en part ; ils se règlent ici, le catalogue ne donne
 * que le défaut et le sens. La valeur du jour est montrée à côté, pour que
 * l'on voie ce qu'un seuil déclenche avant de l'enregistrer.
 */
export function EcranSeuilsPastilles({ valeursDuJour }: { valeursDuJour: Record<string, number | null> }) {
  const router = useRouter();
  const [p, setP] = useState<Parametres>(PARAMETRES_DEFAUT);
  const [valeurs, setValeurs] = useState<Record<string, string>>({});
  const [habilite, setHabilite] = useState(false);
  const [nomRole, setNomRole] = useState("");
  const [enregistre, setEnregistre] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const lu = lireParametres();
    setP(lu);
    setValeurs(Object.fromEntries(Object.entries(lu.pastilles.seuils).map(([id, v]) => [id, String(v)])));
    const r = trouverRole(lireRole());
    setHabilite(peutCloturer(r.role));
    setNomRole(r.libelle);
  }, []);

  const reglables = PASTILLES.filter((x) => x.seuil);
  const nombres: Record<string, number> = Object.fromEntries(reglables.map((x) => [x.id, Number((valeurs[x.id] ?? "").replace(/\s/g, ""))]));
  const valide = reglables.every((x) => Number.isFinite(nombres[x.id]) && nombres[x.id]! >= 0);
  const change = valide && reglables.some((x) => Math.round(nombres[x.id]!) !== p.pastilles.seuils[x.id]);
  const modifie = reglables.some((x) => nombres[x.id] !== SEUILS_DEFAUT[x.id]);
  const enAlerte = reglables.filter((x) => valide && seuilFranchi(x, valeursDuJour[x.id] ?? null, Math.round(nombres[x.id]!))).length;

  function enregistrer() {
    if (!valide) return;
    const suite: Parametres = { ...p, pastilles: { seuils: Object.fromEntries(reglables.map((x) => [x.id, Math.round(nombres[x.id]!)])) } };
    setP(suite);
    setErreur(null);
    void ecrireParametres(suite).then((refus) => {
      if (refus) {
        setErreur(refus);
        return;
      }
      setEnregistre(true);
      router.refresh();
      setTimeout(() => setEnregistre(false), 1800);
    });
  }

  function reinitialiser() {
    setValeurs(Object.fromEntries(Object.entries(SEUILS_DEFAUT).map(([id, v]) => [id, String(v)])));
    setEnregistre(false);
  }

  const champ = "h-9 w-[120px] rounded-[8px] border border-bordure-champ bg-surface px-3 text-right text-[13px] tabular-nums outline-none focus:border-accent disabled:bg-surface-2 disabled:text-texte-2";

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[12.5px] text-attenue">
        <Link href="/parametres" className="inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce">
          <ChevronLeft className="size-3.5" strokeWidth={2} />
          Paramètres
        </Link>
      </nav>
      <TitreEcran
        titre="Pastilles du tableau de bord"
        sousTitre={habilite ? "Les seuils en nombre au-delà desquels une pastille passe au rouge — la valeur du jour est montrée à côté" : `Lecture seule — le réglage relève de la direction et de l'administrateur (vous êtes ${nomRole.toLowerCase()})`}
        actions={
          habilite ? (
            <>
              {erreur ? <span className="max-w-[360px] text-[12.5px] leading-[1.4] text-defavorable">{erreur}</span> : null}
              <button type="button" onClick={reinitialiser} disabled={!modifie} className="bouton-secondaire disabled:cursor-not-allowed disabled:opacity-50">
                <RotateCcw className="size-4 text-texte-2" strokeWidth={1.7} />
                Valeurs par défaut
              </button>
              <button type="button" onClick={enregistrer} disabled={!valide || !change} className="bouton-principal disabled:cursor-not-allowed disabled:opacity-50" title={valide ? undefined : "Chaque seuil doit être un nombre entier positif ou nul"}>
                <Check className="size-4" strokeWidth={2.2} />
                {enregistre ? "Enregistré" : "Enregistrer"}
              </button>
            </>
          ) : null
        }
      />

      {AXES.map((axe) => {
        const lignes = reglables.filter((x) => x.axe === axe.cle);
        if (lignes.length === 0) return null;
        return (
          <Carte key={axe.cle} titre={`${axe.cle} — ${axe.nom}`} precision={axe.sous}>
            <div className="flex flex-col divide-y divide-bordure px-5 pb-2">
              {lignes.map((x) => {
                const n = nombres[x.id]!;
                const seuil = Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
                const duJour = valeursDuJour[x.id] ?? null;
                const rouge = seuil !== null && seuilFranchi(x, duJour, seuil);
                return (
                  <label key={x.id} className="flex flex-wrap items-center gap-4 py-3">
                    <span className="min-w-[260px] flex-1">
                      <span className="block text-[13px] font-medium text-texte">{x.libelle}</span>
                      <span className="meta block">
                        {x.seuil!.sens === "inf" ? "Rouge au-dessus du seuil" : "Rouge en dessous du seuil"} · {seuil !== null ? texteSeuil(x, seuil) : "seuil à saisir"}
                      </span>
                    </span>
                    <span className={`w-[150px] text-right text-[12.5px] tabular-nums ${rouge ? "font-semibold text-defavorable" : "text-texte-2"}`} title="La valeur du jour, au seuil saisi">
                      {duJour === null ? "— aujourd'hui" : `${nombre(duJour, x.decimales ?? 0)}${x.unite ? ` ${x.unite}` : ""} aujourd'hui`}
                    </span>
                    <span className="flex items-center gap-2">
                      <input type="text" inputMode="numeric" value={valeurs[x.id] ?? ""} disabled={!habilite} onChange={(e) => { setValeurs((v) => ({ ...v, [x.id]: e.target.value })); setEnregistre(false); }} className={champ} aria-label={`Seuil — ${x.libelle}`} />
                      <span className="meta w-[80px]">{x.unite === "j" ? "jours" : x.unite ?? "en nombre"}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </Carte>
        );
      })}

      <Carte titre="Ce que ces seuils produisent" precision="Aux valeurs saisies, sur la situation du jour et tout le parc">
        <p className="px-5 pb-4 text-[12.5px] leading-[1.5] text-texte-2">
          {enAlerte === 0 ? (
            <>Aucune pastille réglable ne serait au rouge aujourd&apos;hui.</>
          ) : (
            <>
              <b className="font-semibold text-defavorable">{enAlerte}</b> pastille{enAlerte > 1 ? "s" : ""} réglable{enAlerte > 1 ? "s" : ""} serai{enAlerte > 1 ? "en" : ""}t au rouge aujourd&apos;hui. Les pastilles sans seuil — échéances, caisse, carburant et dépenses de la semaine — gardent leur propre règle.
            </>
          )}{" "}
          Un seuil à zéro se lit « rouge dès le premier ». Les seuils valent pour tout le monde ; le choix des pastilles affichées reste celui de chaque compte.
        </p>
      </Carte>
    </div>
  );
}
