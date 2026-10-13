import React from 'react';
import { Link } from 'react-router-dom';
import { invoiceLink } from '../billing/invoiceLinks';
import type { DispensingBilling } from '../../utils/stock/dispensingStatus';
import { Chip } from './stockParts';
import { LINK } from './stockUi';

/** Where a dispensed medicine stands on the bill, in words (with the invoice linked when there is one) */
export const BillingChip: React.FC<{ billing: DispensingBilling }> = ({ billing }) => {
  switch (billing.state) {
    case 'billed':
      return <Link to={invoiceLink(billing.invoiceId)} className={`${LINK} text-xs`}>Billed on {billing.invoiceNumber || 'the visit\'s invoice'}</Link>;
    case 'on_bill_unsaved':
      return <Chip tone="cyan">On this visit&apos;s bill: charged when the visit is saved</Chip>;
    case 'not_on_bill':
      return <Chip tone="red">Not on a bill yet</Chip>;
    case 'given':
      return <Chip tone="gray">Given without billing</Chip>;
    case 'cancelled':
      return <Chip tone="gray">Cancelled</Chip>;
  }
};
