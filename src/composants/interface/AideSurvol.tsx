/**
 * Le mode d'emploi d'un écran, replié dans un « i » encerclé.
 *
 * Une explication de lecture est utile la première fois et encombrante les
 * suivantes — et ce sont des écrans qu'on ouvre dix fois par jour. Elle se lit
 * donc au survol, et reste accessible au clavier : le bouton prend le focus et
 * l'infobulle s'ouvre avec lui.
 *
 * Né sur le tableau de bord (demande du métier du 4 septembre 2026 : « retirer
 * et mettre en info quand on survole un i encerclé »), repris sur le budget le
 * 5 : dès qu'un motif sert deux fois, il vit dans l'interface, pas dans l'écran.
 */
export function AideSurvol({ libelle, children, aligne = "gauche" }: { libelle: string; children: React.ReactNode; aligne?: "gauche" | "droite" }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={libelle}
        className="grid size-[18px] place-items-center rounded-full border border-bordure-champ text-[11px] font-bold text-attenue transition-colors hover:border-accent hover:text-accent-fonce focus-visible:border-accent focus-visible:text-accent-fonce"
      >
        i
      </button>
      <span
        role="tooltip"
        className={[
          "pointer-events-none invisible absolute top-full z-30 mt-2 w-[min(560px,80vw)] rounded-[12px] border border-bordure bg-surface px-4 py-3",
          "text-[12.5px] leading-relaxed font-normal text-texte-2 opacity-0 shadow-carte transition-opacity",
          "group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100",
          aligne === "droite" ? "right-0" : "left-0",
        ].join(" ")}
      >
        {children}
      </span>
    </span>
  );
}
