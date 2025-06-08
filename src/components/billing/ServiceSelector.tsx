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

        // Fetch practice tariffs
        const { data: tariffs, error: tariffsError } = await supabase
          .from('practice_tariffs')
          .select('*')
          .eq('practice_id', practiceId)
          .eq('is_active', true)
          .order('category', { ascending: true })
          .order('code', { ascending: true });

        if (tariffsError) throw tariffsError;

        // If medical aid is selected, fetch coverage information
        let coverageMap: Map<string, MedicalAidCoverage> = new Map();
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
            description: tariff.namaf_prace_2025 || tariff.full_description,
            category: tariff.category || 'General',
            subcategory: tariff.subcategory,
            price: parseFloat(tariff.price?.toString() || '0'),
            practiceType: tariff.practice_type || 'general',
            unit: (tariff.unit as any) || 'per_visit',
            complexity: 'moderate', // Default complexity
            requiresPreAuth: coverage?.requires_pre_auth || false,
            medicalAidCode: tariff.edi_diagnosi,
            notes: tariff.full_description,
            isActive: tariff.is_active || true,
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