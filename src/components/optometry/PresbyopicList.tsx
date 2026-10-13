import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { INPUT, LINK, day } from '../stock/stockUi';
import { patientEyesLink } from '../billing/invoiceLinks';
import { loadPatientNames } from '../../services/stock/stockService';
import { AGE_BANDS, NO_BIRTH_DATE_BAND, presbyopicPatients, type LatestSpectacleRx } from '../../utils/optometry/report';
import { presbyopicTable } from './optometryDocuments';
import { ExportButtons, NUM, TABLE_BOX, TD, TH } from './reportParts';

const BANDS = [...AGE_BANDS.map(band => band.label), NO_BIRTH_DATE_BAND];

/**
 * The presbyopic patients behind the summary's counts: everyone whose latest spectacle prescription has a reading
 * addition, youngest first (the ones who have just started to need reading glasses), by age group, each one tap from
 * their eye records. For recalls and for offering progressive lenses.
 */
const PresbyopicList: React.FC<{ practiceId: string; latest: readonly LatestSpectacleRx[]; today: string }> = ({ practiceId, latest, today }) => {
  const patients = useMemo(() => presbyopicPatients(latest, today), [latest, today]);
  const [band, setBand] = useState('');
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const ids = patients.map(patient => patient.patientId).join(',');

  useEffect(() => {
    if (!ids) return;
    let cancelled = false;
    loadPatientNames(ids.split(','))
      .then(result => !cancelled && setNames(result))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ids]);

  const shown = band ? patients.filter(patient => patient.band === band) : patients;

  return (
    <section aria-label="Presbyopic patients" className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <label className="text-sm sm:w-56">
          <span className="mb-1.5 block font-medium text-gray-700">Age group</span>
          <select className={INPUT} value={band} onChange={event => setBand(event.target.value)}>
            <option value="">All ages ({patients.length})</option>
            {BANDS.map(label => {
              const count = patients.filter(patient => patient.band === label).length;
              return count > 0 ? <option key={label} value={label}>{label} ({count})</option> : null;
            })}
          </select>
        </label>
        <ExportButtons practiceId={practiceId} disabled={shown.length === 0} log={{ report: 'optometry_presbyopic_patients' }} table={() => presbyopicTable(shown, today, names)} />
      </div>
      <p className="text-xs text-gray-500">Their latest spectacle prescription has a reading addition. Ages today; all dates, not only the period.</p>
      {shown.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500">No presbyopic patient{band ? ' in this age group' : ''} yet.</p>
      ) : (
        <div className={TABLE_BOX}>
          <table className="w-full min-w-[22rem]">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className={TH}>Patient</th>
                <th scope="col" className={`${TH} text-right`}>Age</th>
                <th scope="col" className={`${TH} text-right`}>Reading add</th>
                <th scope="col" className={TH}>Prescribed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shown.map(patient => (
                <tr key={patient.patientId}>
                  <td className={TD}><Link to={patientEyesLink(patient.patientId)} className={LINK}>{names.get(patient.patientId) ?? 'Patient'}</Link></td>
                  <td className={NUM}>{patient.age ?? '-'}</td>
                  <td className={NUM}>+{patient.add.toFixed(2)}</td>
                  <td className={`${TD} whitespace-nowrap`}>{patient.prescribedOn ? day(patient.prescribedOn) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default PresbyopicList;
