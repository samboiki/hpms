/**
 * PSEMAS FORM INTEGRATION EXAMPLE
 *
 * This file shows how to integrate the PSEMAS form printable component
 * with your visit workflow in the Dashboard or Visit Grid components.
 */

import React, { useState } from 'react';
import VisitActionModal from '../modals/VisitActionModal';
import PsemasFormPrintable from '../forms/PsemasFormPrintable';
import { supabase } from '../../lib/supabase';

// Example component showing PSEMAS form integration
export const VisitWithPsemasExample = () => {
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isPsemasFormOpen, setIsPsemasFormOpen] = useState(false);
  const [psemasFormData, setPsemasFormData] = useState<any>(null);

  /**
   * Fetch complete visit data including medical aid details
   * This is called when user wants to print the PSEMAS form
   */
  const fetchCompleteVisitData = async (visitId: string) => {
    try {
      // Fetch visit with patient, practice, doctor, and medical aid details
      const { data: visit, error } = await supabase
        .from('visits')
        .select(`
          id,
          visit_date,
          patient:patients (
            id,
            first_name,
            last_name,
            date_of_birth,
            medical_aid_details:medical_aid_details (
              id,
              membership_number,
              main_member_name,
              main_member_id_number,
              provider,
              medical_aid_provider_id
            )
          ),
          practice:practices (
            name,
            contact_phone,
            contact_email,
            address,
            city,
            postal_code,
            practice_number,
            logo_url
          ),
          doctor:users!doctor_id (
            full_name
          )
        `)
        .eq('id', visitId)
        .single();

      if (error) throw error;

      return visit;
    } catch (error) {
      console.error('Error fetching visit data:', error);
      return null;
    }
  };

  /**
   * Handle printing PSEMAS form
   * This is called when the user clicks "Print PSEMAS Form" button
   */
  const handlePrintPsemasForm = async () => {
    if (!selectedVisit) return;

    // Fetch complete visit data
    const completeVisitData = await fetchCompleteVisitData(selectedVisit.id);

    if (completeVisitData) {
      // Find the PSEMAS medical aid record
      const psemasRecord = completeVisitData.patient.medical_aid_details?.find(
        (aid: any) => aid.medical_aid_provider_id === '2d172f06-a899-48f9-88d0-1d10792fdea4'
      );

      if (psemasRecord) {
        // Prepare data for PSEMAS form
        const formData = {
          id: completeVisitData.id,
          visit_date: completeVisitData.visit_date,
          patient: {
            id: completeVisitData.patient.id,
            first_name: completeVisitData.patient.first_name,
            last_name: completeVisitData.patient.last_name,
            date_of_birth: completeVisitData.patient.date_of_birth
          },
          medical_aid_details: psemasRecord,
          practice: completeVisitData.practice,
          doctor: completeVisitData.doctor
        };

        setPsemasFormData(formData);
        setIsPsemasFormOpen(true);
        setIsActionModalOpen(false);
      }
    }
  };

  /**
   * Example: Handle visit card click to open action modal
   */
  const handleVisitClick = (visit: any) => {
    setSelectedVisit(visit);
    setIsActionModalOpen(true);
  };

  return (
    <div>
      {/* Your visit cards or grid here */}
      {/* ... */}

      {/* Visit Action Modal with PSEMAS form support */}
      {selectedVisit && (
        <VisitActionModal
          isOpen={isActionModalOpen}
          onClose={() => setIsActionModalOpen(false)}
          visit={selectedVisit}
          visitStatus={selectedVisit.status}
          isCheckedIn={selectedVisit.is_checked_in}

          // Other callbacks...
          onStartVisit={() => {/* ... */}}
          onCompleteVisit={() => {/* ... */}}
          onViewDetails={() => {/* ... */}}
          onViewPatientProfile={() => {/* ... */}}
          onSendSMS={() => {/* ... */}}

          // PSEMAS form callback - IMPORTANT!
          onPrintPsemasForm={handlePrintPsemasForm}
        />
      )}

      {/* PSEMAS Form Printable Modal */}
      {psemasFormData && (
        <PsemasFormPrintable
          isOpen={isPsemasFormOpen}
          onClose={() => {
            setIsPsemasFormOpen(false);
            setPsemasFormData(null);
          }}
          visitData={psemasFormData}
        />
      )}
    </div>
  );
};

/**
 * IMPORTANT NOTES:
 *
 * 1. PSEMAS Medical Aid Provider ID: 2d172f06-a899-48f9-88d0-1d10792fdea4
 *
 * 2. The "Print PSEMAS Form" button only appears when:
 *    - Visit status is 'completed'
 *    - Patient has PSEMAS as their medical aid provider
 *    - The onPrintPsemasForm callback is provided
 *
 * 3. Required data structure for PSEMAS form:
 *    {
 *      id: string (visit ID)
 *      visit_date: string
 *      patient: {
 *        id: string
 *        first_name: string
 *        last_name: string
 *        date_of_birth: string
 *      }
 *      medical_aid_details: {
 *        membership_number: string
 *        main_member_name: string
 *        main_member_id_number: string
 *        provider: string
 *      }
 *      practice: {
 *        name: string
 *        contact_phone: string
 *        contact_email: string
 *        address: string
 *        city: string
 *        postal_code: string
 *        practice_number: string
 *        logo_url?: string
 *      }
 *      doctor: {
 *        full_name: string
 *      }
 *    }
 *
 * 4. The form can be:
 *    - Printed directly using the browser print dialog
 *    - Downloaded as a PDF file
 *
 * 5. Database Query Example:
 *    See the fetchCompleteVisitData() function above for the exact
 *    Supabase query needed to get all required data.
 */

export default VisitWithPsemasExample;
