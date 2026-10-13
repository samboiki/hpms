import React from 'react';
import { DENTITION_LABELS, type Dentition } from '../../utils/dental/fdi';

const DENTITIONS: readonly Dentition[] = ['adult', 'child', 'mixed'];

/** Which teeth the chart shows: adult (permanent), child (milk) or mixed (both, for a child between about 6 and 12). */
const DentitionSwitch: React.FC<{ value: Dentition; onChange: (value: Dentition) => void }> = ({ value, onChange }) => (
  <div className="inline-flex rounded-lg bg-gray-100 p-0.5" role="group" aria-label="Which teeth to show">
    {DENTITIONS.map(option => (
      <button
        key={option}
        type="button"
        aria-pressed={value === option}
        onClick={() => onChange(option)}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 motion-reduce:transition-none ${
          value === option ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        {DENTITION_LABELS[option]}
      </button>
    ))}
  </div>
);

export default DentitionSwitch;
