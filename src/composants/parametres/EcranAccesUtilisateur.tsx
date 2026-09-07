"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BellRing, Check, ChevronLeft, KeyRound, LayoutGrid, ShieldCheck, UserRound } from "lucide-react";
import { ChampCombo } from "@/composants/interface/ChampCombo";
import { Pastille } from "@/composants/interface/Pastille";
import { MODULES, NIVEAU, NIVEAUX, PERIMETRE_ENTIER, PROFILS, ecartsDe, nomComplet, trouverProfil, type AccesUtilisateur, type Module, type Niveau, type Profil } from "@/domaine/acces";
import { ALERTES } from "@/domaine/alertes";
import { BUSINESS_UNIT } from "@/domaine/libelles";
import { REGIME_USAGE } from "@/domaine/parc-leger";
import type { BusinessUnit, RegimeUsage } from "@/domaine/types";
import { ecrireAcces, lireAcces, nouvelIdAcces } from "@/lib/acces-demo";
import { authentificationReelle, lireRole } from "@/lib/session-demo";

/* ============================================================================
 * La fiche d'accès d'une personne — cinq sections, sur le modèle du
 * formulaire de contact de Fleetio : identité, accès, profil et périmètre,
 * modules, notifications.
 *
 * Le profil pose les défauts ; ce qui s'en écarte est marqué, et n'entre en
 * vigueur qu'approuvé par l'administrateur — c'est lui seul qui enregistre.
 * Le détenteur est un profil comme un autre, lié au chauffeur ou à
 * l'attributaire qu'il est.
 * ==========================================================================*/

export interface OptionsAcces {
  sites: { valeur: string; libelle: string }[];
  chauffeurs: { valeur: string; libelle: string }[];
  attributaires: { valeur: string; libelle: string }[];
}

const SECTIONS = [
  { cle: "identite", libelle: "Identité", precision: "Qui est la personne", icone: UserRound },
  { cle: "acces", libelle: "Accès", precision: "Compte activé ou contact", icone: KeyRound },
  { cle: "profil", libelle: "Profil et périmètre", precision: "Les défauts, et les bornes", icone: ShieldCheck },
  { cle: "modules", libelle: "Modules", precision: "Module par module", icone: LayoutGrid },
  { cle: "notifications", libelle: "Notifications", precision: "Ce que la personne reçoit", icone: BellRing },
] as const;

type Section = (typeof SECTIONS)[number]["cle"];

const CHAMP = "h-9 w-full rounded-[10px] border border-bordure-champ bg-surface px-3 text-[13px] text-texte outline-none focus:border-accent disabled:bg-surface-2 disabled:text-texte-2";

function vierge(): AccesUtilisateur {
  return { id: "", prenom: "", nom: "", courriel: "", telephone: null, fonction: null, matricule: null, actif: true, profil: "agent-terrain", perimetre: { ...PERIMETRE_ENTIER }, modules: {}, sanctions: null, ecartsApprouves: false, approuvePar: null, chauffeurId: null, attributaireId: null, creeLe: new Date().toISOString(), modifieLe: null };
}

export function EcranAccesUtilisateur({ initial, options }: { initial: AccesUtilisateur | null; options: OptionsAcces }) {
  const router = useRouter();
  const creation = initial === null;
  const [a, setA] = useState<AccesUtilisateur>(initial ?? vierge());
  const [section, setSection] = useState<Section>("identite");
  const [admin, setAdmin] = useState(false);
  const [tentative, setTentative] = useState(false);
  const [issue, setIssue] = useState<{ ok: string } | { erreur: string } | null>(null);

  useEffect(() => {
    setAdmin(lireRole() === "administrateur");
    /* En démonstration, la fiche à modifier peut avoir été retouchée dans ce navigateur. */
    if (initial && !authentificationReelle()) {
      const locale = lireAcces().find((x) => x.id === initial.id);
      if (locale) setA(locale);
    }
  }, [initial]);

  const profil = trouverProfil(a.profil);
  const ecarts = useMemo(() => ecartsDe(a), [a]);
  const sanctionsEcart = a.sanctions !== null && a.sanctions !== profil.sanctions;
  const manquants = [!a.prenom.trim() && "prénom", !a.nom.trim() && "nom", !a.courriel.trim() && "courriel", a.profil === "detenteur" && !a.chauffeurId && !a.attributaireId && "chauffeur ou attributaire du détenteur"].filter((x): x is string => Boolean(x));
  const manquantsPar: Record<Section, number> = { identite: manquants.filter((m) => m !== "chauffeur ou attributaire du détenteur").length, acces: 0, profil: manquants.includes("chauffeur ou attributaire du détenteur") ? 1 : 0, modules: 0, notifications: 0 };

  function regler(champ: Partial<AccesUtilisateur>) {
    setA((x) => ({ ...x, ...champ }));
    setIssue(null);
  }
  function reglerModule(module: Module, niveau: Niveau) {
    const modules = { ...a.modules };
    if (niveau === profil.defauts[module]) delete modules[module];
    else modules[module] = niveau;
    /* Un écart nouveau retombe en attente d'approbation : l'administrateur l'approuve en enregistrant. */
    regler({ modules, ecartsApprouves: false });
  }
  function changerProfil(p: Profil) {
    /* Changer de profil remet les modules aux défauts du nouveau : les écarts de l'ancien n'ont plus de sens. */
    regler({ profil: p, modules: {}, sanctions: null, ecartsApprouves: false, chauffeurId: p === "detenteur" ? a.chauffeurId : null, attributaireId: p === "detenteur" ? a.attributaireId : null });
  }

  function enregistrer() {
    setTentative(true);
    if (manquants.length > 0) {
      setSection(manquantsPar.identite ? "identite" : "profil");
      return;
    }
    const id = a.id || nouvelIdAcces(a.courriel, lireAcces());
    const fiche: AccesUtilisateur = { ...a, id, modifieLe: creation ? null : new Date().toISOString() };
    void ecrireAcces(fiche).then((refus) => {
      if (refus) {
        setIssue({ erreur: refus });
        return;
      }
      router.push("/parametres/utilisateurs");
      router.refresh();
    });
  }

  const alertesDuProfil = ALERTES.filter((al) => !al.roles || al.roles.includes(profil.roleDefaut));
  const actions = admin ? (
    <>
      <Link href="/parametres/utilisateurs" className="bouton-discret text-accent-fonce">
        Annuler
      </Link>
      <button type="button" onClick={enregistrer} className="bouton-principal">
        <Check className="size-4" strokeWidth={2.2} />
        {creation ? "Enregistrer et inviter" : "Enregistrer"}
      </button>
    </>
  ) : null;

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[12.5px] text-attenue">
        <Link href="/parametres" className="inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce">
          <ChevronLeft className="size-3.5" strokeWidth={2} />
          Paramètres
        </Link>
        <span>/</span>
        <Link href="/parametres/utilisateurs" className="font-medium text-texte-2 hover:text-accent-fonce">
          Utilisateurs
        </Link>
      </nav>
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0">
          <h1 className="titre-page">{creation ? "Nouvel utilisateur" : nomComplet(a) || "Fiche d'accès"}</h1>
          <p className="meta mt-1 text-[13px]">
            {admin ? "Le profil pose les défauts ; ce qui s'en écarte n'entre en vigueur qu'approuvé ici, par vous" : "Lecture seule — les accès se règlent par l'administrateur"}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2.5">{actions}</div>
      </div>

      {issue && "erreur" in issue ? <p className="rounded-[10px] bg-defavorable-fond px-4 py-2.5 text-[13px] text-defavorable">{issue.erreur}</p> : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Sections" className="carte h-fit py-2 lg:sticky lg:top-0">
          <ul className="flex flex-col">
            {SECTIONS.map((s) => {
              const Icone = s.icone;
              const manque = manquantsPar[s.cle];
              const active = section === s.cle;
              return (
                <li key={s.cle}>
                  <button type="button" onClick={() => setSection(s.cle)} aria-current={active} className={`flex w-full items-center gap-3 border-l-[3px] px-4 py-2.5 text-left text-[13.5px] transition-colors ${active ? "border-l-accent bg-accent-fond font-semibold text-accent-fonce" : "border-l-transparent font-medium text-texte-2 hover:bg-surface-2 hover:text-texte"}`}>
                    <Icone className="size-[18px] shrink-0" strokeWidth={1.7} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{s.libelle}</span>
                      <span className="meta block truncate text-[11.5px]">{s.precision}</span>
                    </span>
                    {manque > 0 ? <span className={`badge-texte shrink-0 rounded-full px-1.5 py-px ${tentative ? "bg-defavorable-fond text-defavorable" : "bg-surface-3 text-attenue"}`}>{manque}</span> : null}
                    {s.cle === "modules" && (ecarts.length > 0 || sanctionsEcart) ? <span className={`badge-texte shrink-0 rounded-full px-1.5 py-px ${a.ecartsApprouves ? "bg-accent-fond text-accent-fonce" : "bg-vigilance-fond text-vigilance"}`}>{ecarts.length + (sanctionsEcart ? 1 : 0)}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-5">
          {section === "identite" ? (
            <section className="carte px-6 py-5">
              <h2 className="titre-bloc">Identité</h2>
              <p className="meta mt-0.5">Qui est la personne, et comment on la joint</p>
              <div className="mt-4 grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
                <Champ libelle="Prénom" obligatoire invalide={tentative && !a.prenom.trim()}>
                  <input type="text" value={a.prenom} disabled={!admin} onChange={(e) => regler({ prenom: e.target.value })} className={CHAMP} />
                </Champ>
                <Champ libelle="Nom" obligatoire invalide={tentative && !a.nom.trim()}>
                  <input type="text" value={a.nom} disabled={!admin} onChange={(e) => regler({ nom: e.target.value })} className={CHAMP} />
                </Champ>
                <Champ libelle="Courriel" obligatoire invalide={tentative && !a.courriel.trim()} precision="L'invitation part à cette adresse ; les notifications aussi">
                  <input type="email" value={a.courriel} disabled={!admin || !creation} onChange={(e) => regler({ courriel: e.target.value })} className={CHAMP} />
                </Champ>
                <Champ libelle="Téléphone">
                  <input type="text" value={a.telephone ?? ""} disabled={!admin} onChange={(e) => regler({ telephone: e.target.value || null })} className={`${CHAMP} code`} />
                </Champ>
                <Champ libelle="Fonction">
                  <input type="text" value={a.fonction ?? ""} disabled={!admin} onChange={(e) => regler({ fonction: e.target.value || null })} className={CHAMP} placeholder="Correspondant parc, dépôt Thiès" />
                </Champ>
                <Champ libelle="Matricule RH">
                  <input type="text" value={a.matricule ?? ""} disabled={!admin} onChange={(e) => regler({ matricule: e.target.value || null })} className={`${CHAMP} code`} />
                </Champ>
              </div>
            </section>
          ) : null}

          {section === "acces" ? (
            <section className="carte px-6 py-5">
              <h2 className="titre-bloc">Accès</h2>
              <p className="meta mt-0.5">L&apos;invitation part par courriel ; la personne choisit son mot de passe</p>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <ChoixBloc actif={a.actif} disabled={!admin} onClick={() => regler({ actif: true })} titre="Accès à SEDIMA Parc" precision="Compte activé : la personne se connecte, au bureau comme sur le téléphone, et reçoit ses notifications" />
                <ChoixBloc actif={!a.actif} disabled={!admin} onClick={() => regler({ actif: false })} titre="Sans accès" precision="Contact seulement : ni connexion, ni notification. Un compte qui part garde ses traces" />
              </div>
              <p className="meta mt-4">
                {authentificationReelle() ? "Base branchée : le compte se crée dans Supabase (Authentication › Users › Invite) avec la même adresse ; cette fiche lui donne son profil dès sa première connexion." : "En démonstration, la fiche se garde dans ce navigateur ; aucune invitation ne part."}
              </p>
            </section>
          ) : null}

          {section === "profil" ? (
            <>
              <section className="carte px-6 py-5">
                <h2 className="titre-bloc">Profil</h2>
                <p className="meta mt-0.5">Le profil pose les défauts des modules, les statuts que la personne peut poser, et ce qu&apos;elle fait sur le téléphone</p>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {PROFILS.map((p) => (
                    <ChoixBloc key={p.profil} actif={a.profil === p.profil} disabled={!admin} onClick={() => changerProfil(p.profil)} titre={p.libelle} precision={p.precision} />
                  ))}
                </div>
                <p className="mt-4 text-[13px] text-texte-2">
                  <span className="font-medium text-texte">Sur le téléphone :</span> {profil.mobile}.{" "}
                  <span className="font-medium text-texte">Statuts qu&apos;il peut poser :</span> {profil.statuts === "tous" ? "tous" : profil.statuts.length ? profil.statuts.join(", ") : "aucun"}.
                </p>
                {a.profil === "detenteur" ? (
                  <div className="mt-4 grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
                    <Champ libelle="Chauffeur qu'il est" invalide={tentative && !a.chauffeurId && !a.attributaireId} precision="Un chauffeur titulaire : ses demandes et ses transferts sont ceux de ses véhicules">
                      <ChampCombo valeur={a.chauffeurId ?? ""} onChange={(v) => regler({ chauffeurId: v || null, attributaireId: v ? null : a.attributaireId })} options={options.chauffeurs} disabled={!admin} placeholder="Choisir un chauffeur" />
                    </Champ>
                    <Champ libelle="ou attributaire qu'il est" invalide={tentative && !a.chauffeurId && !a.attributaireId} precision="Un attributaire de véhicule de service ou de fonction">
                      <ChampCombo valeur={a.attributaireId ?? ""} onChange={(v) => regler({ attributaireId: v || null, chauffeurId: v ? null : a.chauffeurId })} options={options.attributaires} disabled={!admin} placeholder="Choisir un attributaire" />
                    </Champ>
                  </div>
                ) : null}
              </section>
              {a.profil !== "detenteur" ? (
                <section className="carte px-6 py-5">
                  <h2 className="titre-bloc">Périmètre</h2>
                  <p className="meta mt-0.5">Ce que la personne voit : tout, ou une partie du parc. Un agent terrain voit son site, et s&apos;élargit au cas par cas</p>
                  <Pilules libelle="Sites" tout="Tous les sites" valeurs={a.perimetre.sites} options={options.sites} disabled={!admin} onChange={(v) => regler({ perimetre: { ...a.perimetre, sites: v as string[] | "tous" } })} />
                  <Pilules libelle="Business units" tout="Toutes les BU" cleTout="toutes" valeurs={a.perimetre.businessUnits} options={Object.entries(BUSINESS_UNIT).map(([valeur, libelle]) => ({ valeur, libelle }))} disabled={!admin} onChange={(v) => regler({ perimetre: { ...a.perimetre, businessUnits: v as BusinessUnit[] | "toutes" } })} />
                  <Pilules libelle="Régimes d'usage" tout="Tous les régimes" valeurs={a.perimetre.regimes} options={Object.entries(REGIME_USAGE).map(([valeur, d]) => ({ valeur, libelle: d.libelle }))} disabled={!admin} onChange={(v) => regler({ perimetre: { ...a.perimetre, regimes: v as RegimeUsage[] | "tous" } })} />
                </section>
              ) : null}
            </>
          ) : null}

          {section === "modules" ? (
            <section className="carte px-6 py-5">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="titre-bloc">Modules</h2>
                  <p className="meta mt-0.5">Les défauts du profil {profil.libelle}, ajustables ici — un écart est marqué, et n&apos;entre en vigueur qu&apos;approuvé par l&apos;administrateur</p>
                </div>
                {ecarts.length > 0 || sanctionsEcart ? (
                  a.ecartsApprouves ? (
                    <Pastille ton="favorable">Écarts approuvés</Pastille>
                  ) : admin ? (
                    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-texte">
                      <input type="checkbox" checked={a.ecartsApprouves} onChange={(e) => regler({ ecartsApprouves: e.target.checked })} className="size-4 accent-[var(--color-accent)]" />
                      J&apos;approuve ces écarts
                    </label>
                  ) : (
                    <Pastille ton="vigilance">Écarts en attente d&apos;approbation</Pastille>
                  )
                ) : (
                  <Pastille ton="neutre">Suit son profil</Pastille>
                )}
              </div>
              <div className="mt-4 flex flex-col divide-y divide-bordure">
                {MODULES.map((m) => {
                  const defaut = profil.defauts[m.module];
                  const courant = a.modules[m.module] ?? defaut;
                  const ecart = courant !== defaut;
                  return (
                    <div key={m.module} className="flex flex-wrap items-center gap-3 py-2.5">
                      <div className="min-w-[240px] flex-1">
                        <span className="block text-[13px] font-medium text-texte">
                          {m.libelle}
                          {ecart ? <span className="meta ml-2 text-[11px]">≠ profil ({NIVEAU[defaut].libelle})</span> : null}
                        </span>
                        <span className="meta block">{m.precision}</span>
                      </div>
                      <div className="inline-flex overflow-hidden rounded-full border border-bordure-champ" role="radiogroup" aria-label={m.libelle}>
                        {NIVEAUX.map((n) => (
                          <button key={n} type="button" role="radio" aria-checked={courant === n} disabled={!admin} onClick={() => reglerModule(m.module, n)} title={NIVEAU[n].precision} className={`h-8 min-w-[64px] border-l border-bordure-champ px-3 text-[12px] font-semibold first:border-l-0 disabled:cursor-default ${courant === n ? "bg-accent text-white" : "text-attenue hover:bg-surface-2"}`}>
                            {NIVEAU[n].libelle}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <div className="flex flex-wrap items-center gap-3 py-2.5">
                  <div className="min-w-[240px] flex-1">
                    <span className="block text-[13px] font-medium text-texte">
                      Voit les sanctions des chauffeurs
                      {sanctionsEcart ? <span className="meta ml-2 text-[11px]">≠ profil ({profil.sanctions ? "oui" : "non"})</span> : null}
                    </span>
                    <span className="meta block">Les sanctions relèvent de la relation d&apos;emploi ; la fiche les tait à qui ne les voit pas</span>
                  </div>
                  <div className="inline-flex overflow-hidden rounded-full border border-bordure-champ" role="radiogroup" aria-label="Sanctions">
                    {[false, true].map((v) => {
                      const courant = a.sanctions ?? profil.sanctions;
                      return (
                        <button key={String(v)} type="button" role="radio" aria-checked={courant === v} disabled={!admin} onClick={() => regler({ sanctions: v === profil.sanctions ? null : v, ecartsApprouves: false })} className={`h-8 min-w-[64px] border-l border-bordure-champ px-3 text-[12px] font-semibold first:border-l-0 disabled:cursor-default ${courant === v ? "bg-accent text-white" : "text-attenue hover:bg-surface-2"}`}>
                          {v ? "Oui" : "Non"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {section === "notifications" ? (
            <section className="carte px-6 py-5">
              <h2 className="titre-bloc">Notifications</h2>
              <p className="meta mt-0.5">Les règles d&apos;alerte de l&apos;organisation s&apos;appliquent au profil ; la personne peut s&apos;en écarter dans « Mes notifications ». Canal : l&apos;application et le courriel, pas de SMS</p>
              <ul className="mt-4 flex flex-col divide-y divide-bordure">
                {alertesDuProfil.map((al) => (
                  <li key={al.cle} className="flex items-center gap-3 py-2.5 text-[13px]">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-texte">{al.libelle}</span>
                      <span className="meta block">{al.declencheur}</span>
                    </span>
                    <Pastille ton="neutre">application · courriel</Pastille>
                  </li>
                ))}
              </ul>
              <p className="meta mt-3">
                Les destinataires par famille se règlent dans{" "}
                <Link href="/parametres/alertes" className="font-medium text-accent-fonce hover:text-accent">
                  Règles d&apos;alerte
                </Link>
                .
              </p>
            </section>
          ) : null}

          <div className="flex flex-wrap items-center gap-2.5 border-t border-bordure pt-4">
            <p className="meta min-w-0 flex-1">{tentative && manquants.length ? <span className="font-medium text-defavorable">À renseigner : {manquants.join(", ")}.</span> : admin ? "L'enregistrement écrit le profil, le périmètre et les écarts approuvés." : ""}</p>
            {actions}
          </div>
        </div>
      </div>
    </div>
  );
}

function Champ({ libelle, obligatoire, invalide, precision, children }: { libelle: string; obligatoire?: boolean; invalide?: boolean; precision?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label-champ">
        {libelle}
        {obligatoire ? <span className="text-defavorable"> ●</span> : null}
      </span>
      <span className={invalide ? "[&_input]:border-defavorable" : ""}>{children}</span>
      {precision ? <span className="meta">{precision}</span> : null}
    </label>
  );
}

function ChoixBloc({ actif, disabled, onClick, titre, precision }: { actif: boolean; disabled: boolean; onClick: () => void; titre: string; precision: string }) {
  return (
    <button type="button" role="radio" aria-checked={actif} disabled={disabled} onClick={onClick} className={`rounded-[12px] border px-4 py-3 text-left transition-colors disabled:cursor-default ${actif ? "border-accent bg-accent-fond" : "border-bordure-champ bg-surface hover:border-attenue-2"}`}>
      <span className={`block text-[13.5px] font-semibold ${actif ? "text-accent-fonce" : "text-texte"}`}>{titre}</span>
      <span className="meta mt-0.5 block leading-snug">{precision}</span>
    </button>
  );
}

function Pilules({ libelle, tout, cleTout = "tous", valeurs, options, disabled, onChange }: { libelle: string; tout: string; cleTout?: "tous" | "toutes"; valeurs: string[] | "tous" | "toutes"; options: { valeur: string; libelle: string }[]; disabled: boolean; onChange: (v: string[] | "tous" | "toutes") => void }) {
  const toutes = typeof valeurs === "string";
  const liste = toutes ? [] : valeurs;
  function basculer(v: string) {
    const suite = liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v];
    onChange(suite.length === 0 ? cleTout : suite);
  }
  return (
    <div className="mt-4">
      <span className="label-champ block">{libelle}</span>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <button type="button" disabled={disabled} onClick={() => onChange(cleTout)} aria-pressed={toutes} className={`h-8 rounded-full px-3 text-[12.5px] font-medium disabled:cursor-default ${toutes ? "bg-accent text-white" : "bg-surface-3 text-texte-2 hover:bg-surface-2"}`}>
          {tout}
        </button>
        {options.map((o) => (
          <button key={o.valeur} type="button" disabled={disabled} onClick={() => basculer(o.valeur)} aria-pressed={liste.includes(o.valeur)} className={`h-8 rounded-full px-3 text-[12.5px] disabled:cursor-default ${liste.includes(o.valeur) ? "bg-accent-fond font-semibold text-accent-fonce" : "bg-surface-3 text-texte-2 hover:bg-surface-2"}`}>
            {o.libelle}
          </button>
        ))}
      </div>
    </div>
  );
}
