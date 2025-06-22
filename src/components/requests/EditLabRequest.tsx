import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, Building2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface EditLabRequestProps {
  request: {
    id: string;
    request_date: string;
    preferred_date: string | null;
    lab_facility: string | null;
    notes: string | null;
    status: 'pending' | 'completed' | 'cancelled';
  };
  onClose: () => void;
  onRequestUpdated: () => void;
}

export default function EditLabRequest({ 
  request, 
  onClose, 
  onRequestUpdated 
}: EditLabRequestProps) {
  const [requestDate, setRequestDate] = useState(format(new Date(request.request_date), 'yyyy-MM-dd'));
  const [preferredDate, setPreferredDate] = useState(request.preferred_date ? format(new Date(request.preferred_date), 'yyyy-MM-dd') : '');
  const [labFacility, setLabFacility] = useState(request.lab_facility || '');
  const [notes, setNotes] = useState(request.notes || '');
  const [status, setStatus] = useState(request.status);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('lab_requests')
        .update({
          request_date: requestDate,
          preferred_date: preferredDate || null,
          lab_facility: labFacility || null,
          notes: notes || null,
          status: status
        })
        .eq('id', request.id);

      if (error) throw error;
      
      onRequestUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating lab request:', error);
      alert('Failed to update lab request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
          }
        }}>
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900">Edit Lab Request</h2>
          <p className="text-gray-600 mt-1">Update lab request details</p>
        </div>

        <div className="p-6 space-y-4">
          {/* Request Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Request Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={requestDate}
              onChange={(e) => setRequestDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          {/* Preferred Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Expected Results Date
            </label>
            <input
              type="date"
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
              min={requestDate}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          {/* Lab Facility */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Building2 className="w-4 h-4 inline mr-1" />
              Laboratory
            </label>
            <input
              type="text"
              value={labFacility}
              onChange={(e) => setLabFacility(e.target.value)}
              placeholder="e.g., PathCare, Lancet Lab"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'pending' | 'completed' | 'cancelled')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any special instructions or notes"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <span>Update Request</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}