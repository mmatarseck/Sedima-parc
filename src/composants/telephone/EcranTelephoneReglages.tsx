"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, ChevronRight, Download, KeyRound, LogOut, QrCode, ScanLine, Settings2, ShieldCheck, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { resumerPerimetre, trouverProfil, type AccesCourant } from "@/domaine/acces";
import { trouverRole } from "@/domaine/roles";
import { lireAccesCourant } from "@/lib/acces-courant";
import { authentificationReelle, fermerSession, initiales as initialesDe, lireIdentite, lireRole } from "@/lib/session-demo";
import { clientNavigateur } from "@/lib/supabase";
import { EnTeteTelephone } from "./Telephone";

/* ============================================================================
 * Téléphone › Réglages — sur le modèle de l'écran « Settings » de Fleetio Go :
 * la personne en tête (initiales, nom, profil, périmètre), puis des sections
 * courtes — Utilisateur, Application, Aide — et la déconnexion en bas, en
 * rouge, avec la version.
 * ==========================================================================*/

interface Entree {
  href: string;
  libelle: string;
  precision?: string;
  icone: LucideIcon;
}

export function EcranTelephoneReglages({ version }: { version: string }) {
  const router = useRouter();
  const [nom, setNom] = useState("");
  const [courriel, setCourriel] = useState("");
  const [acces, setAcces] = useState<AccesCourant | null>(null);
  const [reel, setReel] = useState(false);
  useEffect(() => {
    const r = trouverRole(lireRole());
    const identite = lireIdentite();
    setNom(identite?.nom ?? r.nom);
    setCourriel(identite?.courriel ?? r.compteTest);
    setAcces(lireAccesCourant());
    setReel(authentificationReelle());
  }, []);

  async function seDeconnecter() {
    if (authentificationReelle()) await clientNavigateur().auth.signOut();
    fermerSession();
    router.push("/connexion");
    router.refresh();
  }

  const profil = acces ? trouverProfil(acces.profil) : null;
  const detenteur = acces?.profil === "detenteur";
  const sections: { titre: string; entrees: Entree[] }[] = [
    {
      titre: "Utilisateur",
      entrees: [
        { href: "/profil", libelle: "Mon profil", precision: "Identité, rôle, périmètre", icone: UserRound },
        { href: "/parametres/notifications", libelle: "Notifications", precision: "Ce que vous recevez, par quel canal", icone: Bell },
        { href: "/profil#identifiants", libelle: "Connexion et mot de passe", precision: reel ? "Supabase Auth" : "Mode démonstration", icone: KeyRound },
        { href: "/telephone/personnaliser", libelle: "Personnaliser l'accueil", precision: "Les widgets et leur ordre", icone: Settings2 },
      ],
    },
    {
      titre: "Application",
      entrees: [
        { href: "/telephone/scanner", libelle: "Scanner un véhicule", precision: "Le QR code collé sur le véhicule", icone: ScanLine },
        ...(!detenteur && acces && acces.niveaux.flotte !== "aucun" ? [{ href: "/flotte/etiquettes", libelle: "Étiquettes QR", precision: "À imprimer et coller", icone: QrCode }] : []),
        { href: "/telephone/installer", libelle: "Installer sur le téléphone", precision: "Ajouter SEDIMA Parc à l'écran d'accueil", icone: Download },
      ],
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4 px-3 pb-24 pt-1">
      <EnTeteTelephone titre="Réglages" retour="/telephone" />
      <div className="flex flex-col items-center gap-2 py-3 text-center">
        <span className="grid size-20 place-items-center rounded-full bg-accent text-[24px] font-bold text-white">{initialesDe(nom || "SP")}</span>
        <span className="text-[20px] font-bold tracking-[-0.01em] text-texte">{nom || "…"}</span>
        <span className="meta">
          {profil?.libelle ?? "…"}
          {acces && !detenteur ? ` · ${resumerPerimetre(acces.perimetre)}` : ""}
        </span>
        <span className="meta">{courriel}</span>
      </div>

      {sections.map((s) => (
        <section key={s.titre}>
          <h2 className="micro-sur-titre mb-1.5 px-1 text-accent-fonce">{s.titre}</h2>
          <div className="carte divide-y divide-bordure">
            {s.entrees.map((e) => {
              const Icone = e.icone;
              return (
                <Link key={e.href} href={e.href} className="flex items-center gap-3 px-3 py-3 hover:bg-surface-2">
                  <Icone className="size-5 shrink-0 text-texte-2" strokeWidth={1.7} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium text-texte">{e.libelle}</span>
                    {e.precision ? <span className="meta block truncate">{e.precision}</span> : null}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-attenue" strokeWidth={1.8} />
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      <section>
        <h2 className="micro-sur-titre mb-1.5 px-1 text-accent-fonce">Sécurité</h2>
        <div className="carte flex items-start gap-3 px-3 py-3">
          <ShieldCheck className={`mt-0.5 size-5 shrink-0 ${reel ? "text-favorable" : "text-attenue"}`} strokeWidth={1.7} />
          <p className="text-[13px] leading-[1.5] text-texte-2">{reel ? "Session authentifiée. Les droits sont ceux de votre fiche d'accès ; les politiques de la base décident." : "Mode démonstration : l'identité se choisit sur la page de garde, sans mot de passe."}</p>
        </div>
      </section>

      <button type="button" onClick={() => void seDeconnecter()} className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[14px] border border-defavorable-bordure bg-surface text-[15px] font-semibold text-defavorable hover:bg-defavorable-fond">
        <LogOut className="size-4" strokeWidth={2} />
        Se déconnecter
      </button>
      <p className="meta text-center">
        SEDIMA Parc · version {version}
      </p>
    </div>
  );
}
