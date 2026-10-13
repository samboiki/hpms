import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RegionSelect, TownPicker } from '../TownPicker';

// The town field of the patient forms (parity A16). The region a town is in is filled from the list, so reports by
// region count the patient in the right place even when reception never touches the region field.
const Harness: React.FC<{ onSubmit?: () => void }> = ({ onSubmit = vi.fn() }) => {
  const [town, setTown] = useState('');
  const [region, setRegion] = useState('');
  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="town">Town</label>
      <TownPicker
        id="town"
        value={town}
        onChange={setTown}
        onPick={(picked, pickedRegion) => {
          setTown(picked);
          setRegion(pickedRegion);
        }}
        inputClassName="input"
      />
      <label htmlFor="region">Region</label>
      <RegionSelect id="region" value={region} onChange={setRegion} className="input" />
    </form>
  );
};

afterEach(() => cleanup());

describe('TownPicker', () => {
  it('fills the region of the town picked from the list', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Town'), { target: { value: 'Oshak' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /Oshakati/ }));
    expect(screen.getByLabelText('Town')).toHaveValue('Oshakati');
    expect(screen.getByLabelText('Region')).toHaveValue('Oshana');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('picks with the keyboard, and Enter picks the town instead of submitting the form', () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const town = screen.getByLabelText('Town');
    fireEvent.change(town, { target: { value: 'Walvis' } });
    fireEvent.keyDown(town, { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(town).toHaveValue('Walvis Bay');
    expect(screen.getByLabelText('Region')).toHaveValue('Erongo');
  });

  it('takes the listed name and region when a known spelling is typed in full and the field is left', () => {
    render(<Harness />);
    const town = screen.getByLabelText('Town');
    fireEvent.change(town, { target: { value: 'luderitz' } });
    fireEvent.blur(town);
    expect(town).toHaveValue('Lüderitz');
    expect(screen.getByLabelText('Region')).toHaveValue('//Kharas');
  });

  it('keeps a place that is not on the list as typed, and leaves the region for reception to choose', () => {
    render(<Harness />);
    const town = screen.getByLabelText('Town');
    fireEvent.change(town, { target: { value: 'Cape Town' } });
    fireEvent.blur(town);
    expect(town).toHaveValue('Cape Town');
    expect(screen.getByLabelText('Region')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Region'), { target: { value: 'Khomas' } });
    expect(screen.getByLabelText('Region')).toHaveValue('Khomas');
  });

  it('offers only the 14 regions, so a saved region always passes the database check', () => {
    render(<Harness />);
    const options = [...(screen.getByLabelText('Region') as HTMLSelectElement).options].map(option => option.value).filter(Boolean);
    expect(options).toHaveLength(14);
    expect(options).toContain('//Kharas');
    expect(options).not.toContain('Caprivi');
  });
});
