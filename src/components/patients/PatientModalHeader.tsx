import React, { useState, useEffect } from 'react';
import { motion, useSpring, useTransform, animate } from 'framer-motion';
import { HamburgerMenu } from './PatientModalTabs';
import {
  Users,
  User,
  Phone,
  Mail,
  Minimize,
  Maximize,
  X,
  UserPlus,
  Shield,
  ArrowLeft,
  Bot,
  Sparkles,
  MessageSquare,
  Edit,
  Activity,
  CreditCard,
  MapPin,
  Calendar
} from 'lucide-react';
import { Patient } from '../../stores/patientsStoreNew';
import { format, isValid, parseISO } from 'date-fns';
import { emailUnavailableReason, smsUnavailableReason } from './patientContact';
import { ageInYears, countRegisteredInMonth, describeMedicalAidRelationship } from './patientSummary';
import { PatientFileNumbers } from './PatientFileNumbers';
import { PatientHeaderPhoto } from './photo/PatientHeaderPhoto';
import { loadFormalName } from '../../services/patientFileService';
import { describeMissing, patientFileStatus } from '../../utils/patients/temporaryPatient';

/**
 * "Mrs N M Shilongo" under the patient's name, once the file has a title or initials. The patient file's view has no
 * title or initials, so they are read here (again after every save: `version` is the file's updated_at).
 */
const FormalName: React.FC<{ patientId?: string; version?: string | null }> = ({ patientId, version }) => {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    setName(null);
    if (!patientId) return;
    let active = true;
    loadFormalName(patientId)
      .then(result => {
        if (active) setName(result);
      })
      .catch(error => console.error('Could not read the title and initials:', error));
    return () => {
      active = false;
    };
  }, [patientId, version]);
  if (!name) return null;
  return (
    <p className="text-sm text-white/90">
      <span className="sr-only">Formal name: </span>
      {name}
    </p>
  );
};

interface PatientDetails {
  id: string;
  first_name?: string;
  last_name?: string;
  updated_at?: string | null;
  email?: string;
  cell_number?: string;
  date_of_birth?: string;
  gender?: string;
  id_number?: string;
  home_address?: string;
  occupation?: string;
  employer?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
}

interface NextOfKin {
  id: string;
  patient_id: string;
  name: string;
  relationship: string;
  phone: string;
  address?: string;
  created_at: string;
}

interface MedicalAidDetails {
  id: string;
  patient_id: string;
  provider: string;
  scheme: string;
  membership_number: string;
  plan_type: string;
  main_member_name: string;
  main_member_id_number: string;
  relationship_to_main: string;
  created_at: string;
  updated_at: string;
}

interface PatientModalHeaderProps {
  activeTab: 'patients' | 'details';
  isFullScreen: boolean;
  selectedPatientDetails: PatientDetails | null;
  onClose: () => void;
  onToggleFullScreen: () => void;
  onBackToList?: () => void;
  filteredPatients?: Patient[];
  medicalAid?: MedicalAidDetails | null;
  nextOfKin?: NextOfKin | null;
  visits?: any[];
  vitals?: any[];
  onSendMessage?: () => void;
  onSendEmail?: () => void;
  onEditProfile?: () => void;
  onSmsNextOfKin?: (phone: string) => void;
  onManageBeneficiaries?: () => void;
  beneficiariesCount?: number;
  /** Shown next to the patient's name: the account flags badge (cash only, dispute...) from the debtors screens */
  accountBadge?: React.ReactNode;
}

const PatientModalHeader: React.FC<PatientModalHeaderProps> = ({
  activeTab,
  isFullScreen,
  selectedPatientDetails,
  onClose,
  onToggleFullScreen,
  onBackToList,
  filteredPatients = [],
  medicalAid,
  nextOfKin,
  visits = [],
  vitals = [],
  onSendMessage,
  onSendEmail,
  onEditProfile,
  onSmsNextOfKin,
  onManageBeneficiaries,
  beneficiariesCount = 0,
  accountBadge
}) => {
  const totalPatients = filteredPatients.length;
  // Registered this calendar month (was a made-up 15% of all patients)
  const newThisMonth = countRegisteredInMonth(filteredPatients);
  const withMedicalAid = filteredPatients.filter(p => 
    p.medical_aid_details && p.medical_aid_details.length > 0
  ).length;
  const medicalAidPercentage = totalPatients > 0 
    ? Math.round((withMedicalAid / totalPatients) * 100) 
    : 0;
    
  // A file opened with a name and cell only: its placeholder birthday and gender are never shown as real
  const fileStatus = patientFileStatus(selectedPatientDetails);
  // Animated age counter; patientAge is null when the date of birth is missing or unreadable
  const [displayAge, setDisplayAge] = useState(0);
  const patientAge = ageInYears(fileStatus.dateOfBirth);
  const dateOfBirth = fileStatus.dateOfBirth ? parseISO(fileStatus.dateOfBirth) : null;

  useEffect(() => {
    if (patientAge !== null && patientAge > 0 && activeTab === 'details') {
      const controls = animate(0, patientAge, {
        duration: 1.5,
        ease: "easeOut",
        onUpdate: (value) => setDisplayAge(Math.floor(value))
      });
      return () => controls.stop();
    }
    // Babies and unknown ages are not animated, but must never keep the previous patient's age
    setDisplayAge(patientAge ?? 0);
  }, [patientAge, activeTab]);

  // Message and Email stay visible but disabled, with the reason, when the contact detail can't be used
  const smsDisabledReason = smsUnavailableReason(selectedPatientDetails?.cell_number);
  const emailDisabledReason = emailUnavailableReason(selectedPatientDetails?.email);
  return (
    <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
      {activeTab === 'patients' ? (
        // Patients List Header
        <div className="pt-6 px-6 pb-0">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">
                  Patient Management
                </h2>
                <p className="text-white/90">
                  Comprehensive patient database and management
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onToggleFullScreen}
                className="p-3 sm:p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 touch-manipulation flex items-center justify-center"
                title={isFullScreen ? 'Exit Full Screen (Esc or F11)' : 'Full Screen (F11)'}
                aria-label={isFullScreen ? 'Exit full screen' : 'Full screen'}
              >
                {isFullScreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </motion.button>
              <button
                onClick={onClose}
                className="p-3 sm:p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 touch-manipulation flex items-center justify-center"
                title="Close"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4">
            {/* Total Patients */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.3 }}
              className="bg-gradient-to-br from-white/15 to-white/5 rounded-xl p-4 backdrop-blur-sm border border-white/20 hover:border-white/40 transition-all duration-200 group relative overflow-hidden"
            >
              <div className="absolute -right-2 -top-2 opacity-10 group-hover:opacity-20 transition-opacity duration-300">
                <Users className="w-20 h-20 text-white transform rotate-12" />
              </div>
              <div className="relative z-10">
                <p className="text-white/80 text-sm font-medium mb-1">Total Patients</p>
                <p className="text-2xl font-bold text-white group-hover:scale-105 transition-transform duration-300">
                  {totalPatients}
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/60">patient records</p>
                  <div className="text-xs text-white/60 bg-white/10 px-2 py-1 rounded-full">TOTAL</div>
                </div>
              </div>
            </motion.div>

            {/* New This Month */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="bg-gradient-to-br from-white/15 to-white/5 rounded-xl p-4 backdrop-blur-sm border border-white/20 hover:border-white/40 transition-all duration-200 group relative overflow-hidden"
            >
              <div className="absolute -right-2 -top-2 opacity-10 group-hover:opacity-20 transition-opacity duration-300">
                <UserPlus className="w-20 h-20 text-white transform rotate-12" />
              </div>
              <div className="relative z-10">
                <p className="text-white/80 text-sm font-medium mb-1">New This Month</p>
                <p className="text-2xl font-bold text-white group-hover:scale-105 transition-transform duration-300">
                  +{newThisMonth}
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/60">new registrations</p>
                  <div className="text-xs text-white/60 bg-white/10 px-2 py-1 rounded-full">NEW</div>
                </div>
              </div>
            </motion.div>

            {/* Medical Aid Coverage */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.3 }}
              className="bg-gradient-to-br from-white/15 to-white/5 rounded-xl p-4 backdrop-blur-sm border border-white/20 hover:border-white/40 transition-all duration-200 group relative overflow-hidden"
            >
              <div className="absolute -right-2 -top-2 opacity-10 group-hover:opacity-20 transition-opacity duration-300">
                <Shield className="w-20 h-20 text-white transform rotate-12" />
              </div>
              <div className="relative z-10">
                <p className="text-white/80 text-sm font-medium mb-1">Medical Aid Coverage</p>
                <p className="text-2xl font-bold text-white group-hover:scale-105 transition-transform duration-300">
                  {medicalAidPercentage}%
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/60">{withMedicalAid} covered</p>
                  <div className="text-xs text-white/60 bg-white/10 px-2 py-1 rounded-full">COVER</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      ) : (
        // Patient Details Header with Snapshot Info
        <div className="pt-6 px-6 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              {/* Back button */}
              {onBackToList && (
                <motion.button
                  onClick={onBackToList}
                  className="p-3 bg-white/20 rounded-xl backdrop-blur-sm hover:bg-white/30 transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="Back to Patients List"
                  aria-label="Back to patients list"
                >
                  <ArrowLeft className="w-5 h-5" />
                </motion.button>
              )}

              {/* The patient's photo or initials (parity A12); not shown before photos are set up */}
              <PatientHeaderPhoto
                patientId={selectedPatientDetails?.id}
                firstName={selectedPatientDetails?.first_name}
                lastName={selectedPatientDetails?.last_name}
              />

              <div>
                <div className="flex flex-wrap items-center gap-3 mb-1">
                  <h2 className="text-3xl font-bold">
                    {selectedPatientDetails?.first_name} {selectedPatientDetails?.last_name}
                  </h2>
                  {/* Account flags slot (debtors screens): ComprehensivePatientModal passes the badge */}
                  {accountBadge}
                </div>
                <FormalName patientId={selectedPatientDetails?.id} version={selectedPatientDetails?.updated_at} />
                {/* Small: the OneHealth reference, the old file number and, for patients brought over from Eminance,
                    their claim history */}
                <PatientFileNumbers patientId={selectedPatientDetails?.id} className="mt-0.5 text-white/80" />
                {/* Booked with a name and cell only: one tap to the form that completes the file */}
                {fileStatus.incomplete && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
                    <span>
                      <strong>File not complete.</strong> Still needed: {describeMissing(fileStatus.missing)}.
                    </span>
                    {onEditProfile && (
                      <button
                        type="button"
                        onClick={onEditProfile}
                        className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      >
                        Complete file
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Action Buttons - Hidden on mobile/tablet, moved to hamburger menu */}
              <div className="hidden lg:flex items-center gap-3">
                {smsDisabledReason ? (
                  // A disabled button shows no tooltip in every browser, so the wrapper carries it
                  <span title={smsDisabledReason} className="cursor-not-allowed">
                    <button
                      type="button"
                      disabled
                      aria-label={`Message unavailable: ${smsDisabledReason}`}
                      className="px-4 py-2 bg-white/20 rounded-lg flex items-center gap-2 opacity-50 pointer-events-none"
                    >
                      <MessageSquare className="w-4 h-4" aria-hidden="true" />
                      <span>Message</span>
                    </button>
                  </span>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onSendMessage}
                    className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors flex items-center gap-2"
                    title="Send SMS"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Message</span>
                  </motion.button>
                )}

                {emailDisabledReason ? (
                  <span title={emailDisabledReason} className="cursor-not-allowed">
                    <button
                      type="button"
                      disabled
                      aria-label={`Email unavailable: ${emailDisabledReason}`}
                      className="px-4 py-2 bg-white/20 rounded-lg flex items-center gap-2 opacity-50 pointer-events-none"
                    >
                      <Mail className="w-4 h-4" aria-hidden="true" />
                      <span>Email</span>
                    </button>
                  </span>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onSendEmail}
                    className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors flex items-center gap-2"
                    title="Send Email"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Email</span>
                  </motion.button>
                )}
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onEditProfile}
                  className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors flex items-center gap-2"
                  title="Edit Profile"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit</span>
                </motion.button>
                
                <div className="h-8 w-px bg-white/20 mx-1" />
              </div>
              
              {/* Hamburger Menu for Mobile/Tablet - Only show for patient details */}
              <div className="block lg:hidden">
                <HamburgerMenu
                  onSendMessage={onSendMessage}
                  onSendEmail={onSendEmail}
                  onEditProfile={onEditProfile}
                  messageDisabledReason={smsDisabledReason}
                  emailDisabledReason={emailDisabledReason}
                />
              </div>
              
              {/* Desktop Only Controls */}
              <div className="hidden lg:flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onToggleFullScreen}
                  className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                  title={isFullScreen ? 'Exit Full Screen (Esc or F11)' : 'Full Screen (F11)'}
                  aria-label={isFullScreen ? 'Exit full screen' : 'Full screen'}
                >
                  {isFullScreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </motion.button>

                <button
                  onClick={onClose}
                  className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                  title="Close"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
          
          {/* Patient Info Stat Cards - Hidden on mobile for space optimization */}
          <div className="hidden sm:grid grid-cols-1 md:grid-cols-4 gap-4 pb-4">
            {/* Demographics Card */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.3 }}
              className="bg-gradient-to-br from-white/15 to-white/5 rounded-xl p-4 backdrop-blur-sm border border-white/20 hover:border-white/40 transition-all duration-200 group relative overflow-hidden"
            >
              <div className="absolute -right-2 -top-2 opacity-10 group-hover:opacity-20 transition-opacity duration-300">
                <User className="w-20 h-20 text-white transform rotate-12" />
              </div>
              <div className="relative z-10">
                <p className="text-white/80 text-sm font-medium mb-2">Demographics</p>
                <div className="space-y-2">
                  {/* Animated Age */}
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, type: "spring" }}
                    className="flex items-center gap-2"
                  >
                    <Calendar className="w-4 h-4 text-white/70" />
                    {patientAge === null ? (
                      <p className="text-white/80 text-sm font-semibold">Age unknown</p>
                    ) : (
                      <p className="text-white text-lg font-bold">
                        <motion.span
                          key={displayAge}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          {displayAge}
                        </motion.span>
                        <span className="text-sm ml-1">years old</span>
                      </p>
                    )}
                  </motion.div>
                  
                  {/* Gender and Birth Date */}
                  <div className="space-y-1">
                    <p className="text-white/80 text-sm capitalize flex items-center gap-2">
                      <User className="w-3 h-3 text-white/60" />
                      {fileStatus.gender || 'Not specified'}
                    </p>
                    <p className="text-white/60 text-xs">
                      Born {dateOfBirth && isValid(dateOfBirth) ? format(dateOfBirth, 'dd MMM yyyy') : 'Unknown'}
                    </p>
                  </div>
                  
                  {/* Divider */}
                  <div className="h-px bg-white/20 my-1"></div>
                  
                  {/* ID Number (never the placeholder of a file that is not complete) */}
                  {selectedPatientDetails?.id_number && !fileStatus.incomplete && (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                      className="flex items-center gap-2"
                    >
                      <CreditCard className="w-3 h-3 text-white/60" />
                      <p className="text-white/80 text-xs font-mono">{selectedPatientDetails.id_number}</p>
                    </motion.div>
                  )}
                  
                  {/* Home Address */}
                  {selectedPatientDetails?.home_address && (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 }}
                      className="flex items-start gap-2"
                    >
                      <MapPin className="w-3 h-3 text-white/60 mt-0.5" />
                      <p className="text-white/70 text-xs line-clamp-2">{selectedPatientDetails.home_address}</p>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Contact & Employment Card */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="bg-gradient-to-br from-white/15 to-white/5 rounded-xl p-4 backdrop-blur-sm border border-white/20 hover:border-white/40 transition-all duration-200 group relative overflow-hidden"
            >
              <div className="absolute -right-2 -top-2 opacity-10 group-hover:opacity-20 transition-opacity duration-300">
                <Phone className="w-20 h-20 text-white transform rotate-12" />
              </div>
              <div className="relative z-10">
                <p className="text-white/80 text-sm font-medium mb-2">Contact & Employment</p>
                <div className="space-y-1.5">
                  {/* Contact Information */}
                  {selectedPatientDetails?.cell_number || selectedPatientDetails?.email ? (
                    <>
                      <p className="text-white text-sm font-semibold">{selectedPatientDetails?.cell_number || 'No cell number'}</p>
                      <p className="text-white/80 text-xs truncate">{selectedPatientDetails?.email || 'No email'}</p>
                    </>
                  ) : (
                    <p className="text-white/60 text-sm">No contact info</p>
                  )}
                  
                  {/* Divider */}
                  <div className="h-px bg-white/20 my-1.5"></div>
                  
                  {/* Employment Information */}
                  {selectedPatientDetails?.occupation || selectedPatientDetails?.employer ? (
                    <>
                      {selectedPatientDetails.occupation && (
                        <p className="text-white/90 text-xs font-medium">{selectedPatientDetails.occupation}</p>
                      )}
                      {selectedPatientDetails.employer && (
                        <p className="text-white/70 text-xs">@ {selectedPatientDetails.employer}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-white/60 text-xs">No employment info</p>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Medical Coverage Card */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.3 }}
              className="bg-gradient-to-br from-white/15 to-white/5 rounded-xl p-4 backdrop-blur-sm border border-white/20 hover:border-white/40 transition-all duration-200 group relative overflow-hidden"
            >
              <div className="absolute -right-2 -top-2 opacity-10 group-hover:opacity-20 transition-opacity duration-300">
                <Shield className="w-20 h-20 text-white transform rotate-12" />
              </div>
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white/80 text-sm font-medium">Medical Coverage</p>
                  {medicalAid && beneficiariesCount > 0 && (
                    <div className="bg-white/20 text-white text-xs font-medium px-2 py-1 rounded-full">
                      {beneficiariesCount} {beneficiariesCount === 1 ? 'Member' : 'Members'}
                    </div>
                  )}
                </div>
                <div className="space-y-1 flex-1">
                  {medicalAid ? (
                    <>
                      <p className="text-white text-sm font-semibold">{medicalAid.provider}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-white/80 text-xs font-mono">#{medicalAid.membership_number}</p>
                        {beneficiariesCount > 0 && (
                          <span className="text-white/60 text-xs">• Total: {beneficiariesCount}</span>
                        )}
                      </div>
                      <p className="text-white/60 text-xs">Option: {medicalAid.plan_type || 'Not recorded'}</p>
                      <p className="text-white/60 text-xs">{describeMedicalAidRelationship(medicalAid.relationship_to_main)}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-white/60 text-sm font-semibold">No Coverage</p>
                      <p className="text-white/60 text-xs">Self-pay patient</p>
                    </>
                  )}
                </div>
                {medicalAid && onManageBeneficiaries && (
                  <div className="flex justify-end mt-3">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={onManageBeneficiaries}
                      className="px-3 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors flex items-center gap-2 text-xs font-medium"
                      title="Manage Beneficiaries"
                    >
                      <Users className="w-4 h-4 text-white" />
                      <span className="text-white">Manage Members</span>
                    </motion.button>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Next of Kin Card */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              className="bg-gradient-to-br from-white/15 to-white/5 rounded-xl p-4 backdrop-blur-sm border border-white/20 hover:border-white/40 transition-all duration-200 group relative overflow-hidden"
            >
              <div className="absolute -right-2 -top-2 opacity-10 group-hover:opacity-20 transition-opacity duration-300">
                <Users className="w-20 h-20 text-white transform rotate-12" />
              </div>
              <div className="relative z-10 flex flex-col h-full">
                <p className="text-white/80 text-sm font-medium mb-2">Next of Kin</p>
                <div className="space-y-1 flex-1">
                  {nextOfKin ? (
                    <>
                      <p className="text-white text-sm font-semibold">{nextOfKin.name}</p>
                      <p className="text-white/80 text-xs">{nextOfKin.phone}</p>
                      <p className="text-white/60 text-xs capitalize">{nextOfKin.relationship}</p>
                    </>
                  ) : selectedPatientDetails?.emergency_contact_name ? (
                    <>
                      <p className="text-white text-sm font-semibold">{selectedPatientDetails.emergency_contact_name}</p>
                      <p className="text-white/80 text-xs">{selectedPatientDetails.emergency_contact_phone || 'No phone'}</p>
                      <p className="text-white/60 text-xs capitalize">{selectedPatientDetails.emergency_contact_relationship || 'Not specified'}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-white/60 text-sm font-semibold">Not Provided</p>
                      <p className="text-white/60 text-xs">No emergency contact</p>
                    </>
                  )}
                </div>
                {(nextOfKin?.phone || selectedPatientDetails?.emergency_contact_phone) && onSmsNextOfKin && (
                  <div className="flex justify-end mt-3">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onSmsNextOfKin(nextOfKin?.phone || selectedPatientDetails?.emergency_contact_phone!)}
                      className="px-3 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors flex items-center gap-2 text-xs font-medium"
                      title="SMS Next of Kin"
                    >
                      <MessageSquare className="w-4 h-4 text-white" />
                      <span className="text-white">Contact</span>
                    </motion.button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientModalHeader;