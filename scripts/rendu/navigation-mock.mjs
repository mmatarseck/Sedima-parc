export const useRouter = () => ({ push() {}, replace() {}, prefetch() {}, back() {}, refresh() {} });
export const useSearchParams = () => new URLSearchParams();
export const usePathname = () => "/flotte/X";
export const useParams = () => ({});
export const redirect = (u) => { throw new Error("redirect " + u); };
export const notFound = () => { throw new Error("notFound"); };
export const useSelectedLayoutSegment = () => null;
export const useSelectedLayoutSegments = () => [];
