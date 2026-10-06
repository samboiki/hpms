import React, { useState, useEffect, useMemo } from 'react';
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
  Grid3X3,
  List
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ServiceSelection } from '../../types/billing';
import {
  computeLine,
  searchTariffs,
  selectBillableTariffs,
  summarizeLines,
  type BillableTariff,
  type TariffRow
} from '../../utils/billing/pricing';
import { formatNad } from '../../utils/billing/money';
import { todayKey } from '../../utils/billing/dates';

interface ServiceSelectorProps {
  practiceId: string;
  selectedServices: ServiceSelection[];
  onServiceChange: (services: ServiceSelection[]) => void;
  medicalAidId?: string;
  readOnly?: boolean;
}

interface TariffWithCoverage extends BillableTariff {
  category: string;
  requiresPreAuth: boolean;
  medicalAidCovered: boolean;
  coveragePercentage: number;
}

const TARIFF_COLUMNS =
  'id, code, description, price, unit, is_active, effective_from, effective_to, can_be_multiplied, requires_tooth_number, business_rule_formula, example_calculation, notes, practice_type_name';

const ServiceSelector: React.FC<ServiceSelectorProps> = ({
  practiceId,
  selectedServices,
  onServiceChange,
  medicalAidId,
  readOnly = false
}) => {
  const [tariffRows, setTariffRows] = useState<TariffRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showCalculator, setShowCalculator] = useState(false);
  const serviceDateKey = todayKey();
  // The medical aid pays 100% of a medical aid patient's lines, as in the rest of billing
  const hasMedicalAid = Boolean(medicalAidId);

  // Load the practice's tariff list. Prices come only from practice_tariffs: the old fallback
  // lists here invented codes and prices (e.g. "M001 General consultation N$ 450.00"), and the
  // query used a practice_type column that practice_tariffs does not have, so they were always used.
  useEffect(() => {
    let cancelled = false;
    const fetchServices = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data: practiceData, error: practiceError } = await supabase
          .from('practices')
          .select('id, practice_type')
          .eq('id', practiceId)
          .maybeSingle();
        if (practiceError) throw new Error(practiceError.message);
        if (!practiceData?.practice_type) throw new Error('the practice type is not set, so its tariff list is unknown');

        // Aesthetic practices can also perform dental services
        const practiceTypes =
          practiceData.practice_type === 'aesthetic' ? ['aesthetic', 'dental'] : [practiceData.practice_type];
        const { data, error: tariffsError } = await supabase
          .from('practice_tariffs_with_types')
          .select(TARIFF_COLUMNS)
          .in('practice_type_name', practiceTypes);
        if (tariffsError) throw new Error(tariffsError.message);
        if (!cancelled) setTariffRows((data ?? []) as unknown as TariffRow[]);
      } catch (err) {
        if (!cancelled) {
          setTariffRows([]);
          setError(`Could not load the tariff list: ${err instanceof Error ? err.message : 'unknown error'}.`);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    if (practiceId) {
      fetchServices();
    } else {
      setIsLoading(false);
      setError('No practice is selected, so the tariff list cannot be loaded.');
    }
    return () => {
      cancelled = true;
    };
  }, [practiceId]);

  // Only tariffs active and in effect today, one version per code
  const { tariffs } = useMemo(() => selectBillableTariffs(tariffRows, serviceDateKey), [tariffRows, serviceDateKey]);
  const availableServices: TariffWithCoverage[] = useMemo(
    () =>
      tariffs.map(tariff => ({
        ...tariff,
        category: tariff.notes?.split(' / ')[0] || 'General',
        requiresPreAuth: false,
        medicalAidCovered: hasMedicalAid,
        coveragePercentage: hasMedicalAid ? 100 : 0
      })),
    [tariffs, hasMedicalAid]
  );

  // Filter services by code / description search and by category
  const filteredServices = useMemo(() => {
    const searched = searchTariffs(availableServices, searchTerm);
    return selectedCategory === 'all' ? searched : searched.filter(service => service.category === selectedCategory);
  }, [availableServices, searchTerm, selectedCategory]);

  // Get unique categories
  const categories = Array.from(new Set(availableServices.map(s => s.category))).sort();

  // Prices a line with the shared calculation (unit x quantity in cents, split by medical aid status)
  const priceLine = (service: ServiceSelection, quantity: number) => {
    const tariff = availableServices.find(item => item.id === service.tariffId);
    return computeLine({
      code: service.code,
      unitPrice: service.unitPrice,
      quantity,
      multiplyRule: tariff?.multiplyRule ?? (service.canBeMultiplied ? 'YES' : 'NO'),
      requiresTooth: tariff?.requiresTooth ?? false,
      toothNumbers: service.teethNumbers,
      hasMedicalAid,
      businessRule: tariff?.businessRule
    });
  };

  // Add service to selection
  const addService = (service: TariffWithCoverage) => {
    if (readOnly) return;

    const existingService = selectedServices.find(s => s.tariffId === service.id);
    if (existingService && service.multiplyRule !== 'NO' && !service.requiresTooth) {
      // The same code again is one more unit on the existing line
      updateServiceQuantity(existingService.id, existingService.quantity + 1);
      return;
    }
    if (existingService && !window.confirm(`${service.code} is already selected. Add it again as a separate line?`)) {
      return;
    }

    let teeth: string[] = [];
    if (service.requiresTooth) {
      const answer = window.prompt(`Tooth number for ${service.code} (FDI notation, e.g. 21)`);
      if (!answer) return;
      teeth = [answer.trim()];
    }
    const line = computeLine({
      code: service.code,
      unitPrice: service.unitPrice,
      quantity: 1,
      multiplyRule: service.multiplyRule,
      requiresTooth: service.requiresTooth,
      toothNumbers: teeth,
      hasMedicalAid,
      businessRule: service.businessRule
    });
    if (!line.ok) {
      setNotice(line.errors.join(' '));
      return;
    }
    setNotice(null);
    const newService: ServiceSelection = {
      id: crypto.randomUUID(),
      tariffId: service.id,
      code: service.code,
      description: teeth.length > 0 ? `${service.description} (Tooth ${teeth.join(', ')})` : service.description,
      category: service.category,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      totalPrice: line.total,
      requiresPreAuth: service.requiresPreAuth,
      medicalAidCovered: service.medicalAidCovered,
      coveragePercentage: service.coveragePercentage,
      businessRule: service.businessRule ?? undefined,
      requiresTeethNumbers: service.requiresTooth,
      canBeMultiplied: service.multiplyRule !== 'NO',
      teethNumbers: teeth.length > 0 ? teeth : undefined
    };
    onServiceChange([...selectedServices, newService]);
  };

  // Update the quantity of one line (by id); codes that cannot be multiplied stay at 1
  const updateServiceQuantity = (serviceId: string, newQuantity: number) => {
    if (readOnly) return;
    const service = selectedServices.find(item => item.id === serviceId);
    if (!service) return;

    if (newQuantity <= 0) {
      removeService(serviceId);
      return;
    }

    const line = priceLine(service, newQuantity);
    if (!line.ok) {
      setNotice(line.errors.join(' '));
      return;
    }
    setNotice(null);
    onServiceChange(
      selectedServices.map(item => (item.id === serviceId ? { ...item, quantity: line.quantity, totalPrice: line.total } : item))
    );
  };

  // Remove one line (by id)
  const removeService = (serviceId: string) => {
    if (readOnly) return;
    onServiceChange(selectedServices.filter(s => s.id !== serviceId));
  };

  // Totals in whole cents from the same calculation
  const summary = summarizeLines(selectedServices.map(service => priceLine(service, service.quantity)));
  const totals = { subtotal: summary.subtotal, medicalAidTotal: summary.medicalAid, patientTotal: summary.patient };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#01b9d4]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
        <div className="flex items-center">
          <AlertTriangle className="text-red-500 mr-2" size={20} />
          <div>
            <p className="text-red-700">{error}</p>
            <p className="text-red-600 text-sm mt-1">Services cannot be billed until the tariff list loads, so no price is guessed.</p>
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
            Billable Services
          </h3>
          <p className="text-sm text-gray-600">Select services provided during this visit</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => setShowCalculator(!showCalculator)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Calculator className="w-4 h-4" />
          </button>
        </div>
      </div>

      {notice && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700" role="alert">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p className="flex-1">{notice}</p>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
                      <span title="Covered by Medical Aid"><Shield className="w-4 h-4 text-green-500" /></span>
                    )}
                    {service.requiresPreAuth && (
                      <span title="Requires Pre-Authorization"><AlertTriangle className="w-4 h-4 text-amber-500" /></span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{service.description}</p>
                  <p className="text-xs text-gray-500">
                    {formatNad(service.unitPrice)} x {service.quantity} = {formatNad(service.totalPrice)}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateServiceQuantity(service.id, service.quantity - 1)}
                    disabled={readOnly}
                    className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center text-sm font-medium">{service.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateServiceQuantity(service.id, service.quantity + 1)}
                    disabled={readOnly}
                    className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeService(service.id)}
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
                    <span>{formatNad(totals.subtotal)}</span>
                  </div>
                  {medicalAidId && totals.medicalAidTotal > 0 && (
                    <>
                      <div className="flex justify-between text-green-600">
                        <span>Medical Aid Portion:</span>
                        <span>{formatNad(totals.medicalAidTotal)}</span>
                      </div>
                      <div className="flex justify-between text-blue-600">
                        <span>Patient Portion:</span>
                        <span>{formatNad(totals.patientTotal)}</span>
                      </div>
                    </>
                  )}
                  <div className="border-t pt-2 flex justify-between font-medium">
                    <span>Total:</span>
                    <span>{formatNad(totals.subtotal)}</span>
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
                        <span title="Covered by Medical Aid"><Shield className="w-4 h-4 text-green-500" /></span>
                      )}
                      {service.requiresPreAuth && (
                        <span title="Requires Pre-Authorization"><AlertTriangle className="w-4 h-4 text-amber-500" /></span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{service.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-[#01b9d4]">{formatNad(service.unitPrice)}</span>
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