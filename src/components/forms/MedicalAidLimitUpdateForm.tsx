import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { 
  CreditCard, 
  DollarSign, 
  Shield, 
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';

interface MedicalAidDetails {
  id: string;
  patient_id: string;
  provider: string;
  scheme: string; // Changed from scheme_name to scheme
  membership_number: string;
  annual_limit: number;
  remaining_limit: number;
  coverage_percentage: number;
  last_limit_check_date: string;
  authorization_required: boolean;
  pre_authorization_number?: string;
}

interface MedicalAidLimitUpdateFormProps {
  patientId: string;
  onUpdate?: () => void;
  onClose?: () => void;
}

const MedicalAidLimitUpdateForm: React.FC<MedicalAidLimitUpdateFormProps> = ({
  patientId,
  onUpdate,
  onClose
}) => {
  const [medicalAid, setMedicalAid] = useState<MedicalAidDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showSensitiveInfo, setShowSensitiveInfo] = useState(false);
  
  // Form fields
  const [formData, setFormData] = useState({
    remaining_limit: '',
    annual_limit: '',
    coverage_percentage: '',
    co_payment_amount: '',
    authorization_required: false,
    pre_authorization_number: '',
    portal_reference: '',
    notes: ''
  });

  useEffect(() => {
    fetchMedicalAidDetails();
  }, [patientId]);

  const fetchMedicalAidDetails = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('medical_aid_details')
        .select(`
          *,
          medical_aid_providers!inner(name, logo_url)
        `)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setMedicalAid(data);
        setFormData({
          remaining_limit: data.remaining_limit?.toString() || '0',
          annual_limit: data.annual_limit?.toString() || '0',
          coverage_percentage: data.coverage_percentage?.toString() || '80',
          co_payment_amount: data.co_payment_amount?.toString() || '0',
          authorization_required: data.authorization_required || false,
          pre_authorization_number: data.pre_authorization_number || '',
          portal_reference: '',
          notes: ''
        });
      }
    } catch (error) {
      console.error('Error fetching medical aid details:', error);
      toast.error('Failed to load medical aid details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateLimits = async () => {
    if (!medicalAid) return;

    try {
      setIsUpdating(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Call the update function
      const { error } = await supabase.rpc('update_medical_aid_limit', {
        p_patient_id: patientId,
        p_new_remaining_limit: parseFloat(formData.remaining_limit),
        p_annual_limit: parseFloat(formData.annual_limit),
        p_updated_by: user?.id,
        p_portal_reference: formData.portal_reference,
        p_notes: formData.notes
      });

      if (error) throw error;

      // Update the medical aid details table with additional fields
      const { error: updateError } = await supabase
        .from('medical_aid_details')
        .update({
          coverage_percentage: parseFloat(formData.coverage_percentage),
          co_payment_amount: parseFloat(formData.co_payment_amount),
          authorization_required: formData.authorization_required,
          pre_authorization_number: formData.pre_authorization_number || null
        })
        .eq('id', medicalAid.id);

      if (updateError) throw updateError;

      toast.success('Medical aid limits updated successfully!');
      
      // Refresh the data
      await fetchMedicalAidDetails();
      
      if (onUpdate) onUpdate();
      
    } catch (error) {
      console.error('Error updating medical aid limits:', error);
      toast.error('Failed to update medical aid limits');
    } finally {
      setIsUpdating(false);
    }
  };

  const calculateUtilization = () => {
    if (!medicalAid?.annual_limit || medicalAid.annual_limit === 0) return 0;
    const used = medicalAid.annual_limit - (medicalAid.remaining_limit || 0);
    return Math.round((used / medicalAid.annual_limit) * 100);
  };

  const getStatusColor = () => {
    const utilization = calculateUtilization();
    if (utilization >= 90) return 'text-red-600 bg-red-50';
    if (utilization >= 70) return 'text-orange-600 bg-orange-50';
    return 'text-green-600 bg-green-50';
  };

  const getStatusIcon = () => {
    const utilization = calculateUtilization();
    if (utilization >= 90) return <AlertTriangle className="w-4 h-4" />;
    if (utilization >= 70) return <Shield className="w-4 h-4" />;
    return <CheckCircle2 className="w-4 h-4" />;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!medicalAid) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Medical Aid Found
          </h3>
          <p className="text-gray-500">
            This patient doesn't have active medical aid coverage.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Status Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#01b9d5]" />
            Medical Aid Status
          </h3>
          <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${getStatusColor()}`}>
            {getStatusIcon()}
            {calculateUtilization()}% Used
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Provider</label>
            <p className="text-lg font-semibold text-gray-900">{medicalAid.provider}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Scheme</label>
            <p className="text-lg font-semibold text-gray-900">{medicalAid.scheme}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Membership Number</label>
            <div className="flex items-center gap-2">
              <p className={`text-lg font-semibold ${showSensitiveInfo ? 'text-gray-900' : 'text-gray-400'}`}>
                {showSensitiveInfo ? medicalAid.membership_number : '••••••••'}
              </p>
              <button
                onClick={() => setShowSensitiveInfo(!showSensitiveInfo)}
                className="text-gray-400 hover:text-gray-600"
              >
                {showSensitiveInfo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Last Updated</label>
            <p className="text-lg font-semibold text-gray-900">
              {medicalAid.last_limit_check_date ? 
                new Date(medicalAid.last_limit_check_date).toLocaleDateString() : 
                'Never'
              }
            </p>
          </div>
        </div>

        {/* Utilization Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Benefit Utilization</span>
            <span>N${(medicalAid.annual_limit - (medicalAid.remaining_limit || 0)).toLocaleString()} / N${medicalAid.annual_limit?.toLocaleString()}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                calculateUtilization() >= 90 ? 'bg-red-500' :
                calculateUtilization() >= 70 ? 'bg-orange-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(calculateUtilization(), 100)}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Update Form */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-[#01b9d5]" />
          Update Medical Aid Information
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Annual Limit (N$)
            </label>
            <input
              type="number"
              value={formData.annual_limit}
              onChange={(e) => setFormData({ ...formData, annual_limit: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent"
              placeholder="25000.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Remaining Limit (N$)
            </label>
            <input
              type="number"
              value={formData.remaining_limit}
              onChange={(e) => setFormData({ ...formData, remaining_limit: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent"
              placeholder="18500.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Coverage Percentage (%)
            </label>
            <input
              type="number"
              value={formData.coverage_percentage}
              onChange={(e) => setFormData({ ...formData, coverage_percentage: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent"
              placeholder="80"
              min="0"
              max="100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Co-payment Amount (N$)
            </label>
            <input
              type="number"
              value={formData.co_payment_amount}
              onChange={(e) => setFormData({ ...formData, co_payment_amount: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent"
              placeholder="150.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Portal Reference
            </label>
            <input
              type="text"
              value={formData.portal_reference}
              onChange={(e) => setFormData({ ...formData, portal_reference: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent"
              placeholder="Portal confirmation number"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pre-authorization Number
            </label>
            <input
              type="text"
              value={formData.pre_authorization_number}
              onChange={(e) => setFormData({ ...formData, pre_authorization_number: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent"
              placeholder="AUTH123456"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.authorization_required}
              onChange={(e) => setFormData({ ...formData, authorization_required: e.target.checked })}
              className="rounded border-gray-300 text-[#01b9d5] focus:ring-[#01b9d5]"
            />
            <span className="text-sm font-medium text-gray-700">Authorization Required for Claims</span>
          </label>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Update Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent"
            placeholder="Notes about this update (e.g., 'Updated from Bonitas portal')"
          />
        </div>

        <div className="flex justify-end space-x-3">
          {onClose && (
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isUpdating}
            >
              Cancel
            </Button>
          )}
          <Button
            onClick={handleUpdateLimits}
            disabled={isUpdating}
            className="flex items-center gap-2"
          >
            {isUpdating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <DollarSign className="w-4 h-4" />
                Update Limits
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default MedicalAidLimitUpdateForm;