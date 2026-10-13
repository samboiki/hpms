import { describe, expect, it } from 'vitest';
import {
  canOpenScreen,
  parseScreenAccess,
  rolesAfterToggle,
  rolesInUse,
  screenForPath,
  screenGate,
  seesFinanceFigures,
  sidebarShowsPath,
  type ScreenAccess
} from '../screenAccess';

const receptionist = { role: 'receptionist', is_super_admin: false };
const doctor = { role: 'doctor', is_super_admin: false };
const admin = { role: 'admin', is_super_admin: false };
const support = { role: 'doctor', is_super_admin: true };
const ready = (access: ScreenAccess) => ({ status: 'ready' as const, access });

// The owner has not chosen role rights: a practice that never opened Screen access must work exactly as before
describe('until an administrator chooses, nothing changes', () => {
  it('lets every role open Finance and Stock when nothing is stored', () => {
    for (const user of [receptionist, doctor, { role: 'nurse' }]) {
      expect(canOpenScreen(user, 'finance', {})).toBe(true);
      expect(canOpenScreen(user, 'stock', {})).toBe(true);
    }
  });

  it('reads a missing or unreadable setting as "nothing chosen"', () => {
    expect(parseScreenAccess(null)).toEqual({});
    expect(parseScreenAccess('finance')).toEqual({});
    expect(parseScreenAccess(['doctor'])).toEqual({});
  });

  it('keeps a screen nobody chose for open while another one is limited', () => {
    const access = parseScreenAccess({ stock: ['doctor'] });
    expect(canOpenScreen(receptionist, 'finance', access)).toBe(true);
    expect(canOpenScreen(receptionist, 'stock', access)).toBe(false);
  });
});

describe('once chosen, only the ticked roles and administrators open the screen', () => {
  const access = parseScreenAccess({ finance: ['doctor'] });

  it('closes Finance to a receptionist the practice left out and keeps it open for a doctor it ticked', () => {
    expect(canOpenScreen(receptionist, 'finance', access)).toBe(false);
    expect(canOpenScreen(doctor, 'finance', access)).toBe(true);
  });

  // An administrator can never lock themselves (or the practice) out of its own money and stock
  it('always lets administrators and OneHealth support in, even when no role is ticked', () => {
    const closed = parseScreenAccess({ finance: [], stock: [] });
    expect(canOpenScreen(admin, 'finance', closed)).toBe(true);
    expect(canOpenScreen(support, 'stock', closed)).toBe(true);
    expect(canOpenScreen(doctor, 'finance', closed)).toBe(false);
  });

  it('lets nobody in who is not signed in', () => {
    expect(canOpenScreen(null, 'finance', {})).toBe(false);
  });

  // Only the database writes the setting, but a hand-edited value must not reopen a screen the practice closed
  it('treats a damaged entry as "administrators only" and ignores unknown roles and screens', () => {
    expect(parseScreenAccess({ finance: 'doctor' })).toEqual({ finance: [] });
    expect(parseScreenAccess({ finance: ['doctor', 'admin', 'owner'], reports: ['nurse'] })).toEqual({ finance: ['doctor'] });
  });
});

describe('the route explains instead of showing a screen it should not', () => {
  it('opens at once for administrators, without waiting for the setting', () => {
    expect(screenGate(admin, 'finance', { status: 'loading', access: {} })).toBe('open');
    expect(screenGate(support, 'stock', { status: 'error', access: {} })).toBe('open');
  });

  // A receptionist must not glimpse the money screen before the practice's choice arrives
  it('waits while the choice is read and asks to try again when it cannot be read', () => {
    expect(screenGate(receptionist, 'finance', { status: 'loading', access: {} })).toBe('checking');
    expect(screenGate(receptionist, 'finance', { status: 'error', access: {} })).toBe('unchecked');
  });

  it('opens or closes by the practice choice once it is known', () => {
    const access = parseScreenAccess({ finance: ['doctor'] });
    expect(screenGate(doctor, 'finance', ready(access))).toBe('open');
    expect(screenGate(receptionist, 'finance', ready(access))).toBe('closed');
  });
});

describe('the sidebar hides what the person cannot open', () => {
  const access = parseScreenAccess({ finance: ['doctor'] });

  it('knows the Finance and Stock links and nothing else', () => {
    expect(screenForPath('/finance')).toBe('finance');
    expect(screenForPath('/stock')).toBe('stock');
    expect(screenForPath('/patients')).toBeNull();
  });

  it('hides Finance from a receptionist the practice left out, never other links', () => {
    expect(sidebarShowsPath(receptionist, '/finance', ready(access))).toBe(false);
    expect(sidebarShowsPath(receptionist, '/stock', ready(access))).toBe(true);
    expect(sidebarShowsPath(receptionist, '/patients', ready(access))).toBe(true);
  });

  // Hiding only once the choice is known: in the usual case (nothing chosen) the link never flickers away
  it('keeps the links as before while the choice is read or could not be read', () => {
    expect(sidebarShowsPath(receptionist, '/finance', { status: 'loading', access: {} })).toBe(true);
    expect(sidebarShowsPath(receptionist, '/finance', { status: 'error', access: {} })).toBe(true);
  });
});

describe('Screen access offers a box per role the practice uses', () => {
  // Administrators always have access, and a role nobody has (or only someone who left) would be a box with no effect
  it('lists the active staff roles other than administrator, in a fixed order', () => {
    const staff = [
      { role: 'receptionist', is_active: true },
      { role: 'admin', is_active: true },
      { role: 'nurse', is_active: false },
      { role: 'doctor', is_active: null }
    ];
    expect(rolesInUse(staff)).toEqual(['doctor', 'receptionist']);
  });
});

describe('ticking and unticking saves what the administrator sees', () => {
  const shown = ['doctor', 'receptionist'] as const;

  it('limits a screen to the boxes still ticked when one is unticked', () => {
    expect(rolesAfterToggle({}, 'finance', shown, 'receptionist', false)).toEqual(['doctor']);
    expect(rolesAfterToggle({ finance: ['doctor'] }, 'finance', shown, 'doctor', false)).toEqual([]);
  });

  // "Every box ticked" means open to everyone, also to a nurse the practice hires later
  it('opens the screen to every role again when every box is ticked', () => {
    expect(rolesAfterToggle({ finance: ['doctor'] }, 'finance', shown, 'receptionist', true)).toBeNull();
  });

  // A nurse who joins later starts without access to a screen the practice limited, until an administrator ticks it
  it('does not carry roles nobody has into a limited screen', () => {
    expect(rolesAfterToggle({}, 'stock', shown, 'doctor', false)).toEqual(['receptionist']);
  });

  it('changes only the screen whose box was clicked', () => {
    const access = parseScreenAccess({ stock: ['doctor'] });
    expect(rolesAfterToggle(access, 'finance', shown, 'doctor', false)).toEqual(['receptionist']);
  });
});

describe('money figures outside Finance follow who may open Finance', () => {
  const access = parseScreenAccess({ finance: ['doctor'] });

  // A practice that keeps reception out of Finance does not want its takings read off the dashboard or Settings instead
  it('hides them from a role the practice keeps out of Finance and shows them to a role it lets in', () => {
    expect(seesFinanceFigures(receptionist, ready(access))).toBe(false);
    expect(seesFinanceFigures(doctor, ready(access))).toBe(true);
  });

  it('shows them to administrators and OneHealth support at once, even when no role is ticked', () => {
    expect(seesFinanceFigures(admin, { status: 'loading', access: {} })).toBe(true);
    expect(seesFinanceFigures(support, ready(parseScreenAccess({ finance: [] })))).toBe(true);
  });

  // Unlike the sidebar link, a figure must not flash up and vanish for a role the practice turns out to keep out
  it('keeps them hidden while the choice is read or could not be read', () => {
    expect(seesFinanceFigures(receptionist, { status: 'loading', access: {} })).toBe(false);
    expect(seesFinanceFigures(receptionist, { status: 'error', access: {} })).toBe(false);
  });

  it('shows them to every role until the practice chooses, as before', () => {
    expect(seesFinanceFigures(receptionist, ready({}))).toBe(true);
    expect(seesFinanceFigures(null, ready({}))).toBe(false);
  });
});
