import type { MetadataRoute } from "next";
import { NOM_APPLICATION } from "@/domaine/marque";

/**
 * Le manifeste : ce qui fait que l'application s'installe sur un téléphone
 * ou un bureau depuis le navigateur, avec son icône et ses couleurs — le
 * premier pas de la version mobile (cadrage du 7 septembre 2026).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: NOM_APPLICATION,
    short_name: "SEDIMA Parc",
    description: "Gestion de la flotte automobile SEDIMA — véhicules, chauffeurs, conformité, maintenance, carburant, coûts.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6f4",
    theme_color: "#78b225",
    lang: "fr",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
