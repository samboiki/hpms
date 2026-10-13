/**
 * Who may do what with stock (users.role). The database enforces the same lists in its stock_ functions
 * (stock_assert_role, proposals/2026-10-07-dispensing-and-stock.sql); the screens use these to show only the
 * actions a person can complete.
 */

export type StockAction =
  | 'settings'
  | 'adjust'
  | 'post_count'
  | 'reverse_delivery'
  | 'keep_valuation'
  | 'edit_items'
  | 'dispense'
  | 'receive'
  | 'count'
  | 'order'
  | 'suppliers'
  | 'pay_suppliers';

const ANY_STAFF = ['admin', 'doctor', 'nurse', 'receptionist'] as const;

export const STOCK_ROLES: Readonly<Record<StockAction, readonly string[]>> = {
  settings: ['admin'],
  adjust: ['admin', 'doctor'],
  post_count: ['admin', 'doctor'],
  reverse_delivery: ['admin', 'doctor'],
  keep_valuation: ['admin', 'doctor'],
  edit_items: ['admin', 'doctor', 'nurse'],
  dispense: ['admin', 'doctor', 'nurse'],
  receive: ANY_STAFF,
  count: ANY_STAFF,
  order: ANY_STAFF,
  suppliers: ANY_STAFF,
  // Money out (stock_pay_supplier, stock_reverse_supplier_payment)
  pay_suppliers: ['admin', 'doctor']
};

export const canStock = (role: string | null | undefined, action: StockAction): boolean =>
  !!role && STOCK_ROLES[action].includes(role);

const ROLE_WORDS: Readonly<Record<string, string>> = { admin: 'practice admin', doctor: 'doctor', nurse: 'nurse', receptionist: 'receptionist' };

/** "Only a practice admin or doctor can do this", for a disabled button's explanation */
export function whoCan(action: StockAction): string {
  const roles = STOCK_ROLES[action];
  if (roles.length === ANY_STAFF.length) return 'Any staff member can do this.';
  const words = roles.map(role => ROLE_WORDS[role] ?? role);
  const list = words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`;
  return `Only a ${list} can do this.`;
}
