/* ============================================================================
 * L'envoi d'un courriel — la fonction de notification de la plateforme.
 *
 * Décision du métier du 7 septembre 2026 : le détenteur est prévenu par
 * notification de l'application ou par courriel, pas de SMS. L'application
 * ne porte aucun serveur de courrier : elle confie l'envoi à un fournisseur
 * par son API (Resend, à ce jour), avec deux réglages posés sur Vercel —
 * `RESEND_API_KEY` et `COURRIEL_EXPEDITEUR` (« SEDIMA Parc
 * <parc@sedima.sn> »). Tant qu'ils manquent, rien ne part : la notification
 * reste « à envoyer », l'écran le dit, et l'envoi reprend dès qu'ils sont
 * posés. Serveur seulement.
 * ==========================================================================*/

export interface Courriel {
  a: string;
  sujet: string;
  texte: string;
  html?: string;
}

export interface EtatCourriel {
  pret: boolean;
  /** Ce qui manque, en clair, quand rien ne peut partir. */
  raison: string | null;
  expediteur: string | null;
}

/** L'adresse publique de l'application, pour les liens des courriels. */
export function adresseApplication(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://sedima-parc.vercel.app").replace(/\/$/, "");
}

export function etatCourriel(): EtatCourriel {
  if (typeof window !== "undefined") return { pret: false, raison: "Le courriel ne part que du serveur.", expediteur: null };
  const cle = process.env.RESEND_API_KEY;
  const expediteur = process.env.COURRIEL_EXPEDITEUR ?? null;
  if (!cle) return { pret: false, raison: "RESEND_API_KEY n'est pas posée sur le serveur.", expediteur };
  if (!expediteur) return { pret: false, raison: "COURRIEL_EXPEDITEUR n'est pas posé (« SEDIMA Parc <parc@sedima.sn> »).", expediteur: null };
  return { pret: true, raison: null, expediteur };
}

/** Envoie un courriel par le fournisseur ; ne lève jamais, dit ce qui s'est passé. */
export async function envoyerCourriel(c: Courriel): Promise<{ envoye: boolean; erreur: string | null }> {
  const etat = etatCourriel();
  if (!etat.pret) return { envoye: false, erreur: etat.raison };
  try {
    const reponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: etat.expediteur, to: [c.a], subject: c.sujet, text: c.texte, html: c.html }),
    });
    if (!reponse.ok) {
      const detail = await reponse.text().catch(() => "");
      return { envoye: false, erreur: `Le fournisseur a refusé (${reponse.status}) ${detail.slice(0, 200)}`.trim() };
    }
    return { envoye: true, erreur: null };
  } catch (x) {
    return { envoye: false, erreur: `Envoi impossible : ${(x as Error).message}` };
  }
}

/** Le texte d'un courriel de notifications, groupé : ce qui attend la personne, et où le trouver. */
export function composerRecapitulatif(prenom: string, lignes: { sujet: string; extrait: string; href: string; date: string }[]): { sujet: string; texte: string; html: string } {
  const base = adresseApplication();
  const n = lignes.length;
  const sujet = n === 1 ? `SEDIMA Parc — ${lignes[0]!.sujet}` : `SEDIMA Parc — ${n} notifications vous attendent`;
  const bonjour = prenom ? `Bonjour ${prenom},` : "Bonjour,";
  const texte = [bonjour, "", n === 1 ? "Une notification vous attend dans SEDIMA Parc :" : `${n} notifications vous attendent dans SEDIMA Parc :`, "", ...lignes.map((l) => `• ${l.sujet}${l.extrait ? ` — ${l.extrait}` : ""}\n  ${base}${l.href}`), "", `Ouvrir l'application : ${base}/telephone`, "", "Ce message est envoyé par la plateforme SEDIMA Parc ; on n'y répond pas."].join("\n");
  const echapper = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.5;color:#1f2937">
<p>${echapper(bonjour)}</p>
<p>${n === 1 ? "Une notification vous attend dans SEDIMA Parc :" : `${n} notifications vous attendent dans SEDIMA Parc :`}</p>
<ul>${lignes.map((l) => `<li><a href="${base}${echapper(l.href)}" style="color:#166534;font-weight:600">${echapper(l.sujet)}</a>${l.extrait ? ` — ${echapper(l.extrait)}` : ""}</li>`).join("")}</ul>
<p><a href="${base}/telephone" style="display:inline-block;padding:8px 14px;border-radius:8px;background:#16a34a;color:#fff;text-decoration:none;font-weight:600">Ouvrir SEDIMA Parc</a></p>
<p style="color:#6b7280;font-size:12px">Ce message est envoyé par la plateforme SEDIMA Parc ; on n'y répond pas.</p>
</div>`;
  return { sujet, texte, html };
}
