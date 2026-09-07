"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

/**
 * Un cadre où l'on signe au doigt ou à la souris. Le tracé part en PNG
 * (data URL) à chaque levée du stylet ; « Effacer » le vide. Rien d'autre :
 * la signature vaut par les deux noms et l'heure que la fiche garde avec.
 */
export function SignaturePad({ valeur, onChange, disabled }: { valeur: string | null; onChange: (trace: string | null) => void; disabled?: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [trace, setTrace] = useState(false);
  const dessine = useRef(false);

  /* Le canevas se dimensionne à l'écran, net sur les écrans denses. */
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const echelle = window.devicePixelRatio || 1;
    const largeur = c.clientWidth;
    const hauteur = c.clientHeight;
    c.width = Math.round(largeur * echelle);
    c.height = Math.round(hauteur * echelle);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(echelle, echelle);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#22272b";
    if (valeur) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, largeur, hauteur);
      img.src = valeur;
      setTrace(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function position(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function commencer(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* un pointeur déjà relâché : le tracé suit quand même */
    }
    dessine.current = true;
    const p = position(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function tracer(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dessine.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = position(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function finir(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dessine.current) return;
    dessine.current = false;
    setTrace(true);
    onChange(e.currentTarget.toDataURL("image/png"));
  }

  function effacer() {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    setTrace(false);
    onChange(null);
  }

  return (
    <div className="relative">
      <canvas ref={ref} onPointerDown={commencer} onPointerMove={tracer} onPointerUp={finir} onPointerCancel={finir} className={`block h-[150px] w-full touch-none rounded-[12px] border bg-surface ${disabled ? "border-bordure" : "border-dashed border-bordure-champ"}`} aria-label="Cadre de signature" />
      {!trace && !disabled ? <span className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[12.5px] text-attenue">Signez ici, au doigt ou à la souris</span> : null}
      {trace && !disabled ? (
        <button type="button" onClick={effacer} className="absolute top-2 right-2 inline-flex h-7 items-center gap-1 rounded-full border border-bordure bg-surface px-2 text-[11.5px] font-medium text-texte-2 hover:bg-surface-2">
          <Eraser className="size-3.5" strokeWidth={1.8} />
          Effacer
        </button>
      ) : null}
    </div>
  );
}
