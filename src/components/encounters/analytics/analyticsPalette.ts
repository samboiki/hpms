/** Encounters > Analytics: the chart palette of the page's own look (release 645b348), and its wording of counts. */

/** "1 visit", "12 visits" */
export const visitsText = (count: number): string => `${count} ${count === 1 ? 'visit' : 'visits'}`;

// The analytics palette (charts and their legends)
export const COLORS = {
  primary: '#06B6D4',
  secondary: '#0891B2',
  tertiary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  purple: '#8B5CF6',
  indigo: '#6366F1',
  gray: {
    200: '#E5E7EB',
    600: '#4B5563',
    700: '#374151'
  }
};

/** One colour per slice of a ring chart, in the palette's order */
export const SLICE_COLORS = [COLORS.primary, COLORS.secondary, COLORS.tertiary, COLORS.purple, COLORS.indigo, COLORS.success, COLORS.warning, COLORS.danger];
