import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Building2, 
  FileText, 
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
  XCircle,
  ArrowRight,
  Brain,
  Sparkles
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import FormModal from '../components/modals/FormModal';
import AddMedicalRecordForm from '../components/forms/AddMedicalRecordForm';
import NextOfKinForm from '../components/forms/NextOfKinForm';
import EditPatientForm from '../components/forms/EditPatientForm';
import { supabase } from '../lib/supabase';
import { logDatabaseError } from '../lib/supabase';
import { format } from 'date-fns';

// ... (keep all interfaces and type definitions)

const PatientDetail: React.FC = () => {
  // ... (keep all existing state and hooks)

  const generateAISummary = (patient: Patient | null) => {
    if (!patient) return null;

    const age = calculateAge(patient.date_of_birth);
    const medicalAid = patient.medical_aid_details?.[0];
    const chronicConditions = ['Hypertension']; // This would come from patient data
    const recentVisits = 3; // This would be calculated from visit history
    const upcomingAppointments = 2; // This would be from appointments data
    const riskLevel = 'Low'; // This would be calculated based on various factors
    const complianceRate = '95%'; // This would be calculated from appointment attendance, medication adherence, etc.

    return (
      <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                <Brain className="text-indigo-600" size={24} />
              </div>
              <div>
                <CardTitle className="flex items-center">
                  AI Health Summary
                  <Sparkles className="ml-2 text-amber-500" size={18} />
                </CardTitle>
                <p className="text-sm text-gray-500 mt-1">Generated on {format(new Date(), 'MMMM d, yyyy')}</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="prose prose-indigo">
            <p className="text-gray-700 leading-relaxed">
              {patient.first_name} {patient.last_name} is a {age}-year-old {patient.gender} patient with a {riskLevel.toLowerCase()} health risk profile. 
              {chronicConditions.length > 0 && ` They have ${chronicConditions.length} documented chronic condition(s), including ${chronicConditions.join(', ')}.`}
            </p>
            
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Recent Activity</h4>
                <p className="text-sm text-gray-600">
                  Had {recentVisits} clinical visits in the past 3 months with a {complianceRate} appointment compliance rate. 
                  {upcomingAppointments > 0 && ` Has ${upcomingAppointments} upcoming scheduled appointments.`}
                </p>
              </div>
              
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Insurance Status</h4>
                <p className="text-sm text-gray-600">
                  {medicalAid ? 
                    `Covered under ${medicalAid.provider} (${medicalAid.scheme} plan)` :
                    'Currently not covered by medical aid'
                  }
                </p>
              </div>
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Key Observations</h4>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <CheckCircle2 className="text-emerald-500 mr-2 mt-1" size={16} />
                  <span className="text-sm text-gray-600">Regular check-up attendance indicates strong preventive care engagement</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="text-emerald-500 mr-2 mt-1" size={16} />
                  <span className="text-sm text-gray-600">Vital signs have remained stable over the past 6 months</span>
                </li>
                {chronicConditions.length > 0 && (
                  <li className="flex items-start">
                    <AlertCircle className="text-amber-500 mr-2 mt-1" size={16} />
                    <span className="text-sm text-gray-600">Requires regular monitoring of chronic conditions</span>
                  </li>
                )}
              </ul>
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Recommendations</h4>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <ArrowRight className="text-indigo-500 mr-2 mt-1" size={16} />
                  <span className="text-sm text-gray-600">Schedule next routine check-up within 3 months</span>
                </li>
                <li className="flex items-start">
                  <ArrowRight className="text-indigo-500 mr-2 mt-1" size={16} />
                  <span className="text-sm text-gray-600">Continue current medication regimen with regular reviews</span>
                </li>
                <li className="flex items-start">
                  <ArrowRight className="text-indigo-500 mr-2 mt-1" size={16} />
                  <span className="text-sm text-gray-600">Consider comprehensive health screening at next visit</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ... (keep all existing JSX until the Quick Actions card)

  {/* Replace the Quick Actions card with the AI Summary */}
  {generateAISummary(patient)}

  // ... (keep all remaining JSX and components)
};

export default PatientDetail;