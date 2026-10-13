/**
 * Ready-made lists staff can create in one click, and the look of each kind of list.
 * Every preset starts with automatic sending OFF: nothing is sent until someone checks the
 * message and switches it on.
 */
import { DEFAULT_AUTOMATION, type ListAutomationSettings } from '../../utils/patientLists/listAutomation';
import type { SmartRule, SmartRuleType } from '../../utils/patientLists/listRules';
import { isDentalPractice, isOptometryPractice } from '../../utils/billing/tariffRules';

export interface ListLook {
  icon: string;
  /** Tailwind classes for the icon tile */
  tile: string;
  /** Tailwind class for the icon colour */
  iconColor: string;
}

export const LIST_LOOKS: Record<SmartRuleType | 'manual', ListLook> = {
  birthday: { icon: 'solar:gift-bold-duotone', tile: 'bg-rose-50 ring-rose-100', iconColor: 'text-rose-500' },
  recall_due: { icon: 'solar:calendar-mark-bold-duotone', tile: 'bg-cyan-50 ring-cyan-100', iconColor: 'text-cyan-600' },
  recall_by_code: { icon: 'solar:calendar-mark-bold-duotone', tile: 'bg-teal-50 ring-teal-100', iconColor: 'text-teal-600' },
  lapsed: { icon: 'solar:hourglass-line-bold-duotone', tile: 'bg-amber-50 ring-amber-100', iconColor: 'text-amber-600' },
  outstanding_balance: {
    icon: 'solar:wallet-money-bold-duotone',
    tile: 'bg-emerald-50 ring-emerald-100',
    iconColor: 'text-emerald-600'
  },
  missed_appointment: {
    icon: 'solar:calendar-search-bold-duotone',
    tile: 'bg-orange-50 ring-orange-100',
    iconColor: 'text-orange-500'
  },
  regular_follow_up: { icon: 'solar:heart-pulse-bold-duotone', tile: 'bg-violet-50 ring-violet-100', iconColor: 'text-violet-600' },
  repeat_medicine_due: { icon: 'solar:pills-3-bold-duotone', tile: 'bg-emerald-50 ring-emerald-100', iconColor: 'text-emerald-600' },
  contact_lenses_running_out: { icon: 'solar:eye-scan-bold-duotone', tile: 'bg-sky-50 ring-sky-100', iconColor: 'text-sky-600' },
  manual: { icon: 'solar:clipboard-list-bold-duotone', tile: 'bg-indigo-50 ring-indigo-100', iconColor: 'text-indigo-600' }
};

export const lookFor = (rule: SmartRule | null): ListLook => LIST_LOOKS[rule?.type ?? 'manual'];

export interface ListPreset {
  id: string;
  name: string;
  /** One line under the name on the preset tile */
  blurb: string;
  rule: SmartRule;
  automation: ListAutomationSettings;
  /** Staff type the tariff codes before the list is created (recall by treatment outside dentistry) */
  askForCodes?: boolean;
}

const BIRTHDAY_MESSAGE =
  'Happy birthday, {{first_name}}! Everyone at {{practice_name}} wishes you a healthy and happy year ahead.';

const birthdayAutomation: ListAutomationSettings = {
  ...DEFAULT_AUTOMATION,
  template: BIRTHDAY_MESSAGE,
  schedule: 'birthday_morning',
  sendTime: '08:00',
  repeat: 'year'
};

export const LIST_PRESETS: readonly ListPreset[] = [
  {
    id: 'birthdays_today',
    name: 'Birthdays today',
    blurb: 'Greet patients on their birthday',
    rule: { type: 'birthday', window: 'today' },
    automation: birthdayAutomation
  },
  {
    id: 'birthdays_this_week',
    name: 'Birthdays this week',
    blurb: 'Monday to Sunday, greeted on the day',
    rule: { type: 'birthday', window: 'this_week' },
    automation: birthdayAutomation
  },
  {
    id: 'birthdays_this_month',
    name: 'Birthdays this month',
    blurb: 'The whole month, greeted on the day',
    rule: { type: 'birthday', window: 'this_month' },
    automation: birthdayAutomation
  },
  {
    id: 'recall_due',
    name: 'Recall due',
    blurb: 'No completed visit in 6 months, nothing booked',
    rule: { type: 'recall_due', months: 6, visitTypes: [] },
    automation: {
      ...DEFAULT_AUTOMATION,
      template:
        "Hi {{first_name}}, it's time for your check-up at {{practice_name}}. Please call {{practice_phone}} to book a time that suits you.",
      schedule: 'daily',
      sendTime: '09:00',
      repeat: 'month'
    }
  },
  {
    id: 'recall_by_code',
    name: 'Recall by treatment',
    blurb: 'Scale and polish (8159) 6+ months ago, nothing booked',
    rule: { type: 'recall_by_code', months: 6, codes: ['8159'] },
    automation: {
      ...DEFAULT_AUTOMATION,
      template:
        "Hi {{first_name}}, it's time for your next visit at {{practice_name}}. Please call {{practice_phone}} to book a time that suits you.",
      schedule: 'daily',
      sendTime: '09:00',
      repeat: 'month'
    }
  },
  {
    id: 'lapsed',
    name: 'Lapsed patients',
    blurb: 'Not seen for 12 months or more',
    rule: { type: 'lapsed', months: 12 },
    automation: {
      ...DEFAULT_AUTOMATION,
      template:
        "Hi {{first_name}}, we haven't seen you at {{practice_name}} for a while. We're here when you need us: call {{practice_phone}} to book.",
      repeat: 'year'
    }
  },
  {
    id: 'outstanding_balance',
    name: 'Outstanding balance',
    blurb: 'Owing for more than 30 days',
    rule: { type: 'outstanding_balance', minDays: 30, minAmount: 1 },
    automation: {
      ...DEFAULT_AUTOMATION,
      template:
        'Hi {{first_name}}, a friendly reminder from {{practice_name}}: your account shows {{balance}} outstanding. Questions? Call {{practice_phone}}.',
      repeat: 'month'
    }
  },
  {
    id: 'missed_appointment',
    name: 'Missed appointment',
    blurb: 'No-shows of the last 14 days, not rebooked',
    rule: { type: 'missed_appointment', withinDays: 14 },
    automation: {
      ...DEFAULT_AUTOMATION,
      template:
        'Hi {{first_name}}, we missed you at {{practice_name}} on {{missed_date}}. Please call {{practice_phone}} to book a new time.',
      schedule: 'daily',
      sendTime: '10:00',
      repeat: 'week'
    }
  },
  {
    id: 'regular_follow_up',
    name: 'Regular follow-up due',
    blurb: 'Regular patients, last visit 30+ days ago',
    rule: { type: 'regular_follow_up', everyDays: 30, minVisitsInYear: 3 },
    automation: {
      ...DEFAULT_AUTOMATION,
      template:
        "Hi {{first_name}}, it's time for your regular follow-up at {{practice_name}}. Please call {{practice_phone}} to book.",
      repeat: 'month'
    }
  }
];

/** For a practice that dispenses (Stock > Settings): patients whose repeat medicine is due this week */
export const REPEAT_MEDICINE_PRESET: ListPreset = {
  id: 'repeat_medicine_due',
  name: 'Repeat medicine due',
  blurb: 'A repeat falls due in the next 7 days, or is overdue',
  rule: { type: 'repeat_medicine_due', withinDays: 7 },
  automation: {
    ...DEFAULT_AUTOMATION,
    template:
      'Hi {{first_name}}, your repeat medicine at {{practice_name}} is due. Please call {{practice_phone}} or come in to collect it.',
    schedule: 'daily',
    sendTime: '09:00',
    repeat: 'month'
  }
};

/** For an optometry practice: patients whose contact lenses run out in the next two weeks, or ran out lately */
export const CONTACT_LENS_PRESET: ListPreset = {
  id: 'contact_lenses_running_out',
  name: 'Contact lenses running out',
  blurb: 'Lenses run out in the next 14 days, or ran out lately',
  rule: { type: 'contact_lenses_running_out', withinDays: 14 },
  automation: {
    ...DEFAULT_AUTOMATION,
    template:
      'Hi {{first_name}}, your contact lenses from {{practice_name}} are running out. Please call {{practice_phone}} to order more.',
    schedule: 'daily',
    sendTime: '09:00',
    repeat: 'month'
  }
};

/**
 * The ready-made lists for this practice. The treatment recall starts from scale and polish (8159) for a dental
 * practice; any other practice types its own codes, because each discipline bills its own NAMAF schedule. An
 * optometry practice also gets "Contact lenses running out", and a practice that dispenses "Repeat medicine due".
 */
export function presetsFor(practiceType: string | null | undefined, options: { dispenses?: boolean } = {}): readonly ListPreset[] {
  const base = isDentalPractice(practiceType)
    ? LIST_PRESETS
    : LIST_PRESETS.map((preset) =>
        preset.rule.type === 'recall_by_code'
          ? { ...preset, blurb: 'Had a treatment you choose 6+ months ago, nothing booked', rule: { ...preset.rule, codes: [] }, askForCodes: true }
          : preset
      );
  const withDiscipline = isOptometryPractice(practiceType) ? [...base, CONTACT_LENS_PRESET] : base;
  return options.dispenses ? [...withDiscipline, REPEAT_MEDICINE_PRESET] : withDiscipline;
}

/** Settings for a new hand-picked list: "only once per patient", sent when staff press Send now. */
export const MANUAL_LIST_AUTOMATION: ListAutomationSettings = {
  ...DEFAULT_AUTOMATION,
  template: 'Hi {{first_name}}, ',
  repeat: 'ever'
};

/** "Recall due", or "Recall due 2" when that name is taken (names are unique per practice). */
export function uniqueListName(base: string, existingNames: readonly string[]): string {
  const taken = new Set(existingNames.map((name) => name.trim().toLowerCase()));
  const trimmed = base.trim();
  if (!taken.has(trimmed.toLowerCase())) return trimmed;
  for (let n = 2; ; n += 1) {
    const candidate = `${trimmed} ${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}
