"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { ROLES } from "@/domaine/roles";
import { authentificationReelle, fermerSession, ouvrirSession } from "@/lib/session-demo";
import { clientNavigateur } from "@/lib/supabase";
import { NOM_APPLICATION, SOUS_TITRE_APPLICATION } from "@/domaine/marque";

/** Ce que la page de garde dit quand on y revient sans l'avoir choisi. */
const MOTIFS: Record<string, string> = {
  "sans-profil":
    "Ce compte existe mais n'a pas encore de rôle dans SEDIMA Parc. Demandez à un administrateur de poser votre profil, puis reconnectez-vous.",
};

/**
 * Page de garde.
 *
 * **Refondue le 10 septembre 2026 : la photo de la citerne vrac est retirée**
 * (demande du métier). L'écran passe de deux panneaux — le camion en pleine
 * hauteur à gauche, la carte à droite — à **une seule colonne centrée**, la
 * même sur un téléphone et sur un bureau.
 *
 * Pourquoi la colonne centrée plutôt qu'un demi-écran laissé vide. Une fois la
 * photo partie, la grille en deux colonnes n'avait plus de raison d'être : sa
 * moitié gauche ne portait que la marque et une accroche, que la carte peut
 * porter elle-même. Un seul agencement pour les deux tailles d'écran, c'est
 * aussi une seule chose à vérifier quand on y touche.
 *
 * Ce qui reste du langage de l'application : le fond froid très clair, la
 * carte blanche à rayon généreux, une seule touche de vert sur l'action
 * principale. La marque monte au-dessus de la carte, sur le fond, plutôt que
 * sur un voile sombre.
 *
 * Tant qu'aucun projet Supabase n'est configuré, le formulaire ne vaut pas
 * authentification et l'entrée se fait par les comptes de démonstration. Cet
 * encart disparaît de lui-même dès que la configuration est présente.
 */
export function FormulaireConnexion() {
  const router = useRouter();
  const parametres = useSearchParams();
  const reelle = authentificationReelle();
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [information, setInformation] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  /* Renvoyé ici avec un motif : le dire, et refermer la session qui n'a pas
     de profil — sinon le proxy renverrait aussitôt vers la flotte. */
  const motif = parametres.get("motif");
  useEffect(() => {
    if (!motif) return;
    setErreur(MOTIFS[motif] ?? null);
    if (reelle) void clientNavigateur().auth.signOut();
    fermerSession();
  }, [motif, reelle]);

  async function soumettre(evenement: React.FormEvent) {
    evenement.preventDefault();
    if (!reelle) {
      setErreur("L'authentification n'est pas branchée sur ce poste. Choisissez un compte de démonstration ci-dessous.");
      return;
    }
    setErreur(null);
    setInformation(null);
    setEnCours(true);
    const { error } = await clientNavigateur().auth.signInWithPassword({ email: identifiant.trim(), password: motDePasse });
    setEnCours(false);
    if (error) {
      setErreur(
        error.message === "Invalid login credentials"
          ? "Identifiant ou mot de passe incorrect."
          : error.message === "Email not confirmed"
            ? "Cette adresse n'a pas encore été confirmée : ouvrez le courriel d'invitation."
            : `Connexion refusée : ${error.message}`,
      );
      return;
    }
    /* La session est dans les cookies : le serveur la lira au prochain rendu.
       Une page demandée avant la connexion — un QR code scanné — reprend. */
    const suite = parametres.get("suite");
    router.push(suite && suite.startsWith("/") && !suite.startsWith("//") ? suite : "/flotte");
    router.refresh();
  }

  async function motDePasseOublie() {
    const adresse = identifiant.trim();
    if (!adresse) {
      setErreur("Saisissez d'abord votre identifiant : le lien de réinitialisation part à cette adresse.");
      return;
    }
    setErreur(null);
    const { error } = await clientNavigateur().auth.resetPasswordForEmail(adresse, { redirectTo: `${window.location.origin}/connexion` });
    if (error) setErreur(`Réinitialisation refusée : ${error.message}`);
    else setInformation(`Un lien de réinitialisation a été envoyé à ${adresse}, s'il correspond à un compte.`);
  }

  function entrer(role: (typeof ROLES)[number]) {
    ouvrirSession(role.role);
    const suite = parametres.get("suite");
    router.push(suite && suite.startsWith("/") && !suite.startsWith("//") ? suite : "/flotte");
  }

  const champ =
    "h-11 w-full rounded-[10px] border border-bordure-champ bg-surface px-3.5 text-[13.5px] text-texte outline-none transition-colors placeholder:text-attenue focus:border-accent focus:ring-4 focus:ring-accent/15";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-fond px-5 py-10">
      {/* Le halo vert, seule ornementation qui reste. Il est derrière tout,
          sans interaction, et se contente de réchauffer un fond très froid. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 size-[720px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgba(120,178,37,0.16), rgba(120,178,37,0))" }}
      />

      {/* La marque, au-dessus de la carte et sur le fond clair : le picto n'a
          plus de voile sombre à porter, il est posé sur sa propre pastille. */}
      <div className="relative mb-6 flex flex-col items-center gap-3">
        <span className="grid size-14 place-items-center rounded-[16px] bg-surface shadow-flottante ring-1 ring-bordure">
          <Image src="/sedima-picto.png" alt="" width={34} height={34} priority className="size-[34px] object-contain" />
        </span>
        <span className="text-center leading-tight">
          <span className="block text-[17px] font-semibold tracking-[-0.01em] text-texte">{NOM_APPLICATION}</span>
          <span className="meta mt-0.5 block text-[12.5px]">{SOUS_TITRE_APPLICATION}</span>
        </span>
      </div>

      <form
        onSubmit={soumettre}
        className="relative w-full max-w-[420px] rounded-[20px] border border-bordure bg-surface px-6 py-7 shadow-flottante sm:px-8 sm:py-8"
      >
        <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.02em] text-texte">Connexion</h1>
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
                    onClick={() => void motDePasseOublie()}
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
          {information ? (
            <div className="mt-4 flex items-start gap-2.5 rounded-[10px] bg-accent-fond px-3.5 py-3">
              <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent" />
              <span className="text-[12.5px] leading-[1.5] text-accent-tres-fonce">{information}</span>
            </div>
          ) : null}

          <button type="submit" disabled={enCours} className="bouton-principal mt-6 h-11 w-full justify-center text-[14px] disabled:opacity-60">
            {enCours ? "Connexion…" : "Se connecter"}
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

      {/* Le pied : la maison et ses métiers. Sur un téléphone il passe à la
          ligne plutôt que de rétrécir, d'où le retrait du tiret sous 380 px. */}
      <p className="relative mt-6 max-w-[420px] text-center text-[12px] leading-[1.6] text-attenue">
        SEDIMA SA · Agro-industrie · Sénégal
        <span className="mx-2 hidden text-attenue-2 sm:inline">—</span>
        <span className="block sm:inline">Aviculture · Minoterie · Abattoirs</span>
      </p>
    </div>
  );
}
