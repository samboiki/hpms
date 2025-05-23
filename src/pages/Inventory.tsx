import React, { useState } from 'react';
import { 
  Package2, 
  Plus, 
  Search, 
  Filter,
  ArrowUpDown,
  AlertCircle,
  Loader2,
  Box,
  PackageCheck,
  PackageX,
  AlertTriangle,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import FormModal from '../components/modals/FormModal';
import { motion } from 'framer-motion';

const Inventory: React.FC = () => {
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'stock'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Mock inventory data
  const inventoryItems = [
    {
      id: '1',
      name: 'Surgical Gloves',
      category: 'Medical Supplies',
      currentStock: 500,
      minimumStock: 100,
      unit: 'pairs',
      supplier: 'MedSupply Co',
      lastRestocked: '2024-03-10',
      expiryDate: '2025-03-10',
      status: 'in-stock'
    },
    {
      id: '2',
      name: 'Paracetamol 500mg',
      category: 'Medication',
      currentStock: 200,
      minimumStock: 50,
      unit: 'tablets',
      supplier: 'PharmaCorp',
      lastRestocked: '2024-03-01',
      expiryDate: '2025-06-15',
      status: 'low-stock'
    },
    // Add more mock items as needed
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center mb-6">
        <Package2 size={28} className="text-primary-600 mr-3" />
        <div>
          <h1 className="text-[30px] font-bold text-[#494c61]">Inventory Management</h1>
          <p className="text-gray-600">Track and manage medical supplies and equipment</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                <Box size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Items</p>
                <h3 className="text-2xl font-bold text-gray-900">1,234</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 text-green-600">
                <PackageCheck size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">In Stock</p>
                <h3 className="text-2xl font-bold text-gray-900">987</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-amber-100 text-amber-600">
                <AlertTriangle size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Low Stock</p>
                <h3 className="text-2xl font-bold text-gray-900">45</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-red-100 text-red-600">
                <PackageX size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Out of Stock</p>
                <h3 className="text-2xl font-bold text-gray-900">12</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search inventory items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:ring-brand-primary focus:border-brand-primary"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-4 py-2 rounded-md border border-gray-300 focus:ring-brand-primary focus:border-brand-primary"
              >
                <option value="all">All Categories</option>
                <option value="medical-supplies">Medical Supplies</option>
                <option value="medication">Medication</option>
                <option value="equipment">Equipment</option>
              </select>
              <Button variant="outline">
                <Filter size={16} className="mr-2" />
                Filter
              </Button>
              <Button onClick={() => setIsAddItemModalOpen(true)}>
                <Plus size={16} className="mr-2" />
                Add Item
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventory List */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Inventory Items</CardTitle>
            <Button variant="outline" size="sm">
              <BarChart3 size={16} className="mr-2" />
              Generate Report
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs uppercase text-gray-500 border-b border-gray-200">
                  <th className="px-6 py-3 text-left">Item Name</th>
                  <th className="px-6 py-3 text-left">Category</th>
                  <th className="px-6 py-3 text-left">Current Stock</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-left">Last Restocked</th>
                  <th className="px-6 py-3 text-left">Expiry Date</th>
                  <th className="px-6 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {inventoryItems.map((item) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">{item.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-600">{item.category}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium">{item.currentStock} {item.unit}</span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={
                          item.status === 'in-stock' ? 'success' :
                          item.status === 'low-stock' ? 'warning' :
                          'error'
                        }
                        size="sm"
                      >
                        {item.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-600">{item.lastRestocked}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-600">{item.expiryDate}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm">
                          Restock
                        </Button>
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Item Modal */}
      <FormModal
        isOpen={isAddItemModalOpen}
        onClose={() => setIsAddItemModalOpen(false)}
        title="Add Inventory Item"
      >
        {/* Add your form components here */}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Item Name</label>
            <input
              type="text"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
          </div>
          {/* Add more form fields */}
        </div>
      </FormModal>
    </div>
  );
};

export default Inventory;