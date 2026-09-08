import type { MetadataRoute } from "next";
import { NOM_APPLICATION } from "@/domaine/marque";

/**
 * Le manifeste : ce qui fait que l'application s'installe sur un téléphone
 * ou un bureau depuis le navigateur, avec son icône et ses couleurs — le
 * premier pas de la version mobile (cadrage du 7 septembre 2026).
 *
 * Chrome sur Android exige des icônes PNG de 192 et 512 pixels pour proposer
 * l'installation ; la version « maskable » se découpe dans la forme choisie
 * par le téléphone sans rogner le dessin. Le proxy laisse passer ce fichier
 * sans session : le navigateur le lit sans envoyer les cookies.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: NOM_APPLICATION,
    short_name: "SEDIMA Parc",
    description: "Gestion de la flotte automobile SEDIMA — véhicules, chauffeurs, conformité, maintenance, carburant, coûts.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f6f4",
    theme_color: "#78b225",
    lang: "fr",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icone-masquable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
