/**
 * Where an invoice and everything around it can be opened (bi-directional links): the invoice in Finance, its visit,
 * the patient's billing, its claim batch, the quote it came from and the remittances. One place builds these links,
 * so every screen that shows one of them links back the same way.
 */

import { storeParam } from '../../utils/stock/stores';

const q = (value: string): string => encodeURIComponent(value);

/** The invoice's details in Finance > Invoicing. */
export const invoiceLink = (invoiceId: string): string => `/finance?tab=invoicing&invoice=${q(invoiceId)}`;

/** The visit, opened for editing in the patient's file (its Billing tab holds the invoice lines). */
export const visitLink = (patientId: string, visitId: string): string => `/patients/${q(patientId)}?visit=${q(visitId)}`;

/** The patient's file on the Billing tab: the owner's invoice table, every invoice of the patient. */
export const patientBillingLink = (patientId: string): string => `/patients?patientId=${q(patientId)}&tab=billing`;

/**
 * The patient's file on the Account tab, next to Billing (owner, 15 Oct 2026): the balance, payments and receipts,
 * statements, flags and family, payment plans, packages, referrals, authorisations, injury cases and quotes.
 */
export const patientAccountLink = (patientId: string): string => `/patients?patientId=${q(patientId)}&tab=account`;

/** The claim batch the invoice's lines were sent in, opened for review in Finance > Batches. */
export const claimBatchLink = (batchId: string): string => `/finance?tab=batch-management&batch=${q(batchId)}`;

/** Finance > Batches: claims gathered per fund, reviewed and sent from there. */
export const claimBatchesLink = (): string => '/finance?tab=batch-management';

/** Settings > Users, opened on its Payroll tab, where payroll and payslips are run. */
export const payrollLink = (): string => '/settings?tab=users&section=payroll';

/** Settings > Practice, opened on Practice Overhead (the practice's own expenses). */
export const practiceOverheadLink = (): string => '/settings?tab=practice&section=expenses';

/** Settings > Practice, opened on Inventory (the practice's older inventory list, before Stock). */
export const practiceInventoryLink = (): string => '/settings?tab=practice&section=inventory';

/** The diary with its settings open on Reminders (automatic appointment reminders are set up there). */
export const diaryReminderSettingsLink = (): string => '/?diarySettings=reminders';

/** The quote an invoice was made from, in Finance > Quotes. */
export const quoteLink = (quoteId: string): string => `/finance?tab=quotes&quote=${q(quoteId)}`;

/** Fund payments and responses (remittances). */
export const remittancesLink = (): string => '/finance?tab=remittances';

/** The claims the funds did not pay (Finance > Remittances > Rejections), optionally only one patient's. */
export const claimRejectionsLink = (patientId?: string | null): string =>
  `/finance?tab=remittances&section=rejections${patientId ? `&patient=${q(patientId)}` : ''}`;

/** A part of the Stock page: items, deliveries, transfers, count, reports, suppliers or settings. */
export const stockLink = (tab: 'items' | 'deliveries' | 'transfers' | 'count' | 'reports' | 'suppliers' | 'settings' = 'items'): string =>
  `/stock?tab=${q(tab)}`;

/** One stock count (open, posted or cancelled): its lines, who counted and who posted it. */
export const stockCountLink = (countId: string): string => `/stock?tab=count&count=${q(countId)}`;

/** One transfer between stores, by its id or its TRF number (as an item's history shows it). */
export const stockTransferLink = (transfer: string): string => `/stock?tab=transfers&transfer=${q(transfer)}`;

/** The Stock list showing one store's stock (null: the main store). */
export const stockStoreLink = (locationId: string | null): string => `/stock?tab=items&store=${q(storeParam(locationId))}`;

/** The transfers sent from or to one store (null: the main store). */
export const stockStoreTransfersLink = (locationId: string | null): string => `/stock?tab=transfers&store=${q(storeParam(locationId))}`;

/** A stock item with its history (every delivery, sale, dispensing and adjustment, each linking to its document). */
export const stockItemLink = (itemId: string): string => `/stock?tab=items&item=${q(itemId)}`;

/** A delivery or return to a supplier, with its lines and the supplier's payable. */
export const stockDeliveryLink = (deliveryId: string): string => `/stock?tab=deliveries&delivery=${q(deliveryId)}`;

/** A supplier with its deliveries, returns, orders and payables. */
export const supplierLink = (supplierId: string): string => `/stock?tab=suppliers&supplier=${q(supplierId)}`;

/** Payables (practice expenses), where a delivery's supplier invoice is marked paid: Finance > Ledgers > Expenses. */
export const payablesLink = (): string => '/finance?tab=ledgers&view=expenses';

/** Finance > Debtors on one view; a company or fund account (AC-...) opens under Companies when its id is given. */
export const debtorsLink = (view: 'ages' | 'credit' | 'statements' | 'companies' = 'ages', accountId?: string | null): string =>
  accountId ? `/finance?tab=debtors&view=companies&account=${q(accountId)}` : `/finance?tab=debtors&view=${q(view)}`;

/** The patient's file on the Medications tab: the medicines dispensed to them and their repeats. */
export const patientMedicinesLink = (patientId: string): string => `/patients?patientId=${q(patientId)}&tab=medications`;

/** The patient's file on the Teeth tab (dental practices): the tooth chart and the treatment plan. */
export const patientTeethLink = (patientId: string): string => `/patients?patientId=${q(patientId)}&tab=teeth`;

/** One dental lab order, shown first and highlighted under Lab work on the patient's Teeth tab. */
export const patientLabOrderLink = (patientId: string, orderId: string): string => `${patientTeethLink(patientId)}&labOrder=${q(orderId)}`;

/** The patient's file on the Eyes tab (optometry practices): prescriptions, lab orders, contact lenses and eye exams. */
export const patientEyesLink = (patientId: string): string => `/patients?patientId=${q(patientId)}&tab=eyes`;

/**
 * Optometry in Stock (optometry practices; the Optometry page was merged into Stock on 13 Oct 2026): lens orders to the
 * lab with the benefit notes, frames with their barcodes, or the optometry reports under Stock > Reports.
 */
export const optometryLink = (tab: 'orders' | 'frames' | 'reports' | 'notes' = 'orders'): string =>
  `/stock?tab=${tab === 'frames' ? 'frames' : tab === 'reports' ? 'reports' : 'lenses'}`;

/** Stock > Reports > Consignment frames: what is owed per supplier and the supplier invoices recorded. */
export const consignmentLink = (): string => `${optometryLink('reports')}&report=consignment`;

/** Where an old /optometry address (bookmarks, links in messages) opens now: the same part of Stock */
export function optometryRedirect(search: string): string {
  const params = new URLSearchParams(search);
  const tab = params.get('tab');
  const target = optometryLink(tab === 'frames' || tab === 'reports' || tab === 'notes' ? tab : 'orders');
  const report = params.get('report');
  return tab === 'reports' && report ? `${target}&report=${q(report)}` : target;
}

/** The patient's file on the Overview tab: letters, the messages they were sent, bookings and notes. */
export const patientOverviewLink = (patientId: string): string => `/patients?patientId=${q(patientId)}&tab=overview`;

/** Messages > Message log, for one patient when one is given. */
export const messageLogLink = (patientId?: string | null): string =>
  `/communications?tab=log${patientId ? `&patient=${q(patientId)}` : ''}`;

/** Messages > Lists, opened on one list when one is given (PatientListsPage reads ?list=). */
export const patientListsLink = (listId?: string | null): string =>
  `/communications?tab=lists${listId ? `&list=${q(listId)}` : ''}`;

/** Messages > Templates: the practice's letter, SMS and email templates. */
export const templatesLink = (): string => '/communications?tab=templates';
