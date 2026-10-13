import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// One invented frame on the wall
const auth = vi.hoisted(() => ({ role: 'receptionist' }));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (select: (state: { user: { role: string } }) => unknown) => select({ user: { role: auth.role } })
}));
vi.mock('../../../services/optometry/optometryService', () => ({
  loadFrames: vi.fn(async () => ({
    status: 'ready',
    frames: [
      {
        item: { id: 'item-1', name: 'Example Frame 52-18', barcode: null, sellingPriceCents: 150000 },
        details: { brand: 'Example', model: 'One', colour: null, size: null },
        onHand: 1,
        onOrder: 0,
        sold: 0,
        status: 'in_stock',
        inLedger: true,
        consignment: null
      }
    ]
  }))
}));
vi.mock('../../../services/optometry/frameUnitsService', () => ({ loadFrameUnits: vi.fn(async () => ({ status: 'not_set_up' })) }));
vi.mock('../../../services/stock/stockService', () => ({ loadStaffNames: vi.fn(async () => new Map()) }));
vi.mock('../FrameSheet', () => ({ default: () => null }));
vi.mock('../FrameUnitsList', () => ({ default: () => null }));
vi.mock('../ReceiveFramesSheet', () => ({ default: () => null }));
vi.mock('../ReturnFramesSheet', () => ({ default: () => null }));
vi.mock('../../labels/LabelPrintSheet', () => ({ LabelPrintSheet: () => null }));

import FramesPanel from '../FramesPanel';

afterEach(cleanup);

const renderAs = (role: string) => {
  auth.role = role;
  return render(
    <MemoryRouter>
      <FramesPanel practiceId="practice-1" />
    </MemoryRouter>
  );
};

describe('Optometry > Frames: who adds and changes frames', () => {
  // A frame is a stock item: the database lets a practice admin, doctor or nurse add or change it, so a receptionist
  // filled in the whole form only to be refused
  it('offers Add a frame and Change only to staff who may change stock items', async () => {
    renderAs('receptionist');
    expect(await screen.findByText('Example Frame 52-18')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add a frame/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull();
    cleanup();

    renderAs('nurse');
    expect(await screen.findByRole('button', { name: /Add a frame/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
  });
});
