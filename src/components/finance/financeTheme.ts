import type { AgingBucket, Funder, InvoiceStatus, PaymentMethodKey } from '../../services/ledgerService';

/**
 * Finance colours. Categorical sets were checked for colour-blind separation (adjacent pairs)
 * against a white card surface; colour always follows the entity (medical aid is the same cyan
 * in every chart) and every chart also has a labelled legend or table.
 */
export const FUNDER_META: Record<Funder, { label: string; color: string; icon: string; tint: string }> = {
  medical_aid: { label: 'Medical aid', color: '#0891B2', icon: 'solar:heart-pulse-bold-duotone', tint: 'bg-cyan-50' },
  patient: { label: 'Patient', color: '#F59E0B', icon: 'solar:user-bold-duotone', tint: 'bg-amber-50' }
};

export const PAYMENT_METHOD_META: Record<PaymentMethodKey, { label: string; color: string; icon: string; tint: string }> = {
  medical_aid: { label: 'Medical aid', color: '#0891B2', icon: 'solar:heart-pulse-bold-duotone', tint: 'bg-cyan-50' },
  card: { label: 'Card', color: '#7C3AED', icon: 'solar:card-bold-duotone', tint: 'bg-violet-50' },
  eft: { label: 'EFT', color: '#10B981', icon: 'solar:transfer-horizontal-bold-duotone', tint: 'bg-emerald-50' },
  cash: { label: 'Cash', color: '#F59E0B', icon: 'solar:wad-of-money-bold-duotone', tint: 'bg-amber-50' },
  other: { label: 'Other', color: '#DB2777', icon: 'solar:wallet-bold-duotone', tint: 'bg-pink-50' },
  not_recorded: { label: 'Not recorded', color: '#9CA3AF', icon: 'solar:question-circle-bold-duotone', tint: 'bg-gray-50' }
};

/** Ordinal ramp (one hue, light to dark): older debt reads darker */
export const AGING_COLORS: Record<AgingBucket, string> = {
  not_due: '#FB923C',
  days_0_30: '#EA580C',
  days_31_60: '#C2410C',
  days_61_90: '#9A3412',
  days_over_90: '#7C2D12'
};

export const INVOICE_STATUS_META: Record<InvoiceStatus, { label: string; badge: string; icon: string }> = {
  pending: { label: 'Pending', badge: 'bg-amber-100 text-amber-800', icon: 'solar:clock-circle-bold-duotone' },
  overdue: { label: 'Overdue', badge: 'bg-red-100 text-red-800', icon: 'solar:danger-circle-bold-duotone' },
  paid: { label: 'Paid', badge: 'bg-green-100 text-green-800', icon: 'solar:check-circle-bold-duotone' },
  cancelled: { label: 'Cancelled', badge: 'bg-gray-100 text-gray-700', icon: 'solar:close-circle-bold-duotone' }
};

/** Single-series charts: the brand cyan for emphasis, gray for context */
export const CHART = {
  accent: '#0891B2',
  accentSoft: '#A5F3FC',
  muted: '#D1D5DB',
  grid: '#F3F4F6',
  axis: '#9CA3AF',
  tick: { fill: '#9CA3AF', fontSize: 11 }
} as const;

/** Labels for practice_expenses.expense_type (same values as Settings > Practice Overhead) */
export const EXPENSE_TYPE_LABELS: Record<string, string> = {
  rent: 'Rent & lease',
  utilities: 'Utilities',
  insurance: 'Insurance',
  supplies: 'Medical supplies',
  equipment: 'Equipment',
  staff: 'Staff & payroll',
  professional_services: 'Professional services',
  marketing: 'Marketing',
  technology: 'Technology & IT',
  regulatory: 'Regulatory & compliance',
  maintenance: 'Maintenance',
  other: 'Other'
};

/** Labels for practice_inventory.category (same values as Settings > Inventory) */
export const INVENTORY_CATEGORY_LABELS: Record<string, string> = {
  disposables: 'Disposables',
  medications: 'Medications',
  office_supplies: 'Office supplies',
  equipment: 'Equipment',
  other: 'Other'
};

const titleCase = (value: string): string =>
  value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());

export const expenseTypeLabel = (type: string): string => EXPENSE_TYPE_LABELS[type] ?? titleCase(type);
export const inventoryCategoryLabel = (category: string): string => INVENTORY_CATEGORY_LABELS[category] ?? titleCase(category);
