"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, ChevronDown, KeyRound, LogOut, UserRound } from "lucide-react";
import { trouverRole, type DefinitionRole } from "@/domaine/roles";
import { authentificationReelle, fermerSession, initiales, lireIdentite, lireRole } from "@/lib/session-demo";
import { clientNavigateur } from "@/lib/supabase";

interface Entree {
  libelle: string;
  precision: string;
  icone: typeof UserRound;
  href: string;
}

/*
 * Les trois entrées mènent quelque part depuis le 4 septembre 2026. Le profil
 * et les identifiants partagent l'écran « Mon profil » : dans une application
 * dont l'authentification est déléguée à Supabase, le mot de passe et la double
 * authentification ne se règlent pas ici — l'écran le dit et renvoie où il faut,
 * ce qui vaut mieux qu'un formulaire qui ferait semblant.
 */
const ENTREES: Entree[] = [
  { libelle: "Mon profil", precision: "Identité, rôle, site de rattachement", icone: UserRound, href: "/profil" },
  { libelle: "Notifications", precision: "Alertes reçues et canaux", icone: Bell, href: "/parametres/notifications" },
  { libelle: "Identifiants et mot de passe", precision: "Connexion et double authentification", icone: KeyRound, href: "/profil#identifiants" },
];

/**
 * Menu du compte, en haut à droite de chaque écran.
 *
 * Il rassemble ce qui relève de la personne connectée et non du parc : profil,
 * notifications, identifiants, déconnexion. Le rail de navigation, lui, ne
 * porte plus que les modules.
 */
export function MenuUtilisateur() {
  const router = useRouter();
  const [profil, setProfil] = useState<DefinitionRole | null>(null);
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    const r = trouverRole(lireRole());
    /* Authentification réelle : le nom et l'adresse sont ceux du profil, posés
       par AmorceSession ; le libellé du rôle reste celui du référentiel. */
    const identite = lireIdentite();
    setProfil(identite ? { ...r, nom: identite.nom, initiales: initiales(identite.nom), compteTest: identite.courriel ?? "" } : r);
  }, []);

  useEffect(() => {
    function surEchap(e: KeyboardEvent) {
      if (e.key === "Escape") setOuvert(false);
    }
    document.addEventListener("keydown", surEchap);
    return () => document.removeEventListener("keydown", surEchap);
  }, []);

  async function seDeconnecter() {
    /* Réelle : Supabase efface ses cookies, puis le proxy garde la porte. */
    if (authentificationReelle()) await clientNavigateur().auth.signOut();
    fermerSession();
    router.push("/connexion");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-haspopup="menu"
        className="flex h-10 items-center gap-2.5 rounded-full pr-2 pl-1 hover:bg-surface-3"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-[11.5px] font-semibold text-white">
          {profil?.initiales ?? "··"}
        </span>
        <span className="hidden min-w-0 text-left leading-tight sm:block">
          <span className="block max-w-[160px] truncate text-[13px] font-medium text-texte">
            {profil?.nom ?? "Session"}
          </span>
          <span className="meta block max-w-[160px] truncate text-[11px]">{profil?.libelle ?? "—"}</span>
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-attenue" strokeWidth={1.8} />
        <span className="sr-only">Ouvrir le menu du compte</span>
      </button>

      {ouvert ? (
        <>
          <button
            type="button"
            aria-label="Fermer le menu du compte"
            onClick={() => setOuvert(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div
            role="menu"
            className="absolute top-full right-0 z-40 mt-2 w-[280px] rounded-[14px] border border-bordure bg-surface p-2 shadow-flottante"
          >
            <div className="flex items-center gap-3 rounded-[10px] bg-surface-2 px-3 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-[12px] font-semibold text-white">
                {profil?.initiales ?? "··"}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-texte">{profil?.nom ?? "Session"}</span>
                <span className="meta block truncate">{profil?.libelle ?? "—"}</span>
                <span className="code mt-0.5 block truncate text-[11px] text-attenue">{profil?.compteTest ?? "—"}</span>
              </span>
            </div>

            <ul className="mt-1.5 flex flex-col">
              {ENTREES.map((entree) => {
                const Icone = entree.icone;
                return (
                  <li key={entree.libelle}>
                    <Link
                      href={entree.href}
                      role="menuitem"
                      onClick={() => setOuvert(false)}
                      className="flex w-full items-start gap-3 rounded-[10px] px-3 py-2 text-left hover:bg-surface-3"
                    >
                      <Icone className="mt-0.5 size-4 shrink-0 text-texte-2" strokeWidth={1.6} />
                      <span className="min-w-0">
                        <span className="block text-[13px] text-texte">{entree.libelle}</span>
                        <span className="meta block">{entree.precision}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="mt-1.5 border-t border-bordure pt-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => void seDeconnecter()}
                className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left text-[13px] text-texte-2 hover:bg-defavorable-fond hover:text-defavorable"
              >
                <LogOut className="size-4 shrink-0" strokeWidth={1.6} />
                Se déconnecter
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
