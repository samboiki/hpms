import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { User, Phone, Stethoscope, Shield, Users, MapPin, Heart } from 'lucide-react';
import { errorMessage } from './formErrors';
import { windhoekClock } from '../../utils/patientLists/listDates';
import { birthDateMismatch, birthDateToFill, checkIdNumber, normalizeIdNumber } from '../../utils/patients/namibianId';
import {
  MAIN_MEMBER_RELATIONSHIP,
  composeMainMemberName,
  dependantCodeProblem,
  initialsOf,
  isMainMemberRelationship,
  membershipNumberHint,
  normalizeDependantCode,
  normalizeInitials,
  relationshipOption,
  splitMainMemberName
} from '../../utils/patients/medicalAidMember';
import { followInitials, titleOptions } from '../../utils/patients/patientName';
import {
  TEMPORARY_BIRTH_DATE,
  TEMPORARY_GENDER,
  describeMissing,
  isTemporaryIdNumber,
  patientFileStatus,
  type MissingDetail
} from '../../utils/patients/temporaryPatient';
import { isDuplicateIdNumberError } from '../../services/patientDuplicateService';
import { loadPatientFileNumbers } from '../../services/patientFileService';
import { isImportedOldFileNumber } from '../../services/import/eminanceImportService';
import {
  OLD_FILE_NUMBER_MAX_LENGTH,
  PATIENT_FILE_NUMBERS_CHANGED,
  normalizeOldFileNumber,
  oldFileNumberProblem
} from '../../utils/patients/patientNumbers';
import { DependantCodeInput, MainMemberFields } from './medicalAid/MainMemberFields';
import { useDependantCodeColumn } from './medicalAid/dependantCode';
import { usePatientTitleColumns } from './patientTitleColumns';
import { usePatientTownColumns } from './patientTownColumns';
import { ReferralSourceFields } from '../patients/referralSource/ReferralSourceFields';
import { useReferralSourceOnFile } from '../patients/referralSource/useReferralSourceOnFile';
import { RegionSelect, TownPicker } from '../address/TownPicker';
import { toNamibianRegion } from '../../utils/address/namibianTowns';
import { useRecordChangeGuard } from '../records/RecordChangeGuard';

// Writes go through the untyped client where the generated types do not know dependant_code yet
const untypedDb = supabase as unknown as SupabaseClient;

interface EditPatientFormData {
  title: string;
  first_name: string;
  initials: string;
  last_name: string;
  id_number: string;
  email: string;
  cell_number: string;
  date_of_birth: string;
  gender: string;
  marital_status: string;
  occupation: string;
  employer: string;
  home_language: string;
  home_address: string;
  postal_address: string;
  postal_code: string;
  /** patients.town and patients.region, once the columns exist (proposals/2026-10-13-patient-town.sql) */
  town: string;
  region: string;
  /** patients.legacy_account_number: the paper file's number or the account number in the previous system */
  old_file_number: string;

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
  short_name: string | null;
  medical_aid_reference?: string | null;
}

interface MedicalAidScheme {
  id: string;
  provider_id?: string;
  name: string;
  description: string | null;
}

interface MedicalAidDetails {
  id: string;
  provider: string;
  scheme: string;
  membership_number: string;
  main_member_name: string;
  main_member_id_number: string;
  relationship_to_main: string;
  medical_aid_provider_id: string | null;
  /** Only once proposals/2026-10-07-dependant-code.sql is applied */
  dependant_code?: string | null;
}

interface NextOfKinDetails {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  address: string | null;
}

/** What a caller fills the form with (registration passes what was typed when it completes a temporary file) */
export type EditPatientInitialData = Partial<EditPatientFormData> & {
  /** The file's updated_at when these values were read: a save after someone else changed the file warns first */
  updated_at?: string | null;
};

interface Props {
  patientId: string;
  initialData: EditPatientInitialData;
  onSuccess: () => void;
}

const EditPatientFormBody: React.FC<Props & { onReload: () => void }> = ({ patientId, initialData, onSuccess, onReload }) => {
  const [activeTab, setActiveTab] = useState('personal');
  const [providers, setProviders] = useState<MedicalAidProvider[]>([]);
  const [schemes, setSchemes] = useState<MedicalAidScheme[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [loadingSchemes, setLoadingSchemes] = useState(false);
  const [medicalAidDetails, setMedicalAidDetails] = useState<MedicalAidDetails | null>(null);
  const [nextOfKinDetails, setNextOfKinDetails] = useState<NextOfKinDetails | null>(null);
  // The ID number as loaded: only a changed number is written back (the column is unique)
  const savedIdNumberRef = useRef<string | null>(null);
  const dependantCodeAvailable = useDependantCodeColumn();
  const titleColumnsAvailable = usePatientTitleColumns();
  const townColumnsAvailable = usePatientTownColumns();
  // "How did you hear about us?" (owner, 13 Oct 2026): shown and saved once read from the file
  const referral = useReferralSourceOnFile(patientId);
  // What a file opened with a name and cell only still needs; empty for a complete file
  const [stillMissing, setStillMissing] = useState<MissingDetail[]>([]);
  const isTemporaryFile = stillMissing.includes('ID number');
  // The date of birth last filled in from the ID number, and the first names before the last keystroke
  const birthDateFromIdRef = useRef<string | null>(null);
  const firstNamesRef = useRef(initialData?.first_name ?? '');
  // The values the form opened with (callers pass a new object on every render, so effects read this copy)
  const initialDataRef = useRef(initialData);
  // The old file number as saved; editable unless an Eminance import wrote it (statements and claims there quote it)
  const [savedOldFileNumber, setSavedOldFileNumber] = useState<{ value: string; fromImport: boolean } | null>(null);
  // A change someone else saved after the values on this form were read is never overwritten silently (parity Q12)
  const versionGuard = useRecordChangeGuard({
    reload: "The form shows this patient's details as they are saved now. What you typed here is lost; type it again if it is still needed.",
    save: "Your form replaces this patient's details as they are saved now."
  });
  const { remember: rememberVersion, rememberCurrent: rememberCurrentVersion } = versionGuard;
  useEffect(() => {
    // The version read with the values passed in, else the file as saved when the form opens
    const openedAt = initialDataRef.current?.updated_at;
    if (openedAt !== undefined) rememberVersion([{ kind: 'patient', id: patientId, updatedAt: openedAt }]);
    else void rememberCurrentVersion([{ kind: 'patient', id: patientId }]);
  }, [patientId, rememberVersion, rememberCurrentVersion]);

  const { register, handleSubmit, watch, setValue, getValues, formState: { errors, isSubmitting } } = useForm<EditPatientFormData>({
    defaultValues: {
      ...initialData,
      id_number: initialData?.id_number ?? '',
      medicalAid: {
        provider: '',
        scheme: '',
        membershipNumber: '',
        mainMemberSurname: '',
        mainMemberInitials: '',
        mainMemberIdNumber: '',
        relationship: '',
        dependantCode: '',
        ...initialData?.medicalAid
      },
      nextOfKin: {
        name: '',
        relationship: '',
        phone: '',
        address: '',
        ...initialData?.nextOfKin
      }
    }
  });
  
  const selectedProvider = watch('medicalAid.provider');
  const idNumber = watch('id_number');
  const dateOfBirth = watch('date_of_birth');
  const relationship = watch('medicalAid.relationship');
  const membershipNumber = watch('medicalAid.membershipNumber');
  const mainMemberSurname = watch('medicalAid.mainMemberSurname');
  const mainMemberInitials = watch('medicalAid.mainMemberInitials');
  const townValue = watch('town');
  const regionValue = watch('region');
  const idCheck = useMemo(() => checkIdNumber(idNumber, windhoekClock(new Date()).dateKey), [idNumber]);
  const birthDateWarning = birthDateMismatch(idCheck, dateOfBirth);
  const isDependant = !!relationship && !isMainMemberRelationship(relationship);
  const providerRecord = providers.find(provider => provider.id === selectedProvider);
  const membershipHint = providerRecord
    ? membershipNumberHint({ reference: providerRecord.medical_aid_reference, shortName: providerRecord.short_name, name: providerRecord.name }, membershipNumber)
    : null;

  // The ID number is not passed in by every caller: read it so it can be corrected here. A file opened with a name and
  // cell only shows its placeholders (ID number, date of birth, gender) as blank fields for reception to fill in.
  useEffect(() => {
    let active = true;
    const loadIdNumber = async () => {
      const { data, error } = await supabase.from('patients').select('id_number, date_of_birth, gender').eq('id', patientId).maybeSingle();
      if (!active || error || !data) return;
      const saved = (data as { id_number?: string | null }).id_number ?? '';
      savedIdNumberRef.current = saved;
      const status = patientFileStatus(data as { id_number?: string | null; date_of_birth?: string | null; gender?: string | null });
      setStillMissing(status.missing);
      // Real values passed in (registration typed them) are kept; the file's placeholders never are
      const passed = initialDataRef.current;
      const passedId = normalizeIdNumber(passed?.id_number);
      setValue('id_number', status.incomplete ? (isTemporaryIdNumber(passedId) ? '' : passedId) : saved);
      const passedBirthDate = passed?.date_of_birth ?? '';
      if (status.missing.includes('date of birth') && (!passedBirthDate || passedBirthDate === TEMPORARY_BIRTH_DATE)) setValue('date_of_birth', '');
      const passedGender = passed?.gender ?? '';
      if (status.missing.includes('gender') && (!passedGender || passedGender === TEMPORARY_GENDER)) setValue('gender', '');
    };
    void loadIdNumber();
    return () => {
      active = false;
    };
  }, [patientId, setValue]);

  // Title and initials, once the columns exist; initials left blank start as the first names' initials
  const [savedTitle, setSavedTitle] = useState<string | null>(null);
  useEffect(() => {
    if (!titleColumnsAvailable) return;
    let active = true;
    const loadTitle = async () => {
      const { data, error } = await untypedDb.from('patients').select('title, initials').eq('id', patientId).maybeSingle();
      if (!active || error) return;
      const saved = (data ?? {}) as { title?: string | null; initials?: string | null };
      // What is on the file first, then what was passed in (registration), then the first names' initials
      setSavedTitle(saved.title || initialDataRef.current?.title || '');
      setValue('initials', saved.initials || initialDataRef.current?.initials || initialsOf(getValues('first_name')));
    };
    void loadTitle();
    return () => {
      active = false;
    };
  }, [titleColumnsAvailable, patientId, setValue, getValues]);
  // Selected once its option is on screen (a title outside the list is added as an option of its own)
  useEffect(() => {
    if (savedTitle !== null) setValue('title', savedTitle);
  }, [savedTitle, setValue]);

  // Town and region, once the columns exist: what is on the file, else what registration passed in. Shown and saved
  // only once read, so a save never blanks a town the form had not loaded yet
  const [townLoaded, setTownLoaded] = useState(false);
  useEffect(() => {
    if (!townColumnsAvailable) return;
    let active = true;
    const loadTown = async () => {
      const { data, error } = await untypedDb.from('patients').select('town, region').eq('id', patientId).maybeSingle();
      if (!active || error) return;
      const saved = (data ?? {}) as { town?: string | null; region?: string | null };
      setValue('town', saved.town || initialDataRef.current?.town || '');
      setValue('region', saved.region || initialDataRef.current?.region || '');
      setTownLoaded(true);
    };
    void loadTown();
    return () => {
      active = false;
    };
  }, [townColumnsAvailable, patientId, setValue]);

  // The old file number: what is on the file, else what registration passed in (completing a temporary file)
  useEffect(() => {
    let active = true;
    const loadOldFileNumber = async () => {
      try {
        const numbers = await loadPatientFileNumbers(patientId);
        if (!numbers.oldFileNumberAvailable) return;
        const saved = numbers.oldFileNumber ?? '';
        const fromImport = saved ? await isImportedOldFileNumber(patientId, saved) : false;
        if (!active) return;
        setSavedOldFileNumber({ value: saved, fromImport });
        setValue('old_file_number', saved || normalizeOldFileNumber(initialDataRef.current?.old_file_number));
      } catch (error) {
        // The field stays hidden, so nothing is overwritten by a guess
        console.error('Could not read the old file number:', error);
      }
    };
    void loadOldFileNumber();
    return () => {
      active = false;
    };
  }, [patientId, setValue]);

  // Completing a file: a Namibian ID number fills in a blank date of birth (a date reception chose is never replaced)
  useEffect(() => {
    const fromId = birthDateToFill(idCheck.dateOfBirth, getValues('date_of_birth'), birthDateFromIdRef.current);
    if (!fromId) return;
    birthDateFromIdRef.current = fromId;
    setValue('date_of_birth', fromId, { shouldValidate: true });
  }, [idCheck.dateOfBirth, getValues, setValue]);

  // Fetch medical aid providers
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        let data, error;
        
        try {
          const result = await supabase.rpc('get_medical_aid_providers');
          data = result.data;
          error = result.error;
        } catch (funcError) {
          const result = await supabase
            .from('medical_aid_providers')
            .select('id, name, short_name')
            .order('name');
          data = result.data;
          error = result.error;
        }

        if (error) throw error;
        setProviders(data || []);
      } catch (error) {
        console.error('Error fetching providers:', error);
        toast.error(`Couldn't load the medical aid list: ${errorMessage(error)}`);
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
          setSchemes(data || []);
        } catch (error) {
          console.error('Error fetching schemes:', error);
          toast.error(`Couldn't load the schemes for this medical aid: ${errorMessage(error)}`);
        } finally {
          setLoadingSchemes(false);
        }
      };

      fetchSchemes();
    } else {
      setSchemes([]);
    }
  }, [selectedProvider]);

  // The saved record holds the scheme's name but the options are keyed by id, so the patient's scheme
  // showed as "Select scheme". Once the options have rendered, select the one with the saved name.
  useEffect(() => {
    const savedScheme = schemes.find(scheme => scheme.name === getValues('medicalAid.scheme'));
    if (savedScheme) setValue('medicalAid.scheme', savedScheme.id);
  }, [schemes, getValues, setValue]);

  // Fetch existing medical aid details
  useEffect(() => {
    const fetchMedicalAidDetails = async () => {
      try {
        const { data, error } = await supabase
          .from('medical_aid_details')
          .select('*')
          .eq('patient_id', patientId)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;
        
        if (data) {
          setMedicalAidDetails(data);
          // Set form values
          setValue('medicalAid.provider', data.medical_aid_provider_id || '');
          setValue('medicalAid.scheme', data.scheme || '');
          setValue('medicalAid.membershipNumber', data.membership_number || '');
          // An older full name ("Johannes Ndapewa Shilongo") is read back as surname and initials
          const mainMember = splitMainMemberName(data.main_member_name, getValues('last_name'));
          setValue('medicalAid.mainMemberSurname', mainMember.surname);
          setValue('medicalAid.mainMemberInitials', mainMember.initials);
          setValue('medicalAid.mainMemberIdNumber', data.main_member_id_number || '');
          setValue('medicalAid.relationship', relationshipOption(data.relationship_to_main));
          setValue('medicalAid.dependantCode', (data as MedicalAidDetails).dependant_code || '');
        }
      } catch (error) {
        console.error('Error fetching medical aid details:', error);
        // Without the saved record, choosing a provider would add a second medical aid instead of updating it
        toast.error(`Couldn't load this patient's medical aid. Close and reopen the form before changing it. (${errorMessage(error)})`);
      }
    };

    fetchMedicalAidDetails();
  }, [patientId, setValue, getValues]);

  // Fetch existing next of kin details
  useEffect(() => {
    const fetchNextOfKinDetails = async () => {
      try {
        const { data, error } = await supabase
          .from('next_of_kin')
          .select('*')
          .eq('patient_id', patientId)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;
        
        if (data) {
          setNextOfKinDetails(data);
          // Set form values
          setValue('nextOfKin.name', data.name || '');
          setValue('nextOfKin.relationship', data.relationship || '');
          setValue('nextOfKin.phone', data.phone || '');
          setValue('nextOfKin.address', data.address || '');
        }
      } catch (error) {
        console.error('Error fetching next of kin details:', error);
        toast.error(`Couldn't load this patient's next of kin. Close and reopen the form before changing it. (${errorMessage(error)})`);
      }
    };

    fetchNextOfKinDetails();
  }, [patientId, setValue]);

  const onSubmit = async (data: EditPatientFormData) => {
    // The provider list starts empty when the saved record has no provider id, so only a provider that
    // was loaded and then cleared means "remove"; leaving an empty list as it was must not delete anything
    const removesMedicalAid = !data.medicalAid.provider && !!medicalAidDetails?.medical_aid_provider_id;
    const removesNextOfKin = !data.nextOfKin.name && !!nextOfKinDetails;
    if (removesMedicalAid && !window.confirm(`Remove the ${medicalAidDetails?.provider} medical aid from this patient? This cannot be undone.`)) return;
    if (removesNextOfKin && !window.confirm(`Remove ${nextOfKinDetails?.name} as this patient's next of kin? This cannot be undone.`)) return;
    // Someone else saved this file after the form read it: the person chooses before anything is written
    const decision = await versionGuard.confirmSave();
    if (decision === 'reload') {
      onReload();
      return;
    }
    if (decision === 'stop') return;

    try {
      // A changed ID number is saved without spaces; an unchanged one is left alone (it is unique)
      const idNumberToSave = normalizeIdNumber(data.id_number);
      const idNumberChanged = savedIdNumberRef.current !== null && idNumberToSave !== '' && idNumberToSave !== savedIdNumberRef.current;
      // The patient's own ID number: never the placeholder of a file opened with a name and cell only
      const ownIdNumber = idNumberToSave || (isTemporaryIdNumber(savedIdNumberRef.current) ? '' : savedIdNumberRef.current) || '';
      // A changed old file number, unless an Eminance import wrote it ('' removes it)
      const oldFileNumberToSave = normalizeOldFileNumber(data.old_file_number);
      const oldFileNumberChanged = !!savedOldFileNumber && !savedOldFileNumber.fromImport && oldFileNumberToSave !== savedOldFileNumber.value;
      // Only the columns this form edits: PatientDetail passes its whole camelCase patient object as
      // initialData, and sending those extra keys made every update fail
      const patientData = {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        cell_number: data.cell_number,
        // Left blank on a file that is not complete yet: its placeholder stays until reception knows the answer
        ...(data.date_of_birth ? { date_of_birth: data.date_of_birth } : {}),
        ...(data.gender ? { gender: data.gender } : {}),
        // Blank is saved as nothing: the database accepts only the listed values here, and '' made the whole save fail
        marital_status: data.marital_status || null,
        occupation: data.occupation,
        employer: data.employer,
        home_language: data.home_language || null,
        home_address: data.home_address,
        postal_address: data.postal_address,
        postal_code: data.postal_code,
        ...(idNumberChanged ? { id_number: idNumberToSave } : {}),
        ...(oldFileNumberChanged ? { legacy_account_number: oldFileNumberToSave || null } : {}),
        // Only once the columns exist, so the save never fails before the SQL is applied
        ...(titleColumnsAvailable ? { title: data.title || null, initials: normalizeInitials(data.initials) || null } : {}),
        ...(townLoaded ? { town: (data.town ?? '').trim() || null, region: toNamibianRegion(data.region) } : {}),
        ...referral.columns()
      };
      const { error: patientError } = await untypedDb
        .from('patients')
        .update(patientData)
        .eq('id', patientId);

      if (patientError) {
        // Unique per practice: a person may be a patient at several practices, but has one file at this one
        if (isDuplicateIdNumberError(patientError)) {
          throw new Error(`ID number ${idNumberToSave} is already on another file at this practice. Check the number.`);
        }
        throw patientError;
      }
      // This form's own save is now the version it holds (a later step can fail and leave the form open)
      void versionGuard.refresh();
      if (idNumberChanged) savedIdNumberRef.current = idNumberToSave;
      if (oldFileNumberChanged) {
        setSavedOldFileNumber({ value: oldFileNumberToSave, fromImport: false });
        // The open patient file shows the new number at once
        window.dispatchEvent(new CustomEvent(PATIENT_FILE_NUMBERS_CHANGED, { detail: patientId }));
      }

      // Handle medical aid details
      if (data.medicalAid.provider) {
        const selectedProviderData = providers.find(p => p.id === data.medicalAid.provider);
        const selectedSchemeData = schemes.find(s => s.id === data.medicalAid.scheme);
        // A new medical aid defaults to the patient as main member. A saved record without a relationship
        // keeps its main member as it is until someone chooses one (nothing is overwritten by a guess).
        const relationshipToMain = data.medicalAid.relationship || (medicalAidDetails ? null : MAIN_MEMBER_RELATIONSHIP);
        const dependantCode = normalizeDependantCode(data.medicalAid.dependantCode);
        const mainMemberFields =
          relationshipToMain === null
            ? {}
            : isMainMemberRelationship(relationshipToMain)
              ? {
                  relationship_to_main: relationshipToMain,
                  // "Surname, J N": the form the claim builder reads as member surname and initials
                  main_member_name: composeMainMemberName({ surname: data.last_name, initials: initialsOf(data.first_name) }),
                  main_member_id_number: ownIdNumber
                }
              : {
                  relationship_to_main: relationshipToMain,
                  main_member_name: composeMainMemberName({ surname: data.medicalAid.mainMemberSurname ?? '', initials: data.medicalAid.mainMemberInitials ?? '' }),
                  main_member_id_number: normalizeIdNumber(data.medicalAid.mainMemberIdNumber)
                };

        const medicalAidData = {
          patient_id: patientId,
          provider: selectedProviderData?.name || data.medicalAid.provider,
          scheme: selectedSchemeData?.name || data.medicalAid.scheme,
          plan_type: selectedSchemeData?.name || data.medicalAid.scheme,
          medical_aid_provider_id: data.medicalAid.provider,
          membership_number: (data.medicalAid.membershipNumber ?? '').trim(),
          ...mainMemberFields,
          // Only once the column exists, so the save never fails before the SQL is applied
          ...(dependantCodeAvailable ? { dependant_code: dependantCode || null } : {})
        };

        if (medicalAidDetails) {
          // Update existing medical aid details
          const { error: medicalAidError } = await untypedDb
            .from('medical_aid_details')
            .update(medicalAidData)
            .eq('id', medicalAidDetails.id);

          if (medicalAidError) throw medicalAidError;
        } else {
          // Insert new medical aid details
          const { error: medicalAidError } = await untypedDb
            .from('medical_aid_details')
            .insert([medicalAidData]);

          if (medicalAidError) throw medicalAidError;
        }
      } else if (removesMedicalAid && medicalAidDetails) {
        // Remove medical aid details if provider is cleared
        const { error: deleteError } = await supabase
          .from('medical_aid_details')
          .delete()
          .eq('id', medicalAidDetails.id);

        if (deleteError) throw deleteError;
      }

      // Handle next of kin details
      if (data.nextOfKin.name) {
        const nextOfKinData = {
          patient_id: patientId,
          name: data.nextOfKin.name,
          relationship: data.nextOfKin.relationship,
          phone: data.nextOfKin.phone,
          address: data.nextOfKin.address
        };

        if (nextOfKinDetails) {
          // Update existing next of kin details
          const { error: nextOfKinError } = await supabase
            .from('next_of_kin')
            .update(nextOfKinData)
            .eq('id', nextOfKinDetails.id);

          if (nextOfKinError) throw nextOfKinError;
        } else {
          // Insert new next of kin details
          const { error: nextOfKinError } = await supabase
            .from('next_of_kin')
            .insert([nextOfKinData]);

          if (nextOfKinError) throw nextOfKinError;
        }
      } else if (removesNextOfKin && nextOfKinDetails) {
        // Remove next of kin details if cleared
        const { error: deleteError } = await supabase
          .from('next_of_kin')
          .delete()
          .eq('id', nextOfKinDetails.id);

        if (deleteError) throw deleteError;
      }

    } catch (error) {
      console.error('Error updating patient:', error);
      toast.error(`Couldn't save the patient's changes: ${errorMessage(error)}`);
      return;
    }
    toast.success('Patient details saved');
    onSuccess();
  };

  const tabs = [
    { id: 'personal', label: 'Personal Info', icon: User },
    { id: 'contact', label: 'Contact Details', icon: Phone },
    { id: 'medical', label: 'Medical Info', icon: Stethoscope },
    { id: 'medicalaid', label: 'Medical Aid', icon: Shield },
    { id: 'nextofkin', label: 'Next of Kin', icon: Users }
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Premium Tabs */}
      <div className="bg-gradient-to-r from-purple-500 to-indigo-600 relative">
        <div className="px-6">
          <div className="flex w-full">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                // The text label is hidden on small screens, leaving only the icon
                aria-label={tab.label}
                title={tab.label}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-300 relative ${
                  activeTab === tab.id
                    ? 'text-white border-white bg-gradient-to-t from-white/10 to-transparent'
                    : 'text-white/80 border-transparent hover:text-white hover:bg-white/10'
                }`}
              >
                <tab.icon className={`w-4 h-4 transition-all duration-300 ${
                  activeTab === tab.id ? 'text-white drop-shadow-sm' : ''
                }`} />
                <span className="hidden sm:inline font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {/* A file opened with a name and cell only (a phone or website booking): what reception still has to add */}
        {isTemporaryFile && (
          <div role="status" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">This file is not complete yet</p>
            <p>
              Booked with a name and cell number only. Add the {describeMissing(stillMissing)} under Personal Info and any medical
              aid under Medical Aid; claims wait until then. To save other changes only, leave the ID number blank.
            </p>
          </div>
        )}
        {activeTab === 'personal' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {titleColumnsAvailable && (
              <div>
                <label htmlFor="edit-patient-title" className="block text-sm font-medium text-gray-700">Title</label>
                <select
                  id="edit-patient-title"
                  {...register('title')}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
                >
                  <option value="">No title</option>
                  {titleOptions(savedTitle).map(title => (
                    <option key={title} value={title}>{title}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">First Name</label>
              <input
                type="text"
                {...register('first_name', {
                  required: 'First name is required',
                  // Initials follow the first names as they are typed, until reception types their own
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                    if (!titleColumnsAvailable) return;
                    const initials = followInitials(getValues('initials'), firstNamesRef.current, event.target.value);
                    firstNamesRef.current = event.target.value;
                    if (initials !== null) setValue('initials', initials);
                  }
                })}
                className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all shadow-sm hover:shadow-md"
              />
              {errors.first_name && (
                <p className="mt-1 text-sm text-red-600">{errors.first_name.message}</p>
              )}
            </div>

            {titleColumnsAvailable && (
              <div>
                <label htmlFor="edit-patient-initials" className="block text-sm font-medium text-gray-700">Initials</label>
                <input
                  id="edit-patient-initials"
                  type="text"
                  autoComplete="off"
                  maxLength={10}
                  {...register('initials')}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">Last Name</label>
              <input
                type="text"
                {...register('last_name', { required: 'Last name is required' })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
              />
              {errors.last_name && (
                <p className="mt-1 text-sm text-red-600">{errors.last_name.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="edit-patient-id-number" className="block text-sm font-medium text-gray-700">ID Number</label>
              <input
                id="edit-patient-id-number"
                type="text"
                autoComplete="off"
                {...register('id_number', {
                  // A file not complete yet may be saved without it (it then stays not complete)
                  required: isTemporaryFile ? false : 'ID number is required (a passport number for visitors)'
                })}
                placeholder={isTemporaryFile ? '11-digit ID, or passport number' : undefined}
                aria-describedby="edit-patient-id-number-hint"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
              />
              <div id="edit-patient-id-number-hint" aria-live="polite">
                {errors.id_number ? (
                  <p className="mt-1 text-sm text-red-600">{errors.id_number.message}</p>
                ) : idCheck.warning ? (
                  <p className="mt-1 text-sm text-amber-700">{idCheck.warning}</p>
                ) : null}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
              <input
                type="date"
                {...register('date_of_birth', {
                  required: isTemporaryFile ? false : 'Date of birth is required',
                  // Completing a file: the ID number, date of birth and gender go together
                  validate: value => !isTemporaryFile || !(getValues('id_number') ?? '').trim() || !!value || 'Add the date of birth to complete the file'
                })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
              />
              {errors.date_of_birth && (
                <p className="mt-1 text-sm text-red-600">{errors.date_of_birth.message}</p>
              )}
              {!errors.date_of_birth && birthDateWarning && (
                <p className="mt-1 text-sm text-amber-700">{birthDateWarning}</p>
              )}
            </div>

            <div>
              <label htmlFor="edit-patient-gender" className="block text-sm font-medium text-gray-700">Gender</label>
              <select
                id="edit-patient-gender"
                {...register('gender', {
                  required: isTemporaryFile ? false : 'Gender is required',
                  validate: value => !isTemporaryFile || !(getValues('id_number') ?? '').trim() || !!value || 'Choose the gender to complete the file'
                })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
              >
                {/* Blank only on a file not complete yet (its placeholder is not shown as the answer) */}
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
              {errors.gender && (
                <p className="mt-1 text-sm text-red-600">{errors.gender.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Marital Status</label>
              <select
                {...register('marital_status')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
              >
                <option value="">Select Status</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Home Language</label>
              <select
                {...register('home_language')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
              >
                <option value="">Select Language</option>
                <option value="English">English</option>
                <option value="Afrikaans">Afrikaans</option>
                <option value="Oshiwambo">Oshiwambo</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Shown once it is read (hidden before the column exists, so nothing is saved blindly) */}
            {savedOldFileNumber && (
              <div>
                <label htmlFor="edit-patient-old-file-number" className="block text-sm font-medium text-gray-700">Old file number</label>
                <input
                  id="edit-patient-old-file-number"
                  type="text"
                  autoComplete="off"
                  maxLength={OLD_FILE_NUMBER_MAX_LENGTH}
                  readOnly={savedOldFileNumber.fromImport}
                  {...register('old_file_number', {
                    validate: value => savedOldFileNumber.fromImport || (oldFileNumberProblem(value) ?? true)
                  })}
                  placeholder="If the patient has one"
                  aria-describedby="edit-patient-old-file-number-hint"
                  className={`mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5] ${
                    savedOldFileNumber.fromImport ? 'bg-gray-50 text-gray-600' : ''
                  }`}
                />
                <div id="edit-patient-old-file-number-hint" aria-live="polite">
                  {errors.old_file_number ? (
                    <p className="mt-1 text-sm text-red-600">{errors.old_file_number.message}</p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">
                      {savedOldFileNumber.fromImport
                        ? "Brought over from Eminance and kept as imported: the patient's Eminance statements and claims quote it."
                        : 'The number on the paper file or in your previous system. The patient is found by it.'}
                    </p>
                  )}
                </div>
              </div>
            )}
            {referral.shown && (
              <ReferralSourceFields
                id="edit-patient-referral-source"
                value={referral.value}
                onChange={referral.setValue}
                labelClassName="block text-sm font-medium text-gray-700"
                inputClassName="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
              />
            )}
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email Address</label>
                <input
                  type="email"
                  {...register('email')}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Cell Number</label>
                <input
                  type="tel"
                  {...register('cell_number')}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Home Address</label>
              <textarea
                {...register('home_address')}
                rows={3}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
                placeholder="Enter home address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Postal Address</label>
              <textarea
                {...register('postal_address')}
                rows={3}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
                placeholder="Enter postal address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Postal Code</label>
              <input
                type="text"
                {...register('postal_code')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
                placeholder="Enter postal code"
              />
            </div>

            {townLoaded && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-patient-town" className="block text-sm font-medium text-gray-700">Town</label>
                  <TownPicker
                    id="edit-patient-town"
                    value={townValue ?? ''}
                    onChange={value => setValue('town', value)}
                    onPick={(town, region) => {
                      setValue('town', town);
                      setValue('region', region);
                    }}
                    inputClassName="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
                  />
                </div>

                <div>
                  <label htmlFor="edit-patient-region" className="block text-sm font-medium text-gray-700">Region</label>
                  <RegionSelect
                    id="edit-patient-region"
                    value={regionValue ?? ''}
                    onChange={value => setValue('region', value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'medical' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Occupation</label>
              <input
                type="text"
                {...register('occupation')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
                placeholder="Enter occupation"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Employer</label>
              <input
                type="text"
                {...register('employer')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
                placeholder="Enter employer name"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Medical History</label>
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                <p>Medical history information will be managed through patient visits and medical records.</p>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Allergies & Conditions</label>
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                <p>Allergies, the clinical alert and the problem list are kept on the patient's file: open "Details" on the strip under the patient's name.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'medicalaid' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Medical Aid Information</h3>
              <p className="text-sm text-gray-600">Manage the patient's medical aid coverage and benefits.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Medical Aid Provider */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Medical Aid Provider</label>
                <select
                  {...register('medicalAid.provider')}
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all shadow-sm hover:shadow-md"
                  disabled={loadingProviders}
                >
                  <option value="">Select Medical Aid Provider</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}{provider.short_name ? ` (${provider.short_name})` : ''}
                    </option>
                  ))}
                </select>
                {loadingProviders && (
                  <p className="mt-1 text-sm text-gray-500">Loading providers...</p>
                )}
              </div>

              {/* Medical Aid Scheme */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Scheme/Plan</label>
                <select
                  {...register('medicalAid.scheme')}
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all shadow-sm hover:shadow-md"
                  disabled={!selectedProvider || loadingSchemes}
                >
                  <option value="">Select scheme</option>
                  {schemes.map((scheme) => (
                    <option key={scheme.id} value={scheme.id}>
                      {scheme.name}
                    </option>
                  ))}
                </select>
                {loadingSchemes && (
                  <p className="mt-1 text-sm text-gray-500">Loading schemes...</p>
                )}
                {!selectedProvider && (
                  <p className="mt-1 text-sm text-gray-500">Please select a provider first</p>
                )}
              </div>

              {/* Membership Number */}
              <div>
                <label htmlFor="edit-patient-membership" className="block text-sm font-semibold text-gray-700 mb-2">Membership Number</label>
                <input
                  id="edit-patient-membership"
                  type="text"
                  autoComplete="off"
                  {...register('medicalAid.membershipNumber')}
                  aria-describedby="edit-patient-membership-hint"
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all shadow-sm hover:shadow-md"
                  placeholder="As on the card"
                />
                <p id="edit-patient-membership-hint" className="mt-1 text-sm text-amber-700" aria-live="polite">
                  {membershipHint}
                </p>
              </div>

              {/* Relationship to Main Member */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Relationship to Main Member</label>
                <select
                  {...register('medicalAid.relationship')}
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all shadow-sm hover:shadow-md"
                >
                  <option value="">Not recorded</option>
                  <option value="self">Self (main member)</option>
                  <option value="spouse">Spouse</option>
                  <option value="child">Child</option>
                  <option value="parent">Parent</option>
                  <option value="other">Other dependant</option>
                </select>
              </div>

              {/* Main member's surname, initials and ID: a spouse or child is claimed under them */}
              {isDependant && (
                <MainMemberFields
                  surnameField={register('medicalAid.mainMemberSurname')}
                  initialsField={register('medicalAid.mainMemberInitials')}
                  idNumberField={register('medicalAid.mainMemberIdNumber')}
                  surname={mainMemberSurname}
                  initials={mainMemberInitials}
                  inputClassName="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5]"
                  labelClassName="block text-sm font-semibold text-gray-700"
                />
              )}

              {dependantCodeAvailable && (
                <DependantCodeInput
                  field={register('medicalAid.dependantCode', { validate: value => dependantCodeProblem(value) ?? true })}
                  error={errors.medicalAid?.dependantCode?.message}
                  inputClassName="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5]"
                  labelClassName="block text-sm font-semibold text-gray-700"
                />
              )}
            </div>

            {medicalAidDetails && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-5 h-5 text-green-600" />
                  <h4 className="font-semibold text-green-800">Current Medical Aid Coverage</h4>
                </div>
                <div className="text-sm text-green-700">
                  <p><strong>Provider:</strong> {medicalAidDetails.provider}</p>
                  <p><strong>Scheme:</strong> {medicalAidDetails.scheme}</p>
                  <p><strong>Member Number:</strong> {medicalAidDetails.membership_number}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'nextofkin' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-orange-50 to-purple-50 rounded-lg p-4 border border-orange-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Emergency Contact Information</h3>
              <p className="text-sm text-gray-600">Provide details for the patient's emergency contact or next of kin.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4 text-orange-500" />
                  Next of Kin Name
                </label>
                <input
                  type="text"
                  {...register('nextOfKin.name')}
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all shadow-sm hover:shadow-md"
                  placeholder="Enter next of kin name"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-orange-500" />
                  Relationship
                </label>
                <input
                  type="text"
                  {...register('nextOfKin.relationship')}
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all shadow-sm hover:shadow-md"
                  placeholder="e.g., Spouse, Parent, Sibling"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-orange-500" />
                  Phone Number
                </label>
                <input
                  type="tel"
                  {...register('nextOfKin.phone')}
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all shadow-sm hover:shadow-md"
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-orange-500" />
                  Address
                </label>
                <textarea
                  {...register('nextOfKin.address')}
                  rows={3}
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all shadow-sm hover:shadow-md resize-none"
                  placeholder="Enter address"
                />
              </div>
            </div>

            {nextOfKinDetails && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-green-600" />
                  <h4 className="font-semibold text-green-800">Current Emergency Contact</h4>
                </div>
                <div className="text-sm text-green-700">
                  <p><strong>Name:</strong> {nextOfKinDetails.name}</p>
                  <p><strong>Relationship:</strong> {nextOfKinDetails.relationship}</p>
                  <p><strong>Phone:</strong> {nextOfKinDetails.phone}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-3 pt-6 border-t border-gray-100">
        <button
          type="button"
          onClick={() => onSuccess()}
          className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-all hover:shadow-md"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-2.5 rounded-lg hover:shadow-lg transition-all font-medium transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : 'Update Patient'}
        </button>
      </div>
      {versionGuard.dialog}
    </form>
  );
};

// The columns this form shows from the patient's row; the rest (ID number, title, old file number, medical aid, next
// of kin) the form reads itself when it opens
const RELOADED_COLUMNS = 'first_name, last_name, email, cell_number, date_of_birth, gender, marital_status, occupation, employer, home_language, home_address, postal_address, postal_code, updated_at';

/** "Reload their version": the form opens again with the file as it is saved now (what was typed is dropped) */
const EditPatientForm: React.FC<Props> = ({ patientId, initialData, onSuccess }) => {
  const [reloaded, setReloaded] = useState<{ round: number; data: EditPatientInitialData } | null>(null);
  const reload = async () => {
    const { data, error } = await untypedDb.from('patients').select(RELOADED_COLUMNS).eq('id', patientId).maybeSingle();
    if (error || !data) {
      toast.error(`Couldn't read the patient's details again: ${errorMessage(error, 'the file was not found')}`);
      return;
    }
    const row = data as Record<string, string | null>;
    const text = (key: string): string => row[key] ?? '';
    setReloaded(previous => ({
      round: (previous?.round ?? 0) + 1,
      data: {
        first_name: text('first_name'), last_name: text('last_name'), email: text('email'), cell_number: text('cell_number'),
        date_of_birth: text('date_of_birth'), gender: text('gender'), marital_status: text('marital_status'), occupation: text('occupation'),
        employer: text('employer'), home_language: text('home_language'), home_address: text('home_address'),
        postal_address: text('postal_address'), postal_code: text('postal_code'), updated_at: row.updated_at ?? null
      }
    }));
  };
  return (
    <EditPatientFormBody
      key={reloaded?.round ?? 0}
      patientId={patientId}
      initialData={reloaded?.data ?? initialData}
      onSuccess={onSuccess}
      onReload={() => void reload()}
    />
  );
};

export default EditPatientForm;