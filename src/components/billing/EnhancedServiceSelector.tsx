import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
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
  List,
  Hash,
  Zap,
  Info,
  RefreshCw
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { ServiceSelection } from '../../types/billing';
import { useAuthStore } from '../../stores/authStore';
import Icd10CodeInput from './Icd10CodeInput';
import {
  MAX_QUANTITY,
  TARIFF_EXCLUSION_LABELS,
  computeLine,
  searchTariffs,
  selectBillableTariffs,
  summarizeExclusions,
  summarizeLines,
  type BillableTariff,
  type LineResult,
  type MultiplyRule,
  type TariffExclusionReason,
  type TariffRow
} from '../../utils/billing/pricing';
import { formatNad, toCents } from '../../utils/billing/money';
import { toDateKey, todayKey } from '../../utils/billing/dates';
import { emptyIcd10Selection, type Icd10Selection } from '../../utils/billing/icd10';
import { priceBillableTariffs, type PatientTariff } from '../../utils/billing/fundPricing';
import { billableAtPatientRate } from '../../utils/billing/patientRates';
import { isDentalPractice } from '../../utils/billing/tariffRules';
import { fundPricingNotice } from '../visits/visitBillingLines';
import { useFundPricing } from '../visits/useFundPricing';

interface EnhancedServiceSelectorProps {
  practiceId?: string;
  selectedServices: ServiceSelection[];
  onServiceChange: (services: ServiceSelection[]) => void;
  /** medical_aid_details id: when set, this patient's lines are billed to the medical aid. */
  medicalAidId?: string;
  readOnly?: boolean;
  patientId?: string; // Used to check the patient's medical aid when medicalAidId is not given
  /** Date of service (yyyy-MM-dd); decides which tariff prices are in effect. Defaults to today. */
  serviceDate?: string;
  /** ICD-10 codes per service line, keyed by service id (controlled by the parent when given). */
  diagnoses?: Record<string, Icd10Selection>;
  onDiagnosesChange?: (diagnoses: Record<string, Icd10Selection>) => void;
}

/** Handle exposed through the ref, e.g. for a "frequent codes" grid that adds a code. */
export interface EnhancedServiceSelectorHandle {
  /** Adds a tariff by id or code; only tariffs in effect on the service date can be added. */
  addService: (tariff: { id?: string | null; code?: string | null } | string) => void;
}

const TARIFF_COLUMNS =
  'id, code, description, price, unit, is_active, effective_from, effective_to, can_be_multiplied, requires_tooth_number, business_rule_formula, example_calculation, notes';

const MAX_VISIBLE_TARIFFS = 120;

/** Lines without a matching tariff (e.g. loaded from an older invoice) keep their stored multiply flag. */
const ruleForService = (service: ServiceSelection, tariff: BillableTariff | undefined): MultiplyRule =>
  tariff ? tariff.multiplyRule : service.canBeMultiplied ? 'YES' : 'NO';

const EnhancedServiceSelector = forwardRef<EnhancedServiceSelectorHandle, EnhancedServiceSelectorProps>(({
  practiceId,
  selectedServices,
  onServiceChange,
  medicalAidId,
  readOnly = false,
  patientId,
  serviceDate,
  diagnoses,
  onDiagnosesChange
}, ref) => {
  const selectedPracticeId = useAuthStore(state => state.selectedPracticeId);
  const userPracticeId = useAuthStore(state => state.user?.practice_id);
  const effectivePracticeId = practiceId || selectedPracticeId || userPracticeId || null;
  const serviceDateKey = toDateKey(serviceDate ?? null) ?? todayKey();
  // Day-first for people reading the screen; serviceDateKey (yyyy-MM-dd) stays the value used for pricing
  const serviceDateLabel = format(parseISO(serviceDateKey), 'dd MMM yyyy');

  const [tariffRows, setTariffRows] = useState<TariffRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showCalculator, setShowCalculator] = useState(true);
  const [showExcluded, setShowExcluded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [patientMedicalAid, setPatientMedicalAid] = useState<{ checked: boolean; provider: string | null }>({
    checked: false,
    provider: null
  });
  // Set when the medical aid lookup fails, so the breakdown doesn't say "Checking..." forever
  const [medicalAidCheckFailed, setMedicalAidCheckFailed] = useState(false);
  const [localDiagnoses, setLocalDiagnoses] = useState<Record<string, Icd10Selection>>({});

  // Add-service dialog for codes that need a tooth number or a quantity
  const [selectedTariff, setSelectedTariff] = useState<PatientTariff | null>(null);
  // practices.practice_type: whose fund schedules apply, and whether tooth numbers are asked for (dental only)
  const [practiceType, setPracticeType] = useState<string | null>(null);
  const [toothNumber, setToothNumber] = useState('');
  const [quantityInput, setQuantityInput] = useState('1');

  // Load the tariff list for the practice's type. Prices come only from practice_tariffs: the old
  // hard-coded fallback list billed outdated prices whenever loading failed.
  useEffect(() => {
    let cancelled = false;
    const loadTariffs = async () => {
      setIsLoading(true);
      setError(null);
      if (!effectivePracticeId) {
        setTariffRows([]);
        setError('No practice is selected, so the tariff list cannot be loaded.');
        setIsLoading(false);
        return;
      }
      try {
        const { data: practice, error: practiceError } = await supabase
          .from('practices')
          .select('id, practice_type')
          .eq('id', effectivePracticeId)
          .maybeSingle();
        if (practiceError) throw new Error(practiceError.message);
        if (!practice?.practice_type) throw new Error('the practice type is not set, so its tariff list is unknown');
        if (!cancelled) setPracticeType(practice.practice_type);

        const { data, error: tariffError } = await supabase
          .from('practice_tariffs_with_types')
          .select(TARIFF_COLUMNS)
          .eq('practice_type_name', practice.practice_type);
        if (tariffError) throw new Error(tariffError.message);
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
    loadTariffs();
    return () => {
      cancelled = true;
    };
  }, [effectivePracticeId, reloadKey]);

  // Only tariffs active and in effect on the service date, one version per code, priced for this patient: the fund's
  // own price where its schedule has the code (nothing is priced until the patient's fund is known)
  const fundPricing = useFundPricing({
    practiceId: effectivePracticeId,
    practiceType,
    patientId: patientId ?? null,
    medicalAidDetailsId: medicalAidId ?? null
  });
  const pricingBlocked =
    fundPricing.status !== 'ready' ? "Loading the patient's medical aid prices. Try again in a moment." : fundPricing.blockMessage;
  const pricingNotice = pricingBlocked ?? fundPricingNotice(fundPricing.status === 'ready' ? fundPricing.pricing : null, serviceDateKey);
  const { tariffs, excluded } = useMemo(() => {
    const selected = selectBillableTariffs(tariffRows, serviceDateKey);
    // Tooth numbers are a dental rule: other practice types never block a line on a tooth
    const disciplineTariffs = isDentalPractice(practiceType) ? selected.tariffs : selected.tariffs.map(tariff => ({ ...tariff, requiresTooth: false }));
    const pricing = fundPricing.status === 'ready' ? fundPricing.pricing : null;
    const priced = priceBillableTariffs(disciplineTariffs, {
      serviceDate: serviceDateKey,
      practiceId: pricing?.practiceId ?? null,
      fund: pricing?.fund ?? null,
      book: fundPricing.pricing.book
    });
    // The patient's own price rate (R28) on the codes at the practice tariff, as the visit screens price them
    return { tariffs: billableAtPatientRate(priced, pricing?.patientRate), excluded: selected.excluded };
  }, [tariffRows, serviceDateKey, practiceType, fundPricing]);
  const exclusionCounts = useMemo(() => summarizeExclusions(excluded), [excluded]);
  const tariffById = useMemo(() => new Map(tariffs.map(tariff => [tariff.id, tariff])), [tariffs]);
  const tariffByCode = useMemo(() => new Map(tariffs.map(tariff => [tariff.code, tariff])), [tariffs]);
  const filteredTariffs = useMemo(() => searchTariffs(tariffs, searchTerm), [tariffs, searchTerm]);

  // Whether this patient's bill goes to a medical aid (a patient can have several records: limit 1)
  useEffect(() => {
    if (!patientId) {
      setPatientMedicalAid({ checked: false, provider: null });
      return;
    }
    let cancelled = false;
    setMedicalAidCheckFailed(false);
    supabase
      .from('medical_aid_details')
      .select('id, provider')
      .eq('patient_id', patientId)
      .limit(1)
      .then(({ data, error: medicalAidError }) => {
        if (cancelled) return;
        if (medicalAidError) {
          console.error('Could not check the patient medical aid:', medicalAidError.message);
          setPatientMedicalAid({ checked: false, provider: null });
          setMedicalAidCheckFailed(true);
          toast.error("Could not check the patient's medical aid, so the cost split is not final. Close and reopen the visit to try again.");
          return;
        }
        const record = data?.[0];
        setPatientMedicalAid({ checked: true, provider: record ? record.provider || 'Medical aid' : null });
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  // AddVisitForm passes medicalAidId (not patientId), so either one marks a medical aid patient
  const hasMedicalAid = Boolean(medicalAidId) || Boolean(patientMedicalAid.provider);
  // Until the patient's medical aid has been checked, the split is not final
  const medicalAidKnown = Boolean(medicalAidId) || !patientId || patientMedicalAid.checked;
  const medicalAidProvider = patientMedicalAid.provider ?? 'Medical aid';

  // Every line is priced by the one shared calculation (unit x quantity in cents, split by status)
  const lineResults = useMemo(() => {
    const results = new Map<string, LineResult>();
    selectedServices.forEach(service => {
      const tariff = tariffById.get(service.tariffId) ?? tariffByCode.get(service.code);
      results.set(
        service.id,
        computeLine({
          code: service.code,
          unitPrice: service.unitPrice,
          quantity: service.quantity,
          multiplyRule: ruleForService(service, tariff),
          requiresTooth: tariff?.requiresTooth ?? service.requiresTeethNumbers ?? false,
          toothNumbers: service.teethNumbers,
          hasMedicalAid,
          businessRule: tariff?.businessRule
        })
      );
    });
    return results;
  }, [selectedServices, tariffById, tariffByCode, hasMedicalAid]);

  const totals = useMemo(() => summarizeLines([...lineResults.values()]), [lineResults]);

  // Keep each line's stored total and medical aid flags equal to what is shown, so the saved
  // invoice line is exactly unit x quantity and follows the patient's medical aid status.
  useEffect(() => {
    if (readOnly || !medicalAidKnown) return;
    const coverage = hasMedicalAid ? 100 : 0;
    let changed = false;
    const next = selectedServices.map(service => {
      const result = lineResults.get(service.id);
      const totalPrice = result?.ok ? result.total : service.totalPrice;
      if (
        Boolean(service.medicalAidCovered) === hasMedicalAid &&
        (service.coveragePercentage ?? 0) === coverage &&
        totalPrice === service.totalPrice
      ) {
        return service;
      }
      changed = true;
      return { ...service, medicalAidCovered: hasMedicalAid, coveragePercentage: coverage, totalPrice };
    });
    if (changed) onServiceChange(next);
  }, [readOnly, medicalAidKnown, hasMedicalAid, selectedServices, lineResults, onServiceChange]);

  // ICD-10 codes per line. Kept in component state (or by the parent) until invoice_services has
  // ICD-10 columns (proposals/2026-10-claims.sql); the claims screen asks for them per claim line.
  const currentDiagnoses = diagnoses ?? localDiagnoses;
  const updateDiagnoses = (next: Record<string, Icd10Selection>) => {
    if (!diagnoses) setLocalDiagnoses(next);
    onDiagnosesChange?.(next);
  };
  const setLineDiagnosis = (serviceId: string, selection: Icd10Selection) =>
    updateDiagnoses({ ...currentDiagnoses, [serviceId]: selection });
  const applyDiagnosisToAll = (selection: Icd10Selection) =>
    updateDiagnoses(
      Object.fromEntries(
        selectedServices.map(service => [service.id, { primary: selection.primary, secondary: [...selection.secondary] }])
      )
    );

  const resolveTariff = (input: { id?: string | null; code?: string | null } | string): PatientTariff | undefined => {
    if (typeof input === 'string') return tariffByCode.get(input.trim());
    return (input.id ? tariffById.get(input.id) : undefined) ?? (input.code ? tariffByCode.get(input.code.trim()) : undefined);
  };

  const createLine = (tariff: BillableTariff, quantity: number, teeth: string[]): boolean => {
    const result = computeLine({
      code: tariff.code,
      unitPrice: tariff.unitPrice,
      quantity,
      multiplyRule: tariff.multiplyRule,
      requiresTooth: tariff.requiresTooth,
      toothNumbers: teeth,
      hasMedicalAid,
      businessRule: tariff.businessRule
    });
    if (!result.ok) {
      setNotice(result.errors.join(' '));
      return false;
    }
    const newService: ServiceSelection = {
      id: crypto.randomUUID(),
      tariffId: tariff.id,
      code: tariff.code,
      description: teeth.length > 0 ? `${tariff.description} (Tooth ${teeth.join(', ')})` : tariff.description,
      category: tariff.notes?.split(' / ')[0] || 'Service',
      subcategory: tariff.notes?.split(' / ')[1] || 'General',
      unitPrice: result.unitPrice,
      quantity: result.quantity,
      totalPrice: result.total,
      requiresPreAuth: false,
      medicalAidCovered: hasMedicalAid,
      coveragePercentage: hasMedicalAid ? 100 : 0,
      businessRule: tariff.businessRule ?? undefined,
      exampleCalculation: tariff.exampleCalculation ?? undefined,
      requiresTeethNumbers: tariff.requiresTooth,
      canBeMultiplied: tariff.multiplyRule !== 'NO',
      // invoiceService saves teethNumbers to invoice_services.tooth_number, which the claim needs
      teethNumbers: teeth.length > 0 ? teeth : undefined
    };
    onServiceChange([...selectedServices, newService]);
    setNotice(null);
    return true;
  };

  const addService = (input: { id?: string | null; code?: string | null } | string) => {
    if (readOnly) return;
    const tariff = resolveTariff(input);
    if (!tariff) {
      const code = typeof input === 'string' ? input : input.code ?? '';
      setNotice(`Code ${code} is not in effect on ${serviceDateLabel} or is not in the tariff list, so it cannot be billed.`);
      return;
    }
    // A medical aid patient's lines wait for the fund's prices; an ambiguous fund price is never guessed
    if (pricingBlocked || tariff.priceProblem) {
      setNotice(pricingBlocked ?? tariff.priceProblem);
      return;
    }
    if (tariff.requiresTooth || tariff.multiplyRule !== 'NO') {
      setSelectedTariff(tariff);
      setToothNumber('');
      setQuantityInput('1');
      return;
    }
    if (
      selectedServices.some(service => service.code === tariff.code) &&
      !window.confirm(`${tariff.code} is already on this visit. Add it again as a separate line?`)
    ) {
      return;
    }
    createLine(tariff, 1, []);
  };

  // Expose methods via ref
  useImperativeHandle(ref, () => ({ addService }));

  const dialogTeeth = toothNumber.trim() ? [toothNumber.trim()] : [];
  const dialogResult = selectedTariff
    ? computeLine({
        code: selectedTariff.code,
        unitPrice: selectedTariff.unitPrice,
        quantity: selectedTariff.multiplyRule === 'NO' ? 1 : Number(quantityInput),
        multiplyRule: selectedTariff.multiplyRule,
        requiresTooth: selectedTariff.requiresTooth,
        toothNumbers: dialogTeeth,
        hasMedicalAid,
        businessRule: selectedTariff.businessRule
      })
    : null;

  const confirmDialog = () => {
    if (!selectedTariff || !dialogResult?.ok) return;
    if (createLine(selectedTariff, dialogResult.quantity, dialogTeeth)) setSelectedTariff(null);
  };

  // Changes the quantity of one line (by id); codes that cannot be multiplied stay at 1
  const updateServiceQuantity = (serviceId: string, newQuantity: number) => {
    if (readOnly) return;
    const service = selectedServices.find(item => item.id === serviceId);
    if (!service) return;
    const tariff = tariffById.get(service.tariffId) ?? tariffByCode.get(service.code);
    const result = computeLine({
      code: service.code,
      unitPrice: service.unitPrice,
      quantity: newQuantity,
      multiplyRule: ruleForService(service, tariff),
      requiresTooth: tariff?.requiresTooth ?? service.requiresTeethNumbers ?? false,
      toothNumbers: service.teethNumbers,
      hasMedicalAid,
      businessRule: tariff?.businessRule
    });
    if (!result.ok) {
      setNotice(result.errors.join(' '));
      return;
    }
    setNotice(null);
    onServiceChange(
      selectedServices.map(item => (item.id === serviceId ? { ...item, quantity: result.quantity, totalPrice: result.total } : item))
    );
  };

  // Removes one line (by id): two lines with the same code, e.g. two teeth, are separate lines
  const removeService = (serviceId: string) => {
    if (readOnly) return;
    onServiceChange(selectedServices.filter(service => service.id !== serviceId));
    if (currentDiagnoses[serviceId]) {
      updateDiagnoses(Object.fromEntries(Object.entries(currentDiagnoses).filter(([key]) => key !== serviceId)));
    }
  };

  const exclusionSummary = (Object.entries(exclusionCounts) as Array<[TariffExclusionReason, number]>)
    .map(([reason, count]) => `${count} ${TARIFF_EXCLUSION_LABELS[reason]}`)
    .join(', ');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8" role="status">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#01b9d4]"></div>
        <span className="ml-3 text-gray-600">Loading tariff codes...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
        <div className="flex items-start gap-2">
          <AlertTriangle className="text-red-500 flex-shrink-0" size={20} />
          <div className="flex-1">
            <p className="text-red-700 font-medium">{error}</p>
            <p className="text-red-600 text-sm mt-1">
              Services cannot be billed until the tariff list loads, so no price is guessed.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey(key => key + 1)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-100"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
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
            Services & Billing{tariffs.length > 0 && ` (${tariffs.length} codes)`}
          </h3>
          <p className="text-sm text-gray-600">
            Tariff prices in effect on {serviceDateLabel}
            {filteredTariffs.length !== tariffs.length && ` (${filteredTariffs.length} of ${tariffs.length} shown)`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={viewMode === 'grid' ? 'Show codes as a list' : 'Show codes as a grid'}
            title={viewMode === 'grid' ? 'Show codes as a list' : 'Show codes as a grid'}
          >
            {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => setShowCalculator(!showCalculator)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={showCalculator ? 'Hide cost breakdown' : 'Show cost breakdown'}
            title={showCalculator ? 'Hide cost breakdown' : 'Show cost breakdown'}
          >
            <Calculator className="w-4 h-4" />
          </button>
        </div>
      </div>

      {excluded.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p>
                {excluded.length} tariff row(s) cannot be billed on {serviceDateLabel} ({exclusionSummary}). Ask an
                administrator to correct the tariff list.
              </p>
              <button type="button" onClick={() => setShowExcluded(!showExcluded)} className="mt-1 text-xs font-medium underline">
                {showExcluded ? 'Hide details' : 'Show details'}
              </button>
              {showExcluded && (
                <ul className="mt-2 max-h-40 overflow-y-auto text-xs space-y-0.5">
                  {excluded.map((item, index) => (
                    <li key={`${item.id ?? 'none'}-${index}`}>
                      <span className="font-mono">{item.code || '(no code)'}</span>: {TARIFF_EXCLUSION_LABELS[item.reason]}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {pricingNotice && (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${pricingBlocked ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-cyan-200 bg-cyan-50 text-cyan-800'}`}
        >
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p className="flex-1">{pricingNotice}</p>
        </div>
      )}

      {notice && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700" role="alert">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p className="flex-1">{notice}</p>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message" title="Dismiss message" className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search by code or description..."
          aria-label="Search tariff codes by code or description"
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
            {selectedServices.map((service) => {
              const line = lineResults.get(service.id);
              const tariff = tariffById.get(service.tariffId) ?? tariffByCode.get(service.code);
              const multipliable = ruleForService(service, tariff) !== 'NO';
              const priceChanged = tariff !== undefined && toCents(tariff.unitPrice) !== toCents(service.unitPrice);
              const diagnosis = currentDiagnoses[service.id] ?? emptyIcd10Selection();
              const hasMessages = Boolean(line && (line.errors.length > 0 || line.warnings.length > 0)) || priceChanged;
              return (
                <div
                  key={service.id}
                  className={`bg-white p-3 rounded-lg border ${line && !line.ok ? 'border-red-300' : 'border-transparent'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-gray-900">{service.code}</span>
                        {service.teethNumbers && service.teethNumbers.length > 0 && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            Tooth {service.teethNumbers.join(', ')}
                          </span>
                        )}
                        {service.businessRule && service.businessRule !== 'Fixed price' && (
                          <span title={service.businessRule}>
                            <Zap className="w-4 h-4 text-amber-500" />
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{service.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{formatNad(service.unitPrice)} x {service.quantity}</span>
                        <span className="font-medium text-[#01b9d4]">= {formatNad(line?.ok ? line.total : service.totalPrice)}</span>
                        {service.exampleCalculation && (
                          <span className="text-amber-600" title={service.exampleCalculation}>
                            <Info className="w-3 h-3 inline" />
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {multipliable ? (
                        <>
                          <button
                            type="button"
                            onClick={() => updateServiceQuantity(service.id, service.quantity - 1)}
                            disabled={readOnly || service.quantity <= 1}
                            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50"
                            aria-label={`Decrease the quantity of ${service.code}`}
                            title={`Decrease the quantity of ${service.code}`}
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center text-sm font-medium">{service.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateServiceQuantity(service.id, service.quantity + 1)}
                            disabled={readOnly || service.quantity >= MAX_QUANTITY}
                            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50"
                            aria-label={`Increase the quantity of ${service.code}`}
                            title={`Increase the quantity of ${service.code}`}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-gray-500" title="This code is billed once per line">
                          Qty 1
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeService(service.id)}
                        disabled={readOnly}
                        className="p-1 ml-2 text-red-500 hover:text-red-700 hover:bg-red-100 rounded disabled:opacity-50"
                        aria-label={`Remove ${service.code}`}
                        title={`Remove ${service.code}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {hasMessages && (
                    <ul className="mt-2 space-y-0.5 text-xs">
                      {line?.errors.map(message => (
                        <li key={`e-${message}`} className="text-red-700">{message}</li>
                      ))}
                      {line?.warnings.map(message => (
                        <li key={`w-${message}`} className="text-amber-700">{message}</li>
                      ))}
                      {priceChanged && tariff && (
                        <li className="text-amber-700">
                          The tariff price on {serviceDateLabel} is {formatNad(tariff.unitPrice)}; this line uses{' '}
                          {formatNad(service.unitPrice)}. Remove and re-add the code to bill the current price.
                        </li>
                      )}
                    </ul>
                  )}

                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <Icd10CodeInput
                      value={diagnosis}
                      onChange={selection => setLineDiagnosis(service.id, selection)}
                      disabled={readOnly}
                      showRequiredError={hasMedicalAid}
                    />
                    {selectedServices.length > 1 && diagnosis.primary.trim() !== '' && !readOnly && (
                      <button
                        type="button"
                        onClick={() => applyDiagnosisToAll(diagnosis)}
                        className="mt-1 text-xs font-medium text-cyan-700 hover:underline"
                      >
                        Use these codes for all lines
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
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
                <h5 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Calculator className="w-4 h-4" />
                  Cost Breakdown
                  {hasMedicalAid && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      {medicalAidProvider}
                    </span>
                  )}
                </h5>
                {!medicalAidKnown && (
                  <p className={`text-xs mb-2 ${medicalAidCheckFailed ? 'text-red-700' : 'text-gray-500'}`}>
                    {medicalAidCheckFailed
                      ? "Could not check the patient's medical aid, so this split is not final. Close and reopen the visit to try again."
                      : "Checking the patient's medical aid..."}
                  </p>
                )}
                {totals.invalidCount > 0 && (
                  <p className="text-xs text-red-700 mb-2">
                    {totals.invalidCount} line(s) have errors and are not counted below. Fix them before saving.
                  </p>
                )}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatNad(totals.subtotal)}</span>
                  </div>

                  {hasMedicalAid ? (
                    <>
                      <div className="flex justify-between text-green-600 font-semibold">
                        <span className="flex items-center gap-1">
                          <Shield className="w-4 h-4" />
                          Medical Aid Covers:
                        </span>
                        <span>{formatNad(totals.medicalAid)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Patient Portion:</span>
                        <span>{formatNad(totals.patient)}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-medium text-lg">
                        <span>Total Due from Patient:</span>
                        <span className="text-green-600">{formatNad(totals.patient)}</span>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded p-2 mt-2">
                        <p className="text-xs text-green-700 text-center">
                          {medicalAidProvider} is claimed {formatNad(totals.medicalAid)}; the patient pays {formatNad(totals.patient)}.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span>Patient Pays:</span>
                        <span>{formatNad(totals.patient)}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-medium text-lg">
                        <span>Patient Total:</span>
                        <span className="text-[#01b9d4]">{formatNad(totals.patient)}</span>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded p-2 mt-2">
                        <p className="text-xs text-blue-700 text-center">
                          No medical aid: the patient pays the full amount.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Available Tariffs */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3">
          Available Codes ({filteredTariffs.length} of {tariffs.length})
        </h4>
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-2'}>
          {filteredTariffs.slice(0, MAX_VISIBLE_TARIFFS).map((tariff) => {
            const isSelected = selectedServices.some(s => s.code === tariff.code);
            return (
              <motion.button
                type="button"
                key={tariff.id}
                whileHover={{ scale: 1.01 }}
                disabled={readOnly}
                className={`w-full text-left border rounded-lg p-4 cursor-pointer transition-all disabled:cursor-not-allowed ${
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
                      {tariff.requiresTooth && (
                        <span title="Requires a tooth number">
                          <Hash className="w-4 h-4 text-blue-500" />
                        </span>
                      )}
                      {tariff.multiplyRule !== 'NO' && (
                        <span title={tariff.multiplyRule === 'YES' ? 'Quantity allowed' : `Special quantity rule (${tariff.multiplyRule.toLowerCase()})`}>
                          <X className="w-4 h-4 text-green-500" />
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{tariff.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-[#01b9d4]">{formatNad(tariff.unitPrice)}</span>
                      {tariff.unit && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {tariff.unit}
                        </span>
                      )}
                    </div>
                    {tariff.businessRule && tariff.businessRule !== 'Fixed price' && (
                      <p className="text-xs text-amber-600 mt-1" title={tariff.exampleCalculation ?? undefined}>
                        Rule: {tariff.businessRule}
                      </p>
                    )}
                  </div>
                  <Plus className="w-5 h-5 text-gray-400 ml-2" />
                </div>
              </motion.button>
            );
          })}
        </div>

        {filteredTariffs.length > MAX_VISIBLE_TARIFFS && (
          <p className="mt-2 text-center text-xs text-gray-500">
            Showing the first {MAX_VISIBLE_TARIFFS} of {filteredTariffs.length} codes. Refine the search to see more.
          </p>
        )}

        {filteredTariffs.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Stethoscope className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>{tariffs.length === 0 ? `No tariff codes are in effect on ${serviceDateLabel}.` : 'No codes found matching your search.'}</p>
          </div>
        )}
      </div>

      {/* Tooth number / quantity dialog */}
      <AnimatePresence>
        {selectedTariff && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedTariff(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl max-w-md w-full p-6"
              role="dialog"
              aria-modal="true"
              aria-labelledby="service-details-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 id="service-details-title" className="text-lg font-semibold text-gray-900">Service Details</h3>
                <button
                  type="button"
                  onClick={() => setSelectedTariff(null)}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                  aria-label="Close"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="font-medium text-gray-900">{selectedTariff.code}</p>
                  <p className="text-sm text-gray-600">{selectedTariff.description}</p>
                  <p className="text-lg font-bold text-[#01b9d4]">
                    {formatNad(selectedTariff.unitPrice)}
                    {selectedTariff.unit && <span className="ml-1 text-sm font-normal text-gray-500">{selectedTariff.unit}</span>}
                  </p>
                </div>

                {selectedTariff.requiresTooth && (
                  <div>
                    <label htmlFor="service-tooth-number" className="block text-sm font-medium text-gray-700 mb-1">
                      Tooth number (FDI: 11-48, milk teeth 51-85)
                    </label>
                    <input
                      id="service-tooth-number"
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={toothNumber}
                      onChange={(e) => setToothNumber(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
                      placeholder="e.g. 21 for the upper left central incisor"
                    />
                    <p className="mt-1 text-xs text-gray-500">One tooth per line: add the code again for another tooth.</p>
                  </div>
                )}

                {selectedTariff.multiplyRule !== 'NO' && (
                  <div>
                    <label htmlFor="service-quantity" className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity
                    </label>
                    <input
                      id="service-quantity"
                      type="number"
                      min={1}
                      max={MAX_QUANTITY}
                      step={1}
                      value={quantityInput}
                      onChange={(e) => setQuantityInput(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
                    />
                  </div>
                )}

                {selectedTariff.businessRule && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-amber-800 mb-1">Business Rule:</p>
                    <p className="text-sm text-amber-700">{selectedTariff.businessRule}</p>
                    {selectedTariff.exampleCalculation && (
                      <p className="text-xs text-amber-600 mt-1">
                        Example: {selectedTariff.exampleCalculation}
                      </p>
                    )}
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-blue-800">Calculated Total:</p>
                  <p className="text-lg font-bold text-blue-900">
                    {dialogResult?.ok ? formatNad(dialogResult.total) : '-'}
                  </p>
                  {dialogResult && (dialogResult.errors.length > 0 || dialogResult.warnings.length > 0) && (
                    <ul className="mt-1 space-y-0.5 text-xs">
                      {dialogResult.errors.map(message => (
                        <li key={`e-${message}`} className="text-red-700">{message}</li>
                      ))}
                      {dialogResult.warnings.map(message => (
                        <li key={`w-${message}`} className="text-amber-700">{message}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setSelectedTariff(null)}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDialog}
                    disabled={!dialogResult?.ok}
                    className="flex-1 px-4 py-2 text-white bg-[#01b9d4] rounded-lg hover:bg-[#01a5c4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
});

EnhancedServiceSelector.displayName = 'EnhancedServiceSelector';

export default EnhancedServiceSelector;