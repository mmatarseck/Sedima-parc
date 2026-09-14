import Module, { register } from "node:module";
import { fileURLToPath } from "node:url";

/* Les imports en modules ES : `import … from "next/navigation"` dans un .mts. */
register("./resolveur.mjs", import.meta.url);

/* Et ceux en CommonJS.
 *
 * tsx sert les `.mts` en modules ES mais compile les `.tsx` de `src/` en
 * CommonJS : leurs `import` deviennent des `require()`, que le crochet
 * ci-dessus ne voit pas — les crochets de Node ne couvrent que le chargeur ES.
 * La fiche véhicule recevait donc le vrai `next/navigation` et tombait sur
 * « invariant expected app router to be mounted », les 173 rendus avec elle.
 * Sans ce rustinage, le banc échoue en bloc et ne prouve plus rien.
 */
const MOCK = fileURLToPath(new URL("./navigation-mock.cjs", import.meta.url));
const resoudre = Module._resolveFilename;
Module._resolveFilename = function (demande, ...reste) {
  if (demande === "next/navigation") return MOCK;
  return resoudre.call(this, demande, ...reste);
};
