import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

// Invented figures only: 5 SMS this week, 2 of them failed; no email
const stats = vi.hoisted(() => ({
  sms: { total: 5, sent: 3, delivered: 0, failed: 2, blocked: 0, byType: {} },
  email: { total: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0, bounced: 0, spam: 0, byType: {} }
}));
vi.mock('../../../services/communicationService', () => ({
  communicationService: {
    getSMSStats: vi.fn().mockResolvedValue(stats.sms),
    getEmailStats: vi.fn().mockResolvedValue(stats.email),
    checkSMSSubscription: vi.fn().mockResolvedValue({ subscription: null }),
    checkEmailSubscription: vi.fn().mockResolvedValue({ subscription: null })
  }
}));
vi.mock('../../../contexts/PracticeContext', () => ({ usePractice: () => ({ practiceId: 'practice-1' }) }));

import { CommunicationsDashboard } from '../CommunicationsDashboard';

// The charts size themselves with a ResizeObserver, which jsdom lacks
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

afterEach(cleanup);

const openInsights = async (onOpenTab: (tab: string) => void) => {
  render(<CommunicationsDashboard onOpenTab={onOpenTab} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Insights' }));
};

describe('Messages dashboard quick links', () => {
  // "Configure Templates" opened Automations, where no template can be changed
  it('Configure Templates opens the Templates tab', async () => {
    const onOpenTab = vi.fn();
    await openInsights(onOpenTab);
    fireEvent.click(await screen.findByRole('button', { name: 'Configure Templates' }));
    expect(onOpenTab).toHaveBeenCalledWith('templates');
  });

  // "2 failed: check the cell numbers" named no patient: the Message log shows which messages failed and whose they were
  it('failed SMS link to the Message log, where staff see which ones failed', async () => {
    const onOpenTab = vi.fn();
    await openInsights(onOpenTab);
    expect(await screen.findByText(/2 failed: check the cell numbers/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'See them in the Message log →' }));
    expect(onOpenTab).toHaveBeenCalledWith('log');
  });
});
