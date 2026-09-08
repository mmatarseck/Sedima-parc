import { cheminSvgQr, matriceQr } from "@/lib/qr";

/** Un QR code en SVG, net à toute taille. Le texte est ce que le lecteur lira. */
export function QrCode({ texte, taille = 160, className = "", libelle }: { texte: string; taille?: number; className?: string; libelle?: string }) {
  const { chemin, cote } = cheminSvgQr(matriceQr(texte));
  return (
    <svg viewBox={`0 0 ${cote} ${cote}`} width={taille} height={taille} role="img" aria-label={libelle ?? `QR code — ${texte}`} className={className} shapeRendering="crispEdges">
      <rect width={cote} height={cote} fill="#ffffff" />
      <path d={chemin} fill="#22272b" />
    </svg>
  );
}
