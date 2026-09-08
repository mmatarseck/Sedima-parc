"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, Plus, Trash2 } from "lucide-react";
import { ChampPhoto } from "@/composants/interface/ChampPhoto";
import { PhotoJointe } from "@/composants/interface/PhotoJointe";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Carte } from "@/composants/interface/Carte";
import { Pastille } from "@/composants/interface/Pastille";
import type { AccesCourant } from "@/domaine/acces";
import { TYPE_DOCUMENT } from "@/domaine/libelles";
import { EQUIPEMENTS_STANDARD, NIVEAUX_CARBURANT, STATUT_TRANSFERT, libellePartie, numeroTransfertSuivant, statutTransfert, type PartieTransfert, type Signature, type Transfert } from "@/domaine/transferts";
import type { TypeDocument } from "@/domaine/types";
import { trouverRole } from "@/domaine/roles";
import { lireAccesCourant } from "@/lib/acces-courant";
import { lireAcces } from "@/lib/acces-demo";
import { nombre } from "@/lib/format";
import { authentificationReelle, lireIdentite, lireRole } from "@/lib/session-demo";
import { creerTransfert, lireTransferts, signer } from "@/lib/transferts-demo";
import { SignaturePad } from "./SignaturePad";

/* ============================================================================
 * La fiche de transfert — la même sur le bureau et sur le téléphone, en une
 * colonne : le véhicule, qui remet et qui reçoit, l'état des lieux
 * (compteur, carburant, documents à bord, équipements, réserves avec
 * photos), et les deux signatures sur l'écran. Une fiche existante se relit
 * ici, et la partie qui n'a pas encore signé signe.
 * ==========================================================================*/

/** Un véhicule que l'on peut remettre : avec son détenteur du moment et son compteur. */
export interface CibleTransfert {
  vehiculeId: string;
  immatriculation: string;
  libelle: string;
  siteId: string | null;
  siteLibelle: string | null;
  km: number | null;
  detenteur: PartieTransfert | null;
}

export interface PersonnesTransfert {
  chauffeurs: { id: string; nom: string; site: string | null }[];
  attributaires: { id: string; nom: string }[];
}

const CHAMP = "h-10 w-full rounded-[10px] border border-bordure-champ bg-surface px-3 text-[13.5px] text-texte outline-none focus:border-accent disabled:bg-surface-2 disabled:text-texte-2";

function heure(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()} à ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function FicheTransfert({ initial, id, cibles, personnes, documents, maintenant }: { initial: Transfert[]; id: string | null; cibles: CibleTransfert[]; personnes: PersonnesTransfert; documents: { id: TypeDocument; libelle: string }[]; maintenant: string }) {
  const router = useRouter();
  const [liste, setListe] = useState<Transfert[]>(initial);
  const [acces, setAcces] = useState<AccesCourant | null>(null);
  const [auteur, setAuteur] = useState("");
  const [detenteurIds, setDetenteurIds] = useState<{ chauffeurId: string | null; attributaireId: string | null } | null>(null);
  useEffect(() => {
    setListe(lireTransferts(initial));
    const a = lireAccesCourant();
    setAcces(a);
    setAuteur(lireIdentite()?.nom ?? trouverRole(lireRole()).nom);
    if (a.profil === "detenteur" && !authentificationReelle()) {
      const fiche = lireAcces().find((x) => x.profil === "detenteur" && (x.chauffeurId || x.attributaireId));
      setDetenteurIds(fiche ? { chauffeurId: fiche.chauffeurId, attributaireId: fiche.attributaireId } : { chauffeurId: null, attributaireId: null });
    }
  }, [initial]);

  const existante = id ? (liste.find((t) => t.id === id) ?? null) : null;
  if (id && acces && !existante) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-4 py-6 lg:px-8">
        <Retour />
        <div className="carte px-5 py-8 text-center">
          <p className="meta">Fiche introuvable, ou hors de votre périmètre.</p>
        </div>
      </div>
    );
  }
  if (!acces) return <div className="px-8 py-7" />;
  if (existante) return <Lecture t={existante} liste={liste} acces={acces} auteur={auteur} detenteurIds={detenteurIds} maintenant={maintenant} onChange={(t) => setListe(lireTransferts(initial.map((x) => (x.id === t.id ? t : x))))} />;
  return <Nouvelle liste={liste} cibles={cibles} personnes={personnes} documents={documents} maintenant={maintenant} auteur={auteur} onCree={(t) => router.push(`/transferts/${t.id}`)} />;
}

function Retour() {
  return (
    <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[12.5px] text-attenue">
      <Link href="/transferts" className="inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce">
        <ChevronLeft className="size-3.5" strokeWidth={2} />
        Fiches de transfert
      </Link>
    </nav>
  );
}

/* ---- Une fiche nouvelle ---------------------------------------------------- */

function Nouvelle({ liste, cibles, personnes, documents, maintenant, auteur, onCree }: { liste: Transfert[]; cibles: CibleTransfert[]; personnes: PersonnesTransfert; documents: { id: TypeDocument; libelle: string }[]; maintenant: string; auteur: string; onCree: (t: Transfert) => void }) {
  const [vehiculeId, setVehiculeId] = useState("");
  const [remettant, setRemettant] = useState<PartieTransfert>({ genre: "parc", id: null, nom: "" });
  const [recipiendaire, setRecipiendaire] = useState<PartieTransfert>({ genre: "chauffeur", id: null, nom: "" });
  const [date, setDate] = useState(maintenant.slice(0, 16));
  const [motif, setMotif] = useState("Nouvelle affectation");
  const [km, setKm] = useState("");
  const [carburant, setCarburant] = useState<number | null>(null);
  const [docs, setDocs] = useState<Set<TypeDocument>>(new Set());
  const [equipements, setEquipements] = useState<{ libelle: string; present: boolean }[]>(EQUIPEMENTS_STANDARD.map((e) => ({ libelle: e, present: true })));
  const [nouvelEquipement, setNouvelEquipement] = useState("");
  const [reserves, setReserves] = useState<{ texte: string; photo: string | null }[]>([]);
  const [commentaire, setCommentaire] = useState("");
  const [signatureRemettant, setSignatureRemettant] = useState<string | null>(null);
  const [signatureRecipiendaire, setSignatureRecipiendaire] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const cible = cibles.find((c) => c.vehiculeId === vehiculeId) ?? null;

  function choisirVehicule(idV: string) {
    setVehiculeId(idV);
    const c = cibles.find((x) => x.vehiculeId === idV);
    if (!c) return;
    setKm(c.km === null ? "" : String(c.km));
    setRemettant(c.detenteur ?? { genre: "parc", id: null, nom: c.siteLibelle ?? "" });
  }

  const kmNombre = Number(km.replace(/\s/g, ""));
  const reservesValides = reserves.every((r) => r.texte.trim() && r.photo);
  const partieValide = (p: PartieTransfert) => (p.genre === "chauffeur" || p.genre === "attributaire" ? Boolean(p.id) : true) && (p.genre === "tiers" ? p.nom.trim().length > 0 : true);
  const valide = cible !== null && date.length >= 16 && motif.trim().length > 0 && (km === "" || (Number.isFinite(kmNombre) && kmNombre >= 0)) && partieValide(remettant) && partieValide(recipiendaire) && reservesValides;

  async function enregistrer() {
    if (!valide || !cible) return;
    setEnCours(true);
    setErreur(null);
    const dateIso = `${date}:00.000Z`;
    const signatureDe = (nom: string, trace: string | null): Signature | null => (trace ? { nom, le: authentificationReelle() ? new Date().toISOString() : maintenant, trace } : null);
    const t: Transfert = {
      id: `trf-${maintenant.slice(0, 19).replace(/[:T-]/g, "")}-${cible.vehiculeId}`,
      numero: numeroTransfertSuivant(liste, maintenant),
      vehicule: { id: cible.vehiculeId, immatriculation: cible.immatriculation, libelle: cible.libelle, siteId: cible.siteId },
      remettant: { ...remettant, nom: remettant.nom.trim() || (remettant.genre === "parc" ? (cible.siteLibelle ?? "Parc") : remettant.nom) },
      recipiendaire: { ...recipiendaire, nom: recipiendaire.nom.trim() },
      date: dateIso,
      motif: motif.trim(),
      km: km === "" ? null : Math.round(kmNombre),
      carburant,
      documentsABord: [...docs],
      equipements,
      reserves: reserves.map((r) => ({ texte: r.texte.trim(), photo: r.photo })),
      commentaire: commentaire.trim() || null,
      signatureRemettant: signatureDe(remettant.nom || (cible.siteLibelle ?? "Parc"), signatureRemettant),
      signatureRecipiendaire: signatureDe(recipiendaire.nom, signatureRecipiendaire),
      annuleeLe: null,
      appliquee: false,
      creeLe: authentificationReelle() ? new Date().toISOString() : maintenant,
      creePar: auteur,
    };
    const refus = await creerTransfert(t, liste);
    setEnCours(false);
    if (refus) {
      setErreur(refus);
      return;
    }
    onCree(t);
  }

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-4 py-6 lg:px-8">
      <Retour />
      <TitreEcran titre="Nouvelle fiche de transfert" sousTitre="L'état des lieux à la remise, et les deux signatures sur l'écran. Complète, la fiche ouvre l'affectation qui suit." />

      <Carte titre="Le véhicule et la remise">
        <div className="flex flex-col gap-3 px-5 pb-4">
          <label className="block">
            <span className="label-champ mb-1.5 block">Véhicule</span>
            <select value={vehiculeId} onChange={(e) => choisirVehicule(e.target.value)} className={CHAMP}>
              <option value="">Choisir…</option>
              {cibles.map((c) => (
                <option key={c.vehiculeId} value={c.vehiculeId}>
                  {c.immatriculation} · {c.libelle}
                  {c.detenteur ? ` · ${c.detenteur.nom}` : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label-champ mb-1.5 block">Date et heure de la remise</span>
              <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className={CHAMP} />
            </label>
            <label className="block">
              <span className="label-champ mb-1.5 block">Motif</span>
              <input type="text" value={motif} onChange={(e) => setMotif(e.target.value)} list="motifs-transfert" className={CHAMP} />
              <datalist id="motifs-transfert">
                {["Nouvelle affectation", "Retour d'atelier", "Congé du titulaire", "Remplacement", "Retour au parc", "Cession"].map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </label>
          </div>
        </div>
      </Carte>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Carte titre="Qui remet">
          <div className="px-5 pb-4">
            <ChoixPartie valeur={remettant} onChange={setRemettant} personnes={personnes} parDefautParc={cible?.siteLibelle ?? null} />
          </div>
        </Carte>
        <Carte titre="Qui reçoit">
          <div className="px-5 pb-4">
            <ChoixPartie valeur={recipiendaire} onChange={setRecipiendaire} personnes={personnes} parDefautParc={cible?.siteLibelle ?? null} />
          </div>
        </Carte>
      </div>

      <Carte titre="État des lieux">
        <div className="flex flex-col gap-4 px-5 pb-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label-champ mb-1.5 block">Compteur</span>
              <span className="flex items-center gap-2">
                <input type="text" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} placeholder={cible?.km !== null && cible?.km !== undefined ? nombre(cible.km) : "—"} className={`${CHAMP} text-right tabular-nums`} />
                <span className="meta w-8">km</span>
              </span>
            </label>
            <div>
              <span className="label-champ mb-1.5 block">Carburant</span>
              <div className="grid grid-cols-5 gap-1.5">
                {NIVEAUX_CARBURANT.map((n) => (
                  <button key={n.valeur} type="button" onClick={() => setCarburant(n.valeur)} aria-pressed={carburant === n.valeur} className={`h-10 rounded-[10px] border text-[13px] font-semibold ${carburant === n.valeur ? "border-accent-bordure bg-accent-fond text-accent-tres-fonce" : "border-bordure bg-surface text-texte-2"}`}>
                    {n.libelle}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <span className="label-champ mb-1.5 block">Documents à bord</span>
            <div className="flex flex-wrap gap-2">
              {documents.map((d) => (
                <label key={d.id} className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-[12.5px] font-medium ${docs.has(d.id) ? "border-accent-bordure bg-accent-fond text-accent-tres-fonce" : "border-bordure bg-surface text-texte-2"}`}>
                  <input type="checkbox" checked={docs.has(d.id)} onChange={() => setDocs((s) => { const n = new Set(s); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })} className="sr-only" />
                  {d.libelle}
                </label>
              ))}
            </div>
          </div>

          <div>
            <span className="label-champ mb-1.5 block">Équipements</span>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {equipements.map((e, i) => (
                <label key={e.libelle} className="flex items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-[13px] text-texte hover:bg-surface-2">
                  <input type="checkbox" checked={e.present} onChange={() => setEquipements((l) => l.map((x, k) => (k === i ? { ...x, present: !x.present } : x)))} className="size-4 accent-accent" />
                  <span className={e.present ? "" : "text-defavorable line-through"}>{e.libelle}</span>
                </label>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input type="text" value={nouvelEquipement} onChange={(e) => setNouvelEquipement(e.target.value)} placeholder="Un autre équipement…" className={`${CHAMP} h-9 max-w-[320px]`} />
              <button type="button" onClick={() => { const l = nouvelEquipement.trim(); if (!l || equipements.some((e) => e.libelle.toLowerCase() === l.toLowerCase())) return; setEquipements((x) => [...x, { libelle: l, present: true }]); setNouvelEquipement(""); }} className="bouton-secondaire h-9">
                <Plus className="size-4" strokeWidth={2} />
                Ajouter
              </button>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center">
              <span className="label-champ">Réserves</span>
              <button type="button" onClick={() => setReserves((r) => [...r, { texte: "", photo: null }])} className="bouton-secondaire ml-auto h-8 text-[12px]">
                <Plus className="size-3.5" strokeWidth={2} />
                Une réserve
              </button>
            </div>
            {reserves.length === 0 ? <p className="meta">Aucune réserve : le véhicule est remis dans l&apos;état attendu. Chaque réserve porte sa photo.</p> : null}
            {reserves.map((r, i) => (
              <div key={i} className="mb-2 flex flex-col gap-2 rounded-[10px] border border-bordure p-3 sm:flex-row sm:items-center">
                <input type="text" value={r.texte} onChange={(e) => setReserves((l) => l.map((x, k) => (k === i ? { ...x, texte: e.target.value } : x)))} placeholder="Rayure sur l'aile arrière gauche" className={`${CHAMP} h-9 flex-1`} />
                <div className="w-[220px] shrink-0">
                  <ChampPhoto valeur={r.photo} onChange={(ref) => setReserves((l) => l.map((x, k) => (k === i ? { ...x, photo: ref } : x)))} dossier="transferts" compact />
                </div>
                <button type="button" onClick={() => setReserves((l) => l.filter((_, k) => k !== i))} aria-label="Retirer la réserve" className="grid size-9 shrink-0 place-items-center rounded-full text-attenue hover:bg-surface-3 hover:text-defavorable">
                  <Trash2 className="size-4" strokeWidth={1.8} />
                </button>
              </div>
            ))}
          </div>

          <label className="block">
            <span className="label-champ mb-1.5 block">Commentaire</span>
            <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={2} className={`${CHAMP} h-auto resize-none py-2 leading-relaxed`} placeholder="Plaquettes de frein remplacées, pneus avant neufs." />
          </label>
        </div>
      </Carte>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Carte titre="Signature de celui qui remet" precision={remettant.nom || (cible?.siteLibelle ? `Parc · ${cible.siteLibelle}` : "—")}>
          <div className="px-5 pb-4">
            <SignaturePad valeur={signatureRemettant} onChange={setSignatureRemettant} />
          </div>
        </Carte>
        <Carte titre="Signature de celui qui reçoit" precision={recipiendaire.nom || "—"}>
          <div className="px-5 pb-4">
            <SignaturePad valeur={signatureRecipiendaire} onChange={setSignatureRecipiendaire} />
            <p className="meta mt-2">Peut signer plus tard, sur son téléphone.</p>
          </div>
        </Carte>
      </div>

      {erreur ? <p className="text-[12.5px] leading-[1.4] text-defavorable">{erreur}</p> : null}
      <div className="flex items-center gap-2.5">
        <span className="meta">{signatureRemettant && signatureRecipiendaire ? "Les deux signatures sont là : la fiche ouvrira l'affectation du récipiendaire." : "Sans les deux signatures, la fiche reste à signer."}</span>
        <button type="button" onClick={() => void enregistrer()} disabled={!valide || enCours} className="bouton-principal ml-auto h-10 disabled:cursor-not-allowed disabled:opacity-50" title={valide ? undefined : "Véhicule, remise, parties et photos des réserves sont à compléter"}>
          <Check className="size-4" strokeWidth={2.2} />
          Enregistrer la fiche
        </button>
      </div>
    </div>
  );
}

function ChoixPartie({ valeur, onChange, personnes, parDefautParc }: { valeur: PartieTransfert; onChange: (p: PartieTransfert) => void; personnes: PersonnesTransfert; parDefautParc: string | null }) {
  const genres: { genre: PartieTransfert["genre"]; libelle: string }[] = [
    { genre: "chauffeur", libelle: "Chauffeur" },
    { genre: "attributaire", libelle: "Attributaire" },
    { genre: "parc", libelle: "Le parc" },
    { genre: "tiers", libelle: "Un tiers" },
  ];
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-4 gap-1.5">
        {genres.map((g) => (
          <button key={g.genre} type="button" onClick={() => onChange({ genre: g.genre, id: null, nom: g.genre === "parc" ? (parDefautParc ?? "") : "" })} aria-pressed={valeur.genre === g.genre} className={`h-9 rounded-[10px] border text-[12px] font-semibold ${valeur.genre === g.genre ? "border-accent-bordure bg-accent-fond text-accent-tres-fonce" : "border-bordure bg-surface text-texte-2"}`}>
            {g.libelle}
          </button>
        ))}
      </div>
      {valeur.genre === "chauffeur" ? (
        <select value={valeur.id ?? ""} onChange={(e) => { const c = personnes.chauffeurs.find((x) => x.id === e.target.value); onChange({ genre: "chauffeur", id: c?.id ?? null, nom: c?.nom ?? "" }); }} className={CHAMP}>
          <option value="">Choisir le chauffeur…</option>
          {personnes.chauffeurs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
              {c.site ? ` · ${c.site}` : ""}
            </option>
          ))}
        </select>
      ) : null}
      {valeur.genre === "attributaire" ? (
        <select value={valeur.id ?? ""} onChange={(e) => { const a = personnes.attributaires.find((x) => x.id === e.target.value); onChange({ genre: "attributaire", id: a?.id ?? null, nom: a?.nom ?? "" }); }} className={CHAMP}>
          <option value="">Choisir l&apos;attributaire…</option>
          {personnes.attributaires.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nom}
            </option>
          ))}
        </select>
      ) : null}
      {valeur.genre === "parc" ? <input type="text" value={valeur.nom} onChange={(e) => onChange({ ...valeur, nom: e.target.value })} placeholder="Dépôt, atelier, garage…" className={CHAMP} /> : null}
      {valeur.genre === "tiers" ? <input type="text" value={valeur.nom} onChange={(e) => onChange({ ...valeur, nom: e.target.value })} placeholder="Nom de la personne ou de la société" className={CHAMP} /> : null}
    </div>
  );
}

/* ---- Une fiche existante : lecture, et la signature qui manque ------------- */

function Lecture({ t, liste, acces, auteur, detenteurIds, maintenant, onChange }: { t: Transfert; liste: Transfert[]; acces: AccesCourant; auteur: string; detenteurIds: { chauffeurId: string | null; attributaireId: string | null } | null; maintenant: string; onChange: (t: Transfert) => void }) {
  const router = useRouter();
  const [traceRemettant, setTraceRemettant] = useState<string | null>(null);
  const [traceRecipiendaire, setTraceRecipiendaire] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const s = statutTransfert(t);
  const detenteur = acces.profil === "detenteur";

  /* Qui peut poser quelle signature : un détenteur, la sienne ; qui a la
     saisie du module, l'une ou l'autre — la personne signe sur son écran. */
  const estMoi = (p: PartieTransfert) => {
    if (!detenteur) return false;
    if (authentificationReelle()) return p.genre === "chauffeur" || p.genre === "attributaire";
    return Boolean(detenteurIds && ((p.genre === "chauffeur" && p.id === detenteurIds.chauffeurId) || (p.genre === "attributaire" && p.id === detenteurIds.attributaireId)));
  };
  const saisit = !detenteur && (acces.niveaux.transferts === "saisie" || acces.niveaux.transferts === "gestion");
  const peutSignerRemettant = !t.signatureRemettant && !t.annuleeLe && (saisit || estMoi(t.remettant));
  const peutSignerRecipiendaire = !t.signatureRecipiendaire && !t.annuleeLe && (saisit || estMoi(t.recipiendaire));

  async function poser(partie: "remettant" | "recipiendaire", trace: string | null) {
    if (!trace) return;
    const nom = partie === "remettant" ? t.remettant.nom : t.recipiendaire.nom;
    const signature: Signature = { nom: nom || auteur, le: authentificationReelle() ? new Date().toISOString() : maintenant, trace };
    const refus = await signer(t.id, partie, signature, liste);
    if (refus) {
      setErreur(refus);
      return;
    }
    onChange({ ...t, [partie === "remettant" ? "signatureRemettant" : "signatureRecipiendaire"]: signature });
    router.refresh();
  }

  const equipementsAbsents = useMemo(() => t.equipements.filter((e) => !e.present), [t]);

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-4 py-6 lg:px-8">
      <Retour />
      <TitreEcran titre={`Fiche ${t.numero}`} sousTitre={`${t.vehicule.immatriculation} · ${t.vehicule.libelle} · ${t.motif} · remise le ${heure(t.date)}`} actions={<Pastille ton={STATUT_TRANSFERT[s].ton}>{STATUT_TRANSFERT[s].libelle}</Pastille>} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Carte titre="Qui remet">
          <p className="px-5 pb-4 text-[14px] font-medium text-texte">{libellePartie(t.remettant)}</p>
        </Carte>
        <Carte titre="Qui reçoit">
          <p className="px-5 pb-4 text-[14px] font-medium text-texte">{libellePartie(t.recipiendaire)}</p>
        </Carte>
      </div>

      <Carte titre="État des lieux">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 px-5 pb-4 text-[13px] sm:grid-cols-2">
          <div>
            <dt className="meta">Compteur</dt>
            <dd className="code font-medium text-texte">{t.km === null ? "—" : `${nombre(t.km)} km`}</dd>
          </div>
          <div>
            <dt className="meta">Carburant</dt>
            <dd className="font-medium text-texte">{t.carburant === null ? "—" : (NIVEAUX_CARBURANT.find((n) => n.valeur === t.carburant)?.libelle ?? `${t.carburant} %`)}</dd>
          </div>
          <div>
            <dt className="meta">Documents à bord</dt>
            <dd className="text-texte">{t.documentsABord.length ? t.documentsABord.map((d) => TYPE_DOCUMENT[d]).join(", ") : "aucun"}</dd>
          </div>
          <div>
            <dt className="meta">Équipements</dt>
            <dd className="text-texte">{equipementsAbsents.length === 0 ? `${t.equipements.length} vérifiés, tous présents` : <>{t.equipements.length - equipementsAbsents.length} présents · <span className="text-defavorable">manque {equipementsAbsents.map((e) => e.libelle.toLowerCase()).join(", ")}</span></>}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="meta">Réserves</dt>
            <dd className="text-texte">
              {t.reserves.length === 0 ? "aucune" : null}
              {t.reserves.map((r, i) => (
                <span key={i} className="flex items-center gap-2 py-0.5">
                  <PhotoJointe reference={r.photo} taille={32} libelle={r.texte} />
                  {r.texte}
                </span>
              ))}
            </dd>
          </div>
          {t.commentaire ? (
            <div className="sm:col-span-2">
              <dt className="meta">Commentaire</dt>
              <dd className="text-texte">{t.commentaire}</dd>
            </div>
          ) : null}
        </dl>
      </Carte>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Carte titre="Signature de celui qui remet" precision={t.signatureRemettant ? `${t.signatureRemettant.nom} · ${heure(t.signatureRemettant.le)}` : libellePartie(t.remettant)}>
          <div className="px-5 pb-4">
            {t.signatureRemettant ? <SignaturePad valeur={t.signatureRemettant.trace} onChange={() => undefined} disabled /> : peutSignerRemettant ? <SignaturePad valeur={traceRemettant} onChange={setTraceRemettant} /> : <p className="meta py-2">Pas encore signée.</p>}
            {peutSignerRemettant ? (
              <button type="button" onClick={() => void poser("remettant", traceRemettant)} disabled={!traceRemettant} className="bouton-principal mt-2 h-9 disabled:cursor-not-allowed disabled:opacity-50">
                <Check className="size-4" strokeWidth={2.2} />
                Signer
              </button>
            ) : null}
          </div>
        </Carte>
        <Carte titre="Signature de celui qui reçoit" precision={t.signatureRecipiendaire ? `${t.signatureRecipiendaire.nom} · ${heure(t.signatureRecipiendaire.le)}` : libellePartie(t.recipiendaire)}>
          <div className="px-5 pb-4">
            {t.signatureRecipiendaire ? <SignaturePad valeur={t.signatureRecipiendaire.trace} onChange={() => undefined} disabled /> : peutSignerRecipiendaire ? <SignaturePad valeur={traceRecipiendaire} onChange={setTraceRecipiendaire} /> : <p className="meta py-2">Pas encore signée.</p>}
            {peutSignerRecipiendaire ? (
              <button type="button" onClick={() => void poser("recipiendaire", traceRecipiendaire)} disabled={!traceRecipiendaire} className="bouton-principal mt-2 h-9 disabled:cursor-not-allowed disabled:opacity-50">
                <Check className="size-4" strokeWidth={2.2} />
                Signer
              </button>
            ) : null}
          </div>
        </Carte>
      </div>

      {erreur ? <p className="text-[12.5px] leading-[1.4] text-defavorable">{erreur}</p> : null}
      <p className="meta">
        {s === "complete" ? (t.appliquee ? "Fiche complète : l'affectation du récipiendaire est ouverte, la précédente fermée." : "Fiche complète.") : s === "annulee" ? "Fiche annulée." : "Quand les deux signatures seront là, la fiche ouvrira l'affectation du récipiendaire."} Établie par {t.creePar || "—"} le {heure(t.creeLe)}.
      </p>
    </div>
  );
}
