"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Send, X } from "lucide-react";
import { PhotoJointe } from "@/composants/interface/PhotoJointe";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Carte, TableauSimple } from "@/composants/interface/Carte";
import { Pastille } from "@/composants/interface/Pastille";
import type { AccesCourant } from "@/domaine/acces";
import { STATUT_DEMANDE, TYPES_DEMANDE, TYPE_DEMANDE, libelleReponse, numeroDemandeSuivant, resumerLot, statutDemande, type Demande, type Detenteur, type StatutDemande, type TypeDemande } from "@/domaine/demandes";
import { trouverRole } from "@/domaine/roles";
import { lireAccesCourant } from "@/lib/acces-courant";
import { annuler, envoyerDemandes, lireDemandes } from "@/lib/demandes-demo";
import { lireIdentite, lireRole } from "@/lib/session-demo";

/* ============================================================================
 * Demandes — ce que le parc a poussé aux détenteurs, et ce qui est revenu.
 *
 * Une carte par lot : ce qui a été demandé, à qui, pour quand ; qui a
 * répondu, qui tarde. Le panneau « Nouvelle demande » cible une personne,
 * plusieurs, ou tous les détenteurs d'un site (cadrage du 7 septembre 2026).
 * Répondre se fait sur le téléphone, photo obligatoire.
 * ==========================================================================*/

/** Un véhicule à qui l'on peut adresser une demande : il a un détenteur. */
export interface CibleDemande {
  vehiculeId: string;
  immatriculation: string;
  libelle: string;
  siteId: string | null;
  siteLibelle: string | null;
  detenteur: Detenteur;
}

const CHAMP = "h-9 w-full rounded-[10px] border border-bordure-champ bg-surface px-3 text-[13px] text-texte outline-none focus:border-accent disabled:bg-surface-2 disabled:text-texte-2";

function heure(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function EcranDemandes({ initial, cibles, sites, maintenant }: { initial: Demande[]; cibles: CibleDemande[]; sites: { id: string; libelle: string }[]; maintenant: string }) {
  const router = useRouter();
  const [liste, setListe] = useState<Demande[]>(initial);
  const [acces, setAcces] = useState<AccesCourant | null>(null);
  const [auteur, setAuteur] = useState("");
  const [filtre, setFiltre] = useState<StatutDemande | "toutes">("toutes");
  const [panneau, setPanneau] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    setListe(lireDemandes(initial));
    const a = lireAccesCourant();
    setAcces(a);
    setAuteur(lireIdentite()?.nom ?? trouverRole(lireRole()).nom);
    /* Le raccourci « Demander » du téléphone arrive avec `?nouvelle` : le
       panneau s'ouvre directement. Lu sur l'adresse plutôt que par
       `useSearchParams`, qui exigerait une frontière Suspense au rendu statique. */
    if (new URLSearchParams(window.location.search).has("nouvelle") && a.profil !== "detenteur" && (a.niveaux.demandes === "saisie" || a.niveaux.demandes === "gestion")) setPanneau(true);
  }, [initial]);

  const envoie = acces !== null && acces.profil !== "detenteur" && (acces.niveaux.demandes === "saisie" || acces.niveaux.demandes === "gestion");
  const gere = acces !== null && acces.niveaux.demandes === "gestion";

  const resume = useMemo(() => resumerLot(liste, maintenant), [liste, maintenant]);
  const lots = useMemo(() => {
    const parLot = new Map<string, Demande[]>();
    for (const d of liste) {
      if (filtre !== "toutes" && statutDemande(d, maintenant) !== filtre) continue;
      const l = parLot.get(d.lot);
      if (l) l.push(d);
      else parLot.set(d.lot, [d]);
    }
    return [...parLot.values()].sort((a, b) => b[0]!.emiseLe.localeCompare(a[0]!.emiseLe));
  }, [liste, filtre, maintenant]);

  async function annulerUne(d: Demande) {
    const refus = await annuler(d.id, liste);
    if (refus) {
      setErreur(refus);
      return;
    }
    setListe(lireDemandes(initial.map((x) => (x.id === d.id ? { ...x, annuleeLe: maintenant } : x))));
    router.refresh();
  }

  const filtres: { cle: StatutDemande | "toutes"; libelle: string; n: number }[] = [
    { cle: "toutes", libelle: "Toutes", n: resume.total },
    { cle: "a-repondre", libelle: "À répondre", n: resume.aRepondre },
    { cle: "en-retard", libelle: "En retard", n: resume.enRetard },
    { cle: "repondue", libelle: "Répondues", n: resume.repondues },
  ];

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <TitreEcran
        titre="Demandes"
        sousTitre={`${resume.total} demande${resume.total > 1 ? "s" : ""} · ${resume.aRepondre} à répondre · ${resume.enRetard} en retard · ${resume.repondues} répondue${resume.repondues > 1 ? "s" : ""}`}
        actions={
          <>
            {erreur ? <span className="max-w-[360px] text-[12.5px] leading-[1.4] text-defavorable">{erreur}</span> : null}
            {envoie ? (
              <button type="button" onClick={() => setPanneau(true)} className="bouton-principal">
                <Plus className="size-4" strokeWidth={2.2} />
                Nouvelle demande
              </button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {filtres.map((f) => (
          <button key={f.cle} type="button" onClick={() => setFiltre(f.cle)} aria-pressed={filtre === f.cle} className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium ${filtre === f.cle ? "border-accent-bordure bg-accent-fond text-accent-tres-fonce" : "border-bordure bg-surface text-texte-2 hover:bg-surface-2"}`}>
            {f.libelle}
            <span className="code text-[11.5px] text-attenue">{f.n}</span>
          </button>
        ))}
        <span className="meta ml-auto">On répond depuis le téléphone, photo à l&apos;appui.</span>
      </div>

      {lots.length === 0 ? (
        <div className="carte px-5 py-8 text-center">
          <p className="meta">{liste.length === 0 ? "Aucune demande envoyée pour l'instant." : "Aucune demande dans ce filtre."}</p>
        </div>
      ) : null}

      {lots.map((demandes) => {
        const premiere = demandes[0]!;
        const t = TYPE_DEMANDE[premiere.type];
        const r = resumerLot(demandes, maintenant);
        return (
          <Carte key={premiere.lot} titre={`${t.libelle} · ${heure(premiere.emiseLe)}`} precision={`Par ${premiere.emisePar || "—"} · à répondre avant ${heure(premiere.echeance)}${premiere.message ? ` · « ${premiere.message} »` : ""}`} action={<span className="text-[12.5px] text-texte-2">{r.repondues}/{r.total} répondue{r.repondues > 1 ? "s" : ""}{r.enRetard ? <b className="ml-2 font-semibold text-defavorable">{r.enRetard} en retard</b> : null}</span>} sansMarge>
            <TableauSimple<Demande>
              cle={(d) => d.id}
              lignes={demandes}
              filtrable={false}
              figerEnTete={false}
              colonnes={[
                {
                  cle: "vehicule",
                  libelle: "Véhicule",
                  rendu: (d) => (
                    <Link href={`/flotte/${d.vehicule.id}`} className="flex flex-col hover:text-accent-fonce">
                      <span className="code font-medium text-texte">{d.vehicule.immatriculation}</span>
                      <span className="meta">{d.vehicule.libelle}</span>
                    </Link>
                  ),
                },
                { cle: "detenteur", libelle: "Détenteur", rendu: (d) => <span className="text-texte">{d.detenteur.nom}</span> },
                { cle: "numero", libelle: "N°", rendu: (d) => <span className="code text-[12px] text-texte-2">{d.numero}</span> },
                {
                  cle: "statut",
                  libelle: "Statut",
                  rendu: (d) => {
                    const s = statutDemande(d, maintenant);
                    return <Pastille ton={STATUT_DEMANDE[s].ton}>{STATUT_DEMANDE[s].libelle}</Pastille>;
                  },
                },
                {
                  cle: "reponse",
                  libelle: "Réponse",
                  rendu: (d) =>
                    d.reponse ? (
                      <span className="flex flex-col">
                        <span className="text-texte">{libelleReponse(d)}</span>
                        <span className="meta">
                          {heure(d.reponse.le)}
                          {d.reponse.commentaire ? ` · ${d.reponse.commentaire}` : ""}
                        </span>
                      </span>
                    ) : (
                      <span className="text-attenue-2">—</span>
                    ),
                },
                {
                  cle: "photo",
                  libelle: "Photo",
                  rendu: (d) => <PhotoJointe reference={d.reponse?.photo} libelle={`Photo · ${d.vehicule.immatriculation}`} />,
                },
                ...(gere
                  ? [
                      {
                        cle: "action",
                        libelle: "",
                        rendu: (d: Demande) =>
                          statutDemande(d, maintenant) === "repondue" || statutDemande(d, maintenant) === "annulee" ? null : (
                            <button type="button" onClick={() => void annulerUne(d)} className="bouton-secondaire h-7 px-2.5 text-[12px]">
                              Annuler
                            </button>
                          ),
                      },
                    ]
                  : []),
              ]}
            />
          </Carte>
        );
      })}

      {panneau ? (
        <PanneauNouvelleDemande
          cibles={cibles}
          sites={sites}
          maintenant={maintenant}
          auteur={auteur}
          existantes={liste}
          onFermer={() => setPanneau(false)}
          onEnvoye={(nouvelles) => {
            setPanneau(false);
            setListe(lireDemandes([...nouvelles, ...initial]));
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function PanneauNouvelleDemande({ cibles, sites, maintenant, auteur, existantes, onFermer, onEnvoye }: { cibles: CibleDemande[]; sites: { id: string; libelle: string }[]; maintenant: string; auteur: string; existantes: Demande[]; onFermer: () => void; onEnvoye: (nouvelles: Demande[]) => void }) {
  const [type, setType] = useState<TypeDemande>("releve-compteur");
  const [message, setMessage] = useState("");
  const [echeance, setEcheance] = useState(() => `${maintenant.slice(0, 10)}T18:00`);
  const [site, setSite] = useState<string>("tous");
  const [choisis, setChoisis] = useState<Set<string>>(new Set());
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const visibles = useMemo(() => cibles.filter((c) => site === "tous" || c.siteId === site), [cibles, site]);
  const toutesCochees = visibles.length > 0 && visibles.every((c) => choisis.has(c.vehiculeId));

  function basculer(id: string) {
    setChoisis((s) => {
      const suite = new Set(s);
      if (suite.has(id)) suite.delete(id);
      else suite.add(id);
      return suite;
    });
  }

  function toutCocher() {
    setChoisis((s) => {
      const suite = new Set(s);
      if (toutesCochees) visibles.forEach((c) => suite.delete(c.vehiculeId));
      else visibles.forEach((c) => suite.add(c.vehiculeId));
      return suite;
    });
  }

  async function envoyer() {
    const retenues = cibles.filter((c) => choisis.has(c.vehiculeId));
    if (retenues.length === 0 || !echeance) return;
    setEnCours(true);
    setErreur(null);
    const lot = `lot-${maintenant.slice(0, 19).replace(/[:T]/g, "")}-${type}`;
    const echeanceIso = `${echeance}:00.000Z`;
    const nouvelles: Demande[] = [];
    let numero = numeroDemandeSuivant(existantes, maintenant);
    for (const c of retenues) {
      nouvelles.push({
        id: `dem-${lot}-${c.vehiculeId}`,
        numero,
        lot,
        type,
        vehicule: { id: c.vehiculeId, immatriculation: c.immatriculation, libelle: c.libelle, siteId: c.siteId },
        detenteur: c.detenteur,
        message: message.trim() || null,
        emiseLe: maintenant,
        emisePar: auteur,
        echeance: echeanceIso,
        reponse: null,
        annuleeLe: null,
      });
      numero = numeroDemandeSuivant([...existantes, ...nouvelles], maintenant);
    }
    const refus = await envoyerDemandes(nouvelles, existantes);
    setEnCours(false);
    if (refus) {
      setErreur(refus);
      return;
    }
    onEnvoye(nouvelles);
  }

  const t = TYPE_DEMANDE[type];

  return (
    <>
      <button type="button" aria-label="Fermer le panneau" onClick={onFermer} className="fixed inset-0 z-30 cursor-default bg-encre/35" />
      <aside role="dialog" aria-modal="true" aria-labelledby="nouvelle-demande-titre" className="fixed inset-y-0 right-0 z-40 flex w-[min(520px,100vw)] flex-col bg-surface shadow-flottante">
        <div className="flex items-center gap-3 border-b border-bordure px-5 pt-4 pb-3">
          <h2 id="nouvelle-demande-titre" className="text-[16px] font-bold text-texte">
            Nouvelle demande
          </h2>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="ml-auto grid size-8 place-items-center rounded-full text-texte-2 hover:bg-surface-3">
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>

        <div className="defilement-discret flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <label className="block">
            <span className="label-champ mb-1.5 block">Ce qui est demandé</span>
            <select value={type} onChange={(e) => setType(e.target.value as TypeDemande)} className={CHAMP}>
              {TYPES_DEMANDE.map((x) => (
                <option key={x.type} value={x.type}>
                  {x.libelle}
                </option>
              ))}
            </select>
            <span className="meta mt-1 block">{t.consigne} La photo est obligatoire.</span>
          </label>

          <label className="block">
            <span className="label-champ mb-1.5 block">Message au détenteur (facultatif)</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} className={`${CHAMP} h-auto resize-none py-2 leading-relaxed`} placeholder="Relevé de fin de mois : le compteur avant le premier départ." />
          </label>

          <label className="block">
            <span className="label-champ mb-1.5 block">À répondre avant</span>
            <input type="datetime-local" value={echeance} onChange={(e) => setEcheance(e.target.value)} className={`${CHAMP} w-[220px]`} />
          </label>

          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="label-champ">Destinataires</span>
              <select value={site} onChange={(e) => setSite(e.target.value)} className={`${CHAMP} ml-auto h-8 w-[200px] text-[12.5px]`} aria-label="Site">
                <option value="tous">Tous les sites</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.libelle}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-[10px] border border-bordure">
              <label className="flex items-center gap-2.5 border-b border-bordure bg-surface-2 px-3 py-2 text-[12.5px] font-medium text-texte">
                <input type="checkbox" checked={toutesCochees} onChange={toutCocher} className="size-4 accent-accent" />
                {site === "tous" ? "Tous les détenteurs" : `Tous les détenteurs de ${sites.find((s) => s.id === site)?.libelle ?? "ce site"}`}
                <span className="meta ml-auto">{visibles.length}</span>
              </label>
              <div className="defilement-discret max-h-[320px] overflow-y-auto">
                {visibles.length === 0 ? <p className="meta px-3 py-3">Aucun véhicule avec détenteur sur ce site.</p> : null}
                {visibles.map((c) => (
                  <label key={c.vehiculeId} className="flex items-center gap-2.5 border-b border-bordure px-3 py-2 last:border-b-0 hover:bg-surface-2">
                    <input type="checkbox" checked={choisis.has(c.vehiculeId)} onChange={() => basculer(c.vehiculeId)} className="size-4 accent-accent" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] text-texte">
                        {c.detenteur.nom} <span className="meta">· {c.detenteur.genre === "attributaire" ? "attributaire" : "titulaire"}</span>
                      </span>
                      <span className="meta block truncate">
                        <span className="code">{c.immatriculation}</span> · {c.libelle}
                        {c.siteLibelle ? ` · ${c.siteLibelle}` : ""}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {erreur ? <p className="text-[12.5px] leading-[1.4] text-defavorable">{erreur}</p> : null}
        </div>

        <div className="flex items-center gap-2.5 border-t border-bordure px-5 py-3">
          <span className="meta">
            {choisis.size} destinataire{choisis.size > 1 ? "s" : ""} · prévenu{choisis.size > 1 ? "s" : ""} par notification ou courriel
          </span>
          <button type="button" onClick={onFermer} className="bouton-secondaire ml-auto">
            Annuler
          </button>
          <button type="button" onClick={() => void envoyer()} disabled={choisis.size === 0 || !echeance || enCours} className="bouton-principal disabled:cursor-not-allowed disabled:opacity-50">
            {enCours ? <Check className="size-4" strokeWidth={2.2} /> : <Send className="size-4" strokeWidth={2} />}
            Envoyer
          </button>
        </div>
      </aside>
    </>
  );
}
