import React, { useState, useEffect, useMemo, useRef } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  MapPin,
  Heart,
  Users,
  ChevronRight,
  ChevronLeft,
  Check,
  Phone,
  Mail,
  Calendar,
  Briefcase,
  Shield,
  CreditCard,
  ArrowRight
} from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { format, parseISO } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import 'react-day-picker/dist/style.css';
import { windhoekClock } from '../../utils/patientLists/listDates';
import { birthDateMismatch, birthDateToFill, checkIdNumber, normalizeIdNumber } from '../../utils/patients/namibianId';
import { DUPLICATE_REASON_LABELS, type DuplicateMatch } from '../../utils/patients/duplicatePatients';
import {
  MAIN_MEMBER_RELATIONSHIP,
  composeMainMemberName,
  dependantCodeProblem,
  initialsOf,
  isMainMemberRelationship,
  membershipNumberHint,
  normalizeDependantCode,
  normalizeInitials
} from '../../utils/patients/medicalAidMember';
import { PATIENT_TITLES, followInitials } from '../../utils/patients/patientName';
import { OLD_FILE_NUMBER_MAX_LENGTH, normalizeOldFileNumber, oldFileNumberProblem } from '../../utils/patients/patientNumbers';
import { patientFileStatus } from '../../utils/patients/temporaryPatient';
import { findPracticeDuplicates, isDuplicateIdNumberError } from '../../services/patientDuplicateService';
import { loadPatientFileStatus } from '../../services/patientFileService';
import { DependantCodeInput, MainMemberFields } from './medicalAid/MainMemberFields';
import { useDependantCodeColumn } from './medicalAid/dependantCode';
import { usePatientTitleColumns } from './patientTitleColumns';
import { usePatientTownColumns } from './patientTownColumns';
import { usePatientPhotoColumn, useReferralSourceColumns } from './patientExtrasColumns';
import { RegistrationPhotoField } from '../patients/photo/RegistrationPhotoField';
import { savePatientPhoto } from '../patients/photo/patientPhotoService';
import { ReferralSourceFields } from '../patients/referralSource/ReferralSourceFields';
import { NO_REFERRAL_ANSWER, referralColumns, type ReferralAnswer } from '../../utils/patients/referralSource';
import { RegionSelect, TownPicker } from '../address/TownPicker';
import { toNamibianRegion } from '../../utils/address/namibianTowns';
import CompletePatientFileModal from './CompletePatientFileModal';
import type { EditPatientInitialData } from './EditPatientForm';

interface PatientRegistrationFormData {
  // Personal Details
  title: string;
  firstName: string;
  initials: string;
  lastName: string;
  idNumber: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  occupation: string;
  employer: string;
  cellNo: string;
  homeLanguage: string;
  email: string;
  /** The paper file's number or the account number in the practice's previous system (patients.legacy_account_number) */
  oldFileNumber: string;

  // Contact Details
  homeAddress: string;
  postalAddress: string;
  postalCode: string;
  /** patients.town and patients.region, saved once the columns exist (proposals/2026-10-13-patient-town.sql) */
  town: string;
  region: string;

  // Medical Aid
  medicalAid: {
    provider: string;
    scheme: string;
    membershipNumber: string;
    mainMemberSurname: string;
    mainMemberInitials: string;
    mainMemberIdNumber: string;
    relationship: string;
    dependantCode: string;
  };

  // Next of Kin
  nextOfKin: {
    name: string;
    relationship: string;
    phone: string;
    address: string;
  };
}

interface MedicalAidProvider {
  id: string;
  name: string;
  short_name: string;
  medical_aid_reference?: string | null;
}

interface MedicalAidScheme {
  id: string;
  provider_id: string;
  name: string;
  description: string;
}

export interface RegisteredPatient {
  id: string;
  first_name: string;
  last_name: string;
}

interface Props {
  onSuccess?: (patient?: RegisteredPatient) => void;
  /**
   * "Use this patient" on the duplicate check: the person already has a file at this practice. Without
   * it the check can only say so (and the new file can still be saved when the ID number differs).
   */
  onUseExisting?: (patient: RegisteredPatient) => void;
}

interface DuplicateCheck {
  matches: DuplicateMatch[];
  data: PatientRegistrationFormData;
  practiceId: string;
}

const steps = [
  {
    id: 1,
    title: 'Personal',
    icon: User,
    color: '#3b82f6'
  },
  {
    id: 2,
    title: 'Contact',
    icon: MapPin,
    color: '#10b981'
  },
  {
    id: 3,
    title: 'Medical Aid',
    icon: Shield,
    color: '#8b5cf6'
  },
  {
    id: 4,
    title: 'Emergency',
    icon: Users,
    color: '#f59e0b'
  }
];

// Inserts go through the untyped client: the generated types still require columns the database fills
// itself (system_patient_reference_number) and do not know dependant_code yet
const untypedDb = supabase as unknown as SupabaseClient;

/** What was typed here, as the edit form's values: it completes the caller's temporary file instead of a second file */
const registrationAsFile = (data: PatientRegistrationFormData): EditPatientInitialData => ({
  title: data.title ?? '',
  first_name: (data.firstName ?? '').trim(),
  initials: data.initials ?? '',
  last_name: (data.lastName ?? '').trim(),
  id_number: normalizeIdNumber(data.idNumber),
  date_of_birth: data.dateOfBirth,
  gender: data.gender,
  marital_status: data.maritalStatus ?? '',
  occupation: data.occupation ?? '',
  employer: data.employer ?? '',
  home_language: data.homeLanguage ?? '',
  email: data.email ?? '',
  cell_number: data.cellNo ?? '',
  home_address: data.homeAddress ?? '',
  postal_address: data.postalAddress ?? '',
  postal_code: data.postalCode ?? '',
  town: data.town ?? '',
  region: data.region ?? '',
  old_file_number: normalizeOldFileNumber(data.oldFileNumber),
  medicalAid: { ...data.medicalAid },
  nextOfKin: { ...data.nextOfKin }
});

const formatBirthDate = (key: string | null | undefined): string => {
  if (!key) return '';
  const date = parseISO(key);
  return Number.isNaN(date.getTime()) ? key : format(date, 'd MMM yyyy');
};

const ModernPatientRegistrationForm: React.FC<Props> = ({ onSuccess, onUseExisting }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [providers, setProviders] = useState<MedicalAidProvider[]>([]);
  const [schemes, setSchemes] = useState<MedicalAidScheme[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [loadingSchemes, setLoadingSchemes] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Possible existing files for this person, shown before anything is saved
  const [duplicateCheck, setDuplicateCheck] = useState<DuplicateCheck | null>(null);
  // The temporary file being completed with what was typed here (see finishCompletingFile)
  const [completingFile, setCompletingFile] = useState<DuplicateMatch['patient'] | null>(null);
  // A ref, not state: the button sets it in the same click that submits the form, and a state value
  // captured at render time would still be false, so the first "Complete Registration" click did nothing.
  const allowSubmitRef = useRef(false);
  // The date of birth last filled in from the ID number: a date reception chose themselves is never replaced
  const birthDateFromIdRef = useRef<string | null>(null);
  // Saved only once the database has the column (proposals/2026-10-07-dependant-code.sql)
  const dependantCodeAvailable = useDependantCodeColumn();
  // Title and initials: shown and saved once the columns exist (proposals/2026-10-08-patient-title-initials.sql)
  const titleColumnsAvailable = usePatientTitleColumns();
  // Town and region (picking a town fills its region): shown and saved once the columns exist
  const townColumnsAvailable = usePatientTownColumns();
  // Photo and "How did you hear about us?" (owner, 13 Oct 2026): shown and saved once the columns exist
  const photoColumnAvailable = usePatientPhotoColumn();
  const referralColumnsAvailable = useReferralSourceColumns();
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [referralAnswer, setReferralAnswer] = useState<ReferralAnswer>(NO_REFERRAL_ANSWER);
  // The first names before the last keystroke: initials follow them until reception types their own
  const firstNamesRef = useRef('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
    trigger
  } = useForm<PatientRegistrationFormData>({
    defaultValues: {
      homeLanguage: 'English',
      medicalAid: { relationship: MAIN_MEMBER_RELATIONSHIP }
    }
  });

  const selectedProvider = watch('medicalAid.provider');
  const idNumber = watch('idNumber');
  const dateOfBirth = watch('dateOfBirth');
  const relationship = watch('medicalAid.relationship');
  const membershipNumber = watch('medicalAid.membershipNumber');
  const mainMemberSurname = watch('medicalAid.mainMemberSurname');
  const mainMemberInitials = watch('medicalAid.mainMemberInitials');
  const townValue = watch('town');
  const regionValue = watch('region');

  // The ID number as typed: the date of birth it carries (Namibian numbers) and any warning
  const idCheck = useMemo(() => checkIdNumber(idNumber, windhoekClock(new Date()).dateKey), [idNumber]);
  const birthDateWarning = birthDateMismatch(idCheck, dateOfBirth);
  const isDependant = !!relationship && !isMainMemberRelationship(relationship);
  const providerRecord = providers.find(provider => provider.id === selectedProvider);
  const membershipHint = providerRecord
    ? membershipNumberHint({ reference: providerRecord.medical_aid_reference, shortName: providerRecord.short_name, name: providerRecord.name }, membershipNumber)
    : null;

  // Fill the date of birth from a Namibian ID number, unless reception picked a date themselves
  useEffect(() => {
    const fromId = birthDateToFill(idCheck.dateOfBirth, dateOfBirth, birthDateFromIdRef.current);
    if (!fromId) return;
    birthDateFromIdRef.current = fromId;
    setValue('dateOfBirth', fromId, { shouldValidate: true });
    setSelectedDate(parseISO(fromId));
  }, [idCheck.dateOfBirth, dateOfBirth, setValue]);

  // Fetch medical aid providers
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const { data, error } = await supabase
          .from('medical_aid_providers')
          .select('id, name, short_name, medical_aid_reference')
          .order('name');

        if (error) throw error;
        setProviders((data as MedicalAidProvider[] | null) || []);
      } catch (error) {
        console.error('Error fetching providers:', error);
        toast.error("Couldn't load the medical aid list. You can still register the patient and add medical aid later.");
      } finally {
        setLoadingProviders(false);
      }
    };

    fetchProviders();
  }, []);

  // Fetch schemes when provider changes
  useEffect(() => {
    if (selectedProvider) {
      const fetchSchemes = async () => {
        setLoadingSchemes(true);
        try {
          const { data, error } = await supabase
            .from('medical_aid_schemes')
            .select('id, name, description')
            .eq('provider_id', selectedProvider)
            .order('name');

          if (error) throw error;
          setSchemes((data as MedicalAidScheme[] | null) || []);
        } catch (error) {
          console.error('Error fetching schemes:', error);
          toast.error("Couldn't load the schemes for this medical aid. Choose the provider again to retry.");
        } finally {
          setLoadingSchemes(false);
        }
      };

      fetchSchemes();
    } else {
      setSchemes([]);
    }
  }, [selectedProvider]);

  const nextStep = async () => {
    const fieldsToValidate = getFieldsForStep(currentStep);
    const isValid = await trigger(fieldsToValidate);

    if (isValid) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length));
    }
  };

  const prevStep = () => {
    setDuplicateCheck(null);
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  // Only what the database needs is required: names, ID number, date of birth and sex
  const getFieldsForStep = (step: number) => {
    switch (step) {
      case 1:
        return ['firstName', 'lastName', 'idNumber', 'dateOfBirth', 'gender', 'oldFileNumber'] as const;
      case 2:
        return ['cellNo', 'email'] as const;
      case 3:
        return ['medicalAid.dependantCode'] as const; // Medical aid is optional; a dependant code must be digits
      case 4:
        return [] as const; // Next of kin is optional - don't auto-advance
      default:
        return [] as const;
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setValue('dateOfBirth', format(date, 'yyyy-MM-dd'));
      setShowDatePicker(false);
    }
  };

  /** Inserts the patient, then the medical aid and next of kin. Only called once duplicates were checked. */
  const savePatient = async (data: PatientRegistrationFormData, practiceId: string) => {
    setIsSubmitting(true);
    // Set once the patient row exists: if the medical aid or next of kin insert fails after that, the
    // patient IS registered, and "please try again" would only lead to a duplicate-ID error.
    let registeredPatient: RegisteredPatient | null = null;
    try {
      const idNumberToSave = normalizeIdNumber(data.idNumber);
      const oldFileNumber = normalizeOldFileNumber(data.oldFileNumber);
      // Insert patient data
      const { data: patientData, error: patientError } = await untypedDb
        .from('patients')
        .insert([{
          first_name: data.firstName.trim(),
          last_name: data.lastName.trim(),
          id_number: idNumberToSave,
          date_of_birth: data.dateOfBirth,
          gender: data.gender,
          marital_status: data.maritalStatus || null,
          occupation: data.occupation || null,
          employer: (data.employer ?? '').trim() || null,
          // Only once the columns exist, so the registration never fails before the SQL is applied
          ...(titleColumnsAvailable ? { title: data.title || null, initials: normalizeInitials(data.initials) || null } : {}),
          cell_number: data.cellNo || null,
          home_language: data.homeLanguage || 'English', // Default to English if not selected
          email: data.email || null,
          home_address: data.homeAddress || null,
          postal_address: data.postalAddress || null,
          postal_code: data.postalCode || null,
          ...(townColumnsAvailable ? { town: (data.town ?? '').trim() || null, region: toNamibianRegion(data.region) } : {}),
          ...(referralColumnsAvailable ? referralColumns(referralAnswer) : {}),
          practice_id: practiceId,
          // Only when typed: patients who had a paper file or an account in the previous system are found by it
          ...(oldFileNumber ? { legacy_account_number: oldFileNumber } : {})
        }])
        .select()
        .single();

      if (patientError) {
        // The ID number is unique per practice: a file saved at the same moment that the duplicate check could not see
        if (isDuplicateIdNumberError(patientError)) {
          throw new Error(`ID number ${idNumberToSave} is already on another file at this practice. Search for it on the Patients page, or check the number against the ID document.`);
        }
        throw patientError;
      }
      registeredPatient = patientData as RegisteredPatient;

      // Insert medical aid details if provided
      if (data.medicalAid.provider) {
        const selectedProviderData = providers.find(p => p.id === data.medicalAid.provider);
        const selectedSchemeData = schemes.find(s => s.id === data.medicalAid.scheme);
        const relationshipToMain = data.medicalAid.relationship || MAIN_MEMBER_RELATIONSHIP;
        const isMainMember = isMainMemberRelationship(relationshipToMain);
        // The main member is the patient themselves, or the person named on the card for a spouse or child
        const mainMemberName = isMainMember
          ? composeMainMemberName({ surname: data.lastName, initials: initialsOf(data.firstName) })
          : composeMainMemberName({ surname: data.medicalAid.mainMemberSurname ?? '', initials: data.medicalAid.mainMemberInitials ?? '' });
        const mainMemberIdNumber = isMainMember ? idNumberToSave : normalizeIdNumber(data.medicalAid.mainMemberIdNumber);
        const dependantCode = normalizeDependantCode(data.medicalAid.dependantCode);

        const { error: medicalAidError } = await untypedDb
          .from('medical_aid_details')
          .insert([{
            patient_id: registeredPatient.id,
            provider: selectedProviderData?.name || data.medicalAid.provider,
            scheme: selectedSchemeData?.name || data.medicalAid.scheme,
            plan_type: selectedSchemeData?.name || data.medicalAid.scheme,
            medical_aid_provider_id: data.medicalAid.provider,
            membership_number: (data.medicalAid.membershipNumber ?? '').trim(),
            main_member_name: mainMemberName,
            main_member_id_number: mainMemberIdNumber,
            relationship_to_main: relationshipToMain,
            // Only once the column exists, so the save never fails before the SQL is applied
            ...(dependantCodeAvailable && dependantCode ? { dependant_code: dependantCode } : {})
          }]);

        if (medicalAidError) throw medicalAidError;
      }

      // Insert next of kin
      if (data.nextOfKin.name) {
        const { error: nextOfKinError } = await supabase
          .from('next_of_kin')
          .insert([{
            patient_id: registeredPatient.id,
            name: data.nextOfKin.name,
            relationship: data.nextOfKin.relationship,
            phone: data.nextOfKin.phone,
            address: data.nextOfKin.address
          }]);

        if (nextOfKinError) throw nextOfKinError;
      }

      // The photo is stored once the file exists (its folder is the file's); a failure leaves the file registered
      if (photo && photoColumnAvailable) {
        try {
          await savePatientPhoto({ practiceId, patientId: registeredPatient.id, photo });
        } catch (photoError) {
          console.error('Could not save the patient photo:', photoError);
          toast.error(`${registeredPatient.first_name} ${registeredPatient.last_name} was registered, but the photo was not saved. Add it on the patient file.`);
        }
      }

    } catch (error) {
      console.error('Error registering patient:', error);
      if (registeredPatient) {
        toast.error(`${registeredPatient.first_name} ${registeredPatient.last_name} was registered, but the medical aid or next of kin details were not saved. Add them from the patient's profile.`);
      } else {
        toast.error(`Couldn't register the patient. ${error instanceof Error ? plainWords(error.message) : 'Please try again.'}`);
      }
    } finally {
      setIsSubmitting(false);
    }
    if (registeredPatient) onSuccess?.(registeredPatient);
  };

  const onSubmit = async (data: PatientRegistrationFormData) => {
    // Only allow submission if explicitly allowed (via submit button click)
    if (!allowSubmitRef.current || currentStep !== steps.length) {
      return;
    }

    allowSubmitRef.current = false; // Reset to prevent accidental re-submission
    setIsSubmitting(true);
    let practiceId: string | null = null;
    let matches: DuplicateMatch[] = [];
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error('Please sign in before registering a patient.');

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('practice_id')
        .eq('id', user.id)
        .single();
      if (userError) throw userError;
      practiceId = (userData as { practice_id?: string | null } | null)?.practice_id ?? null;
      if (!practiceId) throw new Error('No practice is assigned to your account.');

      // Same ID number, same name and date of birth, same cell number and date of birth, and (when typed) the same
      // medical aid membership or old file number
      const fund = providers.find(provider => provider.id === data.medicalAid.provider);
      matches = await findPracticeDuplicates(practiceId, {
        firstName: data.firstName,
        lastName: data.lastName,
        idNumber: data.idNumber,
        dateOfBirth: data.dateOfBirth,
        cellNumber: data.cellNo,
        oldFileNumber: data.oldFileNumber,
        membership: data.medicalAid.provider
          ? {
              fundId: data.medicalAid.provider,
              // Saved medical aids keep the provider's name (provider); its id where they have one
              fundName: fund?.name ?? null,
              number: data.medicalAid.membershipNumber,
              dependantCode: data.medicalAid.dependantCode
            }
          : null
      });
    } catch (error) {
      console.error('Error registering patient:', error);
      toast.error(`Couldn't register the patient. ${error instanceof Error ? plainWords(error.message) : 'Please try again.'}`);
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(false);

    if (matches.length > 0) {
      setDuplicateCheck({ matches, data, practiceId });
      return;
    }
    await savePatient(data, practiceId);
  };

  const saveAnyway = async () => {
    if (!duplicateCheck) return;
    const { data, practiceId } = duplicateCheck;
    setDuplicateCheck(null);
    await savePatient(data, practiceId);
  };

  // "Complete this file": the caller's temporary file (booked with a name and cell) gets what was typed here, so the
  // person keeps one file and their booking stays on it. Done once the file is complete; cancelling keeps the choice.
  const finishCompletingFile = async () => {
    const file = completingFile;
    setCompletingFile(null);
    if (!file || !duplicateCheck) return;
    let complete = false;
    try {
      complete = (await loadPatientFileStatus(file.id))?.incomplete === false;
    } catch (error) {
      console.error('Could not check the completed file:', error);
    }
    if (!complete) return;
    const { data } = duplicateCheck;
    setDuplicateCheck(null);
    onSuccess?.({ id: file.id, first_name: data.firstName.trim(), last_name: data.lastName.trim() });
  };

  const sameIdNumberOnFile = duplicateCheck?.matches.some(match => match.reasons.includes('id_number')) ?? false;
  const inputClass = 'w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500';
  const labelClass = 'text-sm font-medium text-gray-700';

  return (
    <div className="space-y-6">
      {/* Modern Step Progress Bar */}
      <div className="relative">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center">
                <div
                  className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    currentStep > step.id
                      ? 'bg-green-500 text-white shadow-lg'
                      : currentStep === step.id
                      ? 'text-white shadow-lg'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                  style={{
                    backgroundColor: currentStep === step.id ? step.color : undefined
                  }}
                >
                  {currentStep > step.id ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <step.icon className="w-5 h-5" />
                  )}
                </div>
                <span className={`text-xs mt-2 font-medium ${
                  currentStep >= step.id ? 'text-gray-900' : 'text-gray-500'
                }`}>
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-4 transition-all duration-300 ${
                  currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {currentStep === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {titleColumnsAvailable && (
                  <div className="space-y-1">
                    <label htmlFor="registration-title" className="text-sm font-medium text-gray-700">Title</label>
                    <select
                      id="registration-title"
                      {...register('title')}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">No title</option>
                      {PATIENT_TITLES.map(title => (
                        <option key={title} value={title}>{title}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-500" />
                    First Name *
                  </label>
                  <input
                    type="text"
                    {...register('firstName', {
                      required: 'First name is required',
                      // Initials follow the first names as they are typed, until reception types their own
                      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                        if (!titleColumnsAvailable) return;
                        const initials = followInitials(getValues('initials'), firstNamesRef.current, event.target.value);
                        firstNamesRef.current = event.target.value;
                        if (initials !== null) setValue('initials', initials);
                      }
                    })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter first name"
                  />
                  {errors.firstName && (
                    <p className="text-xs text-red-500">{errors.firstName.message}</p>
                  )}
                </div>

                {titleColumnsAvailable && (
                  <div className="space-y-1">
                    <label htmlFor="registration-initials" className="text-sm font-medium text-gray-700">Initials</label>
                    <input
                      id="registration-initials"
                      type="text"
                      autoComplete="off"
                      maxLength={10}
                      {...register('initials')}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      aria-describedby="registration-initials-hint"
                    />
                    <p id="registration-initials-hint" className="text-xs text-gray-500">Filled in from the first names; change them if needed.</p>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Last Name *</label>
                  <input
                    type="text"
                    {...register('lastName', { required: 'Last name is required' })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter last name"
                  />
                  {errors.lastName && (
                    <p className="text-xs text-red-500">{errors.lastName.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label htmlFor="registration-id-number" className="text-sm font-medium text-gray-700">ID Number *</label>
                  <input
                    id="registration-id-number"
                    type="text"
                    autoComplete="off"
                    {...register('idNumber', { required: 'ID number is required (a passport number for visitors)' })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="11-digit ID, or passport number"
                    aria-describedby="registration-id-number-hint"
                  />
                  <div id="registration-id-number-hint" aria-live="polite">
                    {errors.idNumber ? (
                      <p className="text-xs text-red-500">{errors.idNumber.message}</p>
                    ) : idCheck.warning ? (
                      <p className="text-xs text-amber-700">{idCheck.warning}</p>
                    ) : idCheck.dateOfBirth ? (
                      <p className="text-xs text-emerald-700">Date of birth from the ID number: {formatBirthDate(idCheck.dateOfBirth)}</p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    Date of Birth *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      {...register('dateOfBirth', { required: 'Date of birth is required' })}
                      value={selectedDate ? format(selectedDate, 'dd/MM/yyyy') : ''}
                      onClick={() => setShowDatePicker(!showDatePicker)}
                      readOnly
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                      placeholder="Select date"
                    />
                    {showDatePicker && (
                      <div className="absolute top-full left-0 z-50 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3">
                        <DayPicker
                          mode="single"
                          selected={selectedDate}
                          onSelect={handleDateSelect}
                          captionLayout="dropdown-buttons"
                          fromYear={1900}
                          toYear={new Date().getFullYear()}
                          disabled={(date) => date > new Date()}
                          className="text-sm"
                          styles={{
                            day_selected: {
                              backgroundColor: '#3b82f6',
                              color: 'white'
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                  {errors.dateOfBirth && (
                    <p className="text-xs text-red-500">{errors.dateOfBirth.message}</p>
                  )}
                  {!errors.dateOfBirth && birthDateWarning && (
                    <p className="text-xs text-amber-700">{birthDateWarning}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Gender *</label>
                  <select
                    {...register('gender', { required: 'Gender is required' })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                  {errors.gender && (
                    <p className="text-xs text-red-500">{errors.gender.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Marital Status</label>
                  <select
                    {...register('maritalStatus')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select status</option>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="divorced">Divorced</option>
                    <option value="widowed">Widowed</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-blue-500" />
                    Occupation
                  </label>
                  <input
                    type="text"
                    {...register('occupation')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter occupation"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="registration-employer" className="text-sm font-medium text-gray-700">Employer</label>
                  <input
                    id="registration-employer"
                    type="text"
                    {...register('employer')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter employer name"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Home Language</label>
                  <select
                    {...register('homeLanguage')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="English">English</option>
                    <option value="Afrikaans">Afrikaans</option>
                    <option value="Oshiwambo">Oshiwambo</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="registration-old-file-number" className="text-sm font-medium text-gray-700">Old file number</label>
                  <input
                    id="registration-old-file-number"
                    type="text"
                    autoComplete="off"
                    maxLength={OLD_FILE_NUMBER_MAX_LENGTH}
                    {...register('oldFileNumber', { validate: value => oldFileNumberProblem(value) ?? true })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="If the patient has one"
                    aria-describedby="registration-old-file-number-hint"
                  />
                  <div id="registration-old-file-number-hint" aria-live="polite">
                    {errors.oldFileNumber ? (
                      <p className="text-xs text-red-500">{errors.oldFileNumber.message}</p>
                    ) : (
                      <p className="text-xs text-gray-500">The number on the paper file or in your previous system. The patient is found by it.</p>
                    )}
                  </div>
                </div>

                {referralColumnsAvailable && (
                  <ReferralSourceFields
                    id="registration-referral-source"
                    value={referralAnswer}
                    onChange={setReferralAnswer}
                    labelClassName={labelClass}
                    inputClassName="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                )}

                {photoColumnAvailable && <RegistrationPhotoField value={photo} onChange={setPhoto} labelClassName={labelClass} />}
              </div>
            )}

            {currentStep === 2 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-green-500" />
                    Cell Number
                  </label>
                  <input
                    type="tel"
                    {...register('cellNo')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Enter cell number"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-green-500" />
                    Email Address
                  </label>
                  <input
                    type="email"
                    {...register('email')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Enter email address"
                  />
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-green-500" />
                    Home Address
                  </label>
                  <textarea
                    {...register('homeAddress')}
                    rows={2}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                    placeholder="Enter home address"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Postal Address</label>
                  <textarea
                    {...register('postalAddress')}
                    rows={2}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                    placeholder="Enter postal address"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Postal Code</label>
                  <input
                    type="text"
                    {...register('postalCode')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Enter postal code"
                  />
                </div>

                {townColumnsAvailable && (
                  <>
                    <div className="space-y-1">
                      <label htmlFor="registration-town" className="text-sm font-medium text-gray-700">Town</label>
                      <TownPicker
                        id="registration-town"
                        value={townValue ?? ''}
                        onChange={value => setValue('town', value)}
                        onPick={(town, region) => {
                          setValue('town', town);
                          setValue('region', region);
                        }}
                        inputClassName="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="registration-region" className="text-sm font-medium text-gray-700">Region</label>
                      <RegionSelect
                        id="registration-region"
                        value={regionValue ?? ''}
                        onChange={value => setValue('region', value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {currentStep === 3 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-500" />
                    Medical Aid Provider
                  </label>
                  <select
                    {...register('medicalAid.provider')}
                    className={inputClass}
                    disabled={loadingProviders}
                  >
                    <option value="">None (private patient)</option>
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-purple-500" />
                    Scheme/Option
                  </label>
                  <select
                    {...register('medicalAid.scheme')}
                    className={inputClass}
                    disabled={!selectedProvider || loadingSchemes}
                  >
                    <option value="">Select scheme</option>
                    {schemes.map((scheme) => (
                      <option key={scheme.id} value={scheme.id}>
                        {scheme.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedProvider && (
                  <>
                    <div className="space-y-1">
                      <label htmlFor="registration-membership" className={labelClass}>Membership Number</label>
                      <input
                        id="registration-membership"
                        type="text"
                        autoComplete="off"
                        {...register('medicalAid.membershipNumber')}
                        className={inputClass}
                        placeholder="As on the card"
                        aria-describedby="registration-membership-hint"
                      />
                      <p id="registration-membership-hint" className="text-xs text-amber-700" aria-live="polite">
                        {membershipHint}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className={labelClass}>Relationship to Main Member</label>
                      <select
                        {...register('medicalAid.relationship')}
                        className={inputClass}
                      >
                        <option value="self">Self (main member)</option>
                        <option value="spouse">Spouse</option>
                        <option value="child">Child</option>
                        <option value="parent">Parent</option>
                        <option value="other">Other dependant</option>
                      </select>
                    </div>

                    {isDependant && (
                      <MainMemberFields
                        surnameField={register('medicalAid.mainMemberSurname')}
                        initialsField={register('medicalAid.mainMemberInitials')}
                        idNumberField={register('medicalAid.mainMemberIdNumber')}
                        surname={mainMemberSurname}
                        initials={mainMemberInitials}
                        inputClassName={inputClass}
                        labelClassName={labelClass}
                      />
                    )}

                    {dependantCodeAvailable && (
                      <DependantCodeInput
                        field={register('medicalAid.dependantCode', { validate: value => dependantCodeProblem(value) ?? true })}
                        error={errors.medicalAid?.dependantCode?.message}
                        inputClassName={inputClass}
                        labelClassName={labelClass}
                      />
                    )}
                  </>
                )}
              </div>
            )}

            {currentStep === 4 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Users className="w-4 h-4 text-orange-500" />
                    Next of Kin Name
                  </label>
                  <input
                    type="text"
                    {...register('nextOfKin.name')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Enter next of kin name"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-orange-500" />
                    Relationship
                  </label>
                  <input
                    type="text"
                    {...register('nextOfKin.relationship')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="e.g., Spouse, Parent, Sibling"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-orange-500" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    {...register('nextOfKin.phone')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Enter phone number"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-orange-500" />
                    Address
                  </label>
                  <textarea
                    {...register('nextOfKin.address')}
                    rows={2}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                    placeholder="Enter address"
                  />
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Possible existing file for this person: nothing is saved until reception decides */}
        {duplicateCheck && (
          <div role="alert" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <div>
              <p className="font-semibold text-amber-900">This patient may already have a file</p>
              <p className="text-sm text-amber-900">
                {sameIdNumberOnFile
                  ? 'The ID number is already on a file below, so it cannot be registered twice. Use that file, or go back and correct the number.'
                  : 'Use the existing file so the history stays in one place, or save a new file if this is someone else (twins share a birthday and often a cell number).'}
              </p>
            </div>
            <ul className="space-y-2">
              {duplicateCheck.matches.map(({ patient, reasons }) => {
                // A file booked with a name and cell only: its placeholders are not shown, and it is completed with
                // what was typed here instead of being used as it is
                const file = patientFileStatus(patient);
                return (
                <li key={patient.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-amber-200">
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold text-gray-900">{patient.first_name} {patient.last_name}</p>
                    <p className="text-gray-600">
                      {[
                        file.incomplete ? 'File not complete' : null,
                        file.dateOfBirth ? `Born ${formatBirthDate(file.dateOfBirth)}` : null,
                        !file.incomplete && patient.id_number ? `ID ${patient.id_number}` : null,
                        patient.cell_number,
                        patient.legacy_account_number ? `Old file no. ${patient.legacy_account_number}` : null
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <p className="text-xs text-amber-800">{reasons.map(reason => DUPLICATE_REASON_LABELS[reason]).join(', ')}</p>
                  </div>
                  {file.incomplete ? (
                    <button
                      type="button"
                      onClick={() => setCompletingFile(patient)}
                      className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
                    >
                      Complete this file
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : onUseExisting && (
                    <button
                      type="button"
                      onClick={() => {
                        setDuplicateCheck(null);
                        onUseExisting({ id: patient.id, first_name: patient.first_name ?? '', last_name: patient.last_name ?? '' });
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
                    >
                      Use this patient
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setDuplicateCheck(null)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Go back
              </button>
              {!sameIdNumberOnFile && (
                <button
                  type="button"
                  onClick={() => void saveAnyway()}
                  disabled={isSubmitting}
                  className="rounded-lg border border-amber-400 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                >
                  Save as a new patient
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navigation Buttons: stay in view at the bottom of a scrolling modal, so Previous/Next and
            Complete Registration are always reachable on a phone */}
        <div className="sticky bottom-0 z-10 flex justify-between gap-3 py-3 bg-white border-t border-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>

          {currentStep < steps.length ? (
            <button
              type="button"
              onClick={nextStep}
              className="justify-center rounded-lg font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 flex items-center gap-2"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting || duplicateCheck !== null}
              onClick={() => { allowSubmitRef.current = true; }}
              className={`justify-center rounded-lg font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 px-4 py-2 flex items-center gap-2 ${
                isSubmitting
                  ? 'opacity-50 cursor-not-allowed bg-gradient-to-r from-blue-600 to-purple-600'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
              } text-white`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Registering...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Complete Registration
                </>
              )}
            </button>
          )}
        </div>
      </form>

      {/* Outside the form: the edit form's own submit must not bubble into this one */}
      {completingFile && duplicateCheck && (
        <CompletePatientFileModal
          patientId={completingFile.id}
          isOpen
          prefill={registrationAsFile(duplicateCheck.data)}
          onClose={() => void finishCompletingFile()}
        />
      )}
    </div>
  );
};

export default ModernPatientRegistrationForm;
