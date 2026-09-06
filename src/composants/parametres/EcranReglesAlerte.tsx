"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, ChevronLeft, RotateCcw } from "lucide-react";
import { TitreEcran } from "@/composants/coquille/TitreEcran";
import { Carte } from "@/composants/interface/Carte";
import { Echeance } from "@/composants/interface/Pastille";
import { ALERTES, PREVENANCE_DEFAUT } from "@/domaine/alertes";
import { peutCloturer } from "@/domaine/cloture";
import { PARAMETRES_DEFAUT, REGLES_ALERTE_DEFAUT, type Parametres, type ReglesAlerte } from "@/domaine/parametres";
import { ROLES, trouverRole, type Role } from "@/domaine/roles";
import { ecrireParametres, lireParametres } from "@/lib/parametres-demo";
import { lireRole } from "@/lib/session-demo";

/* ============================================================================
 * Paramètres › Règles d'alerte.
 *
 * À ne pas confondre avec « Mes notifications », qui est le réglage de chacun.
 * Ici, l'administrateur fixe **ce qu'un compte reçoit sans rien toucher** : à
 * quels rôles chaque famille d'alerte est poussée d'office, et à combien de
 * jours l'échéancier prévient.
 *
 * Pourquoi ce réglage existe : sans défaut sensé, personne ne règle rien et
 * tout le monde reçoit tout — ce qui revient à ne rien recevoir. Le
 * gestionnaire de parc cesse de lire ses courriels au bout d'une semaine, et
 * l'alerte qui comptait passe avec les autres.
 *
 * Une famille dont **aucun rôle** n'est coché vaut pour tous : c'est le
 * comportement d'avant ce réglage, et il faut pouvoir y revenir sans avoir à
 * cocher les huit rôles un par un.
 * ==========================================================================*/

export function EcranReglesAlerte() {
  const [p, setP] = useState<Parametres>(PARAMETRES_DEFAUT);
  const [regles, setRegles] = useState<ReglesAlerte>(REGLES_ALERTE_DEFAUT);
  const [habilite, setHabilite] = useState(false);
  const [nomRole, setNomRole] = useState("");
  const [enregistre, setEnregistre] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const lu = lireParametres();
    setP(lu);
    setRegles({ destinataires: { ...lu.alertes.destinataires }, prevenance: [...lu.alertes.prevenance] });
    const r = trouverRole(lireRole());
    setHabilite(peutCloturer(r.role));
    setNomRole(r.libelle);
  }, []);

  const change = JSON.stringify(regles) !== JSON.stringify(p.alertes);
  const modifie = JSON.stringify(regles) !== JSON.stringify(REGLES_ALERTE_DEFAUT);

  function basculer(famille: string, role: Role) {
    setRegles((r) => {
      const actuels = r.destinataires[famille as keyof ReglesAlerte["destinataires"]] ?? [];
      const suivant = actuels.includes(role) ? actuels.filter((x) => x !== role) : [...actuels, role];
      return { ...r, destinataires: { ...r.destinataires, [famille]: suivant } };
    });
    setEnregistre(false);
  }

  function poserPrevenance(valeur: string) {
    /* On accepte « 60, 30, 7 » comme « 60 30 7 » : c'est une liste, pas une
       syntaxe. Le tri décroissant est imposé — la première alerte est la plus
       lointaine, et l'échéancier de Conformité les lit dans cet ordre. */
    const jours = [...new Set(valeur.split(/[^\d]+/).map(Number).filter((n) => Number.isFinite(n) && n > 0 && n <= 365))].sort((a, b) => b - a);
    setRegles((r) => ({ ...r, prevenance: jours }));
    setEnregistre(false);
  }

  function enregistrer() {
    const suivant: Parametres = { ...p, alertes: regles };
    setErreur(null);
    void ecrireParametres(suivant).then((refus) => {
      if (refus) {
        setErreur(refus);
        return;
      }
      setP(suivant);
      setEnregistre(true);
    });
  }

  function retablir() {
    setRegles({ destinataires: { ...REGLES_ALERTE_DEFAUT.destinataires }, prevenance: [...REGLES_ALERTE_DEFAUT.prevenance] });
    setEnregistre(false);
  }

  const valide = regles.prevenance.length > 0;

  return (
    <div className="defilement-discret flex flex-col gap-5 px-8 py-7 lg:h-full lg:overflow-y-auto">
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[12.5px] text-attenue">
        <Link href="/parametres" className="inline-flex items-center gap-1 font-medium text-texte-2 hover:text-accent-fonce">
          <ChevronLeft className="size-3.5" strokeWidth={1.8} />
          Paramètres
        </Link>
      </nav>

      <TitreEcran
        titre="Règles d'alerte"
        sousTitre="Ce qu'un compte reçoit sans rien toucher — le réglage de l'organisation, et non celui de chacun"
        actions={
          habilite ? (
            <>
              {erreur ? <span className="max-w-[360px] text-[12.5px] leading-[1.4] text-defavorable">{erreur}</span> : null}
              {modifie ? (
                <button type="button" onClick={retablir} className="bouton-secondaire">
                  <RotateCcw className="size-4 text-texte-2" strokeWidth={1.7} />
                  Rétablir les règles d&apos;origine
                </button>
              ) : null}
              <button type="button" onClick={enregistrer} disabled={!change || !valide} className="bouton-principal disabled:cursor-not-allowed disabled:opacity-50">
                <Check className="size-4" strokeWidth={2.2} />
                {enregistre && !change ? "Enregistré" : "Enregistrer"}
              </button>
            </>
          ) : null
        }
      />

      {!habilite ? (
        <p className="carte shrink-0 border-l-[3px] border-l-vigilance px-4 py-3 text-[13px] leading-relaxed text-texte-2">
          Vous êtes connecté comme <strong className="font-semibold text-texte">{nomRole}</strong>. Ces règles se lisent, mais ne se modifient que par un administrateur ou la direction — elles
          valent pour toute l&apos;organisation.
        </p>
      ) : null}

      <Carte
        titre="Qui reçoit quoi"
        precision="Une famille dont aucun rôle n'est coché vaut pour tous. Chacun reste libre de s'en écarter depuis « Mes notifications » — ce réglage-ci ne fixe que le point de départ."
        sansMarge
      >
        <div className="defilement-discret overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr>
                <th className="en-tete-colonne sticky left-0 z-10 h-11 border-b border-bordure bg-surface-2 px-5 text-left">Famille d&apos;alerte</th>
                {ROLES.map((r) => (
                  <th key={r.role} className="en-tete-colonne h-11 border-b border-bordure bg-surface-2 px-2 text-center" title={r.perimetre}>
                    <span className="block max-w-[92px] truncate">{r.libelle}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALERTES.map((a) => {
                const retenus = regles.destinataires[a.cle] ?? [];
                return (
                  <tr key={a.cle} className="group">
                    <td className="sticky left-0 z-10 max-w-[320px] border-b border-bordure bg-surface px-5 py-2.5 group-hover:bg-surface-2">
                      <span className="block font-medium text-texte">{a.libelle}</span>
                      <span className="meta block leading-snug">{a.declencheur}</span>
                      {retenus.length === 0 ? <span className="meta mt-0.5 block text-accent-fonce">poussée à tous les rôles</span> : null}
                    </td>
                    {ROLES.map((r) => {
                      /* Une famille réservée à certains rôles ne se propose pas
                         aux autres : la cocher n'aurait aucun effet, puisque
                         l'alerte ne leur est pas offerte. */
                      const concerne = !a.roles || a.roles.includes(r.role);
                      const coche = retenus.includes(r.role);
                      return (
                        <td key={r.role} className="border-b border-bordure px-2 py-2.5 text-center group-hover:bg-surface-2">
                          {concerne ? (
                            <button
                              type="button"
                              role="switch"
                              aria-checked={coche}
                              aria-label={`${a.libelle} — ${r.libelle}`}
                              disabled={!habilite}
                              onClick={() => basculer(a.cle, r.role)}
                              className={`grid size-6 place-items-center rounded-[7px] border transition-colors disabled:cursor-not-allowed ${
                                coche ? "border-accent bg-accent text-white" : "border-bordure-champ bg-surface text-transparent hover:border-accent"
                              }`}
                            >
                              <Check className="size-3.5" strokeWidth={2.6} />
                            </button>
                          ) : (
                            <span className="text-attenue-2" title="Cette alerte n'est pas proposée à ce rôle">
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Carte>

      <Carte
        titre="Délai de prévenance des échéances"
        precision="À combien de jours l'application prévient avant le terme d'un document, d'un permis ou d'une visite médicale. C'est le même réglage que celui qu'applique l'échéancier de Conformité — deux réglages distincts pour la même chose finiraient par se contredire."
      >
        <label className="flex max-w-[420px] flex-col gap-1.5">
          <span className="label-champ">Jours avant échéance</span>
          <input
            type="text"
            inputMode="numeric"
            defaultValue={regles.prevenance.join(", ")}
            onChange={(e) => poserPrevenance(e.target.value)}
            disabled={!habilite}
            aria-label="Jours de prévenance, séparés par des virgules"
            className="code h-9 rounded-[10px] border border-bordure-champ bg-surface px-3 text-[13px] text-texte outline-none focus:border-accent disabled:cursor-not-allowed disabled:border-transparent disabled:bg-transparent"
          />
        </label>
        <p className="meta mt-2">
          Séparés par des virgules. Ils se rangent du plus lointain au plus proche.{" "}
          {regles.prevenance.length > 0 ? (
            <>
              Aujourd&apos;hui :{" "}
              {regles.prevenance.map((j, i) => (
                <span key={j}>
                  {i > 0 ? ", " : ""}
                  <span className="code text-texte">J−{j}</span>
                </span>
              ))}
              .
            </>
          ) : (
            <span className="text-defavorable">Au moins un délai est nécessaire — sans quoi rien ne préviendrait.</span>
          )}
          {regles.prevenance.join(",") !== PREVENANCE_DEFAUT.join(",") ? <span className="ml-1 text-attenue">D&apos;origine : {PREVENANCE_DEFAUT.map((j) => `J−${j}`).join(", ")}.</span> : null}
        </p>
      </Carte>

      <p className="meta shrink-0">
        Ces règles sont enregistrées pour la démonstration dans le navigateur et un cookie, comme les autres paramètres. En production, une table <span className="code">parametre</span> lue par le
        serveur et le navigateur, et une seule vérité. Le réglage personnel de chacun se fait sur{" "}
        <Link href="/parametres/notifications" className="font-medium text-accent-fonce hover:text-accent">
          Mes notifications
        </Link>
        .
      </p>

      {change ? <Echeance ton="vigilance">Modifications non enregistrées</Echeance> : null}
    </div>
  );
}
