"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { ROLES } from "@/domaine/roles";
import { authentificationReelle, fermerSession, ouvrirSession } from "@/lib/session-demo";
import { effacerInstantanes, marquerConnexion } from "@/lib/instantanes";
import { clientNavigateur } from "@/lib/supabase";
import { ACCROCHE_APPLICATION, NOM_APPLICATION, PRECISION_APPLICATION } from "@/domaine/marque";

/**
 * Le dégradé du panneau de garde.
 *
 * La maquette pose un violet plein ; ici ce sont les deux couleurs de la
 * maison : le **vert SEDIMA** qui occupe la page, et le **rouge SEDIMA** qui
 * en tient le coin bas (métier, 10 septembre 2026 : « mettre un peu du rouge
 * sedima »).
 *
 * « Un peu » est le mot. Le rouge arrive en diagonale, dans le dernier quart,
 * et ne mord pas sur la zone où se lisent la marque et l'accroche. Dans
 * l'application, le rouge est réservé à ce qui alerte ; cette page est en
 * dehors de l'application, personne n'y lit un état, et la couleur peut y
 * redevenir ce qu'elle est ailleurs — une couleur de marque.
 *
 * Écrit en clair plutôt qu'en jetons : c'est le seul endroit qui porte un
 * aplat de couleur pleine, et il n'a pas à peser sur la palette commune.
 */
const DEGRADE = "linear-gradient(145deg, #8cc72e 0%, #78b225 30%, #4e7d1a 58%, #7d1c15 86%, #c00000 100%)";

/** Ce que la page de garde dit quand on y revient sans l'avoir choisi. */
const MOTIFS: Record<string, string> = {
  "sans-profil":
    "Ce compte existe mais n'a pas encore de rôle dans SEDIMA Parc. Demandez à un administrateur de poser votre profil, puis reconnectez-vous.",
};

/**
 * Page de garde.
 *
 * **Refondue le 10 septembre 2026, d'après une maquette du métier**, et la
 * photo de la citerne vrac est retirée.
 *
 * Ce que la maquette pose, et qu'on reprend : un **aplat de couleur en
 * dégradé** sur toute la page, une **carte blanche à grand rayon** qui flotte
 * dessus avec une marge sur les quatre côtés, la marque et une accroche dans
 * l'espace coloré à gauche, et dans la carte des **champs et un bouton en
 * pilule**, sans étiquette au-dessus — l'indication à l'intérieur les nomme.
 * Le violet devient le vert SEDIMA.
 *
 * Ce qu'on n'en reprend pas : les boutons Google et Facebook sous le
 * séparateur « ou ». On ne dessine pas une porte qui ne mène nulle part. Le
 * séparateur reste, et ce qui vient après est le second chemin d'entrée que
 * cette application a réellement — les comptes de démonstration.
 *
 * Sur un téléphone, le panneau de gauche disparaît : il n'aurait fait que
 * repousser le formulaire vers le bas. La marque revient alors au-dessus du
 * titre, et la carte prend l'écran, marge comprise.
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
    effacerInstantanes();
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
    /* La connexion rafraîchit le tableau de bord gardé : c'est le moment que le métier a choisi. */
    marquerConnexion();
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
    marquerConnexion();
    const suite = parametres.get("suite");
    router.push(suite && suite.startsWith("/") && !suite.startsWith("//") ? suite : "/flotte");
  }

  /* Les champs en pilule, d'après la maquette : rayon plein, fond très clair
     plutôt que blanc, bordure discrète qui ne se voit qu'au repos. */
  const champ =
    "h-12 w-full rounded-full border border-bordure bg-surface-2 px-5 text-[13.5px] text-texte outline-none transition-colors placeholder:text-attenue focus:border-accent focus:bg-surface focus:ring-4 focus:ring-accent/15";

  return (
    /* Le fond dégradé occupe toute la page ; la carte blanche flotte dessus
       avec une marge tout autour, si bien que le vert continue de se voir sur
       les quatre côtés. C'est le trait de la maquette qui porte le plus. */
    <div className="relative flex min-h-screen flex-col justify-center p-4 sm:p-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(460px,46%)] lg:items-stretch lg:gap-0 lg:p-5" style={{ background: DEGRADE }}>
      {/* -- À gauche : la marque et l'accroche, sur le dégradé --------------
          Cachée sous 1024 px : sur un téléphone, la carte prend l'écran et
          l'accroche n'aurait fait que repousser le formulaire vers le bas. */}
      <section className="hidden flex-col justify-center px-12 py-12 lg:flex xl:px-16">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-white/95 shadow-flottante">
            <Image src="/sedima-picto.png" alt="" width={30} height={30} priority className="size-[30px] object-contain" />
          </span>
          <span className="text-[19px] font-semibold tracking-[-0.01em] text-white">{NOM_APPLICATION}</span>
        </div>
        <h2 className="mt-10 max-w-[520px] text-[44px] leading-[1.08] font-semibold tracking-[-0.03em] text-white xl:text-[52px]">Bonjour.</h2>
        <p className="mt-4 max-w-[480px] text-[16px] leading-[1.45] font-medium text-white/90">{ACCROCHE_APPLICATION}</p>
        <p className="mt-4 max-w-[460px] text-[13.5px] leading-[1.6] text-white/70">{PRECISION_APPLICATION}</p>
      </section>

      {/* -- À droite : la carte blanche ------------------------------------ */}
      <div className="mx-auto flex w-full max-w-[440px] flex-col items-center rounded-[26px] bg-surface px-5 py-8 shadow-flottante sm:px-8 lg:my-0 lg:max-w-none lg:justify-center lg:rounded-[28px] lg:px-8 lg:py-10">
        {/* La marque revient ici sous 1024 px, puisque le panneau de gauche
            n'y est pas : sans elle, l'écran ne dirait pas où l'on entre. */}
        <div className="mb-7 flex flex-col items-center gap-2.5 lg:hidden">
          <span className="grid size-12 place-items-center rounded-[14px] bg-surface ring-1 ring-bordure">
            <Image src="/sedima-picto.png" alt="" width={30} height={30} priority className="size-[30px] object-contain" />
          </span>
          <span className="text-[14.5px] font-semibold tracking-[-0.01em] text-texte">{NOM_APPLICATION}</span>
        </div>

        <form onSubmit={soumettre} className="w-full max-w-[400px]">
          <h1 className="text-center text-[26px] leading-tight font-semibold tracking-[-0.02em] text-texte">Connexion</h1>
          <p className="mt-2 text-center text-[13px] leading-[1.5] text-texte-2">Réservé à l&apos;équipe de gestion de parc.</p>

          {/* Les champs sans étiquette au-dessus, comme la maquette : c'est
              l'indication à l'intérieur qui les nomme. L'étiquette reste dans
              le balisage, pour les lecteurs d'écran, mais ne se dessine pas. */}
          <div className="mt-7 flex flex-col gap-3">
            <label className="block">
              <span className="sr-only">Identifiant</span>
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
              <span className="sr-only">Mot de passe</span>
              <span className="relative block">
                <input
                  type={motDePasseVisible ? "text" : "password"}
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  placeholder="Mot de passe"
                  autoComplete="current-password"
                  className={`${champ} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setMotDePasseVisible((v) => !v)}
                  title={motDePasseVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-attenue hover:bg-surface-3 hover:text-texte-2"
                >
                  {motDePasseVisible ? <Eye className="size-4" strokeWidth={1.8} /> : <EyeOff className="size-4" strokeWidth={1.8} />}
                  <span className="sr-only">{motDePasseVisible ? "Masquer" : "Afficher"} le mot de passe</span>
                </button>
              </span>
            </label>
          </div>

          {/* Le lien d'oubli sous les champs, aligné à droite. Il n'apparaît
              qu'en authentification réelle : sans projet configuré, il n'y a
              pas de mot de passe à réinitialiser. */}
          {reelle ? (
            <div className="mt-2.5 flex justify-end">
              <button type="button" className="text-[12.5px] font-medium text-accent-fonce hover:text-accent" onClick={() => void motDePasseOublie()}>
                Mot de passe oublié&nbsp;?
              </button>
            </div>
          ) : null}

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

          {/* Le bouton en pilule pleine largeur, d'après la maquette. */}
          <button type="submit" disabled={enCours} className="bouton-principal mt-5 h-12 w-full justify-center rounded-full text-[14px] disabled:opacity-60">
            {enCours ? "Connexion…" : "Se connecter"}
            <ArrowRight className="size-4" strokeWidth={2.2} />
          </button>

          <p className="mt-3.5 flex items-center justify-center gap-1.5 text-[11.5px] text-attenue">
            <LockKeyhole className="size-3.5" strokeWidth={1.8} />
            Double authentification obligatoire pour les administrateurs
          </p>

          {!reelle ? (
            <>
              {/* Le séparateur « OU » de la maquette. Là où elle propose
                  Google et Facebook, on n'a rien à proposer de tel — et on ne
                  va pas dessiner des boutons qui ne mènent nulle part. Ce qui
                  vient après, c'est ce que cette application a de second
                  chemin d'entrée : les comptes de démonstration. */}
              <div className="mt-7 flex items-center gap-3">
                <span className="h-px flex-1 bg-bordure" />
                <span className="text-[11.5px] font-semibold tracking-[0.08em] text-attenue uppercase">ou</span>
                <span className="h-px flex-1 bg-bordure" />
              </div>

              <div className="mt-5 mb-3 flex items-baseline">
                <span className="micro-sur-titre">Mode démonstration</span>
                <span className="meta ml-auto text-[11.5px]">sans mot de passe</span>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ROLES.map((role) => (
                  <button
                    key={role.role}
                    type="button"
                    onClick={() => entrer(role)}
                    className="flex items-center gap-2.5 rounded-full border border-bordure bg-surface-2 py-1.5 pr-3 pl-1.5 text-left transition-colors hover:border-accent-bordure hover:bg-accent-fond"
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
            </>
          ) : null}
        </form>

        {/* Le pied : la maison et ses métiers. Sur un téléphone il passe à la
            ligne plutôt que de rétrécir, d'où le retrait du tiret sous 380 px. */}
        <p className="mt-8 max-w-[380px] text-center text-[11.5px] leading-[1.6] text-attenue">
          SEDIMA SA · Agro-industrie · Sénégal
          <span className="mx-2 hidden text-attenue-2 sm:inline">—</span>
          <span className="block sm:inline">Aviculture · Minoterie · Abattoirs</span>
        </p>
      </div>
    </div>
  );
}
