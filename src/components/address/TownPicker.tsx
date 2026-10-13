import React, { useId, useMemo, useState } from 'react';
import { NAMIBIAN_REGIONS, findPlace, pickPlace, searchPlaces, type NamibianRegion } from '../../utils/address/namibianTowns';

interface TownPickerProps {
  id: string;
  value: string;
  /** Every keystroke (a place not on the list can be typed) */
  onChange: (town: string) => void;
  /** A place picked from the list, or typed exactly: its name as listed and its region */
  onPick: (town: string, region: NamibianRegion) => void;
  /** The host form's input look */
  inputClassName: string;
  placeholder?: string;
  disabled?: boolean;
  describedBy?: string;
}

/**
 * The town field of an address (parity A16): type a few letters, pick the town or settlement, and its region is filled
 * in (onPick). Namibian places only, with their other spellings (Luderitz, Walvisbaai, Oshikango); any other place can
 * still be typed. Keyboard: arrows move through the list, Enter picks, Escape closes.
 */
export const TownPicker: React.FC<TownPickerProps> = ({ id, value, onChange, onPick, inputClassName, placeholder = 'Start typing the town', disabled, describedBy }) => {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const matches = useMemo(() => (open ? searchPlaces(value, 8) : []), [open, value]);
  const showList = open && matches.length > 0;

  const pick = (index: number) => {
    const match = matches[index];
    if (!match) return;
    const picked = pickPlace(match.place);
    onPick(picked.town, picked.region);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) setOpen(true);
      setActive(current => (matches.length ? (current + 1) % matches.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(current => (matches.length ? (current - 1 + matches.length) % matches.length : 0));
    } else if (event.key === 'Enter' && showList) {
      // Picks the town instead of submitting the form
      event.preventDefault();
      pick(active);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
    }
  };

  // Typed exactly as a listed place (any case, accents or other spelling): take its listed name and region
  const onBlur = () => {
    setOpen(false);
    const exact = findPlace(value);
    if (exact) onPick(exact.name, exact.region);
  };

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        aria-describedby={describedBy}
        className={inputClassName}
        placeholder={placeholder}
        value={value}
        maxLength={80}
        disabled={disabled}
        onChange={event => {
          onChange(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {matches.map((match, index) => (
            <li
              key={`${match.place.name}-${match.place.region}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              // Before the input's blur, so the click picks
              onMouseDown={event => {
                event.preventDefault();
                pick(index);
              }}
              onMouseEnter={() => setActive(index)}
              className={`flex cursor-pointer flex-wrap items-baseline justify-between gap-x-3 px-3 py-2 text-sm ${index === active ? 'bg-gray-100' : ''}`}
            >
              <span className="font-medium text-gray-900">
                {match.place.name}
                {match.matchedAlias && <span className="font-normal text-gray-500"> ({match.matchedAlias})</span>}
              </span>
              <span className="text-xs text-gray-500">{match.place.region}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

interface RegionSelectProps {
  id: string;
  value: string;
  onChange: (region: string) => void;
  className: string;
  disabled?: boolean;
}

/** The 14 regions (filled when a town is picked; chosen by hand for a place not on the list) */
export const RegionSelect: React.FC<RegionSelectProps> = ({ id, value, onChange, className, disabled }) => (
  <select id={id} className={className} value={value} onChange={event => onChange(event.target.value)} disabled={disabled}>
    <option value="">Not recorded</option>
    {NAMIBIAN_REGIONS.map(region => (
      <option key={region} value={region}>
        {region}
      </option>
    ))}
  </select>
);

export default TownPicker;
