import React from 'react';
import { format } from 'date-fns';
import { Microscope, ImageIcon } from 'lucide-react';
import { Badge } from '../ui/Badge';

interface VisitCardProps {
  visit: {
    pendingLabRequests?: Array<{
      id: string;
      test_name: string;
      priority: 'stat' | 'urgent' | 'routine';
      expected_completion_date: string;
    }>;
    pendingMediaRequests?: Array<{
      id: string;
      type: string;
      body_part: string;
      priority: 'stat' | 'urgent' | 'routine';
      expected_completion_date: string;
    }>;
  };
}

const VisitCard: React.FC<VisitCardProps> = ({ visit }) => {
  return (
    <>
      {/* Pending Requests */}
      {(visit.pendingLabRequests?.length > 0 || visit.pendingMediaRequests?.length > 0) && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pending Requests</h3>
          <div className="space-y-3">
            {visit.pendingLabRequests?.map((request) => (
              <div key={request.id} className="bg-amber-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Microscope size={16} className="text-amber-600 mr-2" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{request.test_name}</p>
                      <p className="text-xs text-gray-500">Lab Test</p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      request.priority === 'stat' ? 'error' :
                      request.priority === 'urgent' ? 'warning' :
                      'success'
                    }
                    size="sm"
                  >
                    {request.priority}
                  </Badge>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Expected: {format(new Date(request.expected_completion_date), 'MMM d, yyyy')}
                </div>
              </div>
            ))}

            {visit.pendingMediaRequests?.map((request) => (
              <div key={request.id} className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <ImageIcon size={16} className="text-purple-600 mr-2" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {request.type.toUpperCase()} - {request.body_part}
                      </p>
                      <p className="text-xs text-gray-500">Imaging</p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      request.priority === 'stat' ? 'error' :
                      request.priority === 'urgent' ? 'warning' :
                      'success'
                    }
                    size="sm"
                  >
                    {request.priority}
                  </Badge>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Expected: {format(new Date(request.expected_completion_date), 'MMM d, yyyy')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default VisitCard;