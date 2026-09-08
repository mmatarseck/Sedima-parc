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
 * Retravaillée le 8 septembre 2026 sur la photo de la citerne vrac SEDIMA :
 * à gauche, le camion en pleine hauteur, la marque et une légende posées sur
 * un voile sombre ; à droite, la carte de connexion, dans le même langage
 * que le reste de l'application — fond froid très clair, carte blanche à
 * rayon généreux, une seule touche de vert sur l'action principale. Sur un
 * téléphone, la photo devient un bandeau au-dessus de la carte.
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
    <div className="relative min-h-screen overflow-hidden bg-fond lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(460px,5fr)]">
      {/* La photo : la citerne vrac SEDIMA, pleine hauteur à gauche, bandeau
          sur un téléphone. Le voile sombre monte du bas pour porter la marque
          et la légende sans éteindre le jaune du camion. */}
      <section className="relative h-[240px] overflow-hidden bg-encre sm:h-[300px] lg:h-auto lg:min-h-screen">
        <Image src="/sedima-vrac.jpg" alt="Citerne vrac SEDIMA attelée, prête à livrer" fill priority sizes="(min-width: 1024px) 58vw, 100vw" className="object-cover object-[62%_45%]" />
        <div aria-hidden="true" className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(34,39,43,0.28) 0%, rgba(34,39,43,0) 32%, rgba(34,39,43,0) 55%, rgba(34,39,43,0.82) 100%)" }} />
        <div className="absolute inset-x-0 top-0 flex items-center gap-3 px-6 pt-5 lg:px-10 lg:pt-8">
          <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-surface/95 shadow-flottante">
            <Image src="/sedima-picto.png" alt="" width={30} height={30} priority className="size-[30px] object-contain" />
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold tracking-[-0.01em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">{NOM_APPLICATION}</span>
            <span className="block text-[12px] text-white/85 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">{SOUS_TITRE_APPLICATION}</span>
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 px-6 pb-5 lg:px-10 lg:pb-10">
          <p className="max-w-[520px] text-[22px] leading-[1.15] font-semibold tracking-[-0.02em] text-white lg:text-[34px]">Le parc qui livre l&apos;aliment, chaque jour.</p>
          <p className="mt-2 hidden max-w-[520px] text-[13.5px] leading-[1.5] text-white/80 sm:block">
            Camions, citernes vrac, véhicules de service et de fonction : un seul endroit pour savoir ce qui roule, ce qui coûte et ce qui arrive à échéance.
          </p>
          <p className="mt-3 hidden text-[11.5px] tracking-[0.08em] text-white/60 uppercase lg:block">Citerne vrac Niokko Bokk · SEDIMA SA · Sénégal</p>
        </div>
      </section>

      {/* La carte de connexion, sur le fond de l'application. */}
      <div className="relative flex flex-col items-center justify-center px-5 py-8 lg:min-h-screen lg:px-10 lg:py-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -bottom-48 size-[560px] rounded-full opacity-70 blur-3xl"
          style={{ background: "radial-gradient(closest-side, rgba(120,178,37,0.18), rgba(120,178,37,0))" }}
        />

        <form
          onSubmit={soumettre}
          className="relative w-full max-w-[440px] rounded-[20px] border border-bordure bg-surface px-8 py-8 shadow-flottante sm:px-9"
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

        <p className="relative mt-7 text-center text-[12px] text-attenue">
          SEDIMA SA · Agro-industrie · Sénégal
          <span className="mx-2 text-attenue-2">—</span>
          Aviculture · Minoterie · Abattoirs
        </p>
      </div>
    </div>
  );
}
