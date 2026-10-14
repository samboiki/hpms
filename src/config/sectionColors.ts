/**
 * Section colours: the one place that says which colour each part of the app is. The sidebar, the dashboard tiles
 * and each section page's header icon and selected main tab read from here, so a section looks the same wherever
 * it appears (the owner, October 2026: Finance was green on the dashboard but blue on its own page, and Stock
 * shared Finance's green).
 *
 * Tailwind only keeps classes it finds written out in full in the source: every stop below is spelled out, and a
 * class is never built from pieces such as `from-${hue}-500`.
 */
export type SectionKey = 'patients' | 'encounters' | 'messages' | 'finance' | 'inpatient' | 'stock';

/** Tone of a section's own tiles and card icons (one of the tones in src/components/ui/tileTones.ts) */
export type SectionTone = 'violet' | 'blue' | 'orange' | 'green' | 'red' | 'slate';

export interface SectionColor {
  /** What people call it: "Green" */
  name: string;
  /** Gradient stops, for components that choose their own direction (the dashboard tile) */
  from: string;
  to: string;
  /** Header icon box, the sidebar chip of the open section, and the section's icon inside other screens */
  iconBox: string;
  /** The selected main tab (PageTabs `activeClassName`) */
  activeTab: string;
  /** Icons in the section colour on a white background */
  text: string;
  tone: SectionTone;
  /** The two stops as hex, for inline styles (the dashboard tile's decorations) */
  hex: readonly [string, string];
}

const section = (name: string, from: string, to: string, text: string, tone: SectionTone, hex: readonly [string, string]): SectionColor => ({
  name,
  from,
  to,
  iconBox: `bg-gradient-to-br ${from} ${to}`,
  activeTab: `bg-gradient-to-r ${from} ${to}`,
  text,
  tone,
  hex
});

export const SECTION_COLORS: Readonly<Record<SectionKey, SectionColor>> = {
  patients: section('Purple', 'from-purple-500', 'to-indigo-600', 'text-purple-600', 'violet', ['#a855f7', '#4f46e5']),
  encounters: section('Blue', 'from-cyan-500', 'to-blue-500', 'text-blue-600', 'blue', ['#06b6d4', '#3b82f6']),
  messages: section('Orange', 'from-amber-500', 'to-orange-600', 'text-orange-600', 'orange', ['#f59e0b', '#ea580c']),
  finance: section('Green', 'from-emerald-500', 'to-teal-600', 'text-emerald-600', 'green', ['#10b981', '#0d9488']),
  // Wards and beds (October 2026): a rose no other section uses. Its tiles take the red tone, the closest tile tone
  inpatient: section('Rose', 'from-rose-500', 'to-pink-600', 'text-rose-600', 'red', ['#f43f5e', '#db2777']),
  // Its own colour since October 2026 (it was Finance's green): a steel blue-grey no other section uses. Not rose or
  // red, which on the Stock page itself mean "expired"; not amber, which means "low"
  stock: section('Slate', 'from-slate-500', 'to-slate-700', 'text-slate-600', 'slate', ['#64748b', '#334155'])
};

/**
 * Pages that are not a section (the Dashboard, Settings, the admin pages) wear the app's own purple on their header
 * icon, selected tab and profile ring. Kept apart from SECTION_COLORS: no sidebar chip or dashboard tile takes it.
 */
export const APP_COLOR: SectionColor = section('Purple', 'from-purple-500', 'to-indigo-600', 'text-purple-600', 'violet', ['#a855f7', '#4f46e5']);
