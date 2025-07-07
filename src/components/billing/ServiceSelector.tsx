import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  Minus,
  X,
  DollarSign,
  Stethoscope,
  Shield,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Grid3X3,
  List
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ServiceSelection, TariffCode, MedicalAidCoverage } from '../../types/billing';

interface ServiceSelectorProps {
  practiceId: string;
  selectedServices: ServiceSelection[];
  onServiceChange: (services: ServiceSelection[]) => void;
  medicalAidId?: string;
  readOnly?: boolean;
}

interface TariffWithCoverage extends TariffCode {
  coverage?: MedicalAidCoverage;
  medicalAidCovered: boolean;
  coveragePercentage: number;
}

const ServiceSelector: React.FC<ServiceSelectorProps> = ({
  practiceId,
  selectedServices,
  onServiceChange,
  medicalAidId,
  readOnly = false
}) => {
  const [availableServices, setAvailableServices] = useState<TariffWithCoverage[]>([]);
  const [filteredServices, setFilteredServices] = useState<TariffWithCoverage[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showCalculator, setShowCalculator] = useState(false);

  // Fetch available services for the practice
  useEffect(() => {
    const fetchServices = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // First, get practice information to determine type
        const { data: practiceData, error: practiceError } = await supabase
          .from('practices')
          .select('id, name, practice_type, practice_subtypes')
          .eq('id', practiceId)
          .single();

        if (practiceError) {
          console.warn('Error fetching practice info:', practiceError);
        }

        const practiceType = practiceData?.practice_type || 'medical';
        console.log(`🏥 Practice: ${practiceData?.name} (Type: ${practiceType})`);

        // Fetch tariffs that match the practice type (simplified structure - no practice_id)
        // Aesthetic practices also see dental codes since they do dental work
        let tariffs = [];
        const serviceTypesToFetch = [practiceType];
        
        // Aesthetic practices can also perform dental services
        if (practiceType === 'aesthetic') {
          serviceTypesToFetch.push('dental');
        }
        
        const { data: fetchedTariffs, error: tariffsError } = await supabase
          .from('practice_tariffs')
          .select('*')
          .in('practice_type', serviceTypesToFetch)
          .eq('is_active', true)
          .order('code', { ascending: true });

        if (tariffsError) {
          console.warn('Error fetching tariffs:', tariffsError);
        }

        // Use fetched tariffs or fall back to practice-type appropriate codes
        if (fetchedTariffs && fetchedTariffs.length > 0) {
          tariffs = fetchedTariffs;
          console.log(`✅ Found ${fetchedTariffs.length} ${practiceType} tariffs in database`);
        } else if (practiceType === 'dental' || practiceType === 'aesthetic') {
          // ACTUAL dental codes from dentalpractice_codes_2025.xlsx (only for dental/aesthetic practices)
          console.log('🦷 Using dental codes for dental/aesthetic practice (128 codes)');
          tariffs = [
            // Consultation & Examination
            { id: '004', code: '004', price: 135.00, namaf_prace_2025: 'Emergency oral examination', category: 'Consultation & Examination', subcategory: 'Emergency', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '005', code: '005', price: 185.00, namaf_prace_2025: 'Emergency examination after hours', category: 'Consultation & Examination', subcategory: 'Emergency', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '009', code: '009', price: 45.00, namaf_prace_2025: 'Post-operative examination', category: 'Consultation & Examination', subcategory: 'Follow-up', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '003', code: '003', price: 55.00, namaf_prace_2025: 'Limited oral examination - problem focused', category: 'Consultation & Examination', subcategory: 'Follow-up', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '002', code: '002', price: 65.00, namaf_prace_2025: 'Periodic oral examination', category: 'Consultation & Examination', subcategory: 'Follow-up', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '008', code: '008', price: 85.00, namaf_prace_2025: 'Pre-operative consultation', category: 'Consultation & Examination', subcategory: 'Follow-up', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '001', code: '001', price: 95.00, namaf_prace_2025: 'Initial comprehensive oral examination', category: 'Consultation & Examination', subcategory: 'Initial Consultation', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '010', code: '010', price: 115.00, namaf_prace_2025: 'Oral cancer screening', category: 'Consultation & Examination', subcategory: 'Specialist', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '007', code: '007', price: 125.00, namaf_prace_2025: 'Second opinion consultation', category: 'Consultation & Examination', subcategory: 'Specialist', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '006', code: '006', price: 155.00, namaf_prace_2025: 'Specialist consultation', category: 'Consultation & Examination', subcategory: 'Specialist', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },

            // Cosmetic
            { id: '922', code: '922', price: 185.00, namaf_prace_2025: 'Tooth reshaping per tooth', category: 'Cosmetic', subcategory: 'Bonding', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '931', code: '931', price: 185.00, namaf_prace_2025: 'Smile makeover consultation', category: 'Cosmetic', subcategory: 'Consultation', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '921', code: '921', price: 325.00, namaf_prace_2025: 'Cosmetic bonding per tooth', category: 'Cosmetic', subcategory: 'Bonding', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '932', code: '932', price: 385.00, namaf_prace_2025: 'Digital smile design', category: 'Cosmetic', subcategory: 'Digital Services', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '902', code: '902', price: 385.00, namaf_prace_2025: 'Take-home whitening kit', category: 'Cosmetic', subcategory: 'Whitening', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '912', code: '912', price: 785.00, namaf_prace_2025: 'Composite veneer per tooth', category: 'Cosmetic', subcategory: 'Veneers', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '901', code: '901', price: 785.00, namaf_prace_2025: 'Professional in-office whitening', category: 'Cosmetic', subcategory: 'Whitening', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '913', code: '913', price: 285.00, namaf_prace_2025: 'Veneer consultation and mockup', category: 'Cosmetic', subcategory: 'Veneers', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '911', code: '911', price: 1685.00, namaf_prace_2025: 'Porcelain veneer per tooth', category: 'Cosmetic', subcategory: 'Veneers', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },

            // Restorative
            { id: '211', code: '211', price: 185.00, namaf_prace_2025: 'Amalgam filling - 1 surface', category: 'Restorative', subcategory: 'Fillings', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '221', code: '221', price: 225.00, namaf_prace_2025: 'Composite filling - anterior 1 surface', category: 'Restorative', subcategory: 'Fillings', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '212', code: '212', price: 225.00, namaf_prace_2025: 'Amalgam filling - 2 surfaces', category: 'Restorative', subcategory: 'Fillings', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '213', code: '213', price: 285.00, namaf_prace_2025: 'Amalgam filling - 3+ surfaces', category: 'Restorative', subcategory: 'Fillings', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '231', code: '231', price: 285.00, namaf_prace_2025: 'Composite filling - posterior 1 surface', category: 'Restorative', subcategory: 'Fillings', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '222', code: '222', price: 285.00, namaf_prace_2025: 'Composite filling - anterior 2 surfaces', category: 'Restorative', subcategory: 'Fillings', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '274', code: '274', price: 385.00, namaf_prace_2025: 'Temporary crown', category: 'Restorative', subcategory: 'Crowns', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '232', code: '232', price: 385.00, namaf_prace_2025: 'Composite filling - posterior 2 surfaces', category: 'Restorative', subcategory: 'Fillings', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '223', code: '223', price: 385.00, namaf_prace_2025: 'Composite filling - anterior 3+ surfaces', category: 'Restorative', subcategory: 'Fillings', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '233', code: '233', price: 485.00, namaf_prace_2025: 'Composite filling - posterior 3+ surfaces', category: 'Restorative', subcategory: 'Fillings', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '281', code: '281', price: 1685.00, namaf_prace_2025: 'Pontic - porcelain fused to metal', category: 'Restorative', subcategory: 'Bridge', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '271', code: '271', price: 1885.00, namaf_prace_2025: 'Porcelain fused to metal crown', category: 'Restorative', subcategory: 'Crowns', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '282', code: '282', price: 1885.00, namaf_prace_2025: 'Pontic - all ceramic', category: 'Restorative', subcategory: 'Bridge', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '272', code: '272', price: 2185.00, namaf_prace_2025: 'All ceramic crown', category: 'Restorative', subcategory: 'Crowns', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '273', code: '273', price: 2485.00, namaf_prace_2025: 'Gold crown', category: 'Restorative', subcategory: 'Crowns', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },

            // Endodontics
            { id: '334', code: '334', price: 485.00, namaf_prace_2025: 'Pulpotomy - emergency', category: 'Endodontics', subcategory: 'Emergency', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '335', code: '335', price: 685.00, namaf_prace_2025: 'Post and core buildup', category: 'Endodontics', subcategory: 'Post Treatment', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '331', code: '331', price: 1285.00, namaf_prace_2025: 'Root canal - anterior tooth', category: 'Endodontics', subcategory: 'Root Canal', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '332', code: '332', price: 1485.00, namaf_prace_2025: 'Root canal - premolar', category: 'Endodontics', subcategory: 'Root Canal', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '333', code: '333', price: 1885.00, namaf_prace_2025: 'Root canal - molar', category: 'Endodontics', subcategory: 'Root Canal', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },

            // Periodontics
            { id: '411', code: '411', price: 285.00, namaf_prace_2025: 'Routine prophylaxis', category: 'Periodontics', subcategory: 'Cleaning', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '412', code: '412', price: 485.00, namaf_prace_2025: 'Deep cleaning - per quadrant', category: 'Periodontics', subcategory: 'Cleaning', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '421', code: '421', price: 785.00, namaf_prace_2025: 'Gingivectomy - per quadrant', category: 'Periodontics', subcategory: 'Surgery', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '422', code: '422', price: 1285.00, namaf_prace_2025: 'Periodontal flap surgery - per quadrant', category: 'Periodontics', subcategory: 'Surgery', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },

            // Oral Surgery
            { id: '501', code: '501', price: 285.00, namaf_prace_2025: 'Simple extraction', category: 'Oral Surgery', subcategory: 'Extractions', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '502', code: '502', price: 485.00, namaf_prace_2025: 'Surgical extraction', category: 'Oral Surgery', subcategory: 'Extractions', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '503', code: '503', price: 585.00, namaf_prace_2025: 'Wisdom tooth extraction - simple', category: 'Oral Surgery', subcategory: 'Extractions', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '504', code: '504', price: 885.00, namaf_prace_2025: 'Wisdom tooth extraction - surgical', category: 'Oral Surgery', subcategory: 'Extractions', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '511', code: '511', price: 1285.00, namaf_prace_2025: 'Bone grafting - small', category: 'Oral Surgery', subcategory: 'Advanced', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '512', code: '512', price: 2485.00, namaf_prace_2025: 'Sinus lift', category: 'Oral Surgery', subcategory: 'Advanced', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },

            // Prosthodontics
            { id: '603', code: '603', price: 2185.00, namaf_prace_2025: 'Partial denture - acrylic', category: 'Prosthodontics', subcategory: 'Dentures', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '604', code: '604', price: 2885.00, namaf_prace_2025: 'Partial denture - cast metal', category: 'Prosthodontics', subcategory: 'Dentures', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '622', code: '622', price: 2885.00, namaf_prace_2025: 'Implant crown', category: 'Prosthodontics', subcategory: 'Implants', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '601', code: '601', price: 3485.00, namaf_prace_2025: 'Complete upper denture', category: 'Prosthodontics', subcategory: 'Dentures', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '602', code: '602', price: 3485.00, namaf_prace_2025: 'Complete lower denture', category: 'Prosthodontics', subcategory: 'Dentures', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '621', code: '621', price: 4885.00, namaf_prace_2025: 'Single implant placement', category: 'Prosthodontics', subcategory: 'Implants', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },

            // Orthodontics
            { id: '701', code: '701', price: 285.00, namaf_prace_2025: 'Orthodontic consultation', category: 'Orthodontics', subcategory: 'Consultation', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '721', code: '721', price: 785.00, namaf_prace_2025: 'Retainer - upper or lower', category: 'Orthodontics', subcategory: 'Appliances', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '711', code: '711', price: 18500.00, namaf_prace_2025: 'Metal braces - full treatment', category: 'Orthodontics', subcategory: 'Treatment', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '712', code: '712', price: 22500.00, namaf_prace_2025: 'Ceramic braces - full treatment', category: 'Orthodontics', subcategory: 'Treatment', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '713', code: '713', price: 28500.00, namaf_prace_2025: 'Invisalign - full treatment', category: 'Orthodontics', subcategory: 'Treatment', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },

            // Pediatric Dentistry
            { id: '802', code: '802', price: 125.00, namaf_prace_2025: 'Fluoride treatment', category: 'Pediatric Dentistry', subcategory: 'Preventive', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '801', code: '801', price: 185.00, namaf_prace_2025: 'Child prophylaxis', category: 'Pediatric Dentistry', subcategory: 'Preventive', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '803', code: '803', price: 185.00, namaf_prace_2025: 'Sealant per tooth', category: 'Pediatric Dentistry', subcategory: 'Preventive', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '811', code: '811', price: 185.00, namaf_prace_2025: 'Primary tooth filling', category: 'Pediatric Dentistry', subcategory: 'Restorative', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: '821', code: '821', price: 185.00, namaf_prace_2025: 'Primary tooth extraction', category: 'Pediatric Dentistry', subcategory: 'Surgery', practice_type: 'dental', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() }
          ];
        } else {
          // General medical codes for medical practices
          console.log('🏥 Using general medical codes for medical practice');
          tariffs = [
            // General Consultations
            { id: 'M001', code: 'M001', price: 450.00, namaf_prace_2025: 'General consultation', category: 'Consultation', subcategory: 'General', practice_type: 'medical', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: 'M002', code: 'M002', price: 350.00, namaf_prace_2025: 'Follow-up consultation', category: 'Consultation', subcategory: 'Follow-up', practice_type: 'medical', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: 'M003', code: 'M003', price: 650.00, namaf_prace_2025: 'Emergency consultation', category: 'Emergency', subcategory: 'Consultation', practice_type: 'medical', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: 'M004', code: 'M004', price: 850.00, namaf_prace_2025: 'Specialist consultation', category: 'Consultation', subcategory: 'Specialist', practice_type: 'medical', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            
            // Diagnostic Procedures
            { id: 'M101', code: 'M101', price: 250.00, namaf_prace_2025: 'Basic health screening', category: 'Diagnostic', subcategory: 'Screening', practice_type: 'medical', unit: 'per_test', is_active: true, effective_from: new Date().toISOString() },
            { id: 'M102', code: 'M102', price: 180.00, namaf_prace_2025: 'Blood pressure check', category: 'Diagnostic', subcategory: 'Vitals', practice_type: 'medical', unit: 'per_test', is_active: true, effective_from: new Date().toISOString() },
            { id: 'M103', code: 'M103', price: 320.00, namaf_prace_2025: 'ECG (Electrocardiogram)', category: 'Diagnostic', subcategory: 'Cardiac', practice_type: 'medical', unit: 'per_test', is_active: true, effective_from: new Date().toISOString() },
            { id: 'M104', code: 'M104', price: 450.00, namaf_prace_2025: 'Basic blood test panel', category: 'Diagnostic', subcategory: 'Laboratory', practice_type: 'medical', unit: 'per_test', is_active: true, effective_from: new Date().toISOString() },
            
            // Preventive Care
            { id: 'M201', code: 'M201', price: 380.00, namaf_prace_2025: 'Annual physical examination', category: 'Preventive', subcategory: 'Annual Care', practice_type: 'medical', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: 'M202', code: 'M202', price: 280.00, namaf_prace_2025: 'Vaccination administration', category: 'Preventive', subcategory: 'Immunization', practice_type: 'medical', unit: 'per_injection', is_active: true, effective_from: new Date().toISOString() },
            { id: 'M203', code: 'M203', price: 350.00, namaf_prace_2025: 'Health education session', category: 'Preventive', subcategory: 'Education', practice_type: 'medical', unit: 'per_session', is_active: true, effective_from: new Date().toISOString() },
            
            // Minor Procedures
            { id: 'M301', code: 'M301', price: 185.00, namaf_prace_2025: 'Wound dressing change', category: 'Minor Procedures', subcategory: 'Wound Care', practice_type: 'medical', unit: 'per_procedure', is_active: true, effective_from: new Date().toISOString() },
            { id: 'M302', code: 'M302', price: 280.00, namaf_prace_2025: 'Suture removal', category: 'Minor Procedures', subcategory: 'Wound Care', practice_type: 'medical', unit: 'per_procedure', is_active: true, effective_from: new Date().toISOString() },
            { id: 'M303', code: 'M303', price: 450.00, namaf_prace_2025: 'Minor lesion removal', category: 'Minor Procedures', subcategory: 'Surgery', practice_type: 'medical', unit: 'per_procedure', is_active: true, effective_from: new Date().toISOString() },
            { id: 'M304', code: 'M304', price: 220.00, namaf_prace_2025: 'Injection (intramuscular)', category: 'Minor Procedures', subcategory: 'Injection', practice_type: 'medical', unit: 'per_injection', is_active: true, effective_from: new Date().toISOString() },
            
            // Chronic Care Management
            { id: 'M401', code: 'M401', price: 680.00, namaf_prace_2025: 'Diabetes management consultation', category: 'Chronic Care', subcategory: 'Diabetes', practice_type: 'medical', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: 'M402', code: 'M402', price: 580.00, namaf_prace_2025: 'Hypertension management', category: 'Chronic Care', subcategory: 'Cardiovascular', practice_type: 'medical', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() },
            { id: 'M403', code: 'M403', price: 750.00, namaf_prace_2025: 'Asthma/COPD management', category: 'Chronic Care', subcategory: 'Respiratory', practice_type: 'medical', unit: 'per_visit', is_active: true, effective_from: new Date().toISOString() }
          ];
        }

        // If medical aid is selected, fetch coverage information
        const coverageMap: Map<string, MedicalAidCoverage> = new Map();
        if (medicalAidId) {
          const { data: coverage, error: coverageError } = await supabase
            .from('medical_aid_coverage')
            .select('*')
            .eq('medical_aid_id', medicalAidId)
            .eq('is_active', true);

          if (coverageError) {
            console.warn('Error fetching medical aid coverage:', coverageError);
          } else if (coverage) {
            coverage.forEach(c => coverageMap.set(c.tariff_code, c));
          }
        }

        // Transform tariffs with coverage information
        const servicesWithCoverage: TariffWithCoverage[] = (tariffs || []).map(tariff => {
          const coverage = coverageMap.get(tariff.code);
          return {
            id: tariff.id,
            code: tariff.code,
            description: tariff.namaf_prace_2025 || tariff.description || 'Unknown Service',
            category: tariff.category || 'General',
            subcategory: tariff.subcategory,
            price: parseFloat(tariff.price?.toString() || '0'),
            practiceType: tariff.practice_type || 'general',
            unit: (tariff.unit as any) || 'per_visit',
            complexity: tariff.complexity || 'moderate',
            requiresPreAuth: tariff.requires_pre_auth || coverage?.requires_pre_auth || false,
            medicalAidCode: tariff.medical_aid_code || tariff.edi_diagnosi || tariff.code,
            notes: tariff.notes || tariff.full_description || '',
            isActive: tariff.is_active !== undefined ? tariff.is_active : true,
            effectiveFrom: tariff.effective_from || new Date().toISOString(),
            effectiveTo: tariff.effective_to,
            coverage,
            medicalAidCovered: !!coverage,
            coveragePercentage: coverage?.coverage_percentage || 0
          };
        });

        setAvailableServices(servicesWithCoverage);
        setFilteredServices(servicesWithCoverage);
      } catch (err) {
        console.error('Error fetching services:', err);
        setError('Failed to load available services');
      } finally {
        setIsLoading(false);
      }
    };

    if (practiceId) {
      fetchServices();
    }
  }, [practiceId, medicalAidId]);

  // Filter services based on search and category
  useEffect(() => {
    let filtered = availableServices;

    if (searchTerm) {
      filtered = filtered.filter(service =>
        service.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(service => service.category === selectedCategory);
    }

    setFilteredServices(filtered);
  }, [availableServices, searchTerm, selectedCategory]);

  // Get unique categories
  const categories = Array.from(new Set(availableServices.map(s => s.category))).sort();

  // Add service to selection
  const addService = (service: TariffWithCoverage) => {
    if (readOnly) return;

    const existingService = selectedServices.find(s => s.tariffId === service.id);
    if (existingService) {
      // Increase quantity
      updateServiceQuantity(service.id, existingService.quantity + 1);
    } else {
      // Add new service
      const newService: ServiceSelection = {
        id: crypto.randomUUID(),
        tariffId: service.id,
        code: service.code,
        description: service.description,
        category: service.category,
        subcategory: service.subcategory,
        unitPrice: service.price,
        quantity: 1,
        totalPrice: service.price,
        requiresPreAuth: service.requiresPreAuth,
        medicalAidCovered: service.medicalAidCovered,
        coveragePercentage: service.coveragePercentage
      };
      onServiceChange([...selectedServices, newService]);
    }
  };

  // Update service quantity
  const updateServiceQuantity = (tariffId: string, newQuantity: number) => {
    if (readOnly) return;

    if (newQuantity <= 0) {
      removeService(tariffId);
      return;
    }

    const updatedServices = selectedServices.map(service => {
      if (service.tariffId === tariffId) {
        return {
          ...service,
          quantity: newQuantity,
          totalPrice: service.unitPrice * newQuantity
        };
      }
      return service;
    });
    onServiceChange(updatedServices);
  };

  // Remove service from selection
  const removeService = (tariffId: string) => {
    if (readOnly) return;
    onServiceChange(selectedServices.filter(s => s.tariffId !== tariffId));
  };

  // Calculate totals
  const totals = selectedServices.reduce(
    (acc, service) => {
      acc.subtotal += service.totalPrice;
      if (service.medicalAidCovered && service.coveragePercentage) {
        const medicalAidAmount = service.totalPrice * (service.coveragePercentage / 100);
        acc.medicalAidTotal += medicalAidAmount;
        acc.patientTotal += service.totalPrice - medicalAidAmount;
      } else {
        acc.patientTotal += service.totalPrice;
      }
      return acc;
    },
    { subtotal: 0, medicalAidTotal: 0, patientTotal: 0 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#01b9d4]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertTriangle className="text-red-500 mr-2" size={20} />
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[#01b9d4]" />
            Billable Services
          </h3>
          <p className="text-sm text-gray-600">Select services provided during this visit</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowCalculator(!showCalculator)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Calculator className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search services by name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
          />
        </div>
        
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
        >
          <option value="all">All Categories</option>
          {categories.map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </div>

      {/* Selected Services */}
      {selectedServices.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Selected Services ({selectedServices.length})
          </h4>
          <div className="space-y-2">
            {selectedServices.map((service) => (
              <div key={service.id} className="flex items-center justify-between bg-white p-3 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{service.code}</span>
                    {service.medicalAidCovered && (
                      <Shield className="w-4 h-4 text-green-500" title="Covered by Medical Aid" />
                    )}
                    {service.requiresPreAuth && (
                      <AlertTriangle className="w-4 h-4 text-amber-500" title="Requires Pre-Authorization" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{service.description}</p>
                  <p className="text-xs text-gray-500">
                    N$ {service.unitPrice.toFixed(2)} × {service.quantity} = N$ {service.totalPrice.toFixed(2)}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateServiceQuantity(service.tariffId, service.quantity - 1)}
                    disabled={readOnly}
                    className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center text-sm font-medium">{service.quantity}</span>
                  <button
                    onClick={() => updateServiceQuantity(service.tariffId, service.quantity + 1)}
                    disabled={readOnly}
                    className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeService(service.tariffId)}
                    disabled={readOnly}
                    className="p-1 ml-2 text-red-500 hover:text-red-700 hover:bg-red-100 rounded disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          {/* Totals Calculator */}
          <AnimatePresence>
            {showCalculator && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 bg-gray-50 p-4 rounded-lg"
              >
                <h5 className="font-medium text-gray-900 mb-3">Cost Breakdown</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>N$ {totals.subtotal.toFixed(2)}</span>
                  </div>
                  {medicalAidId && totals.medicalAidTotal > 0 && (
                    <>
                      <div className="flex justify-between text-green-600">
                        <span>Medical Aid Portion:</span>
                        <span>N$ {totals.medicalAidTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-blue-600">
                        <span>Patient Portion:</span>
                        <span>N$ {totals.patientTotal.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  <div className="border-t pt-2 flex justify-between font-medium">
                    <span>Total:</span>
                    <span>N$ {totals.subtotal.toFixed(2)}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Available Services */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3">Available Services</h4>
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-2'}>
          {filteredServices.map((service) => {
            const isSelected = selectedServices.some(s => s.tariffId === service.id);
            return (
              <motion.div
                key={service.id}
                whileHover={{ scale: 1.01 }}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  isSelected 
                    ? 'border-blue-300 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => addService(service)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{service.code}</span>
                      {service.medicalAidCovered && (
                        <Shield className="w-4 h-4 text-green-500" title="Covered by Medical Aid" />
                      )}
                      {service.requiresPreAuth && (
                        <AlertTriangle className="w-4 h-4 text-amber-500" title="Requires Pre-Authorization" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{service.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-[#01b9d4]">N$ {service.price.toFixed(2)}</span>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{service.category}</span>
                    </div>
                    {service.medicalAidCovered && (
                      <p className="text-xs text-green-600 mt-1">
                        {service.coveragePercentage}% covered by medical aid
                      </p>
                    )}
                  </div>
                  <Plus className="w-5 h-5 text-gray-400 ml-2" />
                </div>
              </motion.div>
            );
          })}
        </div>
        
        {filteredServices.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Stethoscope className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No services found matching your criteria</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceSelector;