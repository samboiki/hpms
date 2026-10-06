import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, DollarSign, Save, X } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { toast } from 'react-hot-toast';
import { formatNad } from '../../utils/billing/money';

interface Tariff {
  id: string;
  practice_id: string;
  service_name: string;
  service_code: string;
  category: string;
  description: string;
  base_price: number;
  currency: string;
  is_active: boolean;
  medical_aid_pricing: Record<string, number>;
  created_at: string;
  updated_at: string;
}

interface TariffFormData {
  service_name: string;
  service_code: string;
  category: string;
  description: string;
  base_price: number;
  is_active: boolean;
  medical_aid_pricing: Record<string, number>;
}

const TariffManagement: React.FC = () => {
  const { user, selectedPracticeId } = useAuthStore();
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);
  const [formData, setFormData] = useState<TariffFormData>({
    service_name: '',
    service_code: '',
    category: 'Consultation',
    description: '',
    base_price: 0,
    is_active: true,
    medical_aid_pricing: {}
  });

  const practiceId = selectedPracticeId || user?.practice_id;

  const categories = [
    'Consultation',
    'Laboratory',
    'Radiology',
    'Procedure',
    'Medication',
    'Other'
  ];

  const medicalAids = [
    { name: 'PSEMAS', key: 'psemas' },
    { name: 'NMC', key: 'nmc' },
    { name: 'Old Mutual', key: 'old_mutual' },
    { name: 'Bonitas', key: 'bonitas' },
    { name: 'Discovery', key: 'discovery' }
  ];

  useEffect(() => {
    if (practiceId) {
      fetchTariffs();
    } else {
      // No practice selected: show the empty table instead of an endless spinner
      setLoading(false);
    }
  }, [practiceId]);

  const fetchTariffs = async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const { data, error } = await supabase
        .from('practice_tariffs')
        .select('*')
        .eq('practice_id', practiceId)
        .order('category', { ascending: true })
        .order('service_name', { ascending: true });

      if (error) throw error;
      setTariffs(data || []);
    } catch (error) {
      console.error('Error fetching tariffs:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTariff = async () => {
    // The fields are marked * but are not inside a <form>, so `required` alone checks nothing
    if (!formData.service_name.trim() || !formData.service_code.trim()) {
      toast.error('Enter a service name and a service code.');
      return;
    }

    try {
      if (editingTariff) {
        // Update existing tariff
        const { error } = await supabase
          .from('practice_tariffs')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingTariff.id);

        if (error) throw error;
      } else {
        // Create new tariff
        const { error } = await supabase
          .from('practice_tariffs')
          .insert({
            ...formData,
            practice_id: practiceId
          });

        if (error) throw error;
      }

      await fetchTariffs();
      toast.success(editingTariff ? 'Tariff updated' : 'Tariff created');
      handleCloseModal();
    } catch (error) {
      console.error('Error saving tariff:', error);
      toast.error('The tariff could not be saved. Please try again.');
    }
  };

  const handleDeleteTariff = async (tariffId: string) => {
    if (!confirm('Delete this tariff? This cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('practice_tariffs')
        .delete()
        .eq('id', tariffId);

      if (error) throw error;
      await fetchTariffs();
      toast.success('Tariff deleted');
    } catch (error) {
      console.error('Error deleting tariff:', error);
      toast.error('The tariff could not be deleted. Please try again.');
    }
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setEditingTariff(null);
    setFormData({
      service_name: '',
      service_code: '',
      category: 'Consultation',
      description: '',
      base_price: 0,
      is_active: true,
      medical_aid_pricing: {}
    });
  };

  const handleEditTariff = (tariff: Tariff) => {
    setEditingTariff(tariff);
    setFormData({
      service_name: tariff.service_name,
      service_code: tariff.service_code,
      category: tariff.category,
      description: tariff.description,
      base_price: tariff.base_price,
      is_active: tariff.is_active,
      medical_aid_pricing: tariff.medical_aid_pricing || {}
    });
    setShowCreateModal(true);
  };

  const filteredTariffs = tariffs.filter(tariff => {
    // Guard nulls: description (and possibly name/code) can be empty in the database
    const matchesSearch = (tariff.service_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (tariff.service_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (tariff.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || tariff.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleMedicalAidPriceChange = (medicalAidKey: string, price: number) => {
    setFormData(prev => ({
      ...prev,
      medical_aid_pricing: {
        ...prev.medical_aid_pricing,
        [medicalAidKey]: price
      }
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Tariff Management</h1>
              <p className="text-gray-600 mt-1">Manage service pricing and medical aid tariffs</p>
            </div>
            <Button 
              onClick={() => setShowCreateModal(true)}
              className="bg-[#01b9d4] hover:bg-[#0196be] text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Tariff
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <Card className="p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search tariffs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d4] focus:border-transparent"
                />
              </div>
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d4] focus:border-transparent"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </Card>

        {/* Tariffs Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Service
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Base Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#01b9d4] mx-auto"></div>
                    </td>
                  </tr>
                ) : filteredTariffs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      {loadError ? 'Tariffs could not be loaded. Please refresh the page.' : 'No tariffs found'}
                    </td>
                  </tr>
                ) : (
                  filteredTariffs.map((tariff) => (
                    <tr key={tariff.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{tariff.service_name}</div>
                          <div className="text-sm text-gray-500">{tariff.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {tariff.service_code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge className="bg-blue-100 text-blue-800">
                          {tariff.category}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {tariff.base_price == null ? '-' : formatNad(Number(tariff.base_price) || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge className={tariff.is_active ? 
                          'bg-green-100 text-green-800' : 
                          'bg-gray-100 text-gray-800'
                        }>
                          {tariff.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleEditTariff(tariff)}
                            className="text-[#01b9d4] hover:text-[#0196be]"
                            aria-label={`Edit ${tariff.service_name || 'tariff'}`}
                            title="Edit tariff"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTariff(tariff.id)}
                            className="text-red-600 hover:text-red-900"
                            aria-label={`Delete ${tariff.service_name || 'tariff'}`}
                            title="Delete tariff"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {editingTariff ? 'Edit Tariff' : 'Create New Tariff'}
              </h2>
              <button onClick={handleCloseModal} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Close" title="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Service Name *
                    </label>
                    <input
                      type="text"
                      value={formData.service_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, service_name: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d4] focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Service Code *
                    </label>
                    <input
                      type="text"
                      value={formData.service_code}
                      onChange={(e) => setFormData(prev => ({ ...prev, service_code: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d4] focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category *
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d4] focus:border-transparent"
                    >
                      {categories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Base Price (NAD) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.base_price}
                      onChange={(e) => setFormData(prev => ({ ...prev, base_price: parseFloat(e.target.value) || 0 }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d4] focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d4] focus:border-transparent"
                  />
                </div>

                {/* Medical Aid Pricing */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Medical Aid Pricing</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {medicalAids.map(aid => (
                      <div key={aid.key}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {aid.name} (NAD)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.medical_aid_pricing[aid.key] || ''}
                          onChange={(e) => handleMedicalAidPriceChange(aid.key, parseFloat(e.target.value) || 0)}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d4] focus:border-transparent"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="h-4 w-4 text-[#01b9d4] focus:ring-[#01b9d4] border-gray-300 rounded"
                  />
                  <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                    Active tariff
                  </label>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <Button variant="outline" onClick={handleCloseModal}>
                Cancel
              </Button>
              <Button 
                onClick={handleSaveTariff}
                className="bg-[#01b9d4] hover:bg-[#0196be] text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingTariff ? 'Update' : 'Create'} Tariff
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TariffManagement;