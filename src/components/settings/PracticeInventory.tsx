import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import { usePractice } from '../../contexts/PracticeContext';
import Button from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { useAuthStore } from '../../stores/authStore';
import { toast } from 'react-hot-toast';
import { formatNad } from '../../utils/billing/money';

interface InventoryItem {
  id: string;
  practice_id: string;
  name: string;
  description?: string;
  category: 'disposables' | 'medications' | 'office_supplies' | 'equipment' | 'other';
  sku?: string;
  quantity: number;
  unit: string;
  reorder_level?: number;
  unit_cost: number;
  total_value: number;
  supplier?: string;
  location?: string;
  assignee_id?: string;
  assignee?: {
    id: string;
    full_name: string;
    email: string;
  };
  expiry_date?: string;
  last_updated: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface InventoryCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  description: string;
}

const categories: InventoryCategory[] = [
  { 
    id: 'disposables', 
    label: 'Disposables', 
    icon: 'solar:virus-bold-duotone',
    color: 'bg-blue-500',
    description: 'Single-use medical supplies'
  },
  { 
    id: 'medications', 
    label: 'Medications', 
    icon: 'solar:pill-bold-duotone',
    color: 'bg-green-500',
    description: 'Pharmaceutical products'
  },
  { 
    id: 'office_supplies', 
    label: 'Office Supplies', 
    icon: 'solar:document-text-bold-duotone',
    color: 'bg-purple-500',
    description: 'Administrative materials'
  },
  { 
    id: 'equipment', 
    label: 'Equipment', 
    icon: 'solar:monitor-bold-duotone',
    color: 'bg-orange-500',
    description: 'Medical and office equipment'
  },
  { 
    id: 'other', 
    label: 'Other', 
    icon: 'solar:box-bold-duotone',
    color: 'bg-gray-500',
    description: 'Miscellaneous items'
  }
];

// formatNad throws on NaN; show a dash instead of blanking the screen if a value is missing
const formatMoney = (amount: number | null | undefined): string =>
  typeof amount === 'number' && Number.isFinite(amount) ? formatNad(amount) : '-';

const PracticeInventory: React.FC = () => {
  const { practiceId } = usePractice();
  const { user } = useAuthStore();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  interface User {
    id: string;
    full_name: string;
    email: string;
  }
  const [users, setUsers] = useState<User[]>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'disposables' as const,
    sku: '',
    quantity: 0,
    unit: 'pcs',
    reorder_level: 0,
    unit_cost: 0,
    supplier: '',
    location: '',
    assignee_id: '',
    expiry_date: '',
    notes: ''
  });

  useEffect(() => {
    const loadData = async () => {
      if (practiceId && user) {
        await fetchInventory();
        await fetchUsers();
      }
    };
    loadData();
  }, [practiceId, user]);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('practice_inventory')
        .select(`
          *,
          assignee:users!practice_inventory_assignee_id_fkey (
            id,
            full_name,
            email
          )
        `)
        .eq('practice_id', practiceId)
        .order('name');

      if (error) throw error;
      setInventory(data || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!practiceId) return;
    try {
      // Fetch users directly by practice_id or through user_practice_assignments
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('practice_id', practiceId)
        .order('full_name');

      if (userError) throw userError;

      // Also include users assigned through user_practice_assignments. Its user_id has no foreign
      // key to users that the API can embed (the old embed failed and left the Assignee list
      // empty), so look the ids up first and then load those users.
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('user_practice_assignments')
        .select('user_id')
        .eq('practice_id', practiceId)
        .eq('is_active', true);

      if (assignmentError) throw assignmentError;

      const directUsers: User[] = userData || [];
      const directIds = new Set(directUsers.map(u => u.id));
      const assignedIds = Array.from(new Set(
        (assignmentData || [])
          .map(a => a.user_id)
          .filter((id): id is string => !!id && !directIds.has(id))
      ));

      let assignedUsers: User[] = [];
      if (assignedIds.length > 0) {
        const { data: assignedData, error: assignedError } = await supabase
          .from('users')
          .select('id, full_name, email')
          .in('id', assignedIds);

        if (assignedError) throw assignedError;
        assignedUsers = assignedData || [];
      }

      const allUsers = [...directUsers, ...assignedUsers]
        .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

      setUsers(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Could not load staff for the Assignee list');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!practiceId) {
      toast.error('No practice ID found. Please refresh and try again.');
      return;
    }

    try {
      const itemData = {
        practice_id: practiceId,
        name: formData.name,
        category: formData.category,
        quantity: formData.quantity,
        unit: formData.unit,
        unit_cost: formData.unit_cost,
        // Convert empty strings to null for nullable fields
        description: formData.description || null,
        sku: formData.sku || null,
        reorder_level: formData.reorder_level || null,
        supplier: formData.supplier || null,
        location: formData.location || null,
        assignee_id: formData.assignee_id || null,
        expiry_date: formData.expiry_date || null,
        notes: formData.notes || null,
        total_value: formData.quantity * formData.unit_cost,
        last_updated: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (editingItem) {
        const { error } = await supabase
          .from('practice_inventory')
          .update(itemData)
          .eq('id', editingItem.id);

        if (error) throw error;
        toast.success('Inventory item updated successfully');
      } else {
        const { error } = await supabase
          .from('practice_inventory')
          .insert({
            ...itemData,
            created_at: new Date().toISOString()
          });

        if (error) throw error;
        toast.success('Inventory item added successfully');
      }

      fetchInventory();
      resetForm();
    } catch (error: any) {
      console.error('Error saving inventory item:', error);
      if (error.code === '42501') {
        toast.error('You do not have permission to manage inventory for this practice. Please contact your administrator.');
      } else if (error.code === '22P02') {
        toast.error('Invalid data format. Please check your inputs.');
      } else {
        toast.error('Failed to save inventory item');
      }
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}" from the inventory? This cannot be undone.`)) return;

    try {
      const { error } = await supabase
        .from('practice_inventory')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Inventory item deleted successfully');
      fetchInventory();
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      toast.error('Failed to delete inventory item');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'disposables',
      sku: '',
      quantity: 0,
      unit: 'pcs',
      reorder_level: 0,
      unit_cost: 0,
      supplier: '',
      location: '',
      assignee_id: '',
      expiry_date: '',
      notes: ''
    });
    setEditingItem(null);
    setShowAddModal(false);
  };

  const filteredInventory = inventory.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const totalValue = filteredInventory.reduce((sum, item) => sum + item.total_value, 0);
  const lowStockItems = filteredInventory.filter(item => 
    item.reorder_level && item.quantity <= item.reorder_level
  );

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Items</p>
                <p className="text-2xl font-bold text-blue-900">{filteredInventory.length}</p>
              </div>
              <Icon icon="solar:box-bold-duotone" className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Total Value</p>
                <p className="text-2xl font-bold text-green-900">{formatMoney(totalValue)}</p>
              </div>
              <Icon icon="solar:wallet-bold-duotone" className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Low Stock</p>
                <p className="text-2xl font-bold text-orange-900">{lowStockItems.length}</p>
              </div>
              <Icon icon="solar:danger-triangle-bold-duotone" className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Categories</p>
                <p className="text-2xl font-bold text-purple-900">{categories.length}</p>
              </div>
              <Icon icon="solar:folder-bold-duotone" className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Icon 
              icon="solar:magnifer-bold-duotone" 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search inventory..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.label}</option>
            ))}
          </select>

          <Button onClick={() => setShowAddModal(true)}>
            <Icon icon="solar:add-circle-bold-duotone" className="w-5 h-5 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Inventory Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assignee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      Loading inventory...
                    </td>
                  </tr>
                ) : filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      {inventory.length === 0
                        ? "No inventory items yet. Use 'Add Item' to add one."
                        : 'No items match your search or category.'}
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map((item) => {
                    const category = categories.find(c => c.id === item.category);
                    // Boolean, so a reorder level of 0 never renders a stray "0" in the stock cell
                    const isLowStock = !!item.reorder_level && item.quantity <= item.reorder_level;
                    
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{item.name}</p>
                            {item.sku && (
                              <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                            )}
                            {item.description && (
                              <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg ${category?.color || 'bg-gray-500'} bg-opacity-20 flex items-center justify-center`}>
                              <Icon icon={category?.icon || 'solar:box-bold-duotone'} className={`w-5 h-5 ${category?.color || 'bg-gray-500'} text-opacity-100`} />
                            </div>
                            <span className="text-sm text-gray-900">{category?.label}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className={`text-sm font-medium ${isLowStock ? 'text-orange-600' : 'text-gray-900'}`}>
                              {item.quantity} {item.unit}
                            </p>
                            {!!item.reorder_level && (
                              <p className="text-xs text-gray-500">
                                Reorder: {item.reorder_level} {item.unit}
                              </p>
                            )}
                            {isLowStock && (
                              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                <Icon icon="solar:danger-triangle-bold" className="w-3 h-3" />
                                Low Stock
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {formatMoney(item.total_value)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatMoney(item.unit_cost)}/unit
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {item.assignee ? (
                            <div>
                              <p className="text-sm text-gray-900">{item.assignee.full_name}</p>
                              <p className="text-xs text-gray-500">{item.location}</p>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">Unassigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingItem(item);
                                setFormData({
                                  name: item.name,
                                  description: item.description || '',
                                  category: item.category,
                                  sku: item.sku || '',
                                  quantity: item.quantity,
                                  unit: item.unit,
                                  reorder_level: item.reorder_level || 0,
                                  unit_cost: item.unit_cost,
                                  supplier: item.supplier || '',
                                  location: item.location || '',
                                  assignee_id: item.assignee_id || '',
                                  expiry_date: item.expiry_date || '',
                                  notes: item.notes || ''
                                });
                                setShowAddModal(true);
                              }}
                              aria-label={`Edit ${item.name}`}
                              title="Edit item"
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Icon icon="solar:pen-bold-duotone" className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id, item.name)}
                              aria-label={`Delete ${item.name}`}
                              title="Delete item"
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Icon icon="solar:trash-bin-trash-bold-duotone" className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                {editingItem ? 'Edit Inventory Item' : 'Add Inventory Item'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Item Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category *
                    </label>
                    <select
                      required
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as InventoryItem['category'] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product code (SKU)
                    </label>
                    <input
                      type="text"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      placeholder="e.g., pcs, boxes, bottles"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reorder Level
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.reorder_level}
                      onChange={(e) => setFormData({ ...formData, reorder_level: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit Cost (N$) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={formData.unit_cost}
                      onChange={(e) => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Supplier
                    </label>
                    <input
                      type="text"
                      value={formData.supplier}
                      onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="e.g., Store Room A, Shelf 3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Assignee
                    </label>
                    <select
                      value={formData.assignee_id}
                      onChange={(e) => setFormData({ ...formData, assignee_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">Unassigned</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{user.full_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expiry Date
                    </label>
                    <input
                      type="date"
                      value={formData.expiry_date}
                      onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      rows={2}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      rows={2}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingItem ? 'Update Item' : 'Add Item'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PracticeInventory;