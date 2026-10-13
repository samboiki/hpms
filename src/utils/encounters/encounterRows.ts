/**
 * Rows of encounters_view. The view repeats a visit that has two invoices or two medical aid rows: the Encounters list
 * shows each visit once, so its count matches the visits (and the figure a list was opened from).
 */
export function onePerVisit<T extends { visit_id: string }>(rows: readonly T[]): T[] {
  const listed = new Set<string>();
  return rows.filter((row) => {
    if (listed.has(row.visit_id)) return false;
    listed.add(row.visit_id);
    return true;
  });
}

/** The payment column and export, in plain words; a visit without an invoice says so instead of "Pending". */
export function paymentStatusText(status: string | null | undefined, hasInvoice: boolean): string {
  switch (status) {
    case 'paid':
      return 'Paid';
    case 'pending':
      return 'Pending';
    case 'partial':
      return 'Part paid';
    case 'overdue':
      return 'Overdue';
    case 'cancelled':
      return 'Cancelled';
    default:
      return hasInvoice ? 'Pending' : 'No invoice';
  }
}
