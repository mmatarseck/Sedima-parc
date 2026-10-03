"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, ClipboardCopy, Mail, Users, X } from "lucide-react";
import { Echeance } from "@/composants/interface/Pastille";
import { CHARGEMENT_SPECIAL, capaciteSpecialeTexte, type ChargementSpecial } from "@/domaine/chargement";
import { adressesDe } from "@/domaine/parametres";
import { brouillonEml, resumeGroupe, sujetCourriel, tableauHtml, texteCapaciteVehicule, texteCourriel, type Capacites, type PointDuMatin as Point } from "@/domaine/point-du-matin";
import type { LigneCamionTiers } from "@/domaine/camions-tiers";
import type { LigneDisponibilite } from "@/domaine/disponibilite";
import { AjusterVehicule, type CibleAjustement } from "./AjusterVehicule";
import { ecrireParametres, lireParametres } from "@/lib/parametres-demo";
import { nombre } from "@/lib/format";

/* ============================================================================
 * Le point du matin, en tableau (métier, 3 octobre 2026 : « mettre sous forme
 * de tableau »).
 *
 * Une ligne par business unit, puis une ligne par parc : SEDIMA, puis chaque
 * transporteur. Les véhicules prêts, leur composition, la capacité en tonnes
 * et, à part, les capacités qui ne se comptent pas en tonnes (plateaux
 * d'œufs, milliers de poussins, sujets vifs). Un clic déplie les véhicules,
 * leur capacité et leur chauffeur. Le courriel part en vrai tableau : il se
 * copie et se colle dans Outlook.
 * ==========================================================================*/

const t1 = (x: number) => `${nombre(x, Number.isInteger(x) ? 0 : 1)} t`;
const NATURES = Object.keys(CHARGEMENT_SPECIAL) as ChargementSpecial[];

function Speciales({ c }: { c: Capacites }) {
  const parties = NATURES.filter((n) => c.speciales[n]);
  if (!parties.length) return <span className="text-attenue-2">—</span>;
  return (
    <span className="flex flex-col items-end gap-0.5">
      {parties.map((n) => (
        <span key={n} className="code whitespace-nowrap" title={CHARGEMENT_SPECIAL[n].libelle}>
          {capaciteSpecialeTexte(n, c.speciales[n]!)}
        </span>
      ))}
    </span>
  );
}

export function PointDuMatin({ point, jourLong, lignes, camions }: { point: Point; jourLong: string; lignes: LigneDisponibilite[]; camions: LigneCamionTiers[] }) {
  const [ouverts, setOuverts] = useState<Set<string>>(() => new Set());
  /* Un clic sur la pastille d'un véhicule ouvre sa fenêtre d'ajustement (métier, 3 octobre 2026). */
  const [cible, setCible] = useState<CibleAjustement | null>(null);
  const ouvrir = (genre: "parc" | "tiers", immatriculation: string) => {
    if (genre === "parc") {
      const ligne = lignes.find((x) => x.immatriculation === immatriculation);
      if (ligne) setCible({ genre: "parc", ligne });
    } else {
      const camion = camions.find((x) => x.immatriculation === immatriculation);
      if (camion) setCible({ genre: "tiers", camion });
    }
  };
  const [courriel, setCourriel] = useState(false);
  const basculer = (cle: string) => setOuverts((s) => (s.has(cle) ? new Set([...s].filter((x) => x !== cle)) : new Set([...s, cle])));
  const toutOuvert = ouverts.size > 0;
  /* Tout replié à l'ouverture (métier, 3 octobre 2026) : la ligne de chaque BU
     d'abord ; un clic montre ses parcs, un second clic sur un parc ses véhicules. */
  const toutesCles = point.bus.flatMap((b) => [`bu:${b.bu ?? "aucune"}`, ...b.groupes.map((g) => `${b.bu ?? "aucune"}|${g.nom}`)]);
  const specialesTotales = NATURES.filter((n) => point.capacites.speciales[n]);

  const th = "border-b border-bordure px-3 py-2 text-[12px] font-medium text-texte-2";
  return (
    <section className="carte flex shrink-0 flex-col overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <h2 className="titre-bloc">Point du matin — véhicules disponibles</h2>
          <p className="meta mt-0.5">Parc : opérationnels avec chauffeur · transporteurs : engagés et opérationnels</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface-3 px-3 text-[12.5px]">
            <span className="code font-semibold text-texte">{point.totalVehicules}</span> véhicules prêts
          </span>
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface-3 px-3 text-[12.5px]">
            <span className="code font-semibold text-texte">{t1(point.capacites.tonnes)}</span>
            <span className="text-texte-2">dont {point.partTiers} % transporteurs</span>
          </span>
          {specialesTotales.map((n) => (
            <span key={n} className="inline-flex h-7 items-center rounded-full bg-accent-fond px-3 text-[12.5px] font-medium text-accent-fonce" title={CHARGEMENT_SPECIAL[n].libelle}>
              {capaciteSpecialeTexte(n, point.capacites.speciales[n]!)}
            </span>
          ))}
          <button type="button" className="bouton-principal h-8" onClick={() => setCourriel(true)}>
            <Mail className="size-4" strokeWidth={2} />
            Préparer le courriel
          </button>
        </div>
      </header>

      <div className="defilement-discret overflow-x-auto border-t border-bordure">
        <table className="w-full min-w-[820px] border-collapse text-[13px]">
          <thead className="bg-surface-2">
            <tr>
              <th className={`${th} w-8`}>
                <button type="button" onClick={() => setOuverts(toutOuvert ? new Set() : new Set(toutesCles))} className="grid size-5 place-items-center rounded text-attenue hover:text-texte" title={toutOuvert ? "Tout replier" : "Tout déplier"}>
                  <ChevronRight className={`size-3.5 transition-transform ${toutOuvert ? "rotate-90" : ""}`} strokeWidth={2} />
                </button>
              </th>
              <th className={`${th} text-left`}>Parc ou transporteur</th>
              <th className={`${th} text-right`}>Prêts</th>
              <th className={`${th} text-left`}>Composition</th>
              <th className={`${th} text-right`}>Capacité</th>
              <th className={`${th} text-right`}>Œufs · poussins · vifs</th>
              <th className={`${th} text-left`}>Sans chauffeur</th>
            </tr>
          </thead>
          <tbody>
            {point.bus.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-attenue">
                  Aucun véhicule prêt ce matin.
                </td>
              </tr>
            ) : null}
            {point.bus.map((b) => {
              const cleBu = `bu:${b.bu ?? "aucune"}`;
              const buOuverte = ouverts.has(cleBu);
              return (
              <Fragment key={cleBu}>
                <tr className="cursor-pointer border-b border-bordure bg-accent-fond/40 hover:bg-accent-fond/70" onClick={() => basculer(cleBu)} aria-expanded={buOuverte}>
                  <td className="px-3 py-2 text-center">
                    <ChevronRight className={`mx-auto size-3.5 text-accent-fonce transition-transform ${buOuverte ? "rotate-90" : ""}`} strokeWidth={2.2} />
                  </td>
                  <td className="px-3 py-2 text-[12px] font-semibold tracking-wide text-accent-fonce uppercase">{b.libelle}</td>
                  <td className="px-3 py-2 text-right">
                    <span className="code font-semibold">{b.nombre}</span>
                  </td>
                  <td />
                  <td className="px-3 py-2 text-right">
                    <span className="code font-semibold">{b.capacites.tonnes ? t1(b.capacites.tonnes) : "—"}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Speciales c={b.capacites} />
                  </td>
                  <td />
                </tr>
                {buOuverte && b.groupes.map((g) => {
                  const cle = `${b.bu ?? "aucune"}|${g.nom}`;
                  const ouvert = ouverts.has(cle);
                  return (
                    <Fragment key={cle}>
                      <tr className="cursor-pointer border-b border-bordure hover:bg-surface-2" onClick={() => basculer(cle)} aria-expanded={ouvert}>
                        <td />
                        <td className="py-2 pr-3 pl-6">
                          <ChevronRight className={`mr-1.5 inline size-3.5 align-[-2px] text-attenue transition-transform ${ouvert ? "rotate-90" : ""}`} strokeWidth={2} />
                          <span className={`font-medium ${g.tiers ? "text-texte" : "text-accent-fonce"}`}>{g.nom}</span>
                          {g.tiers ? <span className="meta"> · transporteur</span> : null}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="code">{g.disponibles.length || <span className="text-attenue-2">0</span>}</span>
                        </td>
                        <td className="px-3 py-2 text-texte-2">{g.disponibles.length ? resumeGroupe(g.disponibles) : <span className="text-attenue">aucun prêt</span>}</td>
                        <td className="px-3 py-2 text-right">
                          <span className="code">{g.capacites.tonnes ? t1(g.capacites.tonnes) : <span className="text-attenue-2">—</span>}</span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Speciales c={g.capacites} />
                        </td>
                        <td className="px-3 py-2">
                          {g.sansChauffeur.length ? <Echeance ton="vigilance">{`${g.sansChauffeur.length} véhicule${g.sansChauffeur.length > 1 ? "s" : ""}`}</Echeance> : <span className="text-attenue-2">—</span>}
                        </td>
                      </tr>
                      {ouvert ? (
                        <tr className="border-b border-bordure bg-surface-2/60">
                          <td />
                          <td colSpan={6} className="py-2 pr-3 pl-14">
                            <ul className="flex flex-wrap gap-1.5">
                              {g.disponibles.map((v) => (
                                <li key={v.immatriculation}>
                                  <button type="button" onClick={() => ouvrir(v.genre, v.immatriculation)} title="Ajuster : statut, chauffeur, BU, site" className="inline-flex h-7 items-center gap-1.5 rounded-full border border-bordure bg-surface px-2.5 text-[12px] hover:border-accent">
                                    <span className="code font-semibold">{v.immatriculationAffichee}</span>
                                    <span className="text-texte-2">
                                      {v.type} · {texteCapaciteVehicule(v)}
                                    </span>
                                    {v.chauffeur ? <span className="text-attenue">· {v.chauffeur}</span> : null}
                                  </button>
                                </li>
                              ))}
                              {g.sansChauffeur.map((v) => (
                                <li key={v.immatriculation}>
                                  <button type="button" onClick={() => ouvrir(v.genre, v.immatriculation)} title="Affecter un chauffeur, changer le statut" className="inline-flex h-7 items-center gap-1.5 rounded-full border border-dashed border-vigilance bg-surface px-2.5 text-[12px] text-vigilance">
                                    <span className="code font-semibold">{v.immatriculationAffichee}</span>
                                    <span>
                                      {v.type} · {texteCapaciteVehicule(v)} · sans chauffeur
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </Fragment>
              );
            })}
          </tbody>
          {point.bus.length ? (
            <tfoot className="bg-surface-2">
              <tr>
                <td />
                <td className="px-3 py-2 font-semibold">Total</td>
                <td className="px-3 py-2 text-right">
                  <span className="code font-semibold">{point.totalVehicules}</span>
                </td>
                <td className="px-3 py-2 text-texte-2">{point.partTiers} % des tonnes chez les transporteurs</td>
                <td className="px-3 py-2 text-right">
                  <span className="code font-semibold">{t1(point.capacites.tonnes)}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <Speciales c={point.capacites} />
                </td>
                <td />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      {point.immobilises.length ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-bordure px-5 py-3">
          <span className="mr-1 text-[12.5px] font-semibold text-texte">Immobilisés ({point.immobilises.length})</span>
          {point.immobilises.map((i) => (
            <button key={i.immatriculationAffichee} type="button" onClick={() => ouvrir(i.genre, i.immatriculation)} title={`${i.type} · ${i.bu}${i.transporteur ? ` · ${i.transporteur}` : ""} — ${i.motif} · cliquer pour remettre en service`}>
              <Echeance ton="vigilance">{`${i.immatriculationAffichee}${i.transporteur ? ` · ${i.transporteur}` : ""}`}</Echeance>
            </button>
          ))}
        </div>
      ) : null}

      {courriel ? <Courriel point={point} jourLong={jourLong} onFermer={() => setCourriel(false)} /> : null}
      {cible ? <AjusterVehicule cible={cible} onFermer={() => setCible(null)} /> : null}
    </section>
  );
}

function Courriel({ point, jourLong, onFermer }: { point: Point; jourLong: string; onFermer: () => void }) {
  const [destinataires, setDestinataires] = useState("");
  const [copie, setCopie] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [copiee, setCopiee] = useState(false);
  useEffect(() => {
    const d = lireParametres().diffusion.disponibilite;
    setDestinataires(d.destinataires.join("; "));
    setCopie(d.copie.join("; "));
  }, []);
  const sujet = sujetCourriel(point, jourLong);
  const html = useMemo(() => tableauHtml(point, jourLong), [point, jourLong]);
  const texte = useMemo(() => texteCourriel(point, jourLong), [point, jourLong]);
  const a = adressesDe(destinataires);
  const cc = adressesDe(copie);

  /*
   * Le courriel s'ouvre dans Outlook, tableau déjà mis en forme (métier,
   * 3 octobre 2026) : un fichier .eml marqué « non envoyé », qu'Outlook ouvre
   * comme un brouillon — destinataires, objet, corps. On relit, on envoie.
   */
  function ouvrirDansOutlook() {
    const eml = brouillonEml({ a, cc, sujet, html });
    const url = URL.createObjectURL(new Blob([eml], { type: "message/rfc822" }));
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = `point-du-matin-${point.jour}.eml`;
    lien.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Le brouillon est téléchargé : ouvrez-le (il s'ouvre dans Outlook), relisez, envoyez.");
  }

  /* Pour Outlook dans le navigateur, qui n'ouvre pas les .eml : le tableau au presse-papier, à coller. */
  async function copier() {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([texte], { type: "text/plain" }) })]);
      setCopiee(true);
      setMessage("Tableau copié : collez-le (Ctrl+V) dans le corps du courriel.");
    } catch {
      setMessage("Le presse-papier est refusé par le navigateur.");
    }
  }

  function memoriser() {
    const p = lireParametres();
    void ecrireParametres({ ...p, diffusion: { ...p.diffusion, disponibilite: { destinataires: a, copie: cc } } }).then((refus) => setMessage(refus ?? "Liste de diffusion enregistrée : elle sera reprise chaque matin."));
  }

  const champ = "w-full rounded-[10px] border border-bordure-champ bg-surface px-3 py-2 text-[13px] text-texte outline-none placeholder:text-attenue focus:border-accent";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-label="Courriel du point du matin">
      <div className="flex max-h-[92vh] w-full max-w-[920px] flex-col overflow-hidden rounded-[16px] border border-bordure bg-surface shadow-modale">
        <header className="flex items-center gap-3 border-b border-bordure px-5 py-3">
          <Mail className="size-4 text-accent-fonce" strokeWidth={2} />
          <h2 className="titre-bloc flex-1">Courriel du point du matin</h2>
          <button type="button" className="bouton-discret h-8" onClick={onFermer} aria-label="Fermer">
            <X className="size-4" strokeWidth={2} />
          </button>
        </header>
        <div className="defilement-discret flex flex-col gap-3 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="label-champ">À</span>
              <textarea rows={2} value={destinataires} onChange={(e) => setDestinataires(e.target.value)} placeholder="prenom.nom@sedima.com; …" className={champ} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="label-champ">Copie</span>
              <textarea rows={2} value={copie} onChange={(e) => setCopie(e.target.value)} className={champ} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="bouton-discret h-7" onClick={memoriser} title="Réservé à l'administrateur et à la direction, comme les autres paramètres">
              <Users className="size-3.5" strokeWidth={2} />
              Garder cette liste pour les prochains matins
            </button>
            {message ? <span className="meta">{message}</span> : null}
          </div>
          <p className="label-champ mt-1">Objet</p>
          <p className="text-[13px] font-medium text-texte">{sujet}</p>
          <p className="label-champ mt-1">Le tableau tel qu'il partira</p>
          {/* Le HTML est produit ici même, chaque valeur échappée : rien d'extérieur n'y entre. */}
          <div className="overflow-x-auto rounded-[10px] border border-bordure bg-white p-3" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-bordure bg-surface-2 px-5 py-3">
          <p className="meta mr-auto max-w-[420px]">« Ouvrir dans Outlook » télécharge un brouillon prêt : destinataires, objet et tableau. Outlook dans le navigateur : « Copier le tableau », puis Ctrl+V.</p>
          <button type="button" onClick={copier} className="bouton-secondaire h-8">
            {copiee ? <Check className="size-4" strokeWidth={2} /> : <ClipboardCopy className="size-4 text-texte-2" strokeWidth={1.8} />}
            Copier le tableau
          </button>
          <button type="button" disabled={!a.length} onClick={ouvrirDansOutlook} className="bouton-principal h-8 disabled:cursor-not-allowed disabled:opacity-50">
            <Mail className="size-4" strokeWidth={2} />
            Ouvrir dans Outlook
          </button>
        </footer>
      </div>
    </div>
  );
}
