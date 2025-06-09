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
  List,
  Hash,
  Zap,
  Info
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ServiceSelection } from '../../types/billing';

interface EnhancedServiceSelectorProps {
  practiceId?: string;
  selectedServices: ServiceSelection[];
  onServiceChange: (services: ServiceSelection[]) => void;
  medicalAidId?: string;
  readOnly?: boolean;
}

interface DentalTariff {
  id: string;
  code: string;
  description: string;
  price: number;
  official_2025_price_nad: number;
  on_2025_list: string;
  found_in_claims: string;
  requires_tooth_number: string;
  can_be_multiplied: string;
  business_rule_formula: string;
  example_calculation: string;
  notes: string;
  unit: string;
  is_active: boolean;
  effective_from: string;
}

interface TariffWithValidation extends DentalTariff {
  medicalAidCovered: boolean;
  coveragePercentage: number;
  calculatedPrice: number;
  toothNumber?: string;
  multiplier?: number;
}

// Comprehensive fallback tariffs that match the imported dental codes
const getFallbackTariffs = (): DentalTariff[] => [
  { id: '1', code: '8101', description: 'Full mouth examination, charting and treatment planning', price: 254.7, official_2025_price_nad: 254.7, on_2025_list: 'YES', found_in_claims: 'YES', requires_tooth_number: 'NO', can_be_multiplied: 'NO', business_rule_formula: 'Fixed price', example_calculation: '254.7 NAD', notes: '', unit: 'per visit', is_active: true, effective_from: '2025-01-01' },
  { id: '2', code: '8102', description: 'Comprehensive consultation', price: 479, official_2025_price_nad: 479, on_2025_list: 'YES', found_in_claims: 'YES', requires_tooth_number: 'NO', can_be_multiplied: 'NO', business_rule_formula: 'Fixed price', example_calculation: '479.0 NAD', notes: '', unit: 'per visit', is_active: true, effective_from: '2025-01-01' },
  { id: '3', code: '8104', description: 'Examination or consultation for a specific problem', price: 137.4, official_2025_price_nad: 137.4, on_2025_list: 'YES', found_in_claims: 'YES', requires_tooth_number: 'NO', can_be_multiplied: 'NO', business_rule_formula: 'Fixed price', example_calculation: '137.4 NAD', notes: '', unit: 'per visit', is_active: true, effective_from: '2025-01-01' },
  { id: '4', code: '8107', description: 'Intra-oral radiographs, per film', price: 135.4, official_2025_price_nad: 135.4, on_2025_list: 'YES', found_in_claims: 'YES', requires_tooth_number: 'YES', can_be_multiplied: 'YES', business_rule_formula: 'Base price × number of X-rays', example_calculation: '135.4 × 3 = 406.20 (for 3 X-rays)', notes: '', unit: 'per item', is_active: true, effective_from: '2025-01-01' },
  { id: '5', code: '8211', description: 'Removal of unerupted/impacted tooth', price: 802.4, official_2025_price_nad: 802.4, on_2025_list: 'YES', found_in_claims: 'YES', requires_tooth_number: 'YES', can_be_multiplied: 'NO', business_rule_formula: 'Fixed price per tooth', example_calculation: '802.4 NAD', notes: '', unit: 'per visit', is_active: true, effective_from: '2025-01-01' },
  { id: '6', code: '8341', description: 'Amalgam - one surface', price: 373.9, official_2025_price_nad: 373.9, on_2025_list: 'YES', found_in_claims: 'YES', requires_tooth_number: 'YES', can_be_multiplied: 'YES', business_rule_formula: 'Per tooth', example_calculation: '373.9 per tooth', notes: '', unit: 'per item', is_active: true, effective_from: '2025-01-01' },
  { id: '7', code: '8315', description: 'Root canal treatment - single rooted tooth', price: 1087.2, official_2025_price_nad: 1087.2, on_2025_list: 'YES', found_in_claims: 'YES', requires_tooth_number: 'YES', can_be_multiplied: 'NO', business_rule_formula: 'Fixed price per tooth', example_calculation: '1087.2 NAD', notes: '', unit: 'per visit', is_active: true, effective_from: '2025-01-01' },
  { id: '8', code: '8621', description: 'Prophylaxis', price: 234.4, official_2025_price_nad: 234.4, on_2025_list: 'YES', found_in_claims: 'YES', requires_tooth_number: 'NO', can_be_multiplied: 'NO', business_rule_formula: 'Fixed price', example_calculation: '234.4 NAD', notes: '', unit: 'per visit', is_active: true, effective_from: '2025-01-01' },
  { id: '9', code: '8711', description: 'Complete upper denture', price: 3456.8, official_2025_price_nad: 3456.8, on_2025_list: 'YES', found_in_claims: 'YES', requires_tooth_number: 'NO', can_be_multiplied: 'NO', business_rule_formula: 'Fixed price', example_calculation: '3456.8 NAD', notes: '', unit: 'per visit', is_active: true, effective_from: '2025-01-01' },
  { id: '10', code: '8826', description: 'CBCT capture both arches with orbits', price: 988.3, official_2025_price_nad: 988.3, on_2025_list: 'YES', found_in_claims: 'YES', requires_tooth_number: 'NO', can_be_multiplied: 'NO', business_rule_formula: 'Fixed price', example_calculation: '988.3 NAD', notes: '', unit: 'per visit', is_active: true, effective_from: '2025-01-01' }
];

const EnhancedServiceSelector: React.FC<EnhancedServiceSelectorProps> = ({
  practiceId,
  selectedServices,
  onServiceChange,
  medicalAidId,
  readOnly = false
}) => {
  const [availableTariffs, setAvailableTariffs] = useState<DentalTariff[]>([]);
  const [filteredTariffs, setFilteredTariffs] = useState<TariffWithValidation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showCalculator, setShowCalculator] = useState(true);
  const [selectedTariff, setSelectedTariff] = useState<DentalTariff | null>(null);
  const [showBusinessRules, setShowBusinessRules] = useState(false);

  // Business rules state
  const [toothNumber, setToothNumber] = useState('');
  const [multiplier, setMultiplier] = useState(1);

  // Fetch dental codes from practice_tariffs table
  useEffect(() => {
    const fetchDentalTariffs = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log('🔍 Fetching dental codes from practice_tariffs...');

        console.log('🔍 Starting triangulation approach...');

        // Triangulation: users -> practices -> practice_tariffs by practice_type
        // Step 1: Get current user's practice_id
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !authUser) {
          console.log('❌ No authenticated user found, using fallback...');
          // Fall back to comprehensive sample data
          setAvailableTariffs(getFallbackTariffs());
          const transformedTariffs: TariffWithValidation[] = getFallbackTariffs().map(tariff => ({
            ...tariff,
            medicalAidCovered: false,
            coveragePercentage: 0,
            calculatedPrice: tariff.price
          }));
          setFilteredTariffs(transformedTariffs);
          return;
        }

        // Step 2: Get user profile to get practice_id
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('id, practice_id')
          .eq('id', authUser.id)
          .single();

        if (profileError || !userProfile?.practice_id) {
          console.log('❌ No practice_id found for user, using fallback...');
          setAvailableTariffs(getFallbackTariffs());
          const transformedTariffs: TariffWithValidation[] = getFallbackTariffs().map(tariff => ({
            ...tariff,
            medicalAidCovered: false,
            coveragePercentage: 0,
            calculatedPrice: tariff.price
          }));
          setFilteredTariffs(transformedTariffs);
          return;
        }

        console.log('✅ User practice_id:', userProfile.practice_id);

        // Step 3: Get practice type from practices table
        const { data: practiceData, error: practiceError } = await supabase
          .from('practices')
          .select('id, practice_type')
          .eq('id', userProfile.practice_id)
          .single();

        if (practiceError || !practiceData) {
          console.log('❌ Practice not found, using fallback...');
          setAvailableTariffs(getFallbackTariffs());
          const transformedTariffs: TariffWithValidation[] = getFallbackTariffs().map(tariff => ({
            ...tariff,
            medicalAidCovered: false,
            coveragePercentage: 0,
            calculatedPrice: tariff.price
          }));
          setFilteredTariffs(transformedTariffs);
          return;
        }

        console.log('✅ Practice type:', practiceData.practice_type);

        // Step 4: Use the normalized view to get tariffs for this practice type
        console.log('🔍 Fetching codes from practice_tariffs_with_types view...');
        
        const result = await supabase
          .from('practice_tariffs_with_types')
          .select('*')
          .eq('practice_type_name', practiceData.practice_type)
          .order('code', { ascending: true });
        
        const tariffs = result.data;
        const tariffsError = result.error;

        console.log('Query result:', { 
          practiceType: practiceData.practice_type,
          data: tariffs?.length, 
          error: tariffsError?.message
        });

        if (tariffsError) {
          console.warn('⚠️ Database access issue detected. Reason:', tariffsError.message);
          console.log('🔄 Using fallback dental codes...');
          
          const fallbackTariffs = getFallbackTariffs();
          setAvailableTariffs(fallbackTariffs);
          const transformedTariffs: TariffWithValidation[] = fallbackTariffs.map(tariff => ({
            ...tariff,
            medicalAidCovered: false,
            coveragePercentage: 0,
            calculatedPrice: tariff.price
          }));
          setFilteredTariffs(transformedTariffs);
          setError(null); // Clear error since we have fallback data
          return;
        }


        if (!tariffs || tariffs.length === 0) {
          if (practiceData && practiceData.practice_type !== 'dental') {
            console.log(`ℹ️  No tariff codes for ${practiceData.practice_type} practice type`);
            setError(`This is a ${practiceData.practice_type} practice. ${practiceData.practice_type} tariff codes are not available yet.`);
          } else {
            console.error('❌ No codes found in practice_tariffs_with_types view');
            setError('No tariff codes found. Please ensure the tariff codes have been imported.');
          }
          return;
        }

        console.log(`✅ Successfully loaded ${tariffs.length} codes from database`);
        setAvailableTariffs(tariffs);

        // Transform for display with validation
        const transformedTariffs: TariffWithValidation[] = tariffs.map(tariff => ({
          ...tariff,
          medicalAidCovered: false, // Will be updated based on medical aid
          coveragePercentage: 0,
          calculatedPrice: tariff.price
        }));

        setFilteredTariffs(transformedTariffs);

      } catch (err) {
        console.error('💥 Error in fetchDentalTariffs:', err);
        setError('Failed to load dental codes');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDentalTariffs();
  }, []);

  // Filter tariffs based on search
  useEffect(() => {
    let filtered = availableTariffs.map(tariff => ({
      ...tariff,
      medicalAidCovered: false,
      coveragePercentage: 0,
      calculatedPrice: tariff.price
    }));

    if (searchTerm) {
      filtered = filtered.filter(tariff =>
        tariff.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tariff.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tariff.notes?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredTariffs(filtered);
  }, [availableTariffs, searchTerm]);

  // Calculate price based on business rules
  const calculatePrice = (tariff: DentalTariff, quantity: number = 1, toothNum?: string): number => {
    let basePrice = tariff.price;
    
    // Apply business rules
    if (tariff.can_be_multiplied === 'YES') {
      // Use multiplier for procedures that can be multiplied
      basePrice = basePrice * quantity;
    }
    
    // Special rules based on business_rule_formula
    if (tariff.business_rule_formula?.includes('number of X-rays')) {
      // For X-rays, multiply by number of films
      basePrice = basePrice * quantity;
    }
    
    return basePrice;
  };

  // Validate service before adding
  const validateService = (tariff: DentalTariff, quantity: number, toothNum?: string): { valid: boolean; message?: string } => {
    // Check if tooth number is required
    if (tariff.requires_tooth_number === 'YES' && !toothNum) {
      return { valid: false, message: 'Tooth number is required for this procedure' };
    }

    // Validate tooth number format (should be 11-48)
    if (toothNum) {
      const toothNumberInt = parseInt(toothNum);
      if (isNaN(toothNumberInt) || toothNumberInt < 11 || toothNumberInt > 48) {
        return { valid: false, message: 'Invalid tooth number. Use format 11-48 (FDI notation)' };
      }
    }

    // Check if quantity makes sense for non-multiplied procedures
    if (tariff.can_be_multiplied === 'NO' && quantity > 1) {
      return { valid: false, message: 'This procedure cannot be performed multiple times in one visit' };
    }

    return { valid: true };
  };

  // Add service with business rules validation
  const addService = (tariff: DentalTariff) => {
    if (readOnly) return;

    // Check if this requires special input
    if (tariff.requires_tooth_number === 'YES' || tariff.can_be_multiplied === 'YES') {
      setSelectedTariff(tariff);
      setShowBusinessRules(true);
      setToothNumber('');
      setMultiplier(1);
      return;
    }

    // Simple add without special requirements
    const validation = validateService(tariff, 1);
    if (!validation.valid) {
      alert(validation.message);
      return;
    }

    const existingService = selectedServices.find(s => s.code === tariff.code);
    if (existingService) {
      // Increase quantity if can be multiplied
      if (tariff.can_be_multiplied === 'YES') {
        updateServiceQuantity(tariff.code, existingService.quantity + 1);
      }
    } else {
      // Add new service
      const calculatedPrice = calculatePrice(tariff, 1);
      const newService: ServiceSelection = {
        id: crypto.randomUUID(),
        tariffId: tariff.id,
        code: tariff.code,
        description: tariff.description,
        category: tariff.notes?.split(' / ')[0] || 'Dental',
        subcategory: tariff.notes?.split(' / ')[1] || 'General',
        unitPrice: tariff.price,
        quantity: 1,
        totalPrice: calculatedPrice,
        requiresPreAuth: false,
        medicalAidCovered: false,
        coveragePercentage: 0,
        toothNumber: undefined,
        businessRule: tariff.business_rule_formula,
        exampleCalculation: tariff.example_calculation
      };
      onServiceChange([...selectedServices, newService]);
    }
  };

  // Add service with business rules
  const addServiceWithRules = () => {
    if (!selectedTariff) return;

    const quantity = selectedTariff.can_be_multiplied === 'YES' ? multiplier : 1;
    const validation = validateService(selectedTariff, quantity, toothNumber);
    
    if (!validation.valid) {
      alert(validation.message);
      return;
    }

    const calculatedPrice = calculatePrice(selectedTariff, quantity, toothNumber);
    const newService: ServiceSelection = {
      id: crypto.randomUUID(),
      tariffId: selectedTariff.id,
      code: selectedTariff.code,
      description: `${selectedTariff.description}${toothNumber ? ` (Tooth ${toothNumber})` : ''}`,
      category: selectedTariff.notes?.split(' / ')[0] || 'Dental',
      subcategory: selectedTariff.notes?.split(' / ')[1] || 'General',
      unitPrice: selectedTariff.price,
      quantity: quantity,
      totalPrice: calculatedPrice,
      requiresPreAuth: false,
      medicalAidCovered: false,
      coveragePercentage: 0,
      toothNumber: toothNumber || undefined,
      businessRule: selectedTariff.business_rule_formula,
      exampleCalculation: selectedTariff.example_calculation
    };

    onServiceChange([...selectedServices, newService]);
    setShowBusinessRules(false);
    setSelectedTariff(null);
  };

  // Update service quantity
  const updateServiceQuantity = (code: string, newQuantity: number) => {
    if (readOnly) return;

    if (newQuantity <= 0) {
      removeService(code);
      return;
    }

    const updatedServices = selectedServices.map(service => {
      if (service.code === code) {
        const tariff = availableTariffs.find(t => t.code === code);
        const calculatedPrice = tariff ? calculatePrice(tariff, newQuantity, service.toothNumber) : service.unitPrice * newQuantity;
        
        return {
          ...service,
          quantity: newQuantity,
          totalPrice: calculatedPrice
        };
      }
      return service;
    });
    onServiceChange(updatedServices);
  };

  // Remove service
  const removeService = (code: string) => {
    if (readOnly) return;
    onServiceChange(selectedServices.filter(s => s.code !== code));
  };

  // Calculate totals
  const totals = selectedServices.reduce(
    (acc, service) => {
      acc.subtotal += service.totalPrice;
      acc.patientTotal += service.totalPrice; // All patient for now
      return acc;
    },
    { subtotal: 0, medicalAidTotal: 0, patientTotal: 0 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#01b9d4]"></div>
        <span className="ml-3 text-gray-600">Loading dental codes...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertTriangle className="text-red-500 mr-2" size={20} />
          <div>
            <p className="text-red-700 font-medium">{error}</p>
            <p className="text-red-600 text-sm mt-1">
              Please ensure the dental codes have been imported into the practice_tariffs table.
            </p>
          </div>
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
            Services & Billing{availableTariffs.length > 0 && ` (${availableTariffs.length} codes)`}
          </h3>
          <p className="text-sm text-gray-600">
            Select from official 2025 tariff codes
            {filteredTariffs.length > 0 && filteredTariffs.length !== availableTariffs.length && 
              ` (${filteredTariffs.length} of ${availableTariffs.length} shown)`
            }
          </p>
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search by code, description, or category..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
        />
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
                    <span className="font-mono font-medium text-gray-900">{service.code}</span>
                    {service.toothNumber && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        Tooth {service.toothNumber}
                      </span>
                    )}
                    {service.businessRule && service.businessRule !== 'Fixed price' && (
                      <Zap className="w-4 h-4 text-amber-500" title={service.businessRule} />
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{service.description}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>N$ {service.unitPrice.toFixed(2)} × {service.quantity}</span>
                    <span className="font-medium text-[#01b9d4]">= N$ {service.totalPrice.toFixed(2)}</span>
                    {service.exampleCalculation && (
                      <span className="text-amber-600" title={service.exampleCalculation}>
                        <Info className="w-3 h-3 inline" />
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateServiceQuantity(service.code, service.quantity - 1)}
                    disabled={readOnly}
                    className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center text-sm font-medium">{service.quantity}</span>
                  <button
                    onClick={() => updateServiceQuantity(service.code, service.quantity + 1)}
                    disabled={readOnly}
                    className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeService(service.code)}
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
                  <div className="border-t pt-2 flex justify-between font-medium text-lg">
                    <span>Total:</span>
                    <span className="text-[#01b9d4]">N$ {totals.subtotal.toFixed(2)}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Available Tariffs */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3">
          Available Codes ({filteredTariffs.length} of {availableTariffs.length})
        </h4>
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-2'}>
          {filteredTariffs.map((tariff) => {
            const isSelected = selectedServices.some(s => s.code === tariff.code);
            return (
              <motion.div
                key={tariff.id}
                whileHover={{ scale: 1.01 }}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  isSelected 
                    ? 'border-blue-300 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => addService(tariff)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-medium text-gray-900">{tariff.code}</span>
                      {tariff.requires_tooth_number === 'YES' && (
                        <Hash className="w-4 h-4 text-blue-500" title="Requires tooth number" />
                      )}
                      {tariff.can_be_multiplied === 'YES' && (
                        <X className="w-4 h-4 text-green-500" title="Can be multiplied" />
                      )}
                      {tariff.on_2025_list === 'YES' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" title="On 2025 official list" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{tariff.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-[#01b9d4]">N$ {tariff.price.toFixed(2)}</span>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {tariff.unit}
                      </span>
                    </div>
                    {tariff.business_rule_formula && tariff.business_rule_formula !== 'Fixed price' && (
                      <p className="text-xs text-amber-600 mt-1" title={tariff.example_calculation}>
                        Rule: {tariff.business_rule_formula}
                      </p>
                    )}
                  </div>
                  <Plus className="w-5 h-5 text-gray-400 ml-2" />
                </div>
              </motion.div>
            );
          })}
        </div>
        
        {filteredTariffs.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Stethoscope className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No codes found matching your criteria</p>
          </div>
        )}
      </div>

      {/* Business Rules Modal */}
      <AnimatePresence>
        {showBusinessRules && selectedTariff && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowBusinessRules(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Service Details</h3>
                <button
                  onClick={() => setShowBusinessRules(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-gray-900">{selectedTariff.code}</p>
                  <p className="text-sm text-gray-600">{selectedTariff.description}</p>
                  <p className="text-lg font-bold text-[#01b9d4]">N$ {selectedTariff.price.toFixed(2)}</p>
                </div>

                {selectedTariff.requires_tooth_number === 'YES' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tooth Number (FDI Notation: 11-48)
                    </label>
                    <input
                      type="number"
                      min="11"
                      max="48"
                      value={toothNumber}
                      onChange={(e) => setToothNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
                      placeholder="e.g., 21 for upper left central incisor"
                    />
                  </div>
                )}

                {selectedTariff.can_be_multiplied === 'YES' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity / Multiplier
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="32"
                      value={multiplier}
                      onChange={(e) => setMultiplier(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
                    />
                  </div>
                )}

                {selectedTariff.business_rule_formula && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-amber-800 mb-1">Business Rule:</p>
                    <p className="text-sm text-amber-700">{selectedTariff.business_rule_formula}</p>
                    {selectedTariff.example_calculation && (
                      <p className="text-xs text-amber-600 mt-1">
                        Example: {selectedTariff.example_calculation}
                      </p>
                    )}
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-blue-800">Calculated Total:</p>
                  <p className="text-lg font-bold text-blue-900">
                    N$ {calculatePrice(selectedTariff, multiplier, toothNumber).toFixed(2)}
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowBusinessRules(false)}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addServiceWithRules}
                    className="flex-1 px-4 py-2 text-white bg-[#01b9d4] rounded-lg hover:bg-[#01a5c4] transition-colors"
                  >
                    Add Service
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EnhancedServiceSelector;