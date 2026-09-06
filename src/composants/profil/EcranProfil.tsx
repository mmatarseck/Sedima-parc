"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Bell, KeyRound, ShieldCheck } from "lucide-react";
import { Carte, Definitions } from "@/composants/interface/Carte";
import { alertesPour, famillesActives, reglageParDefaut, type ReglageAlertes } from "@/domaine/alertes";
import { ROLES, trouverRole } from "@/domaine/roles";
import { lireParametres } from "@/lib/parametres-demo";
import { authentificationReelle, initiales, lireIdentite, lireRole } from "@/lib/session-demo";

/* ============================================================================
 * Mon profil — ce qui relève de la personne connectée, non du parc.
 *
 * Trois choses, et pas une de plus : **qui je suis** dans l'application (rôle,
 * périmètre, compte), **ce que je reçois** (renvoi au réglage des
 * notifications), et **comment je me connecte**.
 *
 * Sur ce dernier point, l'écran ne fait pas semblant. L'authentification est
 * déléguée à Supabase Auth (voir `docs/AUTHENTIFICATION.md` de SEDIMA
 * Opérations) : mot de passe et double authentification s'y règlent, pas ici.
 * Un formulaire de mot de passe local donnerait l'illusion d'un réglage qui ne
 * s'appliquerait nulle part — pire qu'une absence.
 * ==========================================================================*/

const CLE_ALERTES = "sedima.parc.alertes";

export function EcranProfil() {
  const [role, setRole] = useState(trouverRole(null));
  const [reglage, setReglage] = useState<ReglageAlertes | null>(null);
  const [reelle, setReelle] = useState(false);

  useEffect(() => {
    const brut = trouverRole(lireRole());
    /* Authentification réelle : le nom et l'adresse viennent du profil. */
    const identite = lireIdentite();
    const r = identite ? { ...brut, nom: identite.nom, initiales: initiales(identite.nom), compteTest: identite.courriel ?? "" } : brut;
    setRole(r);
    setReelle(authentificationReelle());
    try {
      const brut = localStorage.getItem(`${CLE_ALERTES}.${r.role}`);
      setReglage(brut ? (JSON.parse(brut) as ReglageAlertes) : reglageParDefaut(r.role, lireParametres().alertes));
    } catch {
      setReglage(reglageParDefaut(r.role, lireParametres().alertes));
    }
  }, []);

  const alertes = alertesPour(role.role);
  const actives = reglage ? famillesActives(reglage) : null;

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-[15px] font-semibold text-white">{role.initiales}</span>
        <div className="min-w-0">
          <h1 className="titre-page">{role.nom}</h1>
          <p className="meta mt-1 text-[13px]">
            {role.libelle} · {role.perimetre}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Carte titre="Identité dans l'application" precision="Ce que les autres voient de vous sur les transactions, les discussions et les traces">
          <Definitions
            elements={[
              { libelle: "Nom affiché", valeur: role.nom },
              { libelle: "Initiales", valeur: role.initiales },
              { libelle: "Rôle", valeur: role.libelle },
              { libelle: "Périmètre", valeur: role.perimetre },
              { libelle: "Compte", valeur: role.compteTest },
            ]}
          />
          <p className="meta mt-3">
            Le rôle et le périmètre se règlent par l&apos;administrateur, dans Utilisateurs et rôles — pas par soi-même. C&apos;est ce qui rend une trace opposable :
            personne ne change son propre périmètre après coup.
          </p>
        </Carte>

        <div className="flex min-w-0 flex-col gap-5">
          <Carte titre="Notifications" precision="Ce que vous recevez, et par quel canal">
            <div className="flex items-start gap-3">
              <Bell className="mt-0.5 size-4 shrink-0 text-attenue" strokeWidth={1.7} />
              <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-texte-2">
                {reglage === null ? (
                  "…"
                ) : reglage.silence ? (
                  <span className="font-medium text-vigilance">Toutes vos notifications sont suspendues.</span>
                ) : (
                  <>
                    <span className="font-medium text-texte">
                      {actives} sorte{(actives ?? 0) > 1 ? "s" : ""} d&apos;alerte
                    </span>{" "}
                    sur {alertes.length} vous parviennent, avec un rappel à {reglage.prevenance.map((j) => `J−${j}`).join(", ") || "aucun délai"} avant les échéances.
                  </>
                )}
              </p>
            </div>
            <Link href="/parametres/notifications" className="bouton-secondaire mt-4 h-8">
              Régler mes notifications
              <ArrowUpRight className="size-3.5" strokeWidth={2} />
            </Link>
          </Carte>

          {/* L'ancre du menu du compte : « Identifiants et mot de passe » mène ici. */}
          <div id="identifiants" className="scroll-mt-6">
            <Carte titre="Connexion et double authentification" precision="Comment vous vous authentifiez">
              <div className="flex items-start gap-3">
                <KeyRound className="mt-0.5 size-4 shrink-0 text-attenue" strokeWidth={1.7} />
                <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-texte-2">
                  {reelle ? (
                    <p>
                      L&apos;authentification est assurée par <span className="font-medium text-texte">Supabase Auth</span>. Mot de passe, appareils et double
                      authentification se règlent dans votre compte, pas dans cette application — c&apos;est ce qui permet d&apos;en changer sans toucher au parc.
                    </p>
                  ) : (
                    <p>
                      L&apos;application tourne en <span className="font-medium text-texte">mode démonstration</span> : l&apos;identité se choisit sur la page de garde, il
                      n&apos;y a ni mot de passe ni double authentification. Dès qu&apos;un projet Supabase est configuré, l&apos;authentification réelle prend le relais et
                      ce mode s&apos;efface.
                    </p>
                  )}
                </div>
              </div>
              <p className="mt-4 flex items-center gap-2 text-[12.5px]">
                <ShieldCheck className={`size-4 shrink-0 ${reelle ? "text-favorable" : "text-attenue-2"}`} strokeWidth={1.8} />
                <span className={reelle ? "font-medium text-favorable" : "text-attenue"}>
                  {reelle ? "Authentification réelle active" : "Double authentification exigée des administrateurs, au branchement"}
                </span>
              </p>
              <Link href="/connexion" className="bouton-secondaire mt-4 h-8">
                Changer d&apos;identité de démonstration
                <ArrowUpRight className="size-3.5" strokeWidth={2} />
              </Link>
            </Carte>
          </div>
        </div>
      </div>

      <Carte titre="Les rôles de l'application" precision="Ce que chacun voit et peut faire — pour savoir à qui s'adresser" sansMarge>
        <ul className="flex flex-col">
          {ROLES.map((r) => (
            <li key={r.role} className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-bordure px-5 py-2.5 last:border-b-0 ${r.role === role.role ? "bg-accent-fond/40" : ""}`}>
              <span className="w-[190px] shrink-0 text-[13px] font-medium text-texte">
                {r.libelle}
                {r.role === role.role ? <span className="meta ml-2">vous</span> : null}
              </span>
              <span className="min-w-0 flex-1 text-[12.5px] text-texte-2">{r.perimetre}</span>
              <span className="code shrink-0 text-[11.5px] text-attenue">{r.compteTest}</span>
            </li>
          ))}
        </ul>
      </Carte>
    </div>
  );
}
