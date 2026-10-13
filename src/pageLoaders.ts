/**
 * Where the code of each staff page comes from (StaffApp.tsx loads a page when it is first opened). The sidebar asks for
 * a page's code as soon as the pointer rests on, or the keyboard reaches, its link (prefetchPage), so by the time the
 * click lands the page is usually already downloaded and opens at once. Asking twice is free: the browser keeps one copy.
 */
export const PAGE_LOADERS = {
  '/patients': () => import('./pages/Patients'),
  '/encounters': () => import('./pages/Encounters'),
  '/communications': () => import('./pages/Communications'),
  '/finance': () => import('./pages/Finance'),
  '/stock': () => import('./components/stock/StockPage'),
  '/admin/practices': () => import('./pages/admin/PracticesManagement'),
  '/admin/tariffs': () => import('./pages/admin/TariffManagement'),
  '/admin/funds': () => import('./pages/admin/FundMaster'),
  '/admin/blueprint': () => import('./pages/admin/SystemBlueprint'),
  '/settings': () => import('./pages/Settings')
} as const;

export type PagePath = keyof typeof PAGE_LOADERS;

const requested = new Set<string>();

/** Starts downloading the page a link leads to (once). Unknown addresses and failures are ignored: opening retries. */
export function prefetchPage(pathname: string): void {
  const path = pathname.replace(/\/+$/, '') as PagePath;
  const load = PAGE_LOADERS[path];
  if (!load || requested.has(path)) return;
  requested.add(path);
  load().catch(() => requested.delete(path));
}
