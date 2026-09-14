/* La même façade inerte que `navigation-mock.mjs`, en CommonJS.
 *
 * Les deux existent parce que les deux chemins de chargement existent : tsx
 * sert les `.mts` en modules ES et compile les `.tsx` de `src/` en CommonJS.
 * Le crochet ES ne voit pas les `require()` de ces derniers — d'où ce jumeau,
 * et le rustinage de la résolution CommonJS dans `hook.mjs`.
 *
 * Toute fonction ajoutée ici doit l'être dans l'autre, et réciproquement.
 */
module.exports = {
  useRouter: () => ({ push() {}, replace() {}, prefetch() {}, back() {}, refresh() {} }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/flotte/X",
  useParams: () => ({}),
  redirect: (u) => {
    throw new Error("redirect " + u);
  },
  notFound: () => {
    throw new Error("notFound");
  },
  useSelectedLayoutSegment: () => null,
  useSelectedLayoutSegments: () => [],
};
