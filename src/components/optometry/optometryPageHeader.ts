import type { FollowingPage } from '../access/ScreenAccessNotice';

/**
 * The Optometry page's header: the page shows it, and so does its route when the practice keeps a role out of Stock
 * (the page follows Stock's access). Kept apart from the page so the route does not load the page to say so.
 */
export const OPTOMETRY_PAGE: FollowingPage = {
  label: 'Optometry',
  icon: 'solar:glasses-bold-duotone',
  subtitle: 'Lab orders, frames, reports and optical benefit notes for the whole practice.'
};
