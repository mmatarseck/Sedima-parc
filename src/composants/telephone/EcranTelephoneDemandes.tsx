"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { ChampPhoto } from "@/composants/interface/ChampPhoto";
import type { AccesCourant } from "@/domaine/acces";
import { TYPE_DEMANDE, libelleReponse, statutDemande, type Demande, type ReponseDemande } from "@/domaine/demandes";
import { lireAccesCourant } from "@/lib/acces-courant";
import { lireAcces } from "@/lib/acces-demo";
import { lireDemandes, repondre } from "@/lib/demandes-demo";
import { authentificationReelle } from "@/lib/session-demo";
import { Bloc, EnTeteTelephone, Ligne } from "./Telephone";

/* ============================================================================
 * Téléphone › Demandes.
 *
 * Pour un détenteur : ce que le parc lui demande, et la réponse — la valeur,
 * la photo obligatoire, un mot. Pour les autres : le suivi de ce qui est
 * parti sur leur périmètre, qui a répondu, qui tarde. L'envoi se fait au
 * bureau.
 * ==========================================================================*/

function heure(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")} à ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** En démonstration, le détenteur est la fiche d'accès de ce profil ; base branchée, les politiques ne rendent que ses demandes. */
export function mesDemandes(liste: Demande[], acces: AccesCourant): Demande[] {
  if (acces.profil !== "detenteur" || authentificationReelle()) return liste;
  const fiche = lireAcces().find((a) => a.profil === "detenteur" && (a.chauffeurId || a.attributaireId));
  if (!fiche) return [];
  return liste.filter((d) => (d.detenteur.genre === "chauffeur" && d.detenteur.id === fiche.chauffeurId) || (d.detenteur.genre === "attributaire" && d.detenteur.id === fiche.attributaireId));
}

export function EcranTelephoneDemandes({ initial, maintenant }: { initial: Demande[]; maintenant: string }) {
  const router = useRouter();
  const [liste, setListe] = useState<Demande[]>(initial);
  const [acces, setAcces] = useState<AccesCourant | null>(null);
  const [ouverte, setOuverte] = useState<Demande | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    setListe(lireDemandes(initial));
    setAcces(lireAccesCourant());
  }, [initial]);

  const detenteur = acces?.profil === "detenteur";
  const miennes = useMemo(() => (acces ? mesDemandes(liste, acces) : []), [liste, acces]);
  const parStatut = (s: "a-repondre" | "en-retard" | "repondue" | "annulee") => miennes.filter((d) => statutDemande(d, maintenant) === s);
  const aRepondre = [...parStatut("en-retard"), ...parStatut("a-repondre")].sort((a, b) => a.echeance.localeCompare(b.echeance));
  const repondues = parStatut("repondue").sort((a, b) => (b.reponse?.le ?? "").localeCompare(a.reponse?.le ?? ""));

  async function envoyerReponse(d: Demande, reponse: ReponseDemande) {
    const refus = await repondre(d.id, reponse, liste);
    if (refus) {
      setErreur(refus);
      return;
    }
    setOuverte(null);
    setListe(lireDemandes(initial.map((x) => (x.id === d.id ? { ...x, reponse } : x))));
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3 px-3 pb-24 pt-1">
      <EnTeteTelephone titre={detenteur ? "Mes demandes" : "Demandes"} retour="/telephone" />
      {acces && !detenteur ? (
        <p className="meta -mt-2 px-4">
          Le suivi de ce qui est parti sur votre périmètre.{" "}
          <Link href="/demandes?nouvelle" className="font-semibold text-accent-fonce">
            Envoyer une demande
          </Link>{" "}
          ouvre le panneau du bureau.
        </p>
      ) : null}
      {erreur ? <p className="rounded-[8px] bg-defavorable-fond px-3 py-2 text-[12.5px] text-defavorable">{erreur}</p> : null}

      <Bloc titre={detenteur ? "À répondre" : "Sans réponse"} accent={aRepondre.length > 0}>
        {aRepondre.length === 0 ? <p className="meta py-1">{detenteur ? "Rien à répondre. Le parc vous préviendra." : "Tout le monde a répondu."}</p> : null}
        {aRepondre.map((d) => {
          const s = statutDemande(d, maintenant);
          const t = TYPE_DEMANDE[d.type];
          return (
            <button key={d.id} type="button" onClick={() => (detenteur ? setOuverte(d) : undefined)} className="block w-full text-left" disabled={!detenteur}>
              <Ligne icone={t.reponse === "km" ? "km" : t.reponse === "pourcentage" ? "%" : t.reponse === "controle" ? "✓" : "◎"} ton={s === "en-retard" ? "defavorable" : "vigilance"} titre={detenteur ? t.libelle : `${d.detenteur.nom} · ${t.libelle}`} precision={`${d.vehicule.immatriculation} · avant le ${heure(d.echeance)}${s === "en-retard" ? " · en retard" : ""}`} valeur={detenteur ? "›" : undefined} />
            </button>
          );
        })}
      </Bloc>

      <Bloc titre="Répondues">
        {repondues.length === 0 ? <p className="meta py-1">Aucune réponse pour l&apos;instant.</p> : null}
        {repondues.slice(0, 12).map((d) => {
          const t = TYPE_DEMANDE[d.type];
          return <Ligne key={d.id} icone={<Check className="size-4" strokeWidth={2.2} />} titre={detenteur ? `${t.libelle} · ${libelleReponse(d)}` : `${d.detenteur.nom} · ${libelleReponse(d)}`} precision={`${d.vehicule.immatriculation} · répondu le ${heure(d.reponse!.le)}${d.reponse?.photo ? " · photo" : ""}`} />;
        })}
      </Bloc>

      {ouverte ? <PanneauReponse demande={ouverte} maintenant={maintenant} onFermer={() => setOuverte(null)} onEnvoyer={(r) => void envoyerReponse(ouverte, r)} /> : null}
    </div>
  );
}

function PanneauReponse({ demande, maintenant, onFermer, onEnvoyer }: { demande: Demande; maintenant: string; onFermer: () => void; onEnvoyer: (r: ReponseDemande) => void }) {
  const t = TYPE_DEMANDE[demande.type];
  const [valeur, setValeur] = useState("");
  const [texte, setTexte] = useState("");
  const [controle, setControle] = useState<"ok" | "reserve">("ok");
  const [photo, setPhoto] = useState<string | null>(null);
  const [commentaire, setCommentaire] = useState("");

  const nombre = Number(valeur.replace(/\s/g, ""));
  const valide = photo !== null && (t.reponse === "km" ? Number.isFinite(nombre) && nombre > 0 : t.reponse === "pourcentage" ? Number.isFinite(nombre) && nombre >= 0 && nombre <= 100 : t.reponse === "texte" ? texte.trim().length > 0 : controle === "ok" || texte.trim().length > 0);

  function envoyer() {
    if (!valide) return;
    /* L'heure de la réponse : celle de l'horloge, ou du jeu de démonstration. */
    const le = authentificationReelle() ? new Date().toISOString() : maintenant;
    onEnvoyer({
      le,
      valeur: t.reponse === "km" || t.reponse === "pourcentage" ? Math.round(nombre) : null,
      texte: t.reponse === "texte" ? texte.trim() : t.reponse === "controle" ? (controle === "ok" ? "ok" : texte.trim()) : null,
      photo,
      commentaire: commentaire.trim() || null,
    });
  }

  const champ = "h-11 w-full rounded-[12px] border border-bordure-champ bg-surface px-3.5 text-[15px] text-texte outline-none focus:border-accent";
  const s = statutDemande(demande, maintenant);

  return (
    <>
      <button type="button" aria-label="Fermer" onClick={onFermer} className="fixed inset-0 z-30 cursor-default bg-encre/40" />
      <div role="dialog" aria-modal="true" aria-labelledby="reponse-titre" className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-h-[92vh] w-full max-w-[520px] flex-col rounded-t-[18px] bg-surface shadow-flottante">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <h2 id="reponse-titre" className="min-w-0 flex-1 text-[17px] font-bold text-texte">
            {t.libelle}
          </h2>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="grid size-9 place-items-center rounded-full text-texte-2 hover:bg-surface-3">
            <X className="size-5" strokeWidth={2} />
          </button>
        </div>
        <div className="defilement-discret flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
          <p className="text-[13px] leading-[1.5] text-texte-2">
            <span className="code font-semibold text-texte">{demande.vehicule.immatriculation}</span> · {demande.vehicule.libelle}
            <br />
            {demande.message ?? t.consigne}
            <br />
            <span className={s === "en-retard" ? "font-semibold text-defavorable" : "text-attenue"}>
              {s === "en-retard" ? "En retard — " : ""}à répondre avant le {heure(demande.echeance)}
            </span>
          </p>

          {t.reponse === "km" ? (
            <label className="block">
              <span className="label-champ mb-1.5 block">Kilométrage affiché</span>
              <span className="flex items-center gap-2">
                <input type="text" inputMode="numeric" value={valeur} onChange={(e) => setValeur(e.target.value)} placeholder="343 620" className={`${champ} text-right tabular-nums`} autoFocus />
                <span className="meta w-8">km</span>
              </span>
            </label>
          ) : null}
          {t.reponse === "pourcentage" ? (
            <div>
              <span className="label-champ mb-1.5 block">Niveau du réservoir</span>
              <div className="grid grid-cols-5 gap-1.5">
                {[0, 25, 50, 75, 100].map((p) => (
                  <button key={p} type="button" onClick={() => setValeur(String(p))} aria-pressed={valeur === String(p)} className={`h-11 rounded-[10px] border text-[13.5px] font-semibold ${valeur === String(p) ? "border-accent-bordure bg-accent-fond text-accent-tres-fonce" : "border-bordure bg-surface text-texte-2"}`}>
                    {p === 0 ? "Vide" : p === 100 ? "Plein" : `${p} %`}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {t.reponse === "texte" ? (
            <label className="block">
              <span className="label-champ mb-1.5 block">Où est le véhicule ?</span>
              <input type="text" value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Dépôt de Thiès, parking arrière" className={champ} autoFocus />
            </label>
          ) : null}
          {t.reponse === "controle" ? (
            <div className="flex flex-col gap-2">
              <span className="label-champ block">Contrôle</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" onClick={() => setControle("ok")} aria-pressed={controle === "ok"} className={`h-11 rounded-[10px] border text-[13.5px] font-semibold ${controle === "ok" ? "border-accent-bordure bg-accent-fond text-accent-tres-fonce" : "border-bordure bg-surface text-texte-2"}`}>
                  Tout est bon
                </button>
                <button type="button" onClick={() => setControle("reserve")} aria-pressed={controle === "reserve"} className={`h-11 rounded-[10px] border text-[13.5px] font-semibold ${controle === "reserve" ? "border-defavorable-bordure bg-defavorable-fond text-defavorable" : "border-bordure bg-surface text-texte-2"}`}>
                  Une réserve
                </button>
              </div>
              {controle === "reserve" ? <input type="text" value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Feu de gabarit arrière droit hors service" className={champ} autoFocus /> : null}
            </div>
          ) : null}

          <ChampPhoto valeur={photo} onChange={setPhoto} dossier="demandes" precision="Obligatoire : le compteur, la jauge, le lieu ou le point contrôlé" />

          <label className="block">
            <span className="label-champ mb-1.5 block">Un mot (facultatif)</span>
            <input type="text" value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="Compteur photographié moteur tournant" className={champ} />
          </label>
        </div>
        <div className="border-t border-bordure px-4 py-3">
          <button type="button" onClick={envoyer} disabled={!valide} className="bouton-principal h-11 w-full justify-center rounded-[12px] text-[14px] disabled:cursor-not-allowed disabled:opacity-50">
            <Check className="size-4" strokeWidth={2.2} />
            Envoyer la réponse
          </button>
          {!photo ? <p className="meta mt-2 text-center">La photo est obligatoire.</p> : null}
        </div>
      </div>
    </>
  );
}
