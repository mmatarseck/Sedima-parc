"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { ROLES } from "@/domaine/roles";
import { authentificationReelle, ouvrirSession } from "@/lib/session-demo";
import { NOM_APPLICATION, SOUS_TITRE_APPLICATION } from "@/domaine/marque";

/**
 * Page de garde.
 *
 * Même langage que le reste de l'application : fond froid très clair, une
 * carte blanche centrée à rayon généreux, contrôles arrondis, une seule
 * touche de vert sur l'action principale. Deux halos teintés, très doux,
 * donnent de la profondeur au fond sans le charger — c'est le parti pris des
 * références pour les écrans de formulaire.
 *
 * Tant qu'aucun projet Supabase n'est configuré, le formulaire ne vaut pas
 * authentification et l'entrée se fait par les comptes de démonstration. Cet
 * encart disparaît de lui-même dès que la configuration est présente.
 */
export function FormulaireConnexion() {
  const router = useRouter();
  const reelle = authentificationReelle();
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function soumettre(evenement: React.FormEvent) {
    evenement.preventDefault();
    setErreur("L'authentification n'est pas encore branchée. Choisissez un compte de démonstration ci-dessous.");
  }

  function entrer(role: (typeof ROLES)[number]) {
    ouvrirSession(role.role);
    router.push("/flotte");
  }

  const champ =
    "h-11 w-full rounded-[10px] border border-bordure-champ bg-surface px-3.5 text-[13.5px] text-texte outline-none transition-colors placeholder:text-attenue focus:border-accent focus:ring-4 focus:ring-accent/15";

  return (
    <div className="relative min-h-screen overflow-hidden bg-fond">
      {/* Halos de fond — décoratifs, hors du flux, jamais au-dessus du contenu. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-32 size-[560px] rounded-full opacity-70 blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgba(120,178,37,0.22), rgba(120,178,37,0))" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -bottom-48 size-[640px] rounded-full opacity-70 blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgba(34,39,43,0.10), rgba(34,39,43,0))" }}
      />

      <div className="relative flex min-h-screen flex-col items-center justify-center px-5 py-10">
        {/* Marque */}
        <div className="mb-7 flex items-center gap-3">
          <Image src="/sedima-picto.png" alt="" width={44} height={44} priority className="size-11 object-contain" />
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold tracking-[-0.01em] text-texte">{NOM_APPLICATION}</span>
            <span className="meta block">{SOUS_TITRE_APPLICATION}</span>
          </span>
        </div>

        {/* Carte de connexion */}
        <form
          onSubmit={soumettre}
          className="w-full max-w-[440px] rounded-[20px] border border-bordure bg-surface px-8 py-8 shadow-flottante sm:px-9"
        >
          <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.02em] text-texte">Connexion</h1>
          <p className="mt-1.5 text-[13px] leading-[1.5] text-texte-2">
            Réservé à l'équipe de gestion de parc. Les chauffeurs n'y ont pas accès.
          </p>

          <div className="mt-7 flex flex-col gap-4">
            <label className="block">
              <span className="label-champ mb-1.5 block">Identifiant</span>
              <input
                type="email"
                value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
                placeholder="prenom.nom@sedima.com"
                autoComplete="username"
                className={champ}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-baseline">
                <span className="label-champ">Mot de passe</span>
                {reelle ? (
                  <button
                    type="button"
                    className="ml-auto text-[12px] font-medium text-accent-fonce hover:text-accent"
                    onClick={() => setErreur("La réinitialisation du mot de passe sera branchée avec Supabase.")}
                  >
                    Mot de passe oublié&nbsp;?
                  </button>
                ) : null}
              </span>
              <span className="relative block">
                <input
                  type={motDePasseVisible ? "text" : "password"}
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={`${champ} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setMotDePasseVisible((v) => !v)}
                  title={motDePasseVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-full text-attenue hover:bg-surface-3 hover:text-texte-2"
                >
                  {motDePasseVisible ? <Eye className="size-4" strokeWidth={1.8} /> : <EyeOff className="size-4" strokeWidth={1.8} />}
                  <span className="sr-only">{motDePasseVisible ? "Masquer" : "Afficher"} le mot de passe</span>
                </button>
              </span>
            </label>
          </div>

          {erreur ? (
            <div className="mt-4 flex items-start gap-2.5 rounded-[10px] bg-defavorable-fond px-3.5 py-3">
              <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-defavorable" />
              <span className="text-[12.5px] leading-[1.5] text-defavorable">{erreur}</span>
            </div>
          ) : null}

          <button type="submit" className="bouton-principal mt-6 h-11 w-full justify-center text-[14px]">
            Se connecter
            <ArrowRight className="size-4" strokeWidth={2.2} />
          </button>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-[11.5px] text-attenue">
            <LockKeyhole className="size-3.5" strokeWidth={1.8} />
            Double authentification obligatoire pour les administrateurs
          </p>

          {!reelle ? (
            <div className="mt-7 border-t border-bordure pt-6">
              <div className="mb-3 flex items-baseline">
                <span className="micro-sur-titre">Mode démonstration</span>
                <span className="meta ml-auto text-[11.5px]">sans mot de passe</span>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ROLES.map((role) => (
                  <button
                    key={role.role}
                    type="button"
                    onClick={() => entrer(role)}
                    className="flex items-center gap-2.5 rounded-[12px] border border-bordure bg-surface-2 px-3 py-2.5 text-left transition-colors hover:border-accent-bordure hover:bg-accent-fond"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-[11px] font-semibold text-accent-tres-fonce ring-1 ring-bordure">
                      {role.initiales}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-medium text-texte">{role.libelle}</span>
                      <span className="meta block truncate text-[11px]">{role.compteTest}</span>
                    </span>
                  </button>
                ))}
              </div>

              <p className="meta mt-3 text-[11.5px] leading-[1.5]">
                En production, le rôle ne se choisit pas ici : il est résolu côté serveur, comme dans SEDIMA Opérations.
              </p>
            </div>
          ) : null}
        </form>

        <p className="mt-7 text-center text-[12px] text-attenue">
          SEDIMA SA · Agro-industrie · Sénégal
          <span className="mx-2 text-attenue-2">—</span>
          Aviculture · Minoterie · Abattoirs
        </p>
      </div>
    </div>
  );
}
