import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { optometryRedirect } from '../billing/invoiceLinks';

/**
 * The old Optometry page's address. Its parts now live in Stock (owner, 13 Oct 2026): lens orders and benefit notes
 * (Stock > Lens orders), frames (Stock > Frames) and the optometry reports (Stock > Reports). A bookmark or a link in
 * an old message opens the same part there; Stock's own access rule applies.
 */
const OptometryRedirect: React.FC = () => {
  const location = useLocation();
  return <Navigate to={optometryRedirect(location.search)} replace />;
};

export default OptometryRedirect;
