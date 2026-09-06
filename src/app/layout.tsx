import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NOM_APPLICATION } from "@/domaine/marque";

export const metadata: Metadata = {
  title: NOM_APPLICATION,
  description:
    "Gestion de la flotte automobile SEDIMA — véhicules, chauffeurs, affectations, conformité, maintenance, carburant, transporteurs et coûts.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#78b225",
};

export default function RacineLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
