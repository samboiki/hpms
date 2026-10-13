import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { format, addMinutes } from 'date-fns';
import { checkBooking, checkBookingSeries, findNextFreeSlotFor, loadBookedTimes, loadNoShowHistory, writeWithAppointmentType, writeWithBookingLength } from '../../services/diaryService';
import { bookableAppointmentTypes, describeAppointmentType, type AppointmentType } from '../../utils/diary/appointmentTypes';
import { alignToSlot, startStepFor } from '../../utils/diary/slotLength';
import { DEFAULT_REPEAT_RULE, describeRepeat, seriesWarnings, validateRepeatRule, type RepeatRule } from '../../utils/diary/repeatBookings';
import { RepeatBookingFields } from '../appointments/diary/RepeatBookingFields';
import { bookingProposalKey, describeNoShowHistory, type BookingWarning } from '../../utils/diary/bookingChecks';
import { blocksOverlapping } from '../../utils/diary/blockedTime';
import { defaultLengthFor } from '../../utils/diary/bookingLength';
import { formatDiaryDate, minutesToTime, parseDateKey, timeToMinutes } from '../../utils/diary/diaryTime';
import { diaryHolidayOn } from '../../utils/diary/holidays';
import { describeWorkingWeek, practitionerDayHours, workingHoursLabels } from '../../utils/diary/workingHours';
import type { BookingPrefill } from '../../utils/diary/bookingCopy';
import { bookingFormPractitioner, resolveDiaryView, sameDiaryView } from '../../utils/diary/diaryDefaultView';
import { useDiaryBlocks } from '../../hooks/useDiaryBlocks';
import { useDiaryDefault } from '../../hooks/useDiaryDefault';
import { useDiarySettings } from '../../hooks/useDiarySettings';
import { BookingWarningsPanel } from '../appointments/diary/BookingWarningsPanel';
import { PremiumTimeRangePicker } from '../ui/PremiumTimeRangePicker';
import { PremiumDatePickerModal } from '../ui/PremiumDatePickerModal';
import { AppointmentTypeModal } from '../ui/AppointmentTypeModal';
import { useAuthStore } from '../../stores/authStore';
import { useRecordChangeGuard } from '../records/RecordChangeGuard';
import { debounce } from 'lodash';
import { toast } from 'react-hot-toast';
import FormModal from '../modals/FormModal';
import AddPatientForm, { type CreatedPatient } from './AddPatientForm';
import QuickNewPatient, { type ChosenPatient } from './QuickNewPatient';
import { errorMessage } from './formErrors';
import { patientSearchFields, patientSearchRank, type PatientSearchRank } from '../../utils/patientSearch';
import { patientFileStatus } from '../../utils/patients/temporaryPatient';
import { PRACTITIONER_STAFF_COLUMNS, bookingPractitioners, type PractitionerOption, type PractitionerStaffRow } from './bookingPractitioners';
import { VideoBookingFields } from '../appointments/diary/VideoBookingFields';
import { VIDEO_NOT_SET_UP_MESSAGE, loadBookingVideoLink, loadPracticeVideoLink, videoBookingsNotSetUp, writeWithVideoLink } from '../../services/videoBookingService';
import { checkVideoLink } from '../../utils/diary/videoBookings';

interface AddAppointmentFormData {
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  end_time: string;
  duration: number;
  type: 'consultation' | 'follow-up' | 'procedure' | 'emergency';
  notes?: string;
}

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  id_number?: string | null;
  cell_number?: string | null;
  system_patient_reference_number?: number | null;
}

// What the patient search finds a patient by here (src/utils/patientSearch.ts): names, ID number, reference and cell
const PICKER_COLUMNS = 'id, first_name, last_name, id_number, cell_number, system_patient_reference_number';

// Before the practice's appointment types load (or when it has none): the same empty list on every render
const NO_APPOINTMENT_TYPES: AppointmentType[] = [];

// The diary's practitioners (bookingPractitioners): doctors, and anyone with working hours in Diary settings
type Doctor = PractitionerOption;

interface Props {
  onSuccess: (appointmentData?: any) => void;
  onCancel?: () => void;
  /** Editing: "Cancel Appointment" cancelled the booking (its time can go to the waiting list); then onSuccess */
  onCancelled?: () => void;
  /** The day to start on (default today); null leaves the date empty for reception to choose */
  initialDate?: Date | null;
  initialTime?: string;
  /** The practitioner the form was opened for (a diary column or slot, the booking being edited) */
  initialDoctorId?: string;
  initialPatientId?: string;
  initialType?: 'consultation' | 'follow-up' | 'procedure' | 'emergency';
  initialDuration?: number;
  initialNotes?: string;
  editingAppointmentId?: string;
  /** The practice's appointment type the booking being edited was made as (its length and daily limit apply) */
  initialAppointmentTypeId?: string;
  /**
   * "Book again" or a pasted copy (src/utils/diary/bookingCopy.ts): the patient, practitioner, type, length and reason
   * to start with. All stay editable; initialDoctorId (the column clicked) wins over the copy's practitioner.
   */
  prefill?: BookingPrefill;
}

const PremiumAddAppointmentForm: React.FC<Props> = ({
  onSuccess,
  onCancel,
  onCancelled,
  initialDate,
  initialTime,
  initialDoctorId,
  initialPatientId,
  initialType,
  initialDuration,
  initialNotes,
  editingAppointmentId,
  initialAppointmentTypeId,
  prefill
}) => {
  const { user } = useAuthStore();
  const [dataFetched, setDataFetched] = useState(false);
  // Who the form was opened for: the column or slot clicked, the booking being edited, else the copied booking's
  // practitioner. It is chosen straight away and wins over the user's default practitioner
  const openedForId = initialDoctorId || prefill?.practitionerId || undefined;
  // The booking's own length when editing it, else the copied booking's; otherwise its type's default applies
  const givenLength = initialDuration && initialDuration > 0 ? initialDuration : prefill?.durationMinutes;
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowPatientDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const { register, handleSubmit, formState: { errors }, watch, setValue, reset, clearErrors } = useForm<AddAppointmentFormData>({
    defaultValues: {
      date: initialDate ? format(initialDate, 'yyyy-MM-dd') : initialDate === null ? '' : format(new Date(), 'yyyy-MM-dd'),
      time: initialTime || '09:00', // Will be updated when business hours load
      end_time: '',
      duration: givenLength || 30,
      type: initialType || prefill?.type || 'consultation',
      doctor_id: openedForId || '',
      patient_id: initialPatientId || prefill?.patientId || '',
      notes: initialNotes || prefill?.reason || ''
    }
  });

  const [patients, setPatients] = useState<Patient[]>([]);
  // Everyone in the practice (any role, active or not): bookingPractitioners picks the diary's practitioners
  const [staffRows, setStaffRows] = useState<PractitionerStaffRow[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const initialDoctorAppliedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A copied booking's patient is shown by name straight away (and can still be cleared and changed)
  const [patientSearchTerm, setPatientSearchTerm] = useState(() => (initialPatientId ? '' : prefill?.patientName ?? ''));
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  // Remove this state - we'll use the memoized value directly
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [endTime, setEndTime] = useState<string>('');
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
  const [businessHours, setBusinessHours] = useState<{ start: string; end: string }>({ start: '08:00', end: '18:00' });
  const [allBusinessHours, setAllBusinessHours] = useState<any>(null);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  // "New patient: name and cell": a caller booked before they are registered in full
  const [isQuickPatientOpen, setIsQuickPatientOpen] = useState(false);
  // Weekday name when the chosen date falls on a day the practice is closed
  const [closedDay, setClosedDay] = useState<string | null>(null);
  const walkInSelectedRef = useRef(false);
  // The practice of the signed-in user, for the diary checks (blocked time, clashes, next free slot)
  const [practiceIdForChecks, setPracticeIdForChecks] = useState<string | null>(null);
  // What reception must confirm before saving; "Book anyway" saves exactly the booking it was shown for
  const [pendingWarnings, setPendingWarnings] = useState<{ key: string; warnings: BookingWarning[] } | null>(null);
  const [noShowNote, setNoShowNote] = useState<string | null>(null);
  const [isFindingSlot, setIsFindingSlot] = useState(false);
  // Repeat booking (new bookings only): every N days, weeks or months
  const [repeatOn, setRepeatOn] = useState(false);
  const [repeatRule, setRepeatRule] = useState<RepeatRule>(DEFAULT_REPEAT_RULE);
  // The practice's appointment type ("New patient"): it sets the visit type and the length, and its daily limit is
  // checked before saving. null: one of the four standard types
  const [appointmentTypeId, setAppointmentTypeId] = useState<string | null>(initialAppointmentTypeId ?? prefill?.appointmentTypeId ?? null);
  // Editing a booking: a change someone else saved after the form opened is never overwritten silently (parity Q12)
  const versionGuard = useRecordChangeGuard({
    reload: 'The form closes and the diary shows the booking as it is saved now. Open it again to make your change.',
    save: "This form's day, time, practitioner, type and reason replace the booking as it is saved now."
  });
  const { rememberCurrent: rememberBookingVersion } = versionGuard;
  useEffect(() => {
    // The diary that opened the form shows live bookings: the booking as saved now is what the form starts from
    if (editingAppointmentId) void rememberBookingVersion([{ kind: 'visit', id: editingAppointmentId }]);
  }, [editingAppointmentId, rememberBookingVersion]);
  // A video consultation keeps the room link the patient joins with (parity B16). A booking being changed keeps its
  // link unless reception changes it: until its link is read, saving leaves the link as it is
  const [videoOn, setVideoOn] = useState(false);
  const [videoLink, setVideoLink] = useState('');
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoKnown, setVideoKnown] = useState(!editingAppointmentId);
  const [videoNotSetUp, setVideoNotSetUp] = useState(false);
  useEffect(() => {
    if (!editingAppointmentId) return;
    let cancelled = false;
    void loadBookingVideoLink(editingAppointmentId).then((load) => {
      if (cancelled) return;
      if (load.state === 'ready') {
        setVideoOn(!!load.link);
        setVideoLink(load.link ?? '');
        setVideoKnown(true);
      } else if (load.state === 'not_set_up') {
        setVideoNotSetUp(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [editingAppointmentId]);
  // The practice's own room link (Diary settings > Appointment types), offered for every video booking
  const [practiceVideoLink, setPracticeVideoLink] = useState<string | null>(null);
  useEffect(() => {
    if (!practiceIdForChecks) return;
    let cancelled = false;
    void loadPracticeVideoLink(practiceIdForChecks).then((link) => {
      if (!cancelled) setPracticeVideoLink(link);
    });
    return () => {
      cancelled = true;
    };
  }, [practiceIdForChecks]);

  const selectedPatientId = watch('patient_id');
  const selectedDate = watch('date');
  const selectedTime = watch('time');
  const selectedDoctorId = watch('doctor_id');
  const selectedDuration = watch('duration');
  const selectedType = watch('type');
  // Default length per visit type and the practitioners' working hours (Diary settings)
  const diarySettings = useDiarySettings(practiceIdForChecks);
  const typeLengths = diarySettings.settings.lengths;
  // The practice's own appointment types (Diary settings) and the one chosen, if any
  const appointmentTypes = diarySettings.appointmentTypes ?? NO_APPOINTMENT_TYPES;
  const practiceTypes = useMemo(() => bookableAppointmentTypes(appointmentTypes), [appointmentTypes]);
  const chosenType = appointmentTypes.find(type => type.id === appointmentTypeId) ?? null;
  // Start times and "Next free slot" at the practitioner's diary slot (else every 15 minutes, as before)
  const startStep = startStepFor(diarySettings.settings.slots, selectedDoctorId);
  // The same practitioners as the diary's columns (active doctors, anyone with working hours), plus the one the form
  // was opened for, so a booking made in a nurse's column shows her name
  const doctors = useMemo<Doctor[]>(
    () => bookingPractitioners(staffRows, diarySettings.hours, openedForId),
    [staffRows, diarySettings.hours, openedForId]
  );
  // The user's default practitioner (src/utils/diary/diaryDefaultView.ts): a new booking starts with them when the
  // form was not opened for anyone and the default is one practitioner
  const diaryDefault = useDiaryDefault(user?.id);
  const activeStaffIds = useMemo(
    () => (staffRows.length > 0 ? staffRows.filter(row => row.is_active !== false).map(row => row.id) : null),
    [staffRows]
  );
  const defaultView = useMemo(
    () => resolveDiaryView({ role: user?.role, userId: user?.id, saved: diaryDefault.saved, activeStaffIds }),
    [user?.role, user?.id, diaryDefault.saved, activeStaffIds]
  );
  const defaultKnown = diaryDefault.status !== 'idle' && diaryDefault.status !== 'loading' && activeStaffIds !== null;
  const startPractitionerId = bookingFormPractitioner({
    openedForId,
    view: defaultKnown ? defaultView : null,
    optionIds: doctors.map(doctor => doctor.id)
  });
  const [isSavingDefault, setIsSavingDefault] = useState(false);
  // Once reception picks a length (or edits or copies a booking) the type's default no longer replaces it
  const lengthChosenRef = useRef(!!givenLength);

  // Fetch booked times when doctor or date changes
  useEffect(() => {
    if (selectedDoctorId && selectedDate) {
      fetchBookedTimes(selectedDoctorId, selectedDate);
    }
  }, [selectedDoctorId, selectedDate, typeLengths, startStep]);

  const fetchBookedTimes = async (doctorId: string, date: string) => {
    try {
      // Each booking is marked for its own length (else its type's default), not a fixed 30 minutes, at the
      // practitioner's slot (the time list's steps)
      setBookedTimes(await loadBookedTimes(doctorId, date, typeLengths, editingAppointmentId ?? null, startStep));
    } catch (err) {
      console.error('Error fetching booked times:', err);
      setBookedTimes([]);
      // With no booked times every slot looks free, so say that the list is incomplete
      toast.error(`Couldn't load the doctor's booked times, so taken slots aren't marked: ${errorMessage(err)}`);
    }
  };

  // A new booking's length: the practice's appointment type's ("New patient", 45 min), else its visit type's default
  // from Diary settings
  const typeLength = (): number => chosenType?.lengthMinutes ?? defaultLengthFor(selectedType, typeLengths);

  // The booking's first length: the one being edited (or copied) keeps its own, a new one its type's length
  // (reception can pick another)
  const startingLength = (): number =>
    givenLength && givenLength > 0 ? givenLength : typeLength();

  // Calculate end time whenever start time changes
  useEffect(() => {
    if (selectedTime && !endTime) {
      const start = timeToMinutes(selectedTime);
      if (start === null) return;
      const length = startingLength();
      const calculatedEndTime = minutesToTime(start + length);
      setEndTime(calculatedEndTime);
      setValue('end_time', calculatedEndTime);
      setValue('duration', length);
    }
  }, [selectedTime, setValue, endTime]);

  // A new booking follows its type's length (15 minutes for a follow-up, 45 for a "New patient", ...) until a length
  // is picked
  useEffect(() => {
    if (lengthChosenRef.current || editingAppointmentId) return;
    const start = timeToMinutes(selectedTime);
    if (start === null) return;
    const length = typeLength();
    const end = minutesToTime(start + length);
    if (end !== endTime) {
      setEndTime(end);
      setValue('end_time', end);
      setValue('duration', length);
    }
  }, [selectedType, typeLengths, selectedTime, chosenType]);

  // Fetch all data in parallel on mount
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        // Early return if no user or already fetched
        if (!user?.id) {
          console.log('Waiting for user authentication...');
          return;
        }
        
        if (dataFetched) {
          console.log('Data already fetched, skipping...');
          return;
        }

        // Get practice_id once
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('practice_id')
          .eq('id', user.id)
          .single();

        if (userError) {
          console.error('Error fetching user data:', userError);
          throw userError;
        }
        
        const practiceId = userData?.practice_id;
        if (!practiceId) {
          console.error('No practice_id found for user');
          toast.error("Your account isn't linked to a practice, so patients and practitioners can't be loaded.");
          setIsLoadingPatients(false);
          setIsLoadingDoctors(false);
          return;
        }
        setPracticeIdForChecks(practiceId);

        // Start loading states
        setIsLoadingPatients(true);
        setIsLoadingDoctors(true);

        // Fetch all data in parallel
        const [patientsResult, doctorsResult, practiceResult] = await Promise.all([
          // Fetch patients
          supabase
            .from('patients')
            .select(PICKER_COLUMNS)
            .eq('practice_id', practiceId)
            .order('last_name', { ascending: true }),
          
          // Fetch the practice's staff: bookingPractitioners keeps the diary's practitioners (deactivated staff only
          // when the form was opened for them, e.g. to edit their booking)
          supabase
            .from('users')
            .select(PRACTITIONER_STAFF_COLUMNS)
            .eq('practice_id', practiceId)
            .order('full_name', { ascending: true }),
          
          // Fetch practice for business hours
          supabase
            .from('practices')
            .select('business_hours')
            .eq('id', practiceId)
            .single()
        ]);

        // Process patients
        if (!patientsResult.error) {
          setPatients(patientsResult.data || []);
          console.log('Loaded patients:', patientsResult.data?.length);
        } else {
          console.error('Error loading patients:', patientsResult.error);
          // Otherwise the search says "No patients found" and invites registering a duplicate
          toast.error(`Couldn't load the patient list: ${errorMessage(patientsResult.error)}`);
        }
        setIsLoadingPatients(false);

        // Process the staff (the practitioner list follows from them and the working hours)
        if (!doctorsResult.error) {
          setStaffRows(doctorsResult.data || []);
        } else {
          console.error('Error loading practitioners:', doctorsResult.error);
          toast.error(`Couldn't load the list of practitioners: ${errorMessage(doctorsResult.error)}`);
        }
        setIsLoadingDoctors(false);

        // Process business hours
        if (!practiceResult.error && practiceResult.data?.business_hours) {
          const hours = practiceResult.data.business_hours;
          setAllBusinessHours(hours);
          
          // Set initial business hours
          const today = new Date();
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const currentDay = dayNames[today.getDay()];
          
          let dayHours = hours[currentDay];
          if (!dayHours || dayHours.closed) {
            dayHours = hours.monday || Object.values(hours).find((h: any) => h && !h.closed && h.open && h.close);
          }
          
          if (dayHours && dayHours.open && dayHours.close) {
            setBusinessHours({
              start: dayHours.open,
              end: dayHours.close
            });
          }
        }
        
        // Mark data as fetched
        setDataFetched(true);
      } catch (error) {
        console.error('Error fetching initial data:', error);
        toast.error(`Couldn't load the appointment form: ${errorMessage(error)}`);
        setIsLoadingPatients(false);
        setIsLoadingDoctors(false);
      }
    };

    fetchAllData();
  }, [user, dataFetched]);

  // Update default time when business hours are loaded
  useEffect(() => {
    if (!initialTime && businessHours.start !== '08:00') {
      // Only update if no initial time was provided and business hours have been fetched
      setValue('time', businessHours.start);
    }
  }, [businessHours, initialTime, setValue]);

  // Update business hours when selected date changes
  useEffect(() => {
    if (selectedDate && allBusinessHours) {
      const date = new Date(selectedDate);
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[date.getDay()];
      
      const dayHours = allBusinessHours[dayName];
      
      if (dayHours && !dayHours.closed && dayHours.open && dayHours.close) {
        setClosedDay(null);
        setBusinessHours({
          start: dayHours.open,
          end: dayHours.close
        });
      } else {
        // If selected day is closed, show a message or use default hours
        console.log(`Practice is closed on ${dayName}`);
        setClosedDay(dayName);
        // You might want to show an error or warning to the user
        // For now, let's use the default working hours
        const defaultDay = allBusinessHours.monday || allBusinessHours.tuesday || 
                          allBusinessHours.wednesday || allBusinessHours.thursday || 
                          allBusinessHours.friday;
        if (defaultDay && defaultDay.open && defaultDay.close) {
          setBusinessHours({
            start: defaultDay.open,
            end: defaultDay.close
          });
        }
      }
    }
  }, [selectedDate, allBusinessHours]);

  // Auto-select doctor if only one available, else the one the form was opened for or the user's default
  useEffect(() => {
    if (doctors.length === 0) return;

    // The practitioner the form starts with (the column or booking it was opened for, else the user's default) is
    // chosen once: applying it on every change put it back each time reception picked someone else, so a booking could
    // not be moved to another practitioner. The default never replaces a practitioner reception already chose.
    if (startPractitionerId && !initialDoctorAppliedRef.current && (openedForId || !selectedDoctorId)) {
      const doctor = doctors.find(d => d.id === startPractitionerId);
      if (doctor) {
        initialDoctorAppliedRef.current = true;
        setValue('doctor_id', startPractitionerId);
        setSelectedDoctor(doctor);
      }
    }
    // If only one doctor available and no doctor selected yet
    else if (doctors.length === 1 && !selectedDoctorId) {
      setValue('doctor_id', doctors[0].id);
      setSelectedDoctor(doctors[0]);
    }
    // Update selected doctor object when ID changes
    else if (selectedDoctorId) {
      const doctor = doctors.find(d => d.id === selectedDoctorId);
      if (doctor) setSelectedDoctor(doctor);
    }
  }, [doctors, startPractitionerId, openedForId, selectedDoctorId, setValue]);

  // Set initial patient
  useEffect(() => {
    if (initialPatientId && patients.length > 0 && !patientSearchTerm) {
      const selectedPatient = patients.find(p => p.id === initialPatientId);
      if (selectedPatient) {
        setPatientSearchTerm(`${selectedPatient.first_name} ${selectedPatient.last_name}`);
        setValue('patient_id', initialPatientId);
      }
    }
  }, [initialPatientId, patients, patientSearchTerm, setValue]);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(patientSearchTerm);
    }, 100); // Fast debounce for responsive feel
    
    return () => clearTimeout(timer);
  }, [patientSearchTerm]);

  // Optimized patient filtering with memoization
  const filteredPatients = useMemo(() => {
    if (!debouncedSearchTerm || selectedPatientId) {
      return patients.slice(0, 10); // Show limited results initially
    }

    // The Patients page's search: name, ID number, reference or cell; exact matches first, then starts-with, then
    // contains (the sort is stable, so each group stays in surname order)
    return patients
      .map(patient => ({ patient, rank: patientSearchRank(patientSearchFields(patient), debouncedSearchTerm) }))
      .filter((entry): entry is { patient: Patient; rank: PatientSearchRank } => entry.rank !== null)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 20) // Limit results for performance
      .map(entry => entry.patient);
  }, [debouncedSearchTerm, patients, selectedPatientId]);

  // A file opened with a name and cell only: reception completes it when the patient arrives
  const selectedFileStatus = useMemo(
    () => patientFileStatus(patients.find(patient => patient.id === selectedPatientId)),
    [patients, selectedPatientId]
  );

  // Remove individual fetch functions - they're now handled in the parallel fetch

  // The practitioner's own hours that day: undefined = none saved (the opening hours apply), null = day off
  const practitionerDay = useMemo(
    () => (selectedDoctorId && selectedDate ? practitionerDayHours(diarySettings.hours, selectedDoctorId, selectedDate) : undefined),
    [diarySettings.hours, selectedDoctorId, selectedDate]
  );
  const practitionerWeek = selectedDoctorId ? describeWorkingWeek(diarySettings.hours, selectedDoctorId) : null;
  // The time list covers the opening hours and the practitioner's own hours (they may start earlier), starting on
  // the practitioner's slot so its times meet the hour
  const pickerRange = useMemo(() => {
    const open = timeToMinutes(businessHours.start) ?? 8 * 60;
    const close = timeToMinutes(businessHours.end) ?? 18 * 60;
    return practitionerDay
      ? { start: alignToSlot(Math.min(open, practitionerDay.open), startStep), end: Math.max(close, practitionerDay.close) }
      : { start: alignToSlot(open, startStep), end: close };
  }, [businessHours, practitionerDay, startStep]);

  // Blocked time, breaks and time outside the practitioner's hours on the chosen day, so the time list
  // can show them (all stay selectable: saving asks first)
  const dayBlocks = useDiaryBlocks(selectedDate ? practiceIdForChecks : null, selectedDate, selectedDate);
  const blockedTimes = useMemo(() => {
    const labels: Record<string, string> = workingHoursLabels(practitionerDay, pickerRange.start, pickerRange.end, startStep);
    if (!selectedDoctorId || dayBlocks.blocks.length === 0) return labels;
    for (let start = pickerRange.start; start <= pickerRange.end; start += startStep) {
      const block = blocksOverlapping(dayBlocks.blocks, selectedDate, start, start + startStep, selectedDoctorId)[0];
      if (block) labels[minutesToTime(start)] = block.reason;
    }
    return labels;
  }, [dayBlocks.blocks, selectedDate, selectedDoctorId, practitionerDay, pickerRange, startStep]);
  const holiday = useMemo(() => (selectedDate ? diaryHolidayOn(selectedDate) : null), [selectedDate]);

  // Another patient, practitioner, day, time, length or appointment type needs its own check before saving
  useEffect(() => {
    setPendingWarnings(null);
  }, [selectedPatientId, selectedDoctorId, selectedDate, selectedTime, endTime, repeatOn, repeatRule, appointmentTypeId]);

  // Missed appointments of the chosen patient, like Eminance's previous-status warning
  useEffect(() => {
    setNoShowNote(null);
    if (!selectedPatientId) return;
    let cancelled = false;
    loadNoShowHistory(selectedPatientId).then((history) => {
      if (!cancelled && history) setNoShowNote(describeNoShowHistory(history.count, history.lastDate));
    });
    return () => {
      cancelled = true;
    };
  }, [selectedPatientId]);

  // Length of the booking as chosen (start to end), the type's default when it can't be read
  const chosenDuration = (): number => {
    const start = timeToMinutes(selectedTime);
    const end = timeToMinutes(endTime);
    return start !== null && end !== null && end > start ? end - start : startingLength();
  };

  const handleNextFreeSlot = async () => {
    if (!selectedDoctorId) {
      toast.error('Choose the practitioner first.');
      return;
    }
    if (!practiceIdForChecks) {
      toast.error("Your practice couldn't be identified. Reload the page and try again.");
      return;
    }
    const length = chosenDuration();
    setIsFindingSlot(true);
    try {
      const slot = await findNextFreeSlotFor({
        practiceId: practiceIdForChecks,
        doctorId: selectedDoctorId,
        fromDate: parseDateKey(selectedDate) ?? new Date(),
        durationMinutes: length,
        businessHours: allBusinessHours,
        ignoreVisitId: editingAppointmentId ?? null,
        lengths: typeLengths,
        workingHours: diarySettings.hours,
        stepMinutes: startStep
      });
      if (!slot) {
        toast.error(`No free ${length}-minute slot in the next 4 weeks. Try another practitioner or a shorter booking.`);
        return;
      }
      const end = minutesToTime((timeToMinutes(slot.time) ?? 0) + length);
      setValue('date', slot.date);
      setValue('time', slot.time);
      setEndTime(end);
      setValue('end_time', end);
      setValue('duration', length);
      toast.success(`Next free slot: ${formatDiaryDate(slot.date)} at ${slot.time}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setIsFindingSlot(false);
    }
  };

  // Saves the chosen practitioner as the user's default: the diary opens on them and new bookings start with them
  const handleRememberPractitioner = async () => {
    if (!selectedDoctorId) return;
    setIsSavingDefault(true);
    const result = await diaryDefault.save([selectedDoctorId]);
    setIsSavingDefault(false);
    if (result.ok) {
      toast.success(`Saved: the diary opens on ${selectedDoctor?.full_name || 'this practitioner'}, and new bookings start with them.`);
    } else {
      toast.error(result.message);
    }
  };

  const onSubmit = (data: AddAppointmentFormData) => submitBooking(data, null);

  // acknowledgedKey: the booking reception already confirmed with "Book anyway"
  const submitBooking = async (data: AddAppointmentFormData, acknowledgedKey: string | null) => {
    try {
      setIsLoading(true);
      setError(null);

      // "Book again" opens without a date when no free time was found: reception chooses one
      if (!data.date) {
        setError('Choose the date of the appointment.');
        return;
      }

      // A video booking needs a link the patient can open; a booking being changed whose link was not read keeps it
      let videoValue: string | null | undefined = videoKnown ? null : undefined;
      if (videoOn) {
        const checkedLink = checkVideoLink(videoLink);
        if (!checkedLink.ok) {
          setVideoError(checkedLink.error);
          setError(checkedLink.error);
          return;
        }
        videoValue = checkedLink.link;
      }
      setVideoError(null);

      // Calculate duration from start and end times
      const [startHours, startMinutes] = data.time.split(':').map(Number);
      const [endHours, endMinutes] = data.end_time.split(':').map(Number);
      
      const startDate = new Date();
      startDate.setHours(startHours, startMinutes, 0, 0);
      
      const endDate = new Date();
      endDate.setHours(endHours, endMinutes, 0, 0);
      
      const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);

      // New appointments booked for today cannot start earlier than now
      const now = new Date();
      if (!editingAppointmentId && data.date === format(now, 'yyyy-MM-dd') && data.time < format(now, 'HH:mm')) {
        setError('The selected start time has already passed. Please choose a later time.');
        return;
      }

      // Get practice_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('practice_id')
        .eq('id', user?.id)
        .single();

      if (userError) throw userError;
      const practiceId = userData?.practice_id || user?.practice_id;

      // A clash with the practitioner's other bookings, the patient's other booking that day, blocked
      // time, a public holiday or a closed day is shown with "Book anyway": never refused, never silent
      const proposal = {
        visitId: editingAppointmentId ?? null,
        patientId: data.patient_id,
        doctorId: data.doctor_id,
        date: data.date,
        time: data.time,
        durationMinutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 30
      };
      // "Book anyway" covers this booking as this appointment type only: another type has another daily limit
      const proposalKey = `${bookingProposalKey(proposal)}|${appointmentTypeId ?? ''}`;

      // A repeat booking: every date is checked, the warnings are shown once for the whole series,
      // then all the dates are booked together
      if (!editingAppointmentId && repeatOn) {
        const series = validateRepeatRule(data.date, repeatRule);
        if (!series.ok) {
          setError(series.errors.join(' '));
          return;
        }
        if (!practiceId) {
          setError("Your account isn't linked to a practice, so the appointments can't be booked. Ask an administrator to link your account.");
          return;
        }
        const seriesKey = `${proposalKey}|repeat|${series.dates.join(',')}`;
        if (acknowledgedKey !== seriesKey) {
          const checked = await checkBookingSeries({
            practiceId,
            proposals: series.dates.map((date) => ({ ...proposal, date })),
            practitionerName: (id) => doctors.find((doctor) => doctor.id === id)?.full_name,
            businessHours: allBusinessHours,
            lengths: typeLengths,
            workingHours: diarySettings.hours,
            appointmentType: chosenType
          });
          const warnings = seriesWarnings(checked);
          if (warnings.length > 0) {
            setPendingWarnings({ key: seriesKey, warnings });
            return;
          }
        }
        const repeatText = describeRepeat(repeatRule, series.dates);
        const rows = series.dates.map((date) => ({
          patient_id: data.patient_id,
          doctor_id: data.doctor_id,
          visit_date: date,
          visit_time: data.time,
          scheduled_date: date,
          scheduled_time: data.time,
          visit_type: data.type,
          chief_complaint: data.notes || '',
          notes: `Appointment scheduled for ${formatDiaryDate(date)} at ${data.time} - ${data.end_time} (repeat booking: ${repeatText})`,
          practice_id: practiceId,
          is_scheduled: true,
          is_confirmed: true,
          is_checked_in: false,
          is_ready: false,
          is_cancelled: false,
          status: 'scheduled',
          created_at: new Date().toISOString()
        }));
        const { data: created, error: seriesError } = await writeWithBookingLength(proposal.durationMinutes, (lengthFields) =>
          writeWithAppointmentType(appointmentTypeId, (typeFields) =>
            writeWithVideoLink(videoValue, (videoFields) =>
              supabase
                .from('visits')
                .insert(rows.map((row) => ({ ...row, ...lengthFields, ...typeFields, ...videoFields })))
                .select('id, scheduled_date, scheduled_time')
            )
          )
        );
        if (seriesError) throw seriesError;
        if (videoOn && videoBookingsNotSetUp()) toast.error(VIDEO_NOT_SET_UP_MESSAGE);
        toast.success(`${series.dates.length} bookings made. ${repeatText}.`);
        onSuccess(created?.[0]);
        return;
      }

      if (practiceId && acknowledgedKey !== proposalKey) {
        const bookingDay = practitionerDayHours(diarySettings.hours, data.doctor_id, data.date);
        const warnings = await checkBooking({
          practiceId,
          proposal,
          practitionerName: (id) => doctors.find((doctor) => doctor.id === id)?.full_name,
          // A practitioner who works that day (their own hours) is not "closed" with the practice
          closedWeekday: bookingDay ? null : closedDay,
          lengths: typeLengths,
          practitionerDay: bookingDay,
          appointmentType: chosenType
        });
        if (warnings.length > 0) {
          setPendingWarnings({ key: proposalKey, warnings });
          return;
        }
      }

      if (editingAppointmentId) {
        // Someone else changed this booking after the form opened: the person chooses before it is written
        const decision = await versionGuard.confirmSave();
        if (decision === 'reload') {
          onSuccess();
          return;
        }
        if (decision === 'stop') return;
        // Update existing visit, with the length chosen in the form (and its room link, when it is read)
        const { data: updatedVisit, error: updateError } = await writeWithBookingLength(proposal.durationMinutes, (lengthFields) =>
          writeWithVideoLink(videoValue, (videoFields) =>
            supabase
              .from('visits')
              .update({
                patient_id: data.patient_id,
                doctor_id: data.doctor_id,
                visit_date: data.date,
                visit_time: data.time,
                scheduled_date: data.date,
                scheduled_time: data.time,
                visit_type: data.type,
                chief_complaint: data.notes || '',
                notes: `Appointment scheduled for ${format(new Date(data.date), 'dd MMM yyyy')} at ${data.time} - ${data.end_time}`,
                updated_at: new Date().toISOString(),
                ...lengthFields,
                ...videoFields
              })
              .eq('id', editingAppointmentId)
              .select(`
                *,
                doctor:users!doctor_id(id, full_name),
                patient:patients!visits_patient_id_fkey(id, first_name, last_name)
              `)
              .single()
          )
        );

        if (updateError) throw updateError;
        if (videoOn && videoBookingsNotSetUp()) toast.error(VIDEO_NOT_SET_UP_MESSAGE);

        console.log('✅ Updated visit:', updatedVisit);
        toast.success(`Appointment moved to ${format(new Date(data.date), 'dd MMM yyyy')} at ${data.time}`);
        onSuccess(updatedVisit);
      } else {
        // A booking without a practice is invisible on the practice's calendar
        if (!practiceId) {
          setError("Your account isn't linked to a practice, so the appointment can't be booked. Ask an administrator to link your account.");
          return;
        }
        // Create a new scheduled visit, with the length, the practice's appointment type and the room link chosen in
        // the form
        const { data: newVisit, error: visitError } = await writeWithBookingLength(proposal.durationMinutes, (lengthFields) =>
          writeWithAppointmentType(appointmentTypeId, (typeFields) =>
            writeWithVideoLink(videoValue, (videoFields) =>
              supabase
                .from('visits')
                .insert([{
                  patient_id: data.patient_id,
                  doctor_id: data.doctor_id,
                  visit_date: data.date,
                  visit_time: data.time,
                  scheduled_date: data.date,
                  scheduled_time: data.time,
                  visit_type: data.type,
                  chief_complaint: data.notes || '',
                  notes: `Appointment scheduled for ${format(new Date(data.date), 'dd MMM yyyy')} at ${data.time} - ${data.end_time}`,
                  practice_id: practiceId,
                  is_scheduled: true,
                  is_confirmed: true,
                  is_checked_in: false,
                  is_ready: false,
                  is_cancelled: false,
                  status: 'scheduled',
                  created_at: new Date().toISOString(),
                  ...lengthFields,
                  ...typeFields,
                  ...videoFields
                }])
                .select(`
                  *,
                  doctor:users!doctor_id(id, full_name),
                  patient:patients!visits_patient_id_fkey(id, first_name, last_name)
                `)
                .single()
            )
          )
        );

        if (visitError) throw visitError;
        if (videoOn && videoBookingsNotSetUp()) toast.error(VIDEO_NOT_SET_UP_MESSAGE);

        console.log('✅ Created scheduled visit:', newVisit);
        toast.success(`Appointment booked for ${format(new Date(data.date), 'dd MMM yyyy')} at ${data.time}`);
        onSuccess(newVisit);
      }
    } catch (err) {
      console.error('Error saving appointment:', err);
      setError(`${editingAppointmentId ? 'Failed to update appointment' : 'Failed to create appointment'}: ${errorMessage(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // "Book anyway": save the booking the warnings were shown for (a changed booking was checked again)
  const handleBookAnyway = () => {
    if (!pendingWarnings) return;
    const confirmedKey = pendingWarnings.key;
    void handleSubmit((data) => submitBooking(data, confirmedKey))();
  };

  const handlePatientSelect = useCallback((patient: Patient) => {
    setValue('patient_id', patient.id);
    setPatientSearchTerm(`${patient.first_name} ${patient.last_name}`);
    setShowPatientDropdown(false);
    setIsQuickPatientOpen(false);
  }, [setValue]);

  const clearPatient = useCallback(() => {
    setValue('patient_id', '');
    setPatientSearchTerm('');
    setShowPatientDropdown(false);
    setIsQuickPatientOpen(false);
  }, [setValue]);

  // Walk-in: the registration form handed back the new patient, so select them straight away
  const handleWalkInCreated = useCallback((patient: CreatedPatient) => {
    walkInSelectedRef.current = true;
    setPatients(prev => (prev.some(p => p.id === patient.id) ? prev : [...prev, patient]));
    handlePatientSelect(patient);
  }, [handlePatientSelect]);

  // A caller booked with name and cell: the temporary file just opened, or the existing file reception chose instead
  const handleQuickPatientChosen = useCallback((patient: ChosenPatient, isNew: boolean) => {
    setIsQuickPatientOpen(false);
    setPatients(prev => (prev.some(p => p.id === patient.id) ? prev : [...prev, patient]));
    handlePatientSelect(patient);
    toast.success(isNew ? 'New patient added. Complete the file when they arrive.' : 'Existing patient selected');
  }, [handlePatientSelect]);

  const reloadPatients = async () => {
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('practice_id')
      .eq('id', user?.id)
      .single();
    if (userError || !userData?.practice_id) {
      console.error('Error loading practice for patient reload:', userError);
      toast.error("Couldn't refresh the patient list. Close and reopen the form to find the new patient.");
      return;
    }

    const { data, error: patientsError } = await supabase
      .from('patients')
      .select(PICKER_COLUMNS)
      .eq('practice_id', userData.practice_id)
      .order('last_name', { ascending: true });
    if (patientsError) {
      console.error('Error reloading patients:', patientsError);
      toast.error(`Couldn't refresh the patient list: ${errorMessage(patientsError)}`);
      return;
    }
    setPatients(data || []);
  };

  const handleWalkInRegistered = async () => {
    setIsAddPatientOpen(false);
    if (walkInSelectedRef.current) {
      walkInSelectedRef.current = false;
      toast.success('Patient registered and selected');
      return;
    }
    // The registration form did not hand back the new patient: reload the list so they can be picked
    await reloadPatients();
    setShowPatientDropdown(true);
    toast.success('Patient registered. Select them from the list.');
  };

  const handleCancelAppointment = async () => {
    if (!editingAppointmentId) return;
    const patientName = patientSearchTerm.trim() || 'this patient';
    if (!window.confirm(`Cancel the appointment for ${patientName}? It will be marked as cancelled.`)) return;

    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from('visits')
        .update({ 
          status: 'cancelled',
          is_cancelled: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingAppointmentId);

      if (error) throw error;
      
      console.log('✅ Appointment cancelled');
      toast.success('Appointment cancelled successfully');
      // Its time is free again: the diary offers it to the waiting list, as after Cancel Visit
      onCancelled?.();
      onSuccess(); // Close the modal after cancelling
    } catch (err) {
      console.error('Error cancelling appointment:', err);
      setError('Failed to cancel appointment');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading only when actively fetching, not on initial mount
  const isInitialLoading = isLoadingPatients || isLoadingDoctors;
  
  // Don't render form until user is loaded
  if (!user?.id) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Icon icon="solar:refresh-circle-bold-duotone" className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading appointment form...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="bg-red-50 border border-red-200 rounded-lg p-4"
        >
          <div className="flex items-center gap-3">
            <Icon icon="solar:danger-triangle-bold-duotone" className="w-5 h-5 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </motion.div>
      )}

      {/* Patient Section */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm"
      >
        <motion.div 
          className="flex items-center gap-3 mb-6 -ml-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="p-2 bg-blue-100 rounded-lg">
            <Icon icon="solar:user-rounded-bold-duotone" className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Patient Information</h3>
            <p className="text-sm text-gray-500">Select the patient for this appointment</p>
          </div>
        </motion.div>
        <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Patient
            </label>
            <motion.div 
              className="relative"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <Icon 
                icon="solar:user-rounded-bold-duotone" 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" 
              />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search by name, ID, cell or reference..."
                value={patientSearchTerm}
                onChange={(e) => {
                  if (!initialPatientId) {
                    setPatientSearchTerm(e.target.value);
                    setShowPatientDropdown(true);
                  }
                }}
                onFocus={() => !initialPatientId && !selectedPatientId && setShowPatientDropdown(true)}
                disabled={!!initialPatientId}
                className={`w-full pl-10 ${selectedPatientId && !initialPatientId ? 'pr-12' : 'pr-4'} py-3 bg-gray-100 border-0 rounded-lg 
                  focus:outline-none focus:ring-2 focus:ring-purple-500 
                  transition-all duration-200 text-gray-700
                  ${initialPatientId ? 'bg-gray-200 cursor-not-allowed' : ''}
                  hover:bg-gray-200`}
              />
              {selectedPatientId && !initialPatientId && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ 
                    type: "spring",
                    stiffness: 500,
                    damping: 25
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={clearPatient}
                  aria-label="Clear the selected patient"
                  title="Clear the selected patient"
                  className="absolute right-3 inset-y-0 m-auto h-8 w-8 hover:bg-gray-200 rounded-full transition-all duration-200 z-10 flex items-center justify-center"
                >
                  <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                </motion.button>
              )}
            </motion.div>
            <input type="hidden" {...register('patient_id', { required: 'Patient is required' })} />
            
            <AnimatePresence>
              {showPatientDropdown && !selectedPatientId && !isQuickPatientOpen && (
                <motion.div 
                  ref={dropdownRef}
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ 
                    duration: 0.2,
                    ease: [0.23, 1, 0.32, 1]
                  }}
                  className="absolute z-20 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-60 overflow-auto"
                  style={{ zIndex: 9999 }}
                >
                  {isLoadingPatients ? (
                    <div className="px-4 py-8 text-center">
                      <Icon icon="solar:refresh-bold-duotone" className="w-6 h-6 text-gray-400 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Loading patients...</p>
                    </div>
                  ) : filteredPatients.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <Icon icon="solar:users-group-two-rounded-bold-duotone" className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No patients found</p>
                    </div>
                  ) : (
                    filteredPatients.map((patient, index) => (
                      <motion.div
                        key={patient.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        whileHover={{ 
                          backgroundColor: 'rgba(243, 244, 246, 0.8)',
                          x: 4,
                          transition: { duration: 0.15, ease: "easeOut" }
                        }}
                        onClick={() => handlePatientSelect(patient)}
                        className="px-4 py-3 cursor-pointer flex items-center gap-3 transition-all duration-200"
                      >
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          transition={{ type: "spring", stiffness: 400 }}
                        >
                          <Icon icon="solar:user-circle-bold-duotone" className="w-5 h-5 text-gray-400" />
                        </motion.div>
                        <span className="min-w-0">
                          <span className="block font-medium text-gray-700">
                            {patient.first_name} {patient.last_name}
                          </span>
                          {/* The cell number tells namesakes apart when a caller is on the phone */}
                          {(patient.cell_number || patientFileStatus(patient).incomplete) && (
                            <span className="block text-xs text-gray-500">
                              {[patientFileStatus(patient).incomplete ? 'File not complete' : null, patient.cell_number].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </span>
                      </motion.div>
                    ))
                  )}
                  {!isLoadingPatients && (
                    <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-gray-100 bg-white px-4 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPatientDropdown(false);
                          setIsQuickPatientOpen(true);
                        }}
                        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-md hover:from-purple-600 hover:to-indigo-700"
                      >
                        <Icon icon="solar:user-plus-bold-duotone" className="w-4 h-4" aria-hidden="true" />
                        New patient: name and cell
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPatientDropdown(false);
                          setIsAddPatientOpen(true);
                        }}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Register in full
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            {isQuickPatientOpen && !selectedPatientId && (
              <QuickNewPatient
                practiceId={practiceIdForChecks}
                initialText={patientSearchTerm}
                onUse={handleQuickPatientChosen}
                onCancel={() => setIsQuickPatientOpen(false)}
              />
            )}
          </div>
          {errors.patient_id && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-1 text-sm text-red-600 flex items-center gap-1"
            >
              <Icon icon="solar:danger-circle-bold" className="w-4 h-4" />
              {errors.patient_id.message}
            </motion.p>
          )}
          {noShowNote && (
            <p className="mt-2 text-sm text-amber-700 flex items-start gap-1">
              <Icon icon="solar:user-cross-rounded-bold-duotone" className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
              {noShowNote}
            </p>
          )}
          {selectedPatientId && selectedFileStatus.incomplete && (
            <p className="mt-2 text-sm text-purple-800 flex items-start gap-1">
              <Icon icon="solar:user-id-bold-duotone" className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
              New patient: complete the file (ID number, date of birth, gender and medical aid) when they arrive.
            </p>
          )}
      </motion.div>

      {/* Appointment Details Section */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm"
      >
        <motion.div 
          className="flex items-center gap-3 mb-6 -ml-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="p-2 bg-purple-100 rounded-lg">
            <Icon icon="solar:calendar-add-bold-duotone" className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Appointment Details</h3>
            <p className="text-sm text-gray-500">Configure the appointment settings</p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Practitioner Selection - Only show if more than one practitioner (the diary's: doctors and anyone with hours) */}
          {doctors.length > 1 ? (
            <div>
              <label htmlFor="booking-practitioner" className="block text-sm font-medium text-gray-700 mb-2">
                Practitioner
              </label>
              <div className="relative">
                <select
                  id="booking-practitioner"
                  // The onChange goes through register: a separate onChange prop replaced react-hook-form's
                  // own handler, so the form never saw the chosen doctor and every booking failed with
                  // "Doctor is required" in practices with more than one doctor.
                  {...register('doctor_id', {
                    required: 'Choose the practitioner',
                    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
                      const doctor = doctors.find(d => d.id === e.target.value);
                      if (doctor) setSelectedDoctor(doctor);
                    }
                  })}
                  className="w-full px-4 pr-10 py-3 bg-gray-100 border-0 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-purple-500
                    transition-all duration-200 text-gray-700 appearance-none
                    hover:bg-gray-200"
                >
                <option value="">Select practitioner</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.label}
                  </option>
                ))}
              </select>
                <Icon 
                  icon="solar:alt-arrow-down-bold-duotone" 
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" 
                />
              </div>
            {errors.doctor_id && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-1 text-sm text-red-600 flex items-center gap-1"
              >
                <Icon icon="solar:danger-circle-bold" className="w-4 h-4" />
                {errors.doctor_id.message}
              </motion.p>
            )}
            {/* The user's default practitioner (offered once the database can keep it) */}
            {diaryDefault.status === 'ready' && selectedDoctorId && (
              sameDiaryView(defaultView, [selectedDoctorId]) ? (
                <p className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                  <Icon icon="solar:check-circle-bold-duotone" className="h-4 w-4 flex-none text-emerald-600" aria-hidden="true" />
                  Your default practitioner
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleRememberPractitioner}
                  disabled={isSavingDefault}
                  title="The diary opens on this practitioner and new bookings start with them"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon icon="solar:pin-bold-duotone" className="h-4 w-4 flex-none" aria-hidden="true" />
                  {isSavingDefault ? 'Saving...' : 'Remember as my default'}
                </button>
              )
            )}
          </div>
          ) : selectedDoctor ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Icon icon="solar:stethoscope-bold-duotone" className="w-4 h-4 text-purple-500" />
                Practitioner
              </label>
              <div className="px-4 py-3 bg-gray-200 border-0 rounded-lg flex items-center gap-3">
                <Icon icon="solar:stethoscope-bold-duotone" className="w-5 h-5 text-gray-600" />
                <span className="text-gray-700">{selectedDoctor.label}</span>
              </div>
            </div>
          ) : (
            // Without a practitioner the booking fails with a database error, so say what is missing
            dataFetched && !isLoadingDoctors && diarySettings.hoursStatus !== 'loading' && doctors.length === 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Practitioner</label>
                <p className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  No practitioners could be found for your practice, so appointments can't be booked. An administrator can add a doctor under Settings &gt; Users, or give a staff member working hours in Diary settings.
                </p>
              </div>
            )
          )}

          {/* Appointment Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Appointment Type
            </label>
            <div className="relative">
              <Icon 
                icon="solar:clipboard-heart-bold-duotone" 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" 
              />
              <input
                type="hidden"
                {...register('type', { required: 'Type is required' })}
              />
              <button
                type="button"
                onClick={() => !initialType && setShowTypeModal(true)}
                disabled={!!initialType}
                className={`w-full pl-10 pr-10 py-3 bg-gray-100 border-0 rounded-lg 
                  focus:outline-none focus:ring-2 focus:ring-purple-500 
                  transition-all duration-200 text-gray-700 text-left
                  hover:bg-gray-200
                  ${initialType ? 'bg-gray-200 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {chosenType ? (
                  <span>{chosenType.name}</span>
                ) : watch('type') ? (
                  <span className="capitalize">{watch('type').replace('-', ' ')}</span>
                ) : (
                  <span className="text-gray-500">Select type</span>
                )}
              </button>
              <Icon 
                icon="solar:alt-arrow-down-bold-duotone" 
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" 
              />
            </div>
            {errors.type && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-1 text-sm text-red-600 flex items-center gap-1"
              >
                <Icon icon="solar:danger-circle-bold" className="w-4 h-4" />
                {errors.type.message}
              </motion.p>
            )}
            {/* The practice's appointment type: its length and daily limit, in words */}
            {chosenType && <p className="mt-1 text-xs text-gray-500">{describeAppointmentType(chosenType)}</p>}
          </div>

        </div>

        {/* Date and Time Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Date Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date
            </label>
            <PremiumDatePickerModal
              value={watch('date')}
              onChange={(date) => setValue('date', date)}
              error={errors.date?.message}
              min={new Date()}
            />
            {closedDay && !practitionerDay && (
              <p className="mt-2 text-sm text-amber-700 flex items-center gap-1">
                <Icon icon="solar:danger-triangle-bold-duotone" className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                The practice is closed on {closedDay.charAt(0).toUpperCase() + closedDay.slice(1)}s. Choose another date unless the doctor is working that day.
              </p>
            )}
            {holiday && (
              <p className="mt-2 text-sm text-amber-700 flex items-start gap-1">
                <Icon icon="solar:flag-bold-duotone" className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                {formatDiaryDate(holiday.date)} is {holiday.name}, a public holiday. You will be asked before booking.
              </p>
            )}
          </div>
        </div>

        {/* Time Range Selection */}
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Time Selection
            </label>
            <button
              type="button"
              onClick={handleNextFreeSlot}
              disabled={isFindingSlot}
              title="Find the practitioner's next free time, skipping bookings, blocked time and public holidays"
              className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              <Icon
                icon={isFindingSlot ? 'solar:refresh-bold-duotone' : 'solar:calendar-search-bold-duotone'}
                className={`w-4 h-4 ${isFindingSlot ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {isFindingSlot ? 'Searching...' : 'Next free slot'}
            </button>
          </div>
          {practitionerWeek && (
            <p className="mb-2 flex items-start gap-1 text-xs text-gray-500">
              <Icon icon="solar:clock-circle-bold-duotone" className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />
              <span>
                {selectedDoctor?.full_name || 'The practitioner'} works {practitionerWeek}.
                {practitionerDay === null ? ' Not on this day.' : ''}
              </span>
            </p>
          )}
          <PremiumTimeRangePicker
            startTime={watch('time') || '09:00'}
            endTime={endTime}
            min={minutesToTime(pickerRange.start)}
            max={minutesToTime(pickerRange.end)}
            step={startStep}
            onDurationSelect={() => {
              lengthChosenRef.current = true;
            }}
            onStartTimeChange={(time) => {
              setValue('time', time);
              // Auto-calculate the end time from the booking's starting length
              if (!endTime) {
                const length = startingLength();
                const [hours, minutes] = time.split(':').map(Number);
                const startDate = new Date();
                startDate.setHours(hours, minutes, 0, 0);
                const endDate = addMinutes(startDate, length);
                const calculatedEndTime = format(endDate, 'HH:mm');
                setEndTime(calculatedEndTime);
                setValue('end_time', calculatedEndTime);
                setValue('duration', length);
              }
            }}
            onEndTimeChange={(time) => {
              setEndTime(time);
              setValue('end_time', time);
              
              // Calculate duration
              const startTime = watch('time');
              if (startTime) {
                const [startHours, startMinutes] = startTime.split(':').map(Number);
                const [endHours, endMinutes] = time.split(':').map(Number);
                
                const startDate = new Date();
                startDate.setHours(startHours, startMinutes, 0, 0);
                
                const endDate = new Date();
                endDate.setHours(endHours, endMinutes, 0, 0);
                
                if (endDate > startDate) {
                  const durationMs = endDate.getTime() - startDate.getTime();
                  const durationMinutes = Math.round(durationMs / 60000);
                  setValue('duration', durationMinutes);
                }
              }
            }}
            error={errors.time?.message || errors.end_time?.message}
            bookedTimes={bookedTimes}
            blockedTimes={blockedTimes}
            date={selectedDate}
          />
        </div>

        {/* Repeat booking: a course of treatment, regular reviews (new bookings only) */}
        {!editingAppointmentId && (
          <div className="mt-6">
            <RepeatBookingFields
              enabled={repeatOn}
              onEnabledChange={setRepeatOn}
              rule={repeatRule}
              onRuleChange={setRepeatRule}
              firstDate={selectedDate}
            />
          </div>
        )}

        {/* Video consultation: the room link the patient joins with (parity B16) */}
        <div className="mt-6">
          <VideoBookingFields
            enabled={videoOn}
            onEnabledChange={(on) => {
              setVideoOn(on);
              setVideoError(null);
            }}
            link={videoLink}
            onLinkChange={(link) => {
              setVideoLink(link);
              setVideoError(null);
            }}
            practiceDefault={practiceVideoLink}
            practiceId={practiceIdForChecks}
            error={videoError}
            notSetUp={videoNotSetUp}
          />
        </div>
      </motion.div>

      {/* Notes Section */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm"
      >
        <motion.div 
          className="flex items-center gap-3 mb-6 -ml-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <div className="p-2 bg-green-100 rounded-lg">
            <Icon icon="solar:notes-bold-duotone" className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Additional Notes</h3>
            <p className="text-sm text-gray-500">Add any special instructions or concerns</p>
          </div>
        </motion.div>

        {/* Notes */}
        <div>
          <textarea
            {...register('notes')}
            rows={3}
            placeholder="Add any special instructions or notes..."
            className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg 
              focus:outline-none focus:ring-2 focus:ring-cyan-500 
              transition-all duration-200 text-gray-700 resize-none
              hover:bg-gray-200"
          />
        </div>
      </motion.div>

      {pendingWarnings && (
        <BookingWarningsPanel
          warnings={pendingWarnings.warnings}
          confirmLabel={editingAppointmentId ? 'Save anyway' : repeatOn ? 'Book all anyway' : 'Book anyway'}
          busy={isLoading}
          onConfirm={handleBookAnyway}
          onChange={() => setPendingWarnings(null)}
        />
      )}

      {/* Action Buttons: stay in view at the bottom of the scrolling modal and wrap on a phone */}
      <motion.div
        className="sticky bottom-0 z-10 flex flex-wrap justify-between items-center gap-3 py-3 bg-white border-t border-gray-100"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.3 }}
      >
        {/* Cancel Appointment button - only show when editing */}
        <div>
          {editingAppointmentId && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              type="button"
              onClick={handleCancelAppointment}
              disabled={isLoading}
              className="px-4 sm:px-6 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg
                hover:from-red-600 hover:to-red-700 transition-all duration-200 font-medium 
                flex items-center gap-2 disabled:opacity-50 
                disabled:cursor-not-allowed shadow-lg"
            >
              <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5" />
              Cancel Appointment
            </motion.button>
          )}
        </div>

        {/* Right side buttons */}
        <div className="flex flex-wrap justify-end gap-3 ml-auto">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            type="button"
            onClick={() => {
              if (onCancel) {
                onCancel();
              } else {
                onSuccess();
              }
            }}
            className="px-4 sm:px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg
              hover:bg-gray-50 transition-all duration-200 font-medium flex items-center gap-2"
          >
            Close
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            type="submit"
            disabled={isLoading}
            className="px-4 sm:px-6 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg
              hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 font-medium 
              flex items-center gap-2 disabled:opacity-50 
              disabled:cursor-not-allowed shadow-lg"
          >
          {isLoading ? (
            <>
              <Icon icon="solar:refresh-bold-duotone" className="w-5 h-5 animate-spin" />
              {editingAppointmentId ? 'Updating...' : 'Scheduling...'}
            </>
          ) : (
            <>
              <Icon icon={editingAppointmentId ? "solar:pen-bold-duotone" : "solar:calendar-add-bold-duotone"} className="w-5 h-5" />
              {editingAppointmentId ? 'Update Appointment' : 'Schedule Appointment'}
            </>
          )}
        </motion.button>
        </div>
      </motion.div>
      </form>

      {/* Appointment Type Modal - Outside form to prevent submission */}
      <AppointmentTypeModal
        isOpen={showTypeModal}
        onClose={() => setShowTypeModal(false)}
        onSelect={(type) => {
          setValue('type', type);
          setAppointmentTypeId(null);
          if (errors.type) {
            clearErrors('type');
          }
        }}
        selectedType={chosenType ? undefined : watch('type')}
        practiceTypes={practiceTypes}
        selectedPracticeTypeId={appointmentTypeId}
        onSelectPracticeType={(type) => {
          // Its length applies even after another length was picked: choosing "New patient" means its 45 minutes
          lengthChosenRef.current = false;
          setAppointmentTypeId(type.id);
          setValue('type', type.visitType);
          if (errors.type) {
            clearErrors('type');
          }
        }}
      />

      {/* Walk-in registration - outside the form so its submit doesn't bubble into this one */}
      <FormModal
        isOpen={isAddPatientOpen}
        onClose={() => setIsAddPatientOpen(false)}
        title="Register New Patient"
        icon="solar:user-plus-bold-duotone"
      >
        <AddPatientForm
          onCreated={handleWalkInCreated}
          onSuccess={handleWalkInRegistered}
        />
      </FormModal>

      {/* Someone else changed the booking being edited after the form opened */}
      {versionGuard.dialog}
    </>
  );
};

export default PremiumAddAppointmentForm;