import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import { ServiceSelection } from '../../types/billing';
import { usePracticeTariffs } from '../../contexts/PracticeTariffsContext';
import { MATERIAL_FACTOR_PERCENT, computeLine, isValidFdiTooth, materialFactorUnitPrice, normalizeMultiplyRule, parseTariffPrice, parseToothList } from '../../utils/billing/pricing';
import { formatNad, fromCents, nadParts, toCents } from '../../utils/billing/money';

interface EnhancedDentalServiceSelectorProps {
  selectedServices: ServiceSelection[];
  onServiceChange: (services: ServiceSelection[]) => void;
}

// Tariff prices come from the tariff list as numbers or numeric strings
const tariffPrice = (value: unknown): number => parseTariffPrice(value) ?? 0;

// Codes that require automatic 8346 restorative material factor (10%)
const RESTORATIVE_MATERIAL_CODES = [
  '8341', '8342', '8343', '8344', 
  '8351', '8352', '8353', '8354', 
  '8367', '8368', '8369', '8370'
];

// Code 8109 - Infection control per visit (always required)
const INFECTION_CONTROL_CODE = '8109';

const EnhancedDentalServiceSelector: React.FC<EnhancedDentalServiceSelectorProps> = ({ 
  selectedServices, 
  onServiceChange 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCodes, setFilteredCodes] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  
  const [toothDrafts, setToothDrafts] = useState<Record<string, string>>({});
  const { allTariffs, frequentTariffs, isLoading, error: tariffError, excludedCount } = usePracticeTariffs();

  // Auto-add 8109 infection control on component mount
  useEffect(() => {
    const has8109 = selectedServices.some(s => s.code === INFECTION_CONTROL_CODE);
    if (!has8109 && allTariffs.length > 0) {
      const infectionControlCode = allTariffs.find(t => t.code === INFECTION_CONTROL_CODE);
      if (infectionControlCode) {
        const infectionService: ServiceSelection = {
          id: crypto.randomUUID(),
          tariffId: infectionControlCode.id,
          code: infectionControlCode.code,
          description: infectionControlCode.description,
          category: 'Dental Service',
          subcategory: 'Infection Control',
          unitPrice: tariffPrice(infectionControlCode.price),
          quantity: 1,
          totalPrice: tariffPrice(infectionControlCode.price),
          requiresPreAuth: false,
          medicalAidCovered: true, // Will be determined by patient's medical aid status
          coveragePercentage: 100, // Simplified: 100% coverage for medical aid patients
          businessRule: 'Required per visit',
          exampleCalculation: 'Fixed per visit charge',
          requiresTeethNumbers: false,
          canBeMultiplied: false,
          isRequired: true,
          isPriceProtected: true
        };
        onServiceChange([...selectedServices, infectionService]);
      }
    }
  }, [allTariffs, selectedServices, onServiceChange]);

  // Filter codes based on search term (exclude 8346 from manual selection)
  useEffect(() => {
    const availableTariffs = allTariffs.filter(code => code.code !== '8346');
    
    if (!searchTerm.trim()) {
      setFilteredCodes(availableTariffs);
    } else {
      const filtered = availableTariffs.filter(code => 
        code.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        code.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCodes(filtered);
    }
  }, [searchTerm, allTariffs]);

  // Prices a line with the shared calculation: unit price x quantity, to the cent; codes that cannot
  // be multiplied stay at quantity 1. The old version applied an invented 80% rate to extra units of
  // "progressive" codes and a per-tooth table to 8346, so the same line could get different prices.
  const priceLine = (service: ServiceSelection, quantity: number) =>
    computeLine({
      code: service.code,
      unitPrice: service.unitPrice,
      quantity,
      multiplyRule: service.canBeMultiplied ? 'YES' : 'NO',
      hasMedicalAid: false
    });

  const addService = (code: any, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Prevent manual addition of code 8346 - it can only be auto-generated
    if (code.code === '8346') {
      alert('Code 8346 (Restorative Material) cannot be added manually. It is automatically added with applicable restorative procedures.');
      return;
    }
    
    // For tooth-specific codes, allow multiple instances with different tooth numbers
    // For non-tooth-specific codes, check if service already exists
    if (code.requires_tooth_number !== 'YES') {
      const existingService = selectedServices.find(s => s.code === code.code);
      if (existingService) {
        return; // Don't add duplicates for non-tooth-specific codes
      }
    }

    const newService: ServiceSelection = {
      id: crypto.randomUUID(),
      tariffId: code.id,
      code: code.code,
      description: code.description,
      category: 'Dental Service',
      subcategory: 'General',
      unitPrice: tariffPrice(code.price),
      quantity: 1,
      totalPrice: tariffPrice(code.price),
      requiresPreAuth: false,
      medicalAidCovered: true, // Will be determined by patient's medical aid status
      coveragePercentage: 100, // Simplified: 100% coverage for medical aid patients
      businessRule: code.business_rule_formula,
      exampleCalculation: code.example_calculation,
      requiresTeethNumbers: code.requires_tooth_number === 'YES',
      // SOMETIMES / PROGRESSIVE codes may have quantity > 1 too: computeLine prices them unit x quantity
      canBeMultiplied: normalizeMultiplyRule(code.can_be_multiplied) !== 'NO',
      teethNumbers: code.requires_tooth_number === 'YES' ? [''] : undefined
    };
    
    const updatedServices = [...selectedServices, newService];
    
    // Auto-add 8346 restorative material factor for applicable codes
    if (RESTORATIVE_MATERIAL_CODES.includes(code.code)) {
      // Find the actual 8346 tariff in practice tariffs
      const materialFactorTariff = allTariffs.find(t => t.code === '8346');
      
      if (!materialFactorTariff) {
        console.error('❌ Code 8346 (Restorative Material Factor) not found in practice tariffs');
        alert('Warning: Restorative Material Factor (8346) not found in tariffs. Please add this code to your practice tariffs.');
        // Skip adding the material factor service if tariff not found
        onServiceChange(updatedServices);
        return;
      }
      
      const materialFactorService: ServiceSelection = {
        id: crypto.randomUUID(),
        tariffId: materialFactorTariff.id, // Use actual tariff ID
        code: '8346',
        description: `RESTORATIVE MATERIAL FACTOR (${code.code})`,
        category: 'Dental Service',
        subcategory: 'Material Factor',
        unitPrice: materialFactorUnitPrice(tariffPrice(code.price)), // 10% of the procedure, to the cent
        quantity: 1,
        totalPrice: materialFactorUnitPrice(tariffPrice(code.price)),
        requiresPreAuth: false,
        medicalAidCovered: true, // Will be determined by patient's medical aid status
        coveragePercentage: 100, // Simplified: 100% coverage for medical aid patients
        businessRule: `${MATERIAL_FACTOR_PERCENT}% material factor for ${code.code}`,
        exampleCalculation: `${formatNad(tariffPrice(code.price))} x ${MATERIAL_FACTOR_PERCENT}% = ${formatNad(materialFactorUnitPrice(tariffPrice(code.price)))}`,
        requiresTeethNumbers: code.requires_tooth_number === 'YES',
        // Its quantity follows the procedure, so it may be multiplied exactly when the procedure may
        // (invoiceService refuses quantity > 1 on a line marked as not multipliable)
        canBeMultiplied: newService.canBeMultiplied,
        teethNumbers: code.requires_tooth_number === 'YES' ? [''] : undefined,
        isAutoGenerated: true, // Mark as auto-generated
        parentServiceId: newService.id, // Link to parent service
        isPriceProtected: true // Cannot modify price
      };
      
      updatedServices.push(materialFactorService);
    }
    
    onServiceChange(updatedServices);
  };

  const updateService = (id: string, updates: Partial<ServiceSelection>) => {
    const parentService = selectedServices.find(s => s.id === id);
    if (!parentService) return;
    const updatedService = { ...parentService, ...updates };
    // The line keeps the unit price it was added with; its total is unit x quantity, to the cent
    const line = priceLine(updatedService, updatedService.quantity);
    if (!line.ok) {
      alert(line.errors.join(' '));
      return;
    }
    updatedService.totalPrice = line.total;

    const updatedServices = selectedServices.map(service => {
      if (service.id === id) return updatedService;
      // The 8346 material factor follows its procedure: 10% of its unit price, same quantity and teeth
      if (
        service.code === '8346' &&
        service.parentServiceId === id &&
        RESTORATIVE_MATERIAL_CODES.includes(parentService.code)
      ) {
        const unitPrice = materialFactorUnitPrice(updatedService.unitPrice);
        const materialLine = computeLine({
          code: '8346',
          unitPrice,
          quantity: updatedService.quantity,
          multiplyRule: 'YES',
          hasMedicalAid: false
        });
        return {
          ...service,
          teethNumbers: updatedService.teethNumbers,
          unitPrice,
          quantity: updatedService.quantity,
          canBeMultiplied: updatedService.canBeMultiplied,
          totalPrice: materialLine.ok ? materialLine.total : service.totalPrice
        };
      }
      return service;
    });

    onServiceChange(updatedServices);
  };

  const removeService = (id: string) => {
    // When removing a service, also remove any auto-generated 8346 material factor services
    const serviceToRemove = selectedServices.find(s => s.id === id);
    
    // Prevent removal of required services like 8109
    if (serviceToRemove?.isRequired) {
      alert(`${serviceToRemove.code} (${serviceToRemove.description}) is required per visit and cannot be removed.`);
      return;
    }
    
    let updatedServices = selectedServices.filter(s => s.id !== id);
    
    // If removing a restorative material code, remove its associated 8346 service
    if (serviceToRemove && RESTORATIVE_MATERIAL_CODES.includes(serviceToRemove.code)) {
      updatedServices = updatedServices.filter(s => 
        !(s.code === '8346' && s.parentServiceId === id)
      );
    }
    
    // If removing an auto-generated 8346, prevent it (these should only be removed via parent)
    if (serviceToRemove?.isAutoGenerated && serviceToRemove.code === '8346') {
      alert('Restorative material factor cannot be removed directly. Remove the associated procedure instead.');
      return;
    }
    
    onServiceChange(updatedServices);
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

  // Added up in whole cents so the total is exactly the sum of the lines shown
  const totalCost = fromCents(
    selectedServices.reduce((sum, service) => sum + (Number.isFinite(service.totalPrice) ? toCents(service.totalPrice) : 0), 0)
  );

  // An auto-added 8346 line follows its procedure's quantity, so it has no quantity buttons of its own
  const quantityLocked = (service: ServiceSelection): boolean =>
    service.canBeMultiplied === false || service.isAutoGenerated === true;

  const getServiceIcon = (service: ServiceSelection) => {
    const teeth = (service.teethNumbers || []).filter(tooth => tooth.trim());
    const missingTooth = service.requiresTeethNumbers && teeth.length === 0;
    if (missingTooth || teeth.some(tooth => !isValidFdiTooth(tooth))) {
      return <AlertCircle className="w-4 h-4 text-amber-500" />;
    }
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  };

  const getBusinessRuleInfo = (service: ServiceSelection) => {
    if (service.code === '8346') {
      return `Material factor: ${MATERIAL_FACTOR_PERCENT}% of the procedure price, for the same quantity`;
    }
    if (!service.businessRule) return null;

    const rule = service.businessRule.toLowerCase();
    if (rule.includes('progressive')) {
      return 'Special quantity rule: check the tariff; each unit is billed at the tariff price';
    }
    if (rule.includes('per visit')) {
      return 'Per visit charge: Fixed price regardless of quantity';
    }
    if (rule.includes('multiply') || service.canBeMultiplied) {
      return 'Quantity-based pricing: Price multiplied by quantity';
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
            <p className="text-2xl font-bold text-[#01b9d4]" style={{ fontFamily: 'Rubik, sans-serif' }}>
              <span>N$ {nadParts(totalCost).whole}</span>
              <span className="opacity-60">.{nadParts(totalCost).cents}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600" style={{ fontFamily: 'Rubik, sans-serif' }}>{selectedServices.length} services</p>
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  viewMode === 'cards' 
                    ? 'bg-[#01b9d4] text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-[#01b9d4] text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                List
              </button>
            </div>
          </div>
        </div>
      </div>

      {tariffError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{tariffError}</span>
        </div>
      )}
      {!tariffError && excludedCount > 0 && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <Info className="w-4 h-4 flex-shrink-0" />
          <span>
            {excludedCount} tariff row(s) are hidden because they are inactive, expired, not yet in effect or
            duplicated with different prices. Ask an administrator to check the tariff list.
          </span>
        </div>
      )}

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
                    <div className="font-bold text-sm text-gray-900" style={{ fontFamily: 'Rubik, sans-serif' }}>{code.code}</div>
                    <div className="text-xs text-gray-600 truncate">{code.description}</div>
                    {code.requires_tooth_number === 'YES' && (
                      <div className="text-xs text-amber-600 mt-1">🦷 Requires tooth number</div>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-[#01b9d4] ml-4" style={{ fontFamily: 'Rubik, sans-serif' }}>
                    <span>N$ {nadParts(tariffPrice(code.price)).whole}</span>
                    <span className="opacity-60">.{nadParts(tariffPrice(code.price)).cents}</span>
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
            {frequentTariffs.filter(code => code.code !== '8346').map((code) => (
              <motion.button
                key={code.id}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={(e) => addService(code, e)}
                className="p-3 bg-white border border-gray-200 rounded-lg hover:border-[#01b9d4] hover:shadow-md transition-all text-left group"
              >
                <div className="font-bold text-sm text-gray-900 group-hover:text-[#01b9d4]" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  {code.code}
                </div>
                <div className="text-xs text-gray-600 mt-1 truncate">
                  {code.description}
                </div>
                <div className="text-sm font-semibold text-[#01b9d4] mt-1" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  <span>N$ {nadParts(tariffPrice(code.price)).whole}</span>
                  <span className="opacity-60">.{nadParts(tariffPrice(code.price)).cents}</span>
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
          
          {viewMode === 'list' ? (
            /* List View */
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {selectedServices.map((service) => (
                    <tr key={service.id} className={`${
                      service.isAutoGenerated ? 'bg-amber-50' : 
                      service.isRequired ? 'bg-green-50' : 'bg-white'
                    } hover:bg-gray-50`}>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900" style={{ fontFamily: 'Rubik, sans-serif' }}>
                        {service.code}
                        {service.isRequired && <span className="ml-1 text-green-600">*</span>}
                        {selectedServices.filter(s => s.code === service.code).length > 1 && (
                          <span className="ml-1 text-blue-600 text-xs" style={{ fontFamily: 'Rubik, sans-serif' }}>×{selectedServices.filter(s => s.code === service.code).length}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {service.description}
                        {service.isAutoGenerated && (
                          <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                            Auto
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className={`flex items-center gap-1 ${
                          quantityLocked(service) ? 'opacity-30' : ''
                        }`}>
                          <button
                            type="button"
                            onClick={() => updateQuantity(service.id, -1)}
                            disabled={service.quantity <= 1 || quantityLocked(service)}
                            className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-100"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center" style={{ fontFamily: 'Rubik, sans-serif' }}>{service.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(service.id, 1)}
                            disabled={quantityLocked(service)}
                            className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-100"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <span className={service.isPriceProtected ? 'opacity-60' : ''} style={{ fontFamily: 'Rubik, sans-serif' }}>
                          <span>N$ {nadParts(service.unitPrice).whole}</span>
                          <span className="opacity-60">.{nadParts(service.unitPrice).cents}</span>
                        </span>
                        {service.isPriceProtected && (
                          <span className="ml-1 text-xs text-gray-500">🔒</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-[#01b9d4]" style={{ fontFamily: 'Rubik, sans-serif' }}>
                        <span>N$ {nadParts(service.totalPrice).whole}</span>
                        <span className="opacity-60">.{nadParts(service.totalPrice).cents}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          type="button"
                          onClick={() => removeService(service.id)}
                          disabled={service.isAutoGenerated || service.isRequired}
                          className={`p-1 rounded ${
                            service.isAutoGenerated || service.isRequired
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'text-red-500 hover:text-red-700 hover:bg-red-50'
                          }`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Card View */
            <div className="space-y-4">
              {selectedServices.map((service) => (
              <motion.div
                key={service.id}
                layout
                className={`rounded-lg p-4 ${
                  service.isAutoGenerated 
                    ? 'bg-amber-50 border border-amber-200' 
                    : service.isRequired
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-blue-50 border border-blue-200'
                }`}
              >
                {/* Service Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getServiceIcon(service)}
                      <span className="font-bold text-gray-900" style={{ fontFamily: 'Rubik, sans-serif' }}>{service.code}</span>
                      {selectedServices.filter(s => s.code === service.code).length > 1 && (
                        <span className="ml-1 text-blue-600 text-xs font-bold" style={{ fontFamily: 'Rubik, sans-serif' }}>×{selectedServices.filter(s => s.code === service.code).length}</span>
                      )}
                      <span className="text-sm text-gray-600">{service.description}</span>
                      {service.isAutoGenerated && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                          Auto-Generated
                        </span>
                      )}
                      {service.isRequired && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          Required
                        </span>
                      )}
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
                    className={`p-1 ${
                      service.isAutoGenerated || service.isRequired
                        ? 'text-gray-300 cursor-not-allowed' 
                        : 'text-red-500 hover:text-red-700'
                    }`}
                    disabled={service.isAutoGenerated || service.isRequired}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Teeth Numbers Input */}
                {service.requiresTeethNumbers && (
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tooth Numbers (space-separated)
                      {selectedServices.filter(s => s.code === service.code).length > 1 && (
                        <span className="ml-2 text-xs text-blue-600">
                          Instance {selectedServices.filter(s => s.code === service.code && s.id <= service.id).length} of {selectedServices.filter(s => s.code === service.code).length}
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., 11 12 21 22"
                      value={toothDrafts[service.id] ?? (service.teethNumbers || []).join(' ')}
                      onChange={(e) => {
                        // Keep the typed text (so a space can be typed) and store the parsed teeth
                        const text = e.target.value;
                        setToothDrafts(drafts => ({ ...drafts, [service.id]: text }));
                        updateTeethNumbers(service.id, parseToothList(text));
                      }}
                      className="w-full p-2 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
                    />
                    {(service.teethNumbers || []).some(tooth => tooth.trim() && !isValidFdiTooth(tooth)) && (
                      <p className="mt-1 text-xs text-red-600">
                        Not a valid tooth number:{' '}
                        {(service.teethNumbers || []).filter(tooth => tooth.trim() && !isValidFdiTooth(tooth)).join(', ')} (FDI 11-48,
                        milk teeth 51-85)
                      </p>
                    )}
                  </div>
                )}

                {/* Quantity and Price Controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Quantity Controls */}
                    <div className={`flex items-center gap-2 transition-opacity ${
                      quantityLocked(service) ? 'opacity-30 pointer-events-none' : 'opacity-100'
                    }`}>
                      <span className="text-sm font-medium text-gray-700">Quantity:</span>
                      <div className="flex items-center border border-gray-200 rounded">
                        <button
                          type="button"
                          onClick={() => updateQuantity(service.id, -1)}
                          className="p-1 hover:bg-gray-100 transition-colors"
                          disabled={service.quantity <= 1 || quantityLocked(service)}
                        >
                          <Minus className="w-4 h-4 text-gray-600" />
                        </button>
                        <span className="px-3 py-1 min-w-[40px] text-center text-sm font-medium" style={{ fontFamily: 'Rubik, sans-serif' }}>
                          {service.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(service.id, 1)}
                          className="p-1 hover:bg-gray-100 transition-colors"
                          disabled={quantityLocked(service)}
                        >
                          <Plus className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                      {service.canBeMultiplied === false && (
                        <span className="text-xs text-gray-500 italic">Fixed quantity</span>
                      )}
                    </div>
                  </div>

                  {/* Price Display */}
                  <div className="text-right">
                    <div className="text-sm text-gray-500 flex items-center justify-end gap-1">
                      <span className={service.isPriceProtected ? 'opacity-60' : ''} style={{ fontFamily: 'Rubik, sans-serif' }}>
                        <span>N$ {nadParts(service.unitPrice).whole}</span>
                        <span className="opacity-60">.{nadParts(service.unitPrice).cents}</span>
                        <span> × {service.quantity}</span>
                      </span>
                      {service.isPriceProtected && (
                        <span className="text-xs text-gray-500">🔒</span>
                      )}
                    </div>
                    <div className="text-lg font-semibold text-[#01b9d4]" style={{ fontFamily: 'Rubik, sans-serif' }}>
                      <span>N$ {nadParts(service.totalPrice).whole}</span>
                      <span className="opacity-60">.{nadParts(service.totalPrice).cents}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedDentalServiceSelector;