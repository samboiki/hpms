import React, { useState } from 'react';
import { MoreVertical, Edit, Trash2, Eye, Users, Calendar, TrendingUp, Settings } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface Practice {
  id: string;
  slug: string;
  name: string;
  domain: string;
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  subscription_tier: 'trial' | 'standard' | 'premium' | 'enterprise';
  contact_email: string;
  contact_phone: string;
  city: string;
  admin_name?: string;
  admin_email?: string;
  total_users: number;
  total_patients: number;
  appointments_last_30_days: number;
  appointments_this_month: number;
  created_at: string;
}

interface PracticeCardProps {
  practice: Practice;
  onEdit: (practice: Practice) => void;
  onDelete: (practice: Practice) => void;
  onView: (practice: Practice) => void;
}

const PracticeCard: React.FC<PracticeCardProps> = ({
  practice,
  onEdit,
  onDelete,
  onView
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-800 border-green-200',
      inactive: 'bg-gray-100 text-gray-800 border-gray-200',
      suspended: 'bg-red-100 text-red-800 border-red-200',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    };
    return colors[status as keyof typeof colors] || colors.inactive;
  };

  const getTierColor = (tier: string) => {
    const colors = {
      trial: 'bg-blue-100 text-blue-800 border-blue-200',
      standard: 'bg-purple-100 text-purple-800 border-purple-200',
      premium: 'bg-amber-100 text-amber-800 border-amber-200',
      enterprise: 'bg-emerald-100 text-emerald-800 border-emerald-200'
    };
    return colors[tier as keyof typeof colors] || colors.standard;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Card className="p-6 hover:shadow-lg transition-all duration-200 border border-gray-200 relative">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 hover:text-[#01b9d4] cursor-pointer"
              onClick={() => onView(practice)}>
            {practice.name}
          </h3>
          <p className="text-sm text-gray-600 mb-2">{practice.city}</p>
          <div className="flex flex-wrap gap-2">
            <Badge className={`text-xs ${getStatusColor(practice.status)}`}>
              {practice.status.charAt(0).toUpperCase() + practice.status.slice(1)}
            </Badge>
            <Badge className={`text-xs ${getTierColor(practice.subscription_tier)}`}>
              {practice.subscription_tier.charAt(0).toUpperCase() + practice.subscription_tier.slice(1)}
            </Badge>
          </div>
        </div>
        
        {/* Menu Button */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 top-10 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10">
              <button
                onClick={() => {
                  onView(practice);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Details
              </button>
              <button
                onClick={() => {
                  onEdit(practice);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Practice
              </button>
              <button
                onClick={() => {
                  onDelete(practice);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Practice
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Contact Info */}
      <div className="space-y-1 mb-4 text-sm">
        <p className="text-gray-600">
          <span className="font-medium">Email:</span> {practice.contact_email}
        </p>
        <p className="text-gray-600">
          <span className="font-medium">Phone:</span> {practice.contact_phone}
        </p>
        {practice.domain && (
          <p className="text-gray-600">
            <span className="font-medium">Domain:</span> 
            <a href={`https://${practice.domain}`} target="_blank" rel="noopener noreferrer" 
               className="text-[#01b9d4] hover:underline ml-1">
              {practice.domain}
            </a>
          </p>
        )}
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-center mb-1">
            <Users className="w-4 h-4 text-gray-600 mr-1" />
            <span className="text-xs text-gray-600">Users</span>
          </div>
          <p className="text-lg font-semibold text-gray-900">{practice.total_users}</p>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-center mb-1">
            <Users className="w-4 h-4 text-gray-600 mr-1" />
            <span className="text-xs text-gray-600">Patients</span>
          </div>
          <p className="text-lg font-semibold text-gray-900">{practice.total_patients}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-center mb-1">
            <Calendar className="w-4 h-4 text-blue-600 mr-1" />
            <span className="text-xs text-blue-600">This Month</span>
          </div>
          <p className="text-lg font-semibold text-blue-700">{practice.appointments_this_month}</p>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="flex items-center justify-center mb-1">
            <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
            <span className="text-xs text-green-600">Last 30 Days</span>
          </div>
          <p className="text-lg font-semibold text-green-700">{practice.appointments_last_30_days}</p>
        </div>
      </div>

      {/* Admin Info */}
      <div className="border-t pt-4">
        <div className="flex justify-between items-center">
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-1">Practice Administrator</p>
            {practice.admin_name ? (
              <div>
                <p className="text-sm font-medium text-gray-900">{practice.admin_name}</p>
                <p className="text-xs text-gray-600">{practice.admin_email}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No admin assigned</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Created</p>
            <p className="text-sm text-gray-900">{formatDate(practice.created_at)}</p>
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex gap-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onView(practice)}
          className="flex-1 text-xs"
        >
          <Eye className="w-3 h-3 mr-1" />
          View
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(practice)}
          className="flex-1 text-xs"
        >
          <Settings className="w-3 h-3 mr-1" />
          Manage
        </Button>
      </div>

      {/* Overlay to close menu */}
      {showMenu && (
        <div
          className="fixed inset-0 z-5"
          onClick={() => setShowMenu(false)}
        />
      )}
    </Card>
  );
};

export default PracticeCard;