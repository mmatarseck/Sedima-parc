import { ImageResponse } from "next/og";

/* L'icône d'écran d'accueil, en PNG pour les appareils qui n'acceptent pas
   le SVG : le même camion que `icon.svg`, sur le fond sombre et les trois
   barres du logo SEDIMA. */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: 180, height: 180, display: "flex", background: "#22272b" }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="180" height="180">
          <g transform="translate(43 6) rotate(28)">
            <rect x="0" y="0" width="17" height="4.5" rx="2" fill="#e3d21c" />
            <rect x="-3" y="7" width="17" height="4.5" rx="2" fill="#78b225" />
            <rect x="-6" y="14" width="17" height="4.5" rx="2" fill="#d5dbd6" />
          </g>
          <rect x="8" y="26" width="30" height="20" rx="3" fill="#ffffff" />
          <path d="M38 31h9.5a3 3 0 0 1 2.4 1.2l5.1 6.8a3 3 0 0 1 .6 1.8V44a2 2 0 0 1-2 2H38z" fill="#78b225" />
          <path d="M41 33.5h6.2l3.6 5H41z" fill="#22272b" />
          <circle cx="17" cy="47" r="5" fill="#22272b" stroke="#ffffff" strokeWidth="3" />
          <circle cx="45" cy="47" r="5" fill="#22272b" stroke="#ffffff" strokeWidth="3" />
        </svg>
      </div>
    ),
    size,
  );
}
