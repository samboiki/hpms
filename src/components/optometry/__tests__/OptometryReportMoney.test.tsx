import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

// Two invented frames sold this month; whether this person may see Finance's figures is set per test
const access = vi.hoisted(() => ({ seesMoney: false }));
vi.mock('../../../hooks/useScreenAccess', () => ({ useSeesFinanceFigures: () => access.seesMoney }));
vi.mock('../../../services/optometry/optometryService', () => ({ loadReportData: vi.fn(async () => ({ movements: [], frames: new Map(), latestRx: [], orders: [] })) }));
vi.mock('../../../utils/optometry/report', () => ({
  framesSold: () => ({ units: 2, rows: [{ brand: 'Example', units: 2, costCents: 50000 }] }),
  presbyopiaByAge: () => ({ presbyopic: 0, withPrescription: 0, rows: [], unknownAge: 0 }),
  labTurnaround: () => ({ orders: 0, backFromLab: 0, averageDaysAtLab: null, medianDaysAtLab: null, averageDaysToCollect: null, remakes: 0 })
}));
vi.mock('../ConsignmentView', () => ({ default: () => null }));
vi.mock('../FrameReports', () => ({ FrameSalesView: () => null, FramesByBarcodeView: () => null }));
vi.mock('../JobCostingView', () => ({ default: () => null }));
vi.mock('../PresbyopicList', () => ({ default: () => null }));

import OptometryReport from '../OptometryReport';

afterEach(cleanup);

describe('Optometry > Reports summary and Finance access', () => {
  // The summary showed the practice's frame costs to a role the practice keeps out of Finance, and offered a money
  // report that then did not open for them
  it('shows no costs and no money report to a role kept out of Finance', async () => {
    access.seesMoney = false;
    render(<OptometryReport practiceId="practice-1" today="2026-10-13" />);
    expect(await screen.findByText('Frames sold: 2')).toBeInTheDocument();
    expect(screen.queryByText('Cost to the practice')).toBeNull();
    expect(screen.queryByRole('button', { name: /Each frame, with its barcode/ })).toBeNull();
  });

  it('shows both to staff who see Finance', async () => {
    access.seesMoney = true;
    render(<OptometryReport practiceId="practice-1" today="2026-10-13" />);
    expect(await screen.findByText('Cost to the practice')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Each frame, with its barcode/ })).toBeInTheDocument();
  });
});
