"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Camera, Keyboard, ScanLine } from "lucide-react";
import { normaliser } from "@/domaine/immatriculation";
import { CHEMIN_QR } from "@/lib/qr";
import { Bloc, EnTeteTelephone } from "./Telephone";

/* ============================================================================
 * Téléphone › Scanner — l'appareil photo lit le QR code collé sur le véhicule
 * et ouvre sa fiche rapide. Le lecteur est celui du navigateur
 * (BarcodeDetector, Chrome sur Android) ; sans lui, on tape la plaque — ou
 * on scanne avec l'appareil photo du téléphone, qui ouvre la même adresse.
 * ==========================================================================*/

interface DetecteurCodes {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
interface FenetreAvecDetecteur extends Window {
  BarcodeDetector?: new (options?: { formats?: string[] }) => DetecteurCodes;
}

/** L'immatriculation portée par ce qu'on a lu : l'adresse `/v/…`, ou une plaque tapée. */
export function immatriculationLue(texte: string): string | null {
  const t = texte.trim();
  const i = t.indexOf(CHEMIN_QR);
  const brut = i >= 0 ? t.slice(i + CHEMIN_QR.length).split(/[?#/]/)[0]! : t;
  const canonique = normaliser(brut);
  return /^[A-Z]{2}\d{3,4}[A-Z]{2}$/.test(canonique) ? canonique : null;
}

export function EcranTelephoneScanner() {
  const router = useRouter();
  const video = useRef<HTMLVideoElement | null>(null);
  const [etat, setEtat] = useState<"attente" | "camera" | "sans-camera" | "trouve">("attente");
  const [message, setMessage] = useState<string | null>(null);
  const [plaque, setPlaque] = useState("");

  useEffect(() => {
    const fenetre = window as FenetreAvecDetecteur;
    if (!fenetre.BarcodeDetector || !navigator.mediaDevices?.getUserMedia) {
      setEtat("sans-camera");
      return;
    }
    let flux: MediaStream | null = null;
    let vivant = true;
    let minuterie: number | undefined;
    const detecteur = new fenetre.BarcodeDetector({ formats: ["qr_code"] });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((s) => {
        if (!vivant) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        flux = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
        }
        setEtat("camera");
        const lire = async () => {
          if (!vivant || !video.current || video.current.readyState < 2) {
            minuterie = window.setTimeout(lire, 300);
            return;
          }
          try {
            const codes = await detecteur.detect(video.current);
            const immat = codes.map((c) => immatriculationLue(c.rawValue)).find((x): x is string => x !== null);
            if (immat) {
              setEtat("trouve");
              router.push(`/telephone/vehicules/${immat}`);
              return;
            }
          } catch {
            /* une image pas encore prête : on réessaie */
          }
          minuterie = window.setTimeout(lire, 300);
        };
        void lire();
      })
      .catch(() => {
        setEtat("sans-camera");
        setMessage("L'appareil photo n'est pas accessible : tapez la plaque, ou scannez le code avec l'application photo du téléphone.");
      });
    return () => {
      vivant = false;
      if (minuterie) window.clearTimeout(minuterie);
      flux?.getTracks().forEach((t) => t.stop());
    };
  }, [router]);

  function ouvrirPlaque() {
    const immat = immatriculationLue(plaque);
    if (!immat) {
      setMessage("Une plaque s'écrit comme AA-032-EA.");
      return;
    }
    router.push(`/telephone/vehicules/${immat}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3 px-3 pb-24 pt-1">
      <EnTeteTelephone titre="Scanner un véhicule" retour="/telephone" />
      <div className="relative overflow-hidden rounded-[16px] bg-encre" style={{ aspectRatio: "3 / 4" }}>
        <video ref={video} playsInline muted className={`size-full object-cover ${etat === "camera" ? "" : "hidden"}`} />
        {etat === "camera" ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="size-[62%] rounded-[18px] border-2 border-white/80 shadow-[0_0_0_9999px_rgba(34,39,43,0.35)]" />
          </div>
        ) : (
          <div className="absolute inset-0 grid place-items-center px-6 text-center">
            <div className="flex flex-col items-center gap-2 text-white/85">
              {etat === "attente" ? <Camera className="size-8" strokeWidth={1.6} /> : <ScanLine className="size-8" strokeWidth={1.6} />}
              <p className="text-[13.5px] leading-[1.5]">{etat === "attente" ? "Ouverture de l'appareil photo…" : etat === "trouve" ? "Véhicule reconnu, ouverture…" : "Ce navigateur ne lit pas les QR codes lui-même. Scannez l'étiquette avec l'application photo du téléphone : elle ouvre la fiche."}</p>
            </div>
          </div>
        )}
      </div>
      {etat === "camera" ? <p className="meta px-2 text-center">Visez l&apos;étiquette collée sur le véhicule : la fiche s&apos;ouvre dès que le code est lu.</p> : null}

      <Bloc titre="Ou tapez la plaque">
        <div className="flex items-center gap-2">
          <Keyboard className="size-4 shrink-0 text-attenue" strokeWidth={1.8} />
          <input
            type="text"
            value={plaque}
            onChange={(e) => setPlaque(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ouvrirPlaque()}
            placeholder="AA-032-EA"
            autoCapitalize="characters"
            autoComplete="off"
            className="code h-11 min-w-0 flex-1 rounded-[12px] border border-bordure-champ bg-surface px-3.5 text-[16px] tracking-[0.06em] text-texte outline-none focus:border-accent"
          />
          <button type="button" onClick={ouvrirPlaque} className="bouton-principal h-11 shrink-0 rounded-[12px]">
            Ouvrir
          </button>
        </div>
        {message ? <p className="mt-2 text-[12.5px] text-defavorable">{message}</p> : null}
      </Bloc>
    </div>
  );
}
