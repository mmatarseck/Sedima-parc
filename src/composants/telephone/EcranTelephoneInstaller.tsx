"use client";

import { useEffect, useState } from "react";
import { Download, Share, Smartphone } from "lucide-react";
import { Bloc, EnTeteTelephone } from "./Telephone";

interface EvenementInstallation extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Installer l'application sur le téléphone : Chrome sur Android propose
 * l'installation par un bouton (l'événement `beforeinstallprompt`) ; sur
 * iPhone, Safari passe par « Partager › Sur l'écran d'accueil ». L'écran dit
 * lequel des deux s'applique.
 */
export function EcranTelephoneInstaller() {
  const [evenement, setEvenement] = useState<EvenementInstallation | null>(null);
  const [installee, setInstallee] = useState(false);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setInstallee(window.matchMedia("(display-mode: standalone)").matches);
    const capter = (e: Event) => {
      e.preventDefault();
      setEvenement(e as EvenementInstallation);
    };
    window.addEventListener("beforeinstallprompt", capter);
    window.addEventListener("appinstalled", () => setInstallee(true));
    return () => window.removeEventListener("beforeinstallprompt", capter);
  }, []);

  async function installer() {
    if (!evenement) return;
    await evenement.prompt();
    const choix = await evenement.userChoice;
    if (choix.outcome === "accepted") setInstallee(true);
    setEvenement(null);
  }

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3 px-3 pb-24 pt-1">
      <EnTeteTelephone titre="Installer l'application" retour="/telephone/reglages" />
      <Bloc>
        <div className="flex items-start gap-3 py-1">
          <Smartphone className="mt-0.5 size-6 shrink-0 text-accent-fonce" strokeWidth={1.7} />
          <p className="text-[13.5px] leading-[1.5] text-texte-2">
            SEDIMA Parc s&apos;installe depuis le navigateur, sans magasin d&apos;applications : une icône sur l&apos;écran d&apos;accueil, en plein écran, avec la même adresse et les mêmes droits.
          </p>
        </div>
      </Bloc>
      {installee ? (
        <Bloc accent>
          <p className="py-1 text-[13.5px] font-semibold text-accent-tres-fonce">L&apos;application est installée sur ce téléphone.</p>
        </Bloc>
      ) : evenement ? (
        <button type="button" onClick={() => void installer()} className="bouton-principal h-12 w-full justify-center rounded-[14px] text-[15px]">
          <Download className="size-4" strokeWidth={2} />
          Installer SEDIMA Parc
        </button>
      ) : (
        <Bloc titre={ios ? "Sur iPhone" : "Sur Android"}>
          {ios ? (
            <p className="py-1 text-[13.5px] leading-[1.6] text-texte-2">
              Dans Safari, touchez <Share className="inline size-4 align-text-bottom" strokeWidth={1.8} /> <b className="text-texte">Partager</b>, puis <b className="text-texte">Sur l&apos;écran d&apos;accueil</b>, et confirmez.
            </p>
          ) : (
            <p className="py-1 text-[13.5px] leading-[1.6] text-texte-2">
              Dans Chrome, ouvrez le menu <b className="text-texte">⋮</b>, puis <b className="text-texte">Installer l&apos;application</b> ou <b className="text-texte">Ajouter à l&apos;écran d&apos;accueil</b>. Si le bouton d&apos;installation n&apos;apparaît pas ici, c&apos;est que le navigateur ne le propose pas encore sur cette page.
            </p>
          )}
        </Bloc>
      )}
    </div>
  );
}
