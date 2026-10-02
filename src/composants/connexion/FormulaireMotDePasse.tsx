"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { DEGRADE } from "@/composants/connexion/FormulaireConnexion";
import { marquerConnexion } from "@/lib/instantanes";
import { clientNavigateur } from "@/lib/supabase";
import { NOM_APPLICATION } from "@/domaine/marque";
import { premierePage } from "@/domaine/appareil";

/** La longueur minimale d'un mot de passe choisi ici. */
const LONGUEUR_MINIMALE = 10;

/**
 * « Choisir mon mot de passe » — la page où mène le lien d'invitation, et le
 * lien de réinitialisation que l'administrateur fabrique (2 octobre 2026).
 *
 * Le lien porte un jeton à usage unique (`token_hash`). Il n'est **vérifié
 * qu'à la validation** du formulaire, pas à l'ouverture de la page : l'analyse
 * des liens d'Outlook ouvre les adresses d'un courriel avant la personne, et
 * un jeton consommé à l'ouverture serait grillé avant son clic.
 *
 * Sans jeton, la page sert à qui est déjà connecté et veut changer de mot de
 * passe ; sinon, elle renvoie à l'administrateur.
 */
export function FormulaireMotDePasse() {
  const router = useRouter();
  const parametres = useSearchParams();
  const jeton = parametres.get("token_hash");
  const typeLu = parametres.get("type");
  const type: EmailOtpType | null = typeLu === "invite" || typeLu === "recovery" ? typeLu : null;
  const invitation = type === "invite";

  const [connecte, setConnecte] = useState<boolean | null>(null);
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (jeton && type) return;
    void clientNavigateur()
      .auth.getUser()
      .then(({ data }) => setConnecte(Boolean(data.user)));
  }, [jeton, type]);

  const sansLien = !(jeton && type) && connecte === false;

  async function valider(evenement: React.FormEvent) {
    evenement.preventDefault();
    setErreur(null);
    if (motDePasse.length < LONGUEUR_MINIMALE) {
      setErreur(`Le mot de passe doit compter au moins ${LONGUEUR_MINIMALE} caractères.`);
      return;
    }
    if (motDePasse !== confirmation) {
      setErreur("Les deux saisies ne concordent pas.");
      return;
    }
    setEnCours(true);
    const client = clientNavigateur();
    if (jeton && type) {
      const { error } = await client.auth.verifyOtp({ type, token_hash: jeton });
      if (error) {
        setEnCours(false);
        setErreur("Ce lien n'est plus valable — il a déjà servi, ou il a expiré. Demandez-en un nouveau à l'administrateur de SEDIMA Parc.");
        return;
      }
    }
    const { error } = await client.auth.updateUser({ password: motDePasse });
    setEnCours(false);
    if (error) {
      setErreur(
        /different from the old/i.test(error.message)
          ? "Ce mot de passe est celui que vous aviez : choisissez-en un autre."
          : /weak|pwned|leaked/i.test(error.message)
            ? "Ce mot de passe est trop faible ou figure dans une liste de mots de passe divulgués : choisissez-en un autre."
            : `Mot de passe refusé : ${error.message}`,
      );
      return;
    }
    marquerConnexion();
    router.push(premierePage(navigator.userAgent));
    router.refresh();
  }

  const champ =
    "h-12 w-full rounded-full border border-bordure bg-surface-2 px-5 text-[13.5px] text-texte outline-none transition-colors placeholder:text-attenue focus:border-accent focus:bg-surface focus:ring-4 focus:ring-accent/15";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#4e7d1a] p-4 sm:p-6">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: DEGRADE }} />

      <div className="relative flex w-full max-w-[420px] flex-col items-center rounded-[26px] bg-surface px-5 py-8 shadow-flottante sm:px-8">
        <div className="mb-6 flex flex-col items-center gap-2.5">
          <span className="grid h-[68px] place-items-center rounded-[16px] bg-surface px-4 ring-1 ring-bordure">
            <Image src="/sedima-logo.webp" alt="SEDIMA SA" width={1920} height={1356} priority className="h-[46px] w-auto object-contain" />
          </span>
          <span className="text-[14.5px] font-semibold tracking-[-0.01em] text-texte">{NOM_APPLICATION}</span>
        </div>

        {sansLien ? (
          <div className="w-full text-center">
            <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.02em] text-texte">Lien incomplet</h1>
            <p className="mt-3 text-[13px] leading-[1.55] text-texte-2">
              Cette page s&apos;ouvre depuis le lien personnel reçu par courriel. S&apos;il ne fonctionne plus, demandez-en un nouveau à l&apos;administrateur de SEDIMA Parc.
            </p>
            <a href="/connexion" className="bouton-principal mt-6 inline-flex h-11 justify-center rounded-full px-6 text-[13.5px]">
              Aller à la connexion
            </a>
          </div>
        ) : (
          <form onSubmit={valider} className="w-full">
            <h1 className="text-center text-[24px] leading-tight font-semibold tracking-[-0.02em] text-texte">{invitation ? "Bienvenue" : "Nouveau mot de passe"}</h1>
            <p className="mt-2 text-center text-[13px] leading-[1.5] text-texte-2">
              {invitation ? "Choisissez votre mot de passe pour activer votre accès." : "Choisissez votre nouveau mot de passe."} Au moins {LONGUEUR_MINIMALE} caractères.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <label className="block">
                <span className="sr-only">Mot de passe</span>
                <span className="relative block">
                  <input
                    type={visible ? "text" : "password"}
                    value={motDePasse}
                    onChange={(e) => setMotDePasse(e.target.value)}
                    placeholder="Mot de passe"
                    autoComplete="new-password"
                    className={`${champ} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-attenue hover:bg-surface-3 hover:text-texte-2"
                  >
                    {visible ? <Eye className="size-4" strokeWidth={1.8} /> : <EyeOff className="size-4" strokeWidth={1.8} />}
                    <span className="sr-only">{visible ? "Masquer" : "Afficher"} le mot de passe</span>
                  </button>
                </span>
              </label>
              <label className="block">
                <span className="sr-only">Confirmer le mot de passe</span>
                <input
                  type={visible ? "text" : "password"}
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder="Confirmer le mot de passe"
                  autoComplete="new-password"
                  className={champ}
                />
              </label>
            </div>

            {erreur ? (
              <div className="mt-4 flex items-start gap-2.5 rounded-[10px] bg-defavorable-fond px-3.5 py-3">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-defavorable" />
                <span className="text-[12.5px] leading-[1.5] text-defavorable">{erreur}</span>
              </div>
            ) : null}

            <button type="submit" disabled={enCours} className="bouton-principal mt-5 h-12 w-full justify-center rounded-full text-[14px] disabled:opacity-60">
              {enCours ? "Enregistrement…" : invitation ? "Activer mon accès" : "Enregistrer"}
              <ArrowRight className="size-4" strokeWidth={2.2} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
