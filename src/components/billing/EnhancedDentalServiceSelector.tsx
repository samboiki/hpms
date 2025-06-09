import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search,
  Calculator,
  Plus,
  Minus,
  Trash2,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import { ServiceSelection } from '../../types/billing';
import { usePracticeTariffs } from '../../contexts/PracticeTariffsContext';

interface EnhancedDentalServiceSelectorProps {
  selectedServices: ServiceSelection[];
  onServiceChange: (services: ServiceSelection[]) => void;
}

// Tooth-specific pricing lookup for code 8346
const TOOTH_PRICING_8346: Record<string, number> = {
  '11': 50.84, '12': 50.84, '13': 50.84, '14': 48.20, '15': 48.20, '16': 45.33, '17': 45.33, '18': 45.33,
  '21': 50.84, '22': 50.84, '23': 50.84, '24': 48.20, '25': 48.20, '26': 45.33, '27': 45.33, '28': 45.33,
  '31': 48.90, '32': 48.90, '33': 48.90, '34': 47.20, '35': 47.20, '36': 45.33, '37': 45.33, '38': 45.33,
  '41': 48.90, '42': 48.90, '43': 48.90, '44': 47.20, '45': 47.20, '46': 46.71, '47': 46.71, '48': 45.33
};

const EnhancedDentalServiceSelector: React.FC<EnhancedDentalServiceSelectorProps> = ({ 
  selectedServices, 
  onServiceChange 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCodes, setFilteredCodes] = useState<any[]>([]);
  const [showCalculator, setShowCalculator] = useState(false);
  const [pendingCalculation, setPendingCalculation] = useState<any>(null);
  
  const { allTariffs, frequentTariffs, isLoading } = usePracticeTariffs();

  // Filter codes based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredCodes(allTariffs);
    } else {
      const filtered = allTariffs.filter(code => 
        code.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        code.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCodes(filtered);
    }
  }, [searchTerm, allTariffs]);

  // Business rule implementations
  const calculateServicePrice = (code: any, quantity: number, teethNumbers?: string[]): number => {
    const basePrice = parseFloat(code.price) || 0;
    const businessRule = code.business_rule_formula?.toLowerCase() || 'fixed price';

    // Handle tooth-specific pricing for code 8346
    if (code.code === '8346' && teethNumbers && teethNumbers.length > 0) {
      return teethNumbers.reduce((total, tooth) => {
        const toothPrice = TOOTH_PRICING_8346[tooth.trim()] || basePrice;
        return total + toothPrice;
      }, 0);
    }

    // Handle progressive pricing
    if (businessRule.includes('progressive') || businessRule.includes('additional')) {
      if (quantity === 1) return basePrice;
      // For progressive pricing, first item full price, additional at different rates
      // This would need specific implementation per code
      return basePrice + ((quantity - 1) * basePrice * 0.8); // Example: 80% for additional
    }

    // Handle multiplication rules
    if (code.can_be_multiplied === 'YES' || businessRule.includes('multiply') || businessRule.includes('×')) {
      return basePrice * quantity;
    }

    // Handle per-visit charges (should only appear once)
    if (businessRule.includes('per visit') || businessRule.includes('once per visit')) {
      return basePrice; // Ignore quantity for per-visit charges
    }

    // Default: fixed price regardless of quantity
    return basePrice;
  };

  const addService = (code: any, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Check if service already exists
    if (selectedServices.find(s => s.code === code.code)) {
      return; // Don't add duplicates
    }

    const newService: ServiceSelection = {
      id: crypto.randomUUID(),
      tariffId: code.id,
      code: code.code,
      description: code.description,
      category: 'Dental Service',
      subcategory: 'General',
      unitPrice: parseFloat(code.price) || 0,
      quantity: 1,
      totalPrice: parseFloat(code.price) || 0,
      requiresPreAuth: false,
      medicalAidCovered: false,
      coveragePercentage: 0,
      businessRule: code.business_rule_formula,
      exampleCalculation: code.example_calculation,
      requiresTeethNumbers: code.requires_tooth_number === 'YES',
      canBeMultiplied: code.can_be_multiplied === 'YES',
      teethNumbers: code.requires_tooth_number === 'YES' ? [''] : undefined
    };
    
    onServiceChange([...selectedServices, newService]);
  };

  const updateService = (id: string, updates: Partial<ServiceSelection>) => {
    const updatedServices = selectedServices.map(service => {
      if (service.id === id) {
        const updatedService = { ...service, ...updates };
        
        // Find the original tariff code for business rule calculation
        const originalCode = allTariffs.find(t => t.id === service.tariffId);
        if (originalCode) {
          const newPrice = calculateServicePrice(
            originalCode, 
            updatedService.quantity, 
            updatedService.teethNumbers
          );
          updatedService.totalPrice = newPrice;
        }
        
        return updatedService;
      }
      return service;
    });
    onServiceChange(updatedServices);
  };

  const removeService = (id: string) => {
    onServiceChange(selectedServices.filter(s => s.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    const service = selectedServices.find(s => s.id === id);
    if (!service) return;
    
    const newQuantity = Math.max(1, service.quantity + delta);
    updateService(id, { quantity: newQuantity });
  };

  const updateTeethNumbers = (id: string, teethNumbers: string[]) => {
    updateService(id, { teethNumbers });
  };

  const totalCost = selectedServices.reduce((sum, service) => sum + service.totalPrice, 0);

  const getServiceIcon = (service: ServiceSelection) => {
    if (service.requiresTeethNumbers && (!service.teethNumbers || service.teethNumbers.some(t => !t.trim()))) {
      return <AlertCircle className="w-4 h-4 text-amber-500" />;
    }
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  };

  const getBusinessRuleInfo = (service: ServiceSelection) => {
    if (!service.businessRule) return null;
    
    const rule = service.businessRule.toLowerCase();
    if (rule.includes('progressive')) {
      return 'Progressive pricing: First item full price, additional items reduced';
    }
    if (rule.includes('per visit')) {
      return 'Per visit charge: Fixed price regardless of quantity';
    }
    if (rule.includes('multiply') || service.canBeMultiplied) {
      return 'Quantity-based pricing: Price multiplied by quantity';
    }
    if (service.code === '8346') {
      return 'Tooth-specific pricing: Price varies by tooth location';
    }
    return 'Fixed price: Standard rate applies';
  };

  return (
    <div className="space-y-6">
      {/* Cost Summary */}
      <div className="bg-gradient-to-r from-[#01b9d4]/10 to-purple-600/10 rounded-xl p-4 border border-[#01b9d4]/20">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Total Cost
            </h4>
            <p className="text-2xl font-bold text-[#01b9d4]">N$ {totalCost.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">{selectedServices.length} services</p>
            <button
              type="button"
              onClick={() => {
                setPendingCalculation({ total: totalCost, services: selectedServices });
                setShowCalculator(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[#01b9d4] text-white rounded-lg hover:bg-[#01a5c4] transition-colors"
            >
              <Calculator className="w-4 h-4" />
              Calculate
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder={`Search ${allTariffs.length} dental procedures...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4] transition-all"
        />
        {searchTerm && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
            {filteredCodes.length} found
          </div>
        )}
      </div>
      
      {/* Search Results */}
      {searchTerm && (
        <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg bg-white">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#01b9d4] mx-auto mb-2"></div>
              Loading codes...
            </div>
          ) : filteredCodes.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {filteredCodes.slice(0, 20).map((code) => (
                <button
                  key={code.id}
                  type="button"
                  onClick={(e) => addService(code, e)}
                  className="w-full p-3 text-left hover:bg-gray-50 transition-colors flex justify-between items-center"
                >
                  <div className="flex-1">
                    <div className="font-mono font-medium text-sm text-gray-900">{code.code}</div>
                    <div className="text-xs text-gray-600 truncate">{code.description}</div>
                    {code.requires_tooth_number === 'YES' && (
                      <div className="text-xs text-amber-600 mt-1">🦷 Requires tooth number</div>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-[#01b9d4] ml-4">
                    N$ {parseFloat(code.price)?.toFixed(2)}
                  </div>
                </button>
              ))}
              {filteredCodes.length > 20 && (
                <div className="p-3 text-center text-xs text-gray-500">
                  Showing first 20 of {filteredCodes.length} results. Refine your search for more.
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500 text-sm">
              No procedures found for "{searchTerm}"
            </div>
          )}
        </div>
      )}

      {/* Quick Add Services */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
          Common Procedures
        </h4>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="p-3 bg-gray-100 rounded-lg animate-pulse">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {frequentTariffs.map((code) => (
              <motion.button
                key={code.id}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={(e) => addService(code, e)}
                className="p-3 bg-white border border-gray-200 rounded-lg hover:border-[#01b9d4] hover:shadow-md transition-all text-left group"
              >
                <div className="font-semibold text-sm text-gray-900 font-mono group-hover:text-[#01b9d4]">
                  {code.code}
                </div>
                <div className="text-xs text-gray-600 mt-1 truncate">
                  {code.description}
                </div>
                <div className="text-sm font-semibold text-[#01b9d4] mt-1">
                  N$ {parseFloat(code.price)?.toFixed(2)}
                </div>
                {code.requires_tooth_number === 'YES' && (
                  <div className="text-xs text-amber-600 mt-1">🦷</div>
                )}
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Enhanced Selected Services */}
      {selectedServices.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-900 mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Selected Services
          </h4>
          <div className="space-y-4">
            {selectedServices.map((service) => (
              <motion.div
                key={service.id}
                layout
                className="bg-blue-50 border border-blue-200 rounded-lg p-4"
              >
                {/* Service Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getServiceIcon(service)}
                      <span className="font-mono font-medium text-gray-900">{service.code}</span>
                      <span className="text-sm text-gray-600">{service.description}</span>
                    </div>
                    
                    {/* Business Rule Info */}
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Info className="w-3 h-3" />
                      <span>{getBusinessRuleInfo(service)}</span>
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => removeService(service.id)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Teeth Numbers Input */}
                {service.requiresTeethNumbers && (
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tooth Numbers (space-separated)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., 11 12 21 22"
                      value={(service.teethNumbers || []).join(' ')}
                      onChange={(e) => {
                        const teeth = e.target.value.split(' ').filter(t => t.trim());
                        updateTeethNumbers(service.id, teeth);
                      }}
                      className="w-full p-2 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
                    />
                    {service.code === '8346' && service.teethNumbers && service.teethNumbers.length > 0 && (
                      <div className="mt-1 text-xs text-gray-600">
                        {service.teethNumbers.map(tooth => 
                          tooth.trim() ? `${tooth}: N$${TOOTH_PRICING_8346[tooth.trim()]?.toFixed(2) || 'Unknown'}` : ''
                        ).filter(Boolean).join(', ')}
                      </div>
                    )}
                  </div>
                )}

                {/* Quantity and Price Controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Quantity Controls */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">Quantity:</span>
                      <div className="flex items-center border border-gray-200 rounded">
                        <button
                          type="button"
                          onClick={() => updateQuantity(service.id, -1)}
                          className="p-1 hover:bg-gray-100 transition-colors"
                          disabled={service.quantity <= 1}
                        >
                          <Minus className="w-4 h-4 text-gray-600" />
                        </button>
                        <span className="px-3 py-1 min-w-[40px] text-center text-sm font-medium">
                          {service.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(service.id, 1)}
                          className="p-1 hover:bg-gray-100 transition-colors"
                        >
                          <Plus className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Price Display */}
                  <div className="text-right">
                    <div className="text-sm text-gray-500">
                      N$ {service.unitPrice.toFixed(2)} × {service.quantity}
                    </div>
                    <div className="text-lg font-semibold text-[#01b9d4]">
                      N$ {service.totalPrice.toFixed(2)}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Calculator Modal */}
      {showCalculator && pendingCalculation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Dental Treatment Summary
            </h3>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span>Services:</span>
                <span>{pendingCalculation.services.length}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg">
                <span>Total:</span>
                <span className="text-[#01b9d4]">N$ {pendingCalculation.total.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowCalculator(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCalculator(false);
                  setPendingCalculation(null);
                }}
                className="flex-1 px-4 py-2 text-white bg-[#01b9d4] rounded-lg hover:bg-[#01a5c4] transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedDentalServiceSelector;