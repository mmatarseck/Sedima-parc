"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, FileCheck, Fuel, Gauge, Inbox, Package, PenLine, RefreshCw, ScanLine, Search, Send, Settings2, Stamp, TriangleAlert, UserPlus, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { trouverProfil, type AccesCourant } from "@/domaine/acces";
import { peutCloturer } from "@/domaine/cloture";
import { TYPE_DEMANDE, statutDemande, type Demande } from "@/domaine/demandes";
import { TYPE_DOCUMENT } from "@/domaine/libelles";
import { trouverRole } from "@/domaine/roles";
import { statutTransfert, type Transfert } from "@/domaine/transferts";
import type { LigneFlotte } from "@/domaine/types";
import { lireAccesCourant } from "@/lib/acces-courant";
import { lireDemandes as lireDemandesModification } from "@/lib/clotures-demo";
import { lireDemandes } from "@/lib/demandes-demo";
import { initiales as initialesDe, lireIdentite, lireRole } from "@/lib/session-demo";
import { lireTransferts } from "@/lib/transferts-demo";
import { WIDGETS, lireRecents, lireReglageAccueil, raccourcisPour, type CleRaccourci, type CleWidget, type Raccourci, type VehiculeRecent } from "./accueil-widgets";
import { mesDemandes } from "./EcranTelephoneDemandes";
import { mesTransferts } from "./EcranTelephoneTransferts";
import { dansPerimetre } from "./perimetre";
import { Bloc, Chiffre, Ligne } from "./Telephone";

/* ============================================================================
 * Téléphone › Accueil — refonte du 8 septembre 2026 sur le modèle de Fleetio
 * Go : un accueil fait de widgets que chacun choisit et ordonne (« Personnaliser
 * l'accueil »), l'avatar qui mène aux réglages, et en bas les quatre onglets
 * Accueil, Parcourir, Notifications, Rechercher. Tout reste borné au périmètre
 * et à l'accès de la personne.
 *
 * Le widget « Raccourcis » porte **tous les gestes de la journée** de la
 * personne (demande du métier du 8 septembre 2026) : le catalogue est dans
 * `accueil-widgets.ts`, et chaque geste n'apparaît qu'à qui peut l'accomplir.
 * « À faire aujourd'hui » dit ce qui attend : demandes, fiches à signer,
 * échéances, immobilisés, relevés, atelier, modifications à approuver.
 * ==========================================================================*/

const OPERATIONNELS = new Set(["en-service", "en-backup"]);

export interface CompteursAtelier {
  enAtelier: number;
  planifies: number;
  aPlanifier: number;
}

export function EcranTelephoneAccueil({ lignes, aujourdhui, demandes, transferts, atelier, maintenant }: { lignes: LigneFlotte[]; aujourdhui: string; demandes: Demande[]; transferts: Transfert[]; atelier: CompteursAtelier; maintenant: string }) {
  const [acces, setAcces] = useState<AccesCourant | null>(null);
  const [nom, setNom] = useState("");
  const [ordre, setOrdre] = useState<CleWidget[] | null>(null);
  const [listeDemandes, setListeDemandes] = useState<Demande[]>(demandes);
  const [listeTransferts, setListeTransferts] = useState<Transfert[]>(transferts);
  const [recents, setRecents] = useState<VehiculeRecent[]>([]);
  /* Les modifications sur des mois clos qui attendent une décision ; lues après le montage, comme tout ce que le navigateur garde. */
  const [aValider, setAValider] = useState(0);
  useEffect(() => {
    setAcces(lireAccesCourant());
    setNom(lireIdentite()?.nom ?? trouverRole(lireRole()).nom);
    setOrdre(lireReglageAccueil().ordre);
    setListeDemandes(lireDemandes(demandes));
    setListeTransferts(lireTransferts(transferts));
    setRecents(lireRecents());
    setAValider(peutCloturer(lireRole()) ? lireDemandesModification().filter((d) => d.statut === "en-attente").length : 0);
  }, [demandes, transferts]);

  const detenteur = acces?.profil === "detenteur";
  const miennes = useMemo(() => (acces ? lignes.filter((l) => dansPerimetre(l, acces)) : lignes), [lignes, acces]);
  const engagees = miennes.filter((l) => l.vehicule.engage && l.vehicule.statut !== "a-recevoir");
  const disponibles = engagees.filter((l) => OPERATIONNELS.has(l.statutEffectif ?? l.vehicule.statut));
  const immobilises = engagees.filter((l) => !OPERATIONNELS.has(l.statutEffectif ?? l.vehicule.statut));
  const echeances = miennes
    .filter((l) => l.prochaineEcheanceConformite && l.prochaineEcheanceConformite.joursRestants <= 30)
    .sort((a, b) => a.prochaineEcheanceConformite!.joursRestants - b.prochaineEcheanceConformite!.joursRestants);
  const sansReleve = miennes.filter((l) => l.vehicule.engage && (!l.dateKilometrage || joursEntre(l.dateKilometrage, aujourdhui) > 7)).length;
  const demandesOuvertes = useMemo(() => (acces ? mesDemandes(listeDemandes, acces).filter((d) => statutDemande(d, maintenant) === "a-repondre" || statutDemande(d, maintenant) === "en-retard") : []), [listeDemandes, acces, maintenant]);
  const enRetard = demandesOuvertes.filter((d) => statutDemande(d, maintenant) === "en-retard").length;
  const transfertsASigner = useMemo(() => (acces ? mesTransferts(listeTransferts, acces).filter((t) => { const s = statutTransfert(t); return s !== "complete" && s !== "annulee"; }) : []), [listeTransferts, acces]);
  const profil = acces ? trouverProfil(acces.profil) : null;
  const niveau = (m: Parameters<typeof peut>[1]) => peut(acces, m);
  const monVehicule = detenteur ? (demandesOuvertes[0]?.vehicule ?? mesDemandes(listeDemandes, acces!)[0]?.vehicule ?? transfertsASigner[0]?.vehicule ?? null) : null;
  const raccourcis = useMemo(() => (acces ? raccourcisPour(acces) : []), [acces]);
  /* L'atelier n'est « à faire » que pour qui y agit : un ordre à clôturer ne concerne pas un lecteur. */
  const agitAtelier = acces !== null && !detenteur && (acces.niveaux.maintenance === "saisie" || acces.niveaux.maintenance === "gestion");
  const atelierAFaire = agitAtelier ? atelier.enAtelier + atelier.planifies : 0;

  const visibles = (ordre ?? []).filter((c) => {
    const w = WIDGETS.find((x) => x.cle === c);
    if (!w) return false;
    if (w.detenteur === "seulement" && !detenteur) return false;
    if (w.detenteur === "jamais" && detenteur) return false;
    if (w.module && !niveau(w.module)) return false;
    return true;
  });

  const perimetreLibelle = acces && acces.perimetre.sites !== "tous" ? `${acces.perimetre.sites.length} site${acces.perimetre.sites.length > 1 ? "s" : ""}` : "tout le parc";
  const prenom = nom.split(/\s+/)[0] ?? "";

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3 px-3 pb-24 pt-2">
      <header className="flex items-center gap-3 px-1 pt-1">
        <Link href="/telephone/reglages" className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-semibold text-white" aria-label="Réglages et profil">
          {initialesDe(nom || "SP")}
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[19px] font-bold tracking-[-0.01em] text-texte">Bonjour{prenom ? `, ${prenom}` : ""}</h1>
          <p className="meta truncate">
            {profil?.libelle ?? "…"} · {detenteur ? "mon véhicule" : perimetreLibelle}
          </p>
        </div>
        <Link href="/telephone/personnaliser" className="grid size-10 shrink-0 place-items-center rounded-full text-texte-2 hover:bg-surface-3" aria-label="Personnaliser l'accueil" title="Personnaliser l'accueil">
          <Settings2 className="size-5" strokeWidth={1.8} />
        </Link>
      </header>

      {ordre === null ? <p className="meta px-2">…</p> : null}
      {ordre !== null && visibles.length === 0 ? (
        <Bloc>
          <p className="meta py-1">
            Votre accueil est vide.{" "}
            <Link href="/telephone/personnaliser" className="font-semibold text-accent-fonce">
              Choisissez ce qu&apos;il montre
            </Link>
            .
          </p>
        </Bloc>
      ) : null}

      {visibles.map((cle) => {
        switch (cle) {
          case "raccourcis":
            /* Quatre par ligne : jusqu'à treize gestes pour un administrateur, trois
               pour un détenteur — la grille se remplit dans l'ordre de la journée. */
            return (
              <div key={cle} className={`grid gap-2 ${raccourcis.length <= 3 ? "grid-cols-3" : "grid-cols-4"}`}>
                {raccourcis.map((r) => (
                  <Geste key={r.cle} raccourci={r} pastille={r.cle === "valider" ? aValider : r.cle === "repondre" ? demandesOuvertes.length : r.cle === "signer" ? transfertsASigner.length : 0} />
                ))}
              </div>
            );
          case "mon-vehicule":
            return (
              <Bloc key={cle} titre="Mon véhicule">
                {monVehicule ? <Ligne icone={monVehicule.immatriculation.slice(0, 2)} titre={monVehicule.immatriculation} precision={monVehicule.libelle} href={`/telephone/vehicules/${monVehicule.id}`} /> : <p className="meta py-1">Aucun véhicule ne vous est encore rattaché dans l&apos;application.</p>}
              </Bloc>
            );
          case "parc":
            return (
              <div key={cle} className="grid grid-cols-2 gap-2">
                <Chiffre valeur={`${disponibles.length} / ${engagees.length}`} libelle="véhicules disponibles" />
                <Chiffre valeur={immobilises.length} libelle="immobilisés" alerte={immobilises.length > 0} />
              </div>
            );
          case "a-faire": {
            const vide = echeances.length === 0 && immobilises.length === 0 && sansReleve === 0 && demandesOuvertes.length === 0 && transfertsASigner.length === 0 && atelierAFaire === 0 && aValider === 0;
            return (
              <Bloc key={cle} titre="À faire aujourd'hui" accent={demandesOuvertes.length + transfertsASigner.length + aValider > 0}>
                {vide ? <p className="meta py-1">Rien d&apos;urgent sur ce périmètre.</p> : null}
                {aValider > 0 ? <Ligne icone={<Stamp className="size-4" strokeWidth={2} />} ton="vigilance" titre="Modifications à approuver" precision={`${aValider} sur des mois clos`} href="/clotures" /> : null}
                {atelierAFaire > 0 ? <Ligne icone={<Wrench className="size-4" strokeWidth={2} />} ton={atelier.enAtelier > 0 ? "vigilance" : "neutre"} titre="Atelier" precision={[atelier.enAtelier ? `${atelier.enAtelier} à clôturer` : "", atelier.planifies ? `${atelier.planifies} à faire entrer` : ""].filter(Boolean).join(" · ")} href="/telephone/atelier" /> : null}
                {demandesOuvertes.slice(0, detenteur ? 4 : 1).map((d) =>
                  detenteur ? (
                    <Ligne key={d.id} icone={<Inbox className="size-4" strokeWidth={2} />} ton={statutDemande(d, maintenant) === "en-retard" ? "defavorable" : "vigilance"} titre={TYPE_DEMANDE[d.type].libelle} precision={`${d.vehicule.immatriculation} · ${statutDemande(d, maintenant) === "en-retard" ? "en retard" : "à répondre"}`} href="/telephone/demandes" />
                  ) : (
                    <Ligne key="demandes" icone={<Inbox className="size-4" strokeWidth={2} />} ton={enRetard > 0 ? "defavorable" : "vigilance"} titre="Demandes sans réponse" precision={`${demandesOuvertes.length} en attente${enRetard ? `, dont ${enRetard} en retard` : ""}`} href="/telephone/demandes" />
                  ),
                )}
                {transfertsASigner.slice(0, 3).map((t) => (
                  <Ligne key={t.id} icone={<PenLine className="size-4" strokeWidth={2} />} ton="vigilance" titre={`Fiche de transfert · ${t.motif}`} precision={`${t.vehicule.immatriculation} · à signer`} href={`/transferts/${t.id}`} />
                ))}
                {!detenteur
                  ? echeances.slice(0, 3).map((l) => {
                      const e = l.prochaineEcheanceConformite!;
                      return <Ligne key={`e-${l.vehicule.id}`} icone="VT" ton={e.joursRestants < 0 ? "defavorable" : "vigilance"} titre={`${l.vehicule.immatriculationAffichee} · ${TYPE_DOCUMENT[e.type].toLowerCase()}`} precision={e.joursRestants < 0 ? `échue depuis ${-e.joursRestants} j` : `dans ${e.joursRestants} j`} href={`/telephone/vehicules/${l.vehicule.id}`} />;
                    })
                  : null}
                {!detenteur && sansReleve > 0 ? <Ligne icone="km" titre="Relevés de la semaine" precision={`${sansReleve} véhicule${sansReleve > 1 ? "s" : ""} sans relevé depuis 7 jours`} href="/telephone/vehicules?geste=releve" /> : null}
                {!detenteur
                  ? immobilises.slice(0, 2).map((l) => <Ligne key={`i-${l.vehicule.id}`} icone="!" ton="defavorable" titre={`${l.vehicule.immatriculationAffichee} · ${l.vehicule.marque} ${l.vehicule.appellation}`} precision={l.immobilisationAdministrative?.length ? "immobilisé administrativement" : "immobilisé"} href={`/telephone/vehicules/${l.vehicule.id}`} />)
                  : null}
              </Bloc>
            );
          }
          case "recents":
            return (
              <Bloc key={cle} titre="Véhicules récents">
                {recents.length === 0 ? <p className="meta py-1">Les fiches que vous ouvrez apparaîtront ici.</p> : null}
                {recents.map((r) => (
                  <Ligne key={r.id} icone={r.immatriculation.slice(0, 2)} titre={r.immatriculation} precision={r.libelle} href={`/telephone/vehicules/${r.id}`} />
                ))}
              </Bloc>
            );
          case "demandes":
            return (
              <Bloc key={cle} titre={detenteur ? "Mes demandes" : "Demandes"} accent={demandesOuvertes.length > 0}>
                {demandesOuvertes.length === 0 ? <p className="meta py-1">{detenteur ? "Rien à répondre." : "Tout le monde a répondu."}</p> : null}
                {demandesOuvertes.slice(0, 3).map((d) => (
                  <Ligne key={d.id} icone={<Inbox className="size-4" strokeWidth={2} />} ton={statutDemande(d, maintenant) === "en-retard" ? "defavorable" : "vigilance"} titre={detenteur ? TYPE_DEMANDE[d.type].libelle : `${d.detenteur.nom} · ${TYPE_DEMANDE[d.type].libelle}`} precision={`${d.vehicule.immatriculation} · ${statutDemande(d, maintenant) === "en-retard" ? "en retard" : "à répondre"}`} href="/telephone/demandes" />
                ))}
                <Link href="/telephone/demandes" className="mt-1.5 inline-block text-[12.5px] font-semibold text-accent-fonce">
                  Toutes les demandes
                </Link>
              </Bloc>
            );
          case "transferts":
            return (
              <Bloc key={cle} titre="Fiches de transfert" accent={transfertsASigner.length > 0}>
                {transfertsASigner.length === 0 ? <p className="meta py-1">Aucune fiche n&apos;attend de signature.</p> : null}
                {transfertsASigner.slice(0, 3).map((t) => (
                  <Ligne key={t.id} icone={<PenLine className="size-4" strokeWidth={2} />} ton="vigilance" titre={`${t.vehicule.immatriculation} · ${t.motif}`} precision="à signer" href={`/transferts/${t.id}`} />
                ))}
                <Link href="/telephone/transferts" className="mt-1.5 inline-block text-[12.5px] font-semibold text-accent-fonce">
                  Toutes les fiches
                </Link>
              </Bloc>
            );
          case "atelier":
            return (
              <Link key={cle} href="/telephone/atelier" className="grid grid-cols-3 gap-2">
                <Chiffre valeur={atelier.enAtelier} libelle="en atelier" />
                <Chiffre valeur={atelier.planifies} libelle="planifiés" />
                <Chiffre valeur={atelier.aPlanifier} libelle="à planifier" alerte={atelier.aPlanifier > 0} />
              </Link>
            );
          case "alertes":
            return (
              <Bloc key={cle} titre="Alertes" accent={echeances.some((l) => l.prochaineEcheanceConformite!.joursRestants < 0)}>
                {echeances.length === 0 ? <p className="meta py-1">Aucune échéance dans les trente jours.</p> : null}
                {echeances.slice(0, 4).map((l) => {
                  const e = l.prochaineEcheanceConformite!;
                  return <Ligne key={l.vehicule.id} icone="VT" ton={e.joursRestants < 0 ? "defavorable" : "vigilance"} titre={`${l.vehicule.immatriculationAffichee} · ${TYPE_DOCUMENT[e.type].toLowerCase()}`} precision={e.joursRestants < 0 ? `échue depuis ${-e.joursRestants} j` : `dans ${e.joursRestants} j`} href={`/telephone/vehicules/${l.vehicule.id}`} />;
                })}
                <Link href="/conformite" className="mt-1.5 inline-block text-[12.5px] font-semibold text-accent-fonce">
                  Toute la conformité
                </Link>
              </Bloc>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

function peut(acces: AccesCourant | null, module: keyof AccesCourant["niveaux"]): boolean {
  return acces !== null && acces.niveaux[module] !== "aucun";
}

const ICONE_RACCOURCI: Record<CleRaccourci, LucideIcon> = {
  scanner: ScanLine,
  releve: Gauge,
  plein: Fuel,
  panne: TriangleAlert,
  statut: RefreshCw,
  document: FileCheck,
  atelier: Wrench,
  pieces: Package,
  demander: Send,
  demandes: Inbox,
  repondre: Inbox,
  transfert: ClipboardCheck,
  signer: PenLine,
  affecter: UserPlus,
  valider: Stamp,
  chercher: Search,
};

function Geste({ raccourci, pastille }: { raccourci: Raccourci; pastille: number }) {
  const Icone = ICONE_RACCOURCI[raccourci.cle];
  return (
    <Link href={raccourci.href} className="carte flex flex-col items-center gap-1.5 px-1 py-3 text-[12px] font-semibold text-texte hover:bg-surface-2">
      <span className="relative grid size-9 place-items-center rounded-[10px] bg-accent-fond text-accent-fonce">
        <Icone className="size-4" strokeWidth={2} />
        {pastille > 0 ? <span className="badge-texte absolute -top-1.5 -right-1.5 rounded-full bg-defavorable px-1.5 py-px text-[10px] text-white">{pastille}</span> : null}
      </span>
      {raccourci.libelle}
    </Link>
  );
}

function joursEntre(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);
}
