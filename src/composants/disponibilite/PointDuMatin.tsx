"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Mail, Users, X } from "lucide-react";
import { Echeance } from "@/composants/interface/Pastille";
import { adressesDe } from "@/domaine/parametres";
import { sujetCourriel, texteCourriel, resumeGroupe, type PointDuMatin as Point } from "@/domaine/point-du-matin";
import { ecrireParametres, lireParametres } from "@/lib/parametres-demo";
import { nombre } from "@/lib/format";

/* ============================================================================
 * Le point du matin, sur l'écran Disponibilité (métier, 3 octobre 2026).
 *
 * Par business unit : le parc SEDIMA puis chaque transporteur, ce qui est
 * prêt avec sa capacité, plaque et chauffeur au survol. Et le courriel du
 * matin, prêt à partir : destinataires de la liste de diffusion, objet, corps
 * — l'application l'ouvre dans la messagerie, on relit, on envoie.
 * ==========================================================================*/

const t = (x: number) => `${nombre(x, Number.isInteger(x) ? 0 : 1)} t`;

export function PointDuMatin({ point, jourLong }: { point: Point; jourLong: string }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <section className="carte flex shrink-0 flex-col">
      <header className="flex flex-wrap items-start gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <h2 className="titre-bloc">Point du matin — véhicules disponibles</h2>
          <p className="meta mt-0.5">
            {point.totalVehicules} véhicules prêts, {t(point.totalCapacite)} de capacité, dont {point.partTiers} % chez les transporteurs · parc : opérationnels avec chauffeur ; transporteurs : engagés et opérationnels
          </p>
        </div>
        <button type="button" className="bouton-principal h-8" onClick={() => setOuvert(true)}>
          <Mail className="size-4" strokeWidth={2} />
          Préparer le courriel
        </button>
      </header>
      <div className="grid grid-cols-1 gap-4 border-t border-bordure px-5 py-4 md:grid-cols-2 xl:grid-cols-3">
        {point.bus.map((b) => (
          <div key={b.bu ?? "aucune"} className="min-w-0">
            <p className="flex items-baseline gap-2">
              <span className="text-[13px] font-semibold text-texte">{b.libelle}</span>
              <span className="meta">
                {b.nombre} · {t(b.capaciteTonnes)}
              </span>
            </p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {b.groupes.map((g) => (
                <li key={g.nom} className="text-[12.5px] leading-snug text-texte-2">
                  <span className={`font-medium ${g.tiers ? "text-texte" : "text-accent-fonce"}`}>{g.nom}</span>
                  {" : "}
                  {g.disponibles.length ? (
                    <span title={g.disponibles.map((v) => `${v.immatriculationAffichee} ${v.type}${v.capaciteTonnes ? ` ${v.capaciteTonnes} t` : ""}${v.chauffeur ? ` — ${v.chauffeur}` : ""}`).join("\n")}>
                      {resumeGroupe(g.disponibles)} <span className="code text-texte">· {t(g.capaciteTonnes)}</span>
                    </span>
                  ) : (
                    <span className="text-attenue">aucun prêt</span>
                  )}
                  {g.sansChauffeur.length ? (
                    <span className="block text-vigilance">
                      + {g.sansChauffeur.length} sans chauffeur ({g.sansChauffeur.map((v) => v.immatriculationAffichee).join(", ")})
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {point.immobilises.length ? (
          <div className="min-w-0">
            <p className="flex items-baseline gap-2">
              <span className="text-[13px] font-semibold text-texte">Immobilisés</span>
              <span className="meta">{point.immobilises.length}</span>
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {point.immobilises.map((i) => (
                <li key={i.immatriculationAffichee}>
                  <Link href={i.href} title={`${i.type}${i.transporteur ? ` · ${i.transporteur}` : ""} — ${i.motif}`}>
                    <Echeance ton="vigilance">{i.immatriculationAffichee}</Echeance>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {ouvert ? <Courriel point={point} jourLong={jourLong} onFermer={() => setOuvert(false)} /> : null}
    </section>
  );
}

function Courriel({ point, jourLong, onFermer }: { point: Point; jourLong: string; onFermer: () => void }) {
  const [destinataires, setDestinataires] = useState("");
  const [copie, setCopie] = useState("");
  const [enregistre, setEnregistre] = useState<string | null>(null);
  const [copie2, setCopie2] = useState(false);
  useEffect(() => {
    const d = lireParametres().diffusion.disponibilite;
    setDestinataires(d.destinataires.join("; "));
    setCopie(d.copie.join("; "));
  }, []);
  const sujet = sujetCourriel(point, jourLong);
  const corps = useMemo(() => texteCourriel(point, jourLong, null), [point, jourLong]);
  const a = adressesDe(destinataires);
  const cc = adressesDe(copie);
  /* La messagerie s'ouvre sur le courriel prêt : destinataires, copie, objet, corps. */
  const lien = `mailto:${a.join(";")}?${[cc.length ? `cc=${encodeURIComponent(cc.join(";"))}` : "", `subject=${encodeURIComponent(sujet)}`, `body=${encodeURIComponent(corps)}`].filter(Boolean).join("&")}`;

  function memoriser() {
    const p = lireParametres();
    void ecrireParametres({ ...p, diffusion: { ...p.diffusion, disponibilite: { destinataires: a, copie: cc } } }).then((refus) => setEnregistre(refus ?? "Liste de diffusion enregistrée : elle sera reprise chaque matin."));
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(`${sujet}\n\n${corps}`);
      setCopie2(true);
      setTimeout(() => setCopie2(false), 2000);
    } catch {
      /* le presse-papier refusé : le texte reste sélectionnable dans l'aperçu */
    }
  }

  const champ = "w-full rounded-[10px] border border-bordure-champ bg-surface px-3 py-2 text-[13px] text-texte outline-none placeholder:text-attenue focus:border-accent";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-label="Courriel du point du matin">
      <div className="flex max-h-[90vh] w-full max-w-[760px] flex-col overflow-hidden rounded-[16px] border border-bordure bg-surface shadow-modale">
        <header className="flex items-center gap-3 border-b border-bordure px-5 py-3">
          <Mail className="size-4 text-accent-fonce" strokeWidth={2} />
          <h2 className="titre-bloc flex-1">Courriel du point du matin</h2>
          <button type="button" className="bouton-discret h-8" onClick={onFermer} aria-label="Fermer">
            <X className="size-4" strokeWidth={2} />
          </button>
        </header>
        <div className="defilement-discret flex flex-col gap-3 overflow-y-auto px-5 py-4">
          <label className="flex flex-col gap-1">
            <span className="label-champ">À</span>
            <textarea rows={2} value={destinataires} onChange={(e) => setDestinataires(e.target.value)} placeholder="prenom.nom@sedima.com; …" className={champ} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label-champ">Copie</span>
            <textarea rows={1} value={copie} onChange={(e) => setCopie(e.target.value)} className={champ} />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="bouton-discret h-7" onClick={memoriser} title="Réservé à l'administrateur et à la direction, comme les autres paramètres">
              <Users className="size-3.5" strokeWidth={2} />
              Garder cette liste pour les prochains matins
            </button>
            {enregistre ? <span className="meta">{enregistre}</span> : null}
          </div>
          <p className="label-champ mt-1">Objet</p>
          <p className="text-[13px] font-medium text-texte">{sujet}</p>
          <p className="label-champ mt-1">Message</p>
          <pre className="max-h-[42vh] overflow-auto rounded-[10px] border border-bordure bg-surface-2 p-3 font-sans text-[12.5px] leading-relaxed whitespace-pre-wrap text-texte">{corps}</pre>
        </div>
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-bordure bg-surface-2 px-5 py-3">
          <p className="meta mr-auto">La messagerie s'ouvre avec le courriel prêt ; relisez, puis envoyez. Si le message arrive tronqué, « Copier » le met entier dans le presse-papier.</p>
          <button type="button" className="bouton-secondaire h-8" onClick={copier}>
            {copie2 ? <Check className="size-4" strokeWidth={2} /> : <Copy className="size-4 text-texte-2" strokeWidth={1.8} />}
            {copie2 ? "Copié" : "Copier"}
          </button>
          <a href={lien} className={`bouton-principal h-8 ${a.length ? "" : "pointer-events-none opacity-50"}`} aria-disabled={!a.length}>
            <Mail className="size-4" strokeWidth={2} />
            Ouvrir dans la messagerie
          </a>
        </footer>
      </div>
    </div>
  );
}
