import React from 'react';
import { Package2 } from 'lucide-react';
import PracticeInventory from '../components/settings/PracticeInventory';

// The database-backed inventory (add, edit, delete, stock levels) is PracticeInventory, shown in
// Settings > Practice > Inventory. This page reuses it instead of hard-coded sample stock.
const Inventory: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="animate-fade-in space-y-6">
      <div className="flex items-center mb-6">
        <Package2 size={28} className="text-primary-600 mr-3" />
        <div>
          <h1 className="text-[30px] font-bold text-[#494c61]">Inventory Management</h1>
          <p className="text-gray-600">Track and manage medical supplies and equipment</p>
        </div>
      </div>

      <PracticeInventory />
      </div>
    </div>
  );
};

export default Inventory;