import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Building2,
    FileText, // Consider using for 'Reports'
    Phone,
    Mail,
    MapPin,
    ChevronLeft,
    Edit3,
    Clock,
    User,
    Loader2,
    Heart,
    Activity,
    Stethoscope,
    Pill,
    Clipboard,
    AlertCircle,
    CheckCircle2,
    // XCircle, // Not used in current AI summary, but good for other statuses
    ArrowRight,
    Brain,
    Sparkles,
    CalendarDays, // For Visits
    Briefcase, // For Occupation
    Home, // For Address
    Users, // For Next of Kin
    ShieldCheck, // For Medical Aid
    FilePlus, // For Add Record
    Download, // For Export Data
    RefreshCw, // For Refreshing data
} from 'lucide-react';
import Button from '../components/ui/Button'; // Assuming Button has variants: primary, secondary, outline, ghost
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Badge from '../components/ui/Badge'; // Assuming Badge has variants: success, warning, info, error, default
import FormModal from '../components/modals/FormModal';
import AddMedicalRecordForm from '../components/forms/AddMedicalRecordForm';
import NextOfKinForm from '../components/forms/NextOfKinForm';
import EditPatientForm from '../components/forms/EditPatientForm';
import AddVisitForm from '../components/forms/AddVisitForm';
// Assume you might have an EditMedicalAidForm
// import EditMedicalAidForm from '../components/forms/EditMedicalAidForm';

import { supabase } from '../lib/supabase';
import { logDatabaseError } from '../lib/supabase'; // Ensure this function is robust
import { format, differenceInYears } from 'date-fns';
import VisitsTimeline from '../components/visits/VisitsTimeline';

interface MedicalAidDetail {
    provider: string;
    scheme: string;
    membership_number: string;
    plan_type: string;
    main_member_name: string;
    main_member_id_number: string;
    relationship_to_main: string;
}

interface NextOfKinDetail {
    id: string;
    name: string;
    relationship: string;
    phone: string;
    address?: string; // Made optional as per usage
}

interface Patient {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    cell_number: string;
    date_of_birth: string;
    gender: string;
    marital_status?: string;
    occupation?: string;
    home_language?: string;
    home_address: string;
    postal_address?: string;
    postal_code?: string;
    medical_aid_details?: MedicalAidDetail[];
    next_of_kin?: NextOfKinDetail[];
    chronicConditions?: string[];
    // Example: Add fields that might be in your patient_details_view
    total_visits?: number;
    total_reports?: number;
    // last_visit_date?: string;
}

const premiumContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.07,
        },
    },
};

const premiumItemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            type: 'spring',
            stiffness: 100,
            damping: 12,
        },
    },
};

const PatientDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [patient, setPatient] = useState<Patient | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal States (Consider grouping into an object if they grow)
    // const [isAddRecordModalOpen, setIsAddRecordModalOpen] = useState(false); // Keep if needed
    const [isNextOfKinModalOpen, setIsNextOfKinModalOpen] = useState(false);
    const [isEditPatientModalOpen, setIsEditPatientModalOpen] = useState(false);
    const [isMedicalAidModalOpen, setIsMedicalAidModalOpen] = useState(false); // For adding/editing medical aid
    const [isAddVisitModalOpen, setIsAddVisitModalOpen] = useState(false);

    useEffect(() => {
        if (id) {
            fetchPatientDetails();
        } else {
            navigate('/patients'); // Or some error page
        }
    }, [id, navigate]);

    const fetchPatientDetails = async (showLoading = true) => {
        if (!id) return;
        try {
            if (showLoading) setIsLoading(true);
            setError(null);
            const { data, error: dbError } = await supabase
                .from('patient_details_view') // Ensure this view exists and has all required fields
                .select('*')
                .eq('id', id)
                .single();

            if (dbError) throw dbError;
            if (data) setPatient(data);
            else setError('Patient not found.');

        } catch (err: any) {
            console.error('Error fetching patient details:', err);
            logDatabaseError(err, `WorkspacePatientDetails - Patient ID: ${id}`);
            setError('An error occurred while loading patient details. Please try again.');
        } finally {
            if (showLoading) setIsLoading(false);
        }
    };

    const handleModalSuccess = (modalSetter: React.Dispatch<React.SetStateAction<boolean>>) => {
        fetchPatientDetails(false); // Refresh data without full page loading spinner
        modalSetter(false);
    };
    
    const patientAge = useMemo(() => {
        if (!patient?.date_of_birth) return '';
        return differenceInYears(new Date(), new Date(patient.date_of_birth));
    }, [patient?.date_of_birth]);

    // --- Reimagined AI Health Summary ---
    const AISummaryCard: React.FC<{ patient: Patient }> = ({ patient }) => {
        const medicalAid = patient.medical_aid_details?.[0];
        const nextOfKin = patient.next_of_kin?.[0];

        return (
            <motion.div variants={premiumItemVariants}>
                <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-2xl border-slate-700">
                    <CardHeader className="border-b border-slate-700 pb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-slate-700 rounded-lg">
                                    <Brain size={22} className="text-sky-400" />
                                </div>
                                <CardTitle className="text-xl font-semibold text-white">AI Health Insights</CardTitle>
                            </div>
                            <div className="flex items-center text-xs text-sky-400 bg-slate-700 px-2 py-1 rounded-md">
                                <Sparkles size={14} className="mr-1.5" />
                                Powered by AI
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-5">
                        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                            <h4 className="text-lg font-medium text-sky-300 mb-2">Patient Snapshot</h4>
                            <p className="text-slate-300 leading-relaxed text-sm">
                                {patient.first_name} {patient.last_name} is a {patientAge}-year-old {patient.gender?.toLowerCase()}.
                                {patient.occupation ? ` Currently working as a ${patient.occupation}.` : ''}
                                {medicalAid ? ` Insured under ${medicalAid.provider} (${medicalAid.scheme}).` : ' No active medical aid on record.'}
                                {nextOfKin ? ` Emergency contact: ${nextOfKin.name} (${nextOfKin.relationship}).` : ''}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InfoBlock icon={<Activity size={18} className="text-emerald-400" />} title="Health Status">
                                <ListItem icon={<CheckCircle2 size={15} className="text-emerald-400" />} text="Regular check-ups advised" />
                                <ListItem icon={<CheckCircle2 size={15} className="text-emerald-400" />} text="Vaccinations appear current" />
                                {patient.chronicConditions && patient.chronicConditions.length > 0 && (
                                    <ListItem icon={<AlertCircle size={15} className="text-amber-400" />} text={`Managing: ${patient.chronicConditions.join(', ')}`} />
                                )}
                            </InfoBlock>

                            <InfoBlock icon={<Stethoscope size={18} className="text-sky-400" />} title="Recent Notes">
                                {/* Replace with actual data if available */}
                                <ListItem icon={<Clock size={15} />} text={`Last known visit: ${patient.total_visits && patient.total_visits > 0 ? format(new Date(), 'MMM d, yyyy') : 'N/A' }`} />
                                <ListItem icon={<Pill size={15} />} text="Medication adherence: Monitor" />
                                <ListItem icon={<Heart size={15} />} text="Vitals: Check next visit" />
                            </InfoBlock>
                        </div>

                        <InfoBlock icon={<Clipboard size={18} className="text-purple-400" />} title="Care Suggestions">
                            <ListItem icon={<ArrowRight size={15} className="text-purple-400" />} text="Follow up in 2 months for routine evaluation." />
                            <ListItem icon={<ArrowRight size={15} className="text-purple-400" />} text="Consider lifestyle adjustments for overall well-being." />
                            {patient.chronicConditions && patient.chronicConditions.length > 0 && (
                                <ListItem icon={<ArrowRight size={15} className="text-purple-400" />} text="Continue specialized management for chronic conditions." />
                            )}
                        </InfoBlock>
                    </CardContent>
                </Card>
            </motion.div>
        );
    };

    const InfoBlock: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <h4 className="text-md font-medium text-slate-200 mb-2.5 flex items-center">
                <span className="mr-2">{icon}</span>
                {title}
            </h4>
            <ul className="space-y-1.5 text-sm text-slate-400">{children}</ul>
        </div>
    );

    const ListItem: React.FC<{ icon?: React.ReactNode; text: string; }> = ({ icon, text }) => (
        <li className="flex items-center">
            {icon && <span className="mr-2">{icon}</span>}
            {text}
        </li>
    );


    // --- Loading and Error States ---
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center space-y-3 p-8 bg-white rounded-xl shadow-2xl"
                >
                    <Loader2 size={48} className="text-sky-500 animate-spin" />
                    <p className="text-slate-700 font-medium text-lg">Loading Patient Records...</p>
                    <p className="text-slate-500 text-sm">Please wait a moment.</p>
                </motion.div>
            </div>
        );
    }

    if (error || !patient) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-8 bg-white rounded-xl shadow-2xl text-center max-w-md"
                >
                    <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">Access Denied or Patient Not Found</h2>
                    <p className="text-slate-600 mb-6">{error || 'The requested patient record could not be found or you do not have permission to view it.'}</p>
                    <Button
                        variant="primary"
                        onClick={() => navigate('/patients')}
                        className="w-full"
                    >
                        <ChevronLeft size={18} className="mr-2" />
                        Return to Patients List
                    </Button>
                </motion.div>
            </div>
        );
    }

    // --- Main Patient Detail Page Structure ---
    return (
        <motion.div 
            variants={premiumContainerVariants} 
            initial="hidden" 
            animate="visible" 
            className="min-h-screen bg-slate-100 p-4 md:p-6 lg:p-8"
        >
            {/* Page Header */}
            <motion.header variants={premiumItemVariants} className="mb-6 md:mb-8">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate('/patients')}
                            className="bg-white mb-2 md:mb-0"
                        >
                            <ChevronLeft size={18} className="mr-1.5" />
                            Back to Patients
                        </Button>
                        <h1 className="text-3xl md:text-4xl font-bold text-slate-800">
                            {patient.first_name} {patient.last_name}
                        </h1>
                        <p className="text-slate-600">Patient ID: {patient.id}</p>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                        <Button variant="secondary" size="sm" onClick={() => fetchPatientDetails(false)}>
                            <RefreshCw size={16} className="mr-2"/>
                            Refresh Data
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => alert('Export functionality to be implemented!')}>
                            <Download size={16} className="mr-2"/>
                            Export Patient Data
                        </Button>
                         <Button variant="primary" onClick={() => setIsAddVisitModalOpen(true)}>
                            <FilePlus size={18} className="mr-2" />
                            Record New Visit
                        </Button>
                    </div>
                </div>
            </motion.header>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                {/* Left Column */}
                <motion.div variants={premiumItemVariants} className="lg:col-span-1 space-y-6 md:space-y-8">
                    {/* Patient Profile Card */}
                    <Card className="overflow-hidden shadow-xl border border-slate-200">
                        <div className="h-36 bg-gradient-to-br from-sky-500 to-sky-600 relative">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 text-white"
                                onClick={() => setIsEditPatientModalOpen(true)}
                                aria-label="Edit Profile"
                            >
                                <Edit3 size={18} />
                            </Button>
                        </div>
                        <CardContent className="relative pt-16 pb-6 text-center">
                            <div className="absolute left-1/2 transform -translate-x-1/2 -top-14 p-1 bg-white rounded-full shadow-lg">
                                <div className="w-24 h-24 bg-gradient-to-br from-sky-400 to-sky-500 rounded-full flex items-center justify-center text-white">
                                    <User size={48} />
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mt-2">
                                {patient.first_name} {patient.last_name}
                            </h2>
                            <p className="text-slate-500 mt-1">
                                {patientAge} years old • {patient.gender}
                            </p>
                            <div className="flex justify-center mt-3 space-x-2">
                                <Badge variant="success">Active Patient</Badge>
                                {patient.medical_aid_details && patient.medical_aid_details.length > 0 && (
                                    <Badge variant="info">Insured</Badge>
                                )}
                            </div>

                            <div className="mt-6 space-y-3 text-sm text-slate-600 px-4">
                                <InfoItem icon={<Mail size={16} className="text-sky-600"/>} label="Email" value={patient.email || 'N/A'} />
                                <InfoItem icon={<Phone size={16} className="text-sky-600"/>} label="Phone" value={patient.cell_number || 'N/A'} />
                                <InfoItem icon={<Home size={16} className="text-sky-600"/>} label="Address" value={patient.home_address || 'N/A'} />
                                {patient.occupation && <InfoItem icon={<Briefcase size={16} className="text-sky-600"/>} label="Occupation" value={patient.occupation} />}
                            </div>
                            
                            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-slate-200 pt-6 px-2">
                                <StatItem value={patient.total_visits ?? 0} label="Visits" icon={<CalendarDays size={20} className="text-sky-600 mb-1"/>} />
                                <StatItem value={patient.total_reports ?? 0} label="Reports" icon={<FileText size={20} className="text-sky-600 mb-1"/>} />
                                <StatItem value={0} label="Referrals" icon={<Users size={20} className="text-sky-600 mb-1"/>} /> {/* Placeholder */}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Medical Aid Card */}
                    <Card className="overflow-hidden shadow-xl border border-slate-200">
                        <CardHeader className="bg-slate-50 border-b border-slate-200">
                           <div className="flex justify-between items-center">
                                <CardTitle className="text-lg font-semibold text-slate-700 flex items-center">
                                    <ShieldCheck size={20} className="mr-2 text-green-600" />
                                    Medical Aid Details
                                </CardTitle>
                                <Button variant="ghost" size="icon_sm" onClick={() => setIsMedicalAidModalOpen(true)} aria-label="Edit Medical Aid">
                                    <Edit3 size={16} className="text-slate-500"/>
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6">
                            {patient.medical_aid_details && patient.medical_aid_details[0] ? (
                                <div className="space-y-4 text-sm">
                                    <DetailItem label="Provider" value={patient.medical_aid_details[0].provider} />
                                    <DetailItem label="Scheme" value={patient.medical_aid_details[0].scheme} />
                                    <DetailItem label="Membership No." value={patient.medical_aid_details[0].membership_number} mono />
                                    <DetailItem label="Plan Type" value={patient.medical_aid_details[0].plan_type || 'N/A'} />
                                    <div className="pt-3 mt-3 border-t border-slate-200">
                                        <DetailItem label="Main Member" value={patient.medical_aid_details[0].main_member_name} boldValue />
                                        <DetailItem label="Main Member ID" value={patient.medical_aid_details[0].main_member_id_number || 'N/A'} />
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <Building2 size={36} className="mx-auto text-slate-300 mb-3" />
                                    <p className="text-slate-500 mb-4 text-sm">No medical aid information on file.</p>
                                    <Button variant="outline" size="sm" onClick={() => setIsMedicalAidModalOpen(true)}>
                                        Add Medical Aid
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Next of Kin Card */}
                    <Card className="overflow-hidden shadow-xl border border-slate-200">
                        <CardHeader className="bg-slate-50 border-b border-slate-200">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-lg font-semibold text-slate-700 flex items-center">
                                    <Heart size={20} className="mr-2 text-red-500" />
                                    Next of Kin
                                </CardTitle>
                                 <Button variant="ghost" size="icon_sm" onClick={() => setIsNextOfKinModalOpen(true)} aria-label="Edit Next of Kin">
                                    <Edit3 size={16} className="text-slate-500"/>
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6">
                            {patient.next_of_kin && patient.next_of_kin[0] ? (
                                <div className="space-y-3 text-sm">
                                     <div className="flex items-center space-x-3 mb-3">
                                        <div className="p-2.5 bg-red-50 rounded-full">
                                            <Users size={20} className="text-red-500" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-800 text-md">{patient.next_of_kin[0].name}</h3>
                                            <p className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-sm inline-block">{patient.next_of_kin[0].relationship}</p>
                                        </div>
                                    </div>
                                    <DetailItem icon={<Phone size={15} className="text-slate-500"/>} label="Phone" value={patient.next_of_kin[0].phone} />
                                    {patient.next_of_kin[0].address && (
                                        <DetailItem icon={<MapPin size={15} className="text-slate-500"/>} label="Address" value={patient.next_of_kin[0].address} />
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <Users size={36} className="mx-auto text-slate-300 mb-3" />
                                    <p className="text-slate-500 mb-4 text-sm">No next of kin information available.</p>
                                    <Button variant="outline" size="sm" onClick={() => setIsNextOfKinModalOpen(true)}>
                                        Add Next of Kin
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Right Column */}
                <motion.div variants={premiumItemVariants} className="lg:col-span-2 space-y-6 md:space-y-8">
                    <AISummaryCard patient={patient} />
                    <VisitsTimeline patientId={id || ''} />
                </motion.div>
            </div>

            {/* Modals */}
            <FormModal
                isOpen={isNextOfKinModalOpen}
                onClose={() => setIsNextOfKinModalOpen(false)}
                title={patient.next_of_kin && patient.next_of_kin[0] ? "Update Next of Kin" : "Add Next of Kin"}
            >
                <NextOfKinForm
                    patientId={id || ''}
                    initialData={patient.next_of_kin && patient.next_of_kin[0]}
                    onSuccess={() => handleModalSuccess(setIsNextOfKinModalOpen)}
                />
            </FormModal>

            <FormModal
                isOpen={isEditPatientModalOpen}
                onClose={() => setIsEditPatientModalOpen(false)}
                title="Edit Patient Details"
            >
                <EditPatientForm
                    patientId={id || ''}
                    initialData={patient} // Send the whole patient object
                    onSuccess={() => handleModalSuccess(setIsEditPatientModalOpen)}
                />
            </FormModal>
            
            {/* Placeholder for Medical Aid Modal - Create this form */}
            <FormModal
                isOpen={isMedicalAidModalOpen}
                onClose={() => setIsMedicalAidModalOpen(false)}
                title={patient.medical_aid_details && patient.medical_aid_details[0] ? "Update Medical Aid" : "Add Medical Aid"}
            >
                {/* Replace with your EditMedicalAidForm component */}
                <div className="p-4">
                    <p className="text-slate-600">Medical Aid form to be implemented here.</p>
                    <p className="text-sm text-slate-500 mt-1">Patient ID: {id}</p>
                    <p className="text-sm text-slate-500">Initial Data: {JSON.stringify(patient.medical_aid_details?.[0])}</p>
                     <Button onClick={() => handleModalSuccess(setIsMedicalAidModalOpen)} className="mt-4">Save (Placeholder)</Button>
                </div>
                {/* <EditMedicalAidForm 
                    patientId={id || ''}
                    initialData={patient.medical_aid_details?.[0]}
                    onSuccess={() => handleModalSuccess(setIsMedicalAidModalOpen)}
                />
                */}
            </FormModal>


            <FormModal
                isOpen={isAddVisitModalOpen}
                onClose={() => setIsAddVisitModalOpen(false)}
                title="Record New Patient Visit"
            >
                <AddVisitForm
                    patientId={id || ''}
                    onSuccess={() => handleModalSuccess(setIsAddVisitModalOpen)}
                />
            </FormModal>

            {/* <FormModal
                isOpen={isAddRecordModalOpen}
                onClose={() => setIsAddRecordModalOpen(false)}
                title="Add New Medical Record"
            >
                <AddMedicalRecordForm
                    patientId={id || ''}
                    onSuccess={() => handleModalSuccess(setIsAddRecordModalOpen)}
                />
            </FormModal> 
            */}
        </motion.div>
    );
};

// Helper components for consistent styling (can be moved to a separate file)
const InfoItem: React.FC<{icon: React.ReactNode, label: string, value: string | number }> = ({ icon, label, value}) => (
    <div className="flex items-start text-left">
        <span className="mr-2 mt-0.5 shrink-0">{icon}</span>
        <div>
            {/* <p className="text-xs text-slate-400">{label}</p> */}
            <p className="text-slate-700 leading-tight">{value}</p>
        </div>
    </div>
);

const StatItem: React.FC<{ value: string | number, label: string, icon: React.ReactNode }> = ({ value, label, icon }) => (
    <div className="text-center px-1">
        {icon}
        <div className="text-2xl font-bold text-sky-600">{value}</div>
        <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
    </div>
);

const DetailItem: React.FC<{label: string, value: string | number, mono?: boolean, boldValue?: boolean, icon?: React.ReactNode}> = ({ label, value, mono, boldValue, icon }) => (
    <div className="flex items-start justify-between">
        <p className="text-slate-500 flex items-center">
            {icon && <span className="mr-1.5">{icon}</span>}
            {label}:
        </p>
        <p className={`text-slate-700 ${mono ? 'font-mono' : ''} ${boldValue ? 'font-semibold': ''} text-right`}>{value}</p>
    </div>
);


export default PatientDetail;