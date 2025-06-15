export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          admin_user_id: string | null
          created_at: string | null
          id: string
          ip_address: unknown | null
          new_values: Json | null
          old_values: Json | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_system_role: boolean | null
          name: string
          permissions: Json
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system_role?: boolean | null
          name: string
          permissions?: Json
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system_role?: boolean | null
          name?: string
          permissions?: Json
        }
        Relationships: []
      }
      admin_sessions: {
        Row: {
          admin_user_id: string | null
          created_at: string | null
          expires_at: string
          id: string
          ip_address: unknown | null
          session_token: string
          user_agent: string | null
        }
        Insert: {
          admin_user_id?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          ip_address?: unknown | null
          session_token: string
          user_agent?: string | null
        }
        Update: {
          admin_user_id?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: unknown | null
          session_token?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_sessions_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          is_super_admin: boolean | null
          last_login_at: string | null
          password_hash: string
          role_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          is_super_admin?: boolean | null
          last_login_at?: string | null
          password_hash: string
          role_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          is_super_admin?: boolean | null
          last_login_at?: string | null
          password_hash?: string
          role_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "admin_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          created_at: string | null
          date: string
          doctor_id: string | null
          duration: number
          id: string
          notes: string | null
          patient_id: string | null
          practice_id: string | null
          status: string
          time: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          doctor_id?: string | null
          duration?: number
          id?: string
          notes?: string | null
          patient_id?: string | null
          practice_id?: string | null
          status: string
          time: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          doctor_id?: string | null
          duration?: number
          id?: string
          notes?: string | null
          patient_id?: string | null
          practice_id?: string | null
          status?: string
          time?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "visit_timeline_view"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "appointments_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          description: string | null
          id: string
          ip_address: unknown | null
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          description?: string | null
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string | null
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      batch_details: {
        Row: {
          authorisation_number: string | null
          batch_header_id: string | null
          bhf_tariff_code: string
          cpt_cdt_code: string | null
          created_at: string | null
          date_of_injury: string | null
          density_of_tint: string | null
          diagnosis: string | null
          diagnostic_code: string | null
          diagnostic_code_type: string | null
          discount_amount: number | null
          dosage_description: string | null
          employee_number: string | null
          employer_name: string | null
          free_text: string | null
          gender: string
          hospital_indicator: string | null
          id: string
          invoice_id: string | null
          invoice_number: string
          iod_reference_number: string | null
          lens_prescription: string | null
          medical_aid_membership_number: string | null
          medical_aid_reference: string
          member_initials: string | null
          member_surname: string | null
          modifier_1: string | null
          modifier_2: string | null
          modifier_3: string | null
          modifier_4: string | null
          nappi_code: string | null
          not_used_1: string | null
          not_used_2: string | null
          not_used_3: string | null
          number_of_services: number | null
          patient_date_of_birth: string | null
          patient_id: string | null
          patient_id_number: string
          patient_name: string | null
          place_of_service: string | null
          practice_number: string
          reading_additions: string | null
          referred_to_practice_number: string | null
          referring_doctor: string | null
          referring_doctor_2: string | null
          resubmission_flag: string | null
          service_amount: number
          service_date: string
          service_fee: number | null
          service_time: string | null
          system_patient_reference_number: string | null
          system_transaction_number: number | null
          tariff_code_type: string | null
          tooth_numbers: string | null
          tracking_number: string | null
          transaction_id: string | null
          transaction_number_in_batch: number
          treating_doctor_hpcsa_number: string | null
          type_of_service: string | null
          updated_at: string | null
          visit_id: string | null
          visit_service_id: string | null
        }
        Insert: {
          authorisation_number?: string | null
          batch_header_id?: string | null
          bhf_tariff_code: string
          cpt_cdt_code?: string | null
          created_at?: string | null
          date_of_injury?: string | null
          density_of_tint?: string | null
          diagnosis?: string | null
          diagnostic_code?: string | null
          diagnostic_code_type?: string | null
          discount_amount?: number | null
          dosage_description?: string | null
          employee_number?: string | null
          employer_name?: string | null
          free_text?: string | null
          gender: string
          hospital_indicator?: string | null
          id?: string
          invoice_id?: string | null
          invoice_number: string
          iod_reference_number?: string | null
          lens_prescription?: string | null
          medical_aid_membership_number?: string | null
          medical_aid_reference: string
          member_initials?: string | null
          member_surname?: string | null
          modifier_1?: string | null
          modifier_2?: string | null
          modifier_3?: string | null
          modifier_4?: string | null
          nappi_code?: string | null
          not_used_1?: string | null
          not_used_2?: string | null
          not_used_3?: string | null
          number_of_services?: number | null
          patient_date_of_birth?: string | null
          patient_id?: string | null
          patient_id_number: string
          patient_name?: string | null
          place_of_service?: string | null
          practice_number: string
          reading_additions?: string | null
          referred_to_practice_number?: string | null
          referring_doctor?: string | null
          referring_doctor_2?: string | null
          resubmission_flag?: string | null
          service_amount: number
          service_date: string
          service_fee?: number | null
          service_time?: string | null
          system_patient_reference_number?: string | null
          system_transaction_number?: number | null
          tariff_code_type?: string | null
          tooth_numbers?: string | null
          tracking_number?: string | null
          transaction_id?: string | null
          transaction_number_in_batch: number
          treating_doctor_hpcsa_number?: string | null
          type_of_service?: string | null
          updated_at?: string | null
          visit_id?: string | null
          visit_service_id?: string | null
        }
        Update: {
          authorisation_number?: string | null
          batch_header_id?: string | null
          bhf_tariff_code?: string
          cpt_cdt_code?: string | null
          created_at?: string | null
          date_of_injury?: string | null
          density_of_tint?: string | null
          diagnosis?: string | null
          diagnostic_code?: string | null
          diagnostic_code_type?: string | null
          discount_amount?: number | null
          dosage_description?: string | null
          employee_number?: string | null
          employer_name?: string | null
          free_text?: string | null
          gender?: string
          hospital_indicator?: string | null
          id?: string
          invoice_id?: string | null
          invoice_number?: string
          iod_reference_number?: string | null
          lens_prescription?: string | null
          medical_aid_membership_number?: string | null
          medical_aid_reference?: string
          member_initials?: string | null
          member_surname?: string | null
          modifier_1?: string | null
          modifier_2?: string | null
          modifier_3?: string | null
          modifier_4?: string | null
          nappi_code?: string | null
          not_used_1?: string | null
          not_used_2?: string | null
          not_used_3?: string | null
          number_of_services?: number | null
          patient_date_of_birth?: string | null
          patient_id?: string | null
          patient_id_number?: string
          patient_name?: string | null
          place_of_service?: string | null
          practice_number?: string
          reading_additions?: string | null
          referred_to_practice_number?: string | null
          referring_doctor?: string | null
          referring_doctor_2?: string | null
          resubmission_flag?: string | null
          service_amount?: number
          service_date?: string
          service_fee?: number | null
          service_time?: string | null
          system_patient_reference_number?: string | null
          system_transaction_number?: number | null
          tariff_code_type?: string | null
          tooth_numbers?: string | null
          tracking_number?: string | null
          transaction_id?: string | null
          transaction_number_in_batch?: number
          treating_doctor_hpcsa_number?: string | null
          type_of_service?: string | null
          updated_at?: string | null
          visit_id?: string | null
          visit_service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_details_batch_header_id_fkey"
            columns: ["batch_header_id"]
            isOneToOne: false
            referencedRelation: "batch_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_details_batch_header_id_fkey"
            columns: ["batch_header_id"]
            isOneToOne: false
            referencedRelation: "batch_management_view"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "batch_details_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_details_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_details_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_details_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit_timeline_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_details_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_headers: {
        Row: {
          batch_date: string
          batch_number: number
          confirmed_at: string | null
          created_at: string | null
          generated_file_content: string | null
          id: string
          medical_aid_reference: string
          practice_id: string | null
          practice_number: string
          recipient_email: string | null
          sent_at: string | null
          source_software: string | null
          source_software_version: string | null
          status: string | null
          system_identification: number | null
          total_amount: number | null
          total_invoices: number | null
          transaction_type: string | null
          updated_at: string | null
        }
        Insert: {
          batch_date: string
          batch_number: number
          confirmed_at?: string | null
          created_at?: string | null
          generated_file_content?: string | null
          id?: string
          medical_aid_reference: string
          practice_id?: string | null
          practice_number: string
          recipient_email?: string | null
          sent_at?: string | null
          source_software?: string | null
          source_software_version?: string | null
          status?: string | null
          system_identification?: number | null
          total_amount?: number | null
          total_invoices?: number | null
          transaction_type?: string | null
          updated_at?: string | null
        }
        Update: {
          batch_date?: string
          batch_number?: number
          confirmed_at?: string | null
          created_at?: string | null
          generated_file_content?: string | null
          id?: string
          medical_aid_reference?: string
          practice_id?: string | null
          practice_number?: string
          recipient_email?: string | null
          sent_at?: string | null
          source_software?: string | null
          source_software_version?: string | null
          status?: string | null
          system_identification?: number | null
          total_amount?: number | null
          total_invoices?: number | null
          transaction_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_headers_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_headers_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "batch_headers_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_headers_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
        ]
      }
      batch_submissions: {
        Row: {
          batch_header_id: string
          confirmed_at: string | null
          created_at: string | null
          delivered_at: string | null
          delivery_confirmation: Json | null
          email_id: string | null
          email_service: string | null
          email_subject: string | null
          error_details: Json | null
          file_content_compressed: string | null
          file_format: string
          file_name: string
          file_size: number
          id: string
          max_attempts: number | null
          medical_aid_reference: string | null
          practice_id: string | null
          provider_response: Json | null
          recipient_email: string
          sender_email: string | null
          sent_at: string | null
          status: string
          submission_attempt: number | null
          submitted_at: string
          submitted_by: string | null
          total_amount: number | null
          total_claims: number | null
          updated_at: string | null
        }
        Insert: {
          batch_header_id: string
          confirmed_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_confirmation?: Json | null
          email_id?: string | null
          email_service?: string | null
          email_subject?: string | null
          error_details?: Json | null
          file_content_compressed?: string | null
          file_format?: string
          file_name: string
          file_size: number
          id?: string
          max_attempts?: number | null
          medical_aid_reference?: string | null
          practice_id?: string | null
          provider_response?: Json | null
          recipient_email: string
          sender_email?: string | null
          sent_at?: string | null
          status?: string
          submission_attempt?: number | null
          submitted_at?: string
          submitted_by?: string | null
          total_amount?: number | null
          total_claims?: number | null
          updated_at?: string | null
        }
        Update: {
          batch_header_id?: string
          confirmed_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_confirmation?: Json | null
          email_id?: string | null
          email_service?: string | null
          email_subject?: string | null
          error_details?: Json | null
          file_content_compressed?: string | null
          file_format?: string
          file_name?: string
          file_size?: number
          id?: string
          max_attempts?: number | null
          medical_aid_reference?: string | null
          practice_id?: string | null
          provider_response?: Json | null
          recipient_email?: string
          sender_email?: string | null
          sent_at?: string | null
          status?: string
          submission_attempt?: number | null
          submitted_at?: string
          submitted_by?: string | null
          total_amount?: number | null
          total_claims?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_submissions_batch_header_id_fkey"
            columns: ["batch_header_id"]
            isOneToOne: false
            referencedRelation: "batch_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_submissions_batch_header_id_fkey"
            columns: ["batch_header_id"]
            isOneToOne: false
            referencedRelation: "batch_management_view"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      batch_trailer: {
        Row: {
          batch_header_id: string | null
          created_at: string | null
          id: string
          total_amount_detail_transactions: number
          total_detail_transactions: number
          trailer_identifier: string | null
        }
        Insert: {
          batch_header_id?: string | null
          created_at?: string | null
          id?: string
          total_amount_detail_transactions: number
          total_detail_transactions: number
          trailer_identifier?: string | null
        }
        Update: {
          batch_header_id?: string | null
          created_at?: string | null
          id?: string
          total_amount_detail_transactions?: number
          total_detail_transactions?: number
          trailer_identifier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_trailer_batch_header_id_fkey"
            columns: ["batch_header_id"]
            isOneToOne: true
            referencedRelation: "batch_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_trailer_batch_header_id_fkey"
            columns: ["batch_header_id"]
            isOneToOne: true
            referencedRelation: "batch_management_view"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      invoice_services: {
        Row: {
          code: string
          created_at: string | null
          description: string
          id: string
          invoice_id: string
          medical_aid_covered: number | null
          notes: string | null
          patient_portion: number
          quantity: number | null
          system_transaction_number: number
          tariff_id: string | null
          tooth_number: string | null
          total_price: number
          unit_price: number
        }
        Insert: {
          code: string
          created_at?: string | null
          description: string
          id?: string
          invoice_id: string
          medical_aid_covered?: number | null
          notes?: string | null
          patient_portion: number
          quantity?: number | null
          system_transaction_number: number
          tariff_id?: string | null
          tooth_number?: string | null
          total_price: number
          unit_price: number
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string
          id?: string
          invoice_id?: string
          medical_aid_covered?: number | null
          notes?: string | null
          patient_portion?: number
          quantity?: number | null
          system_transaction_number?: number
          tariff_id?: string | null
          tooth_number?: string | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_services_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices_enhanced"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices_enhanced: {
        Row: {
          batch_id: string | null
          created_at: string | null
          due_date: string
          id: string
          invoice_number: string
          issue_date: string | null
          medical_aid_claim_number: string | null
          medical_aid_status: string | null
          medical_aid_total: number | null
          notes: string | null
          patient_id: string
          patient_total: number | null
          payment_method: string | null
          payment_status: string | null
          practice_id: string | null
          practitioner_id: string | null
          subtotal: number | null
          tax: number | null
          total: number | null
          updated_at: string | null
          visit_id: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string | null
          due_date: string
          id?: string
          invoice_number: string
          issue_date?: string | null
          medical_aid_claim_number?: string | null
          medical_aid_status?: string | null
          medical_aid_total?: number | null
          notes?: string | null
          patient_id: string
          patient_total?: number | null
          payment_method?: string | null
          payment_status?: string | null
          practice_id?: string | null
          practitioner_id?: string | null
          subtotal?: number | null
          tax?: number | null
          total?: number | null
          updated_at?: string | null
          visit_id: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string | null
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string | null
          medical_aid_claim_number?: string | null
          medical_aid_status?: string | null
          medical_aid_total?: number | null
          notes?: string | null
          patient_id?: string
          patient_total?: number | null
          payment_method?: string | null
          payment_status?: string | null
          practice_id?: string | null
          practitioner_id?: string | null
          subtotal?: number | null
          tax?: number | null
          total?: number | null
          updated_at?: string | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_enhanced_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_enhanced_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_management_view"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "invoices_enhanced_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_enhanced_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "visit_timeline_view"
            referencedColumns: ["doctor_id"]
          },
        ]
      }
      lab_requests: {
        Row: {
          completed_at: string | null
          created_at: string | null
          expected_completion_date: string | null
          id: string
          lab_result_id: string | null
          notes: string | null
          notify_on_completion: boolean | null
          practice_id: string | null
          priority: string
          requested_at: string | null
          requesting_doctor_id: string | null
          status: string
          test_name: string
          updated_at: string | null
          visit_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          expected_completion_date?: string | null
          id?: string
          lab_result_id?: string | null
          notes?: string | null
          notify_on_completion?: boolean | null
          practice_id?: string | null
          priority: string
          requested_at?: string | null
          requesting_doctor_id?: string | null
          status: string
          test_name: string
          updated_at?: string | null
          visit_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          expected_completion_date?: string | null
          id?: string
          lab_result_id?: string | null
          notes?: string | null
          notify_on_completion?: boolean | null
          practice_id?: string | null
          priority?: string
          requested_at?: string | null
          requesting_doctor_id?: string | null
          status?: string
          test_name?: string
          updated_at?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_requests_lab_result_id_fkey"
            columns: ["lab_result_id"]
            isOneToOne: false
            referencedRelation: "lab_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_requests_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_requests_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "lab_requests_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_requests_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "lab_requests_requesting_doctor_id_fkey"
            columns: ["requesting_doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_requests_requesting_doctor_id_fkey"
            columns: ["requesting_doctor_id"]
            isOneToOne: false
            referencedRelation: "visit_timeline_view"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "lab_requests_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_requests_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit_timeline_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_requests_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_results: {
        Row: {
          created_at: string | null
          date: string
          id: string
          name: string
          reference_range: string | null
          status: string
          unit: string | null
          value: string
          visit_id: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          name: string
          reference_range?: string | null
          status: string
          unit?: string | null
          value: string
          visit_id?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          name?: string
          reference_range?: string | null
          status?: string
          unit?: string | null
          value?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_results_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit_timeline_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      media_files: {
        Row: {
          created_at: string | null
          description: string | null
          filename: string
          id: string
          updated_at: string | null
          url: string
          visit_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          filename: string
          id?: string
          updated_at?: string | null
          url: string
          visit_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          filename?: string
          id?: string
          updated_at?: string | null
          url?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_files_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_files_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit_timeline_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_files_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      media_requests: {
        Row: {
          body_part: string
          completed_at: string | null
          created_at: string | null
          expected_completion_date: string | null
          id: string
          media_result_id: string | null
          notes: string | null
          notify_on_completion: boolean | null
          practice_id: string | null
          priority: string
          requested_at: string | null
          requesting_doctor_id: string | null
          status: string
          type: string
          updated_at: string | null
          visit_id: string | null
        }
        Insert: {
          body_part: string
          completed_at?: string | null
          created_at?: string | null
          expected_completion_date?: string | null
          id?: string
          media_result_id?: string | null
          notes?: string | null
          notify_on_completion?: boolean | null
          practice_id?: string | null
          priority: string
          requested_at?: string | null
          requesting_doctor_id?: string | null
          status: string
          type: string
          updated_at?: string | null
          visit_id?: string | null
        }
        Update: {
          body_part?: string
          completed_at?: string | null
          created_at?: string | null
          expected_completion_date?: string | null
          id?: string
          media_result_id?: string | null
          notes?: string | null
          notify_on_completion?: boolean | null
          practice_id?: string | null
          priority?: string
          requested_at?: string | null
          requesting_doctor_id?: string | null
          status?: string
          type?: string
          updated_at?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_requests_media_result_id_fkey"
            columns: ["media_result_id"]
            isOneToOne: false
            referencedRelation: "visit_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_requests_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_requests_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "media_requests_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_requests_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "media_requests_requesting_doctor_id_fkey"
            columns: ["requesting_doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_requests_requesting_doctor_id_fkey"
            columns: ["requesting_doctor_id"]
            isOneToOne: false
            referencedRelation: "visit_timeline_view"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "media_requests_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_requests_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit_timeline_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_requests_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_aid_details: {
        Row: {
          created_at: string | null
          id: string
          main_member_id_number: string
          main_member_name: string
          medical_aid_provider_id: string | null
          membership_number: string
          patient_id: string | null
          plan_type: string
          provider: string
          relationship_to_main: string
          scheme: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          main_member_id_number: string
          main_member_name: string
          medical_aid_provider_id?: string | null
          membership_number: string
          patient_id?: string | null
          plan_type: string
          provider: string
          relationship_to_main: string
          scheme: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          main_member_id_number?: string
          main_member_name?: string
          medical_aid_provider_id?: string | null
          membership_number?: string
          patient_id?: string | null
          plan_type?: string
          provider?: string
          relationship_to_main?: string
          scheme?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_aid_details_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_aid_details_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_aid_details_provider_id_fkey"
            columns: ["medical_aid_provider_id"]
            isOneToOne: false
            referencedRelation: "medical_aid_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_aid_providers: {
        Row: {
          address: string | null
          contact_number: string | null
          created_at: string | null
          email: string | null
          id: string
          logo_url: string | null
          medical_aid_reference: string | null
          name: string
          short_name: string | null
          theme_color: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          contact_number?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          medical_aid_reference?: string | null
          name: string
          short_name?: string | null
          theme_color?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          contact_number?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          medical_aid_reference?: string | null
          name?: string
          short_name?: string | null
          theme_color?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      medical_aid_schemes: {
        Row: {
          created_at: string | null
          description: string | null
          gp_cover_percentage: number | null
          hospital_cover_percentage: number | null
          id: string
          medication_annual_limit: number | null
          name: string
          provider_id: string | null
          specialist_cover_percentage: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          gp_cover_percentage?: number | null
          hospital_cover_percentage?: number | null
          id?: string
          medication_annual_limit?: number | null
          name: string
          provider_id?: string | null
          specialist_cover_percentage?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          gp_cover_percentage?: number | null
          hospital_cover_percentage?: number | null
          id?: string
          medication_annual_limit?: number | null
          name?: string
          provider_id?: string | null
          specialist_cover_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_aid_schemes_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "medical_aid_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_aid_service_prices: {
        Row: {
          base_price: number | null
          category: string | null
          covered_amount: number | null
          created_at: string | null
          id: string
          patient_copay_percentage: number | null
          provider_id: string | null
          requires_preauth: boolean | null
          scheme_id: string | null
          service_code: string | null
          service_name: string
        }
        Insert: {
          base_price?: number | null
          category?: string | null
          covered_amount?: number | null
          created_at?: string | null
          id?: string
          patient_copay_percentage?: number | null
          provider_id?: string | null
          requires_preauth?: boolean | null
          scheme_id?: string | null
          service_code?: string | null
          service_name: string
        }
        Update: {
          base_price?: number | null
          category?: string | null
          covered_amount?: number | null
          created_at?: string | null
          id?: string
          patient_copay_percentage?: number | null
          provider_id?: string | null
          requires_preauth?: boolean | null
          scheme_id?: string | null
          service_code?: string | null
          service_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_aid_service_prices_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "medical_aid_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_aid_service_prices_scheme_id_fkey"
            columns: ["scheme_id"]
            isOneToOne: false
            referencedRelation: "medical_aid_schemes"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          content: string
          created_at: string | null
          id: string
          name: string
          subject: string | null
          type: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          name: string
          subject?: string | null
          type: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          name?: string
          subject?: string | null
          type?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          error: string | null
          id: string
          recipient: string
          scheduled_for: string | null
          sent_at: string | null
          status: string
          subject: string | null
          template_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          error?: string | null
          id?: string
          recipient: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          error?: string | null
          id?: string
          recipient?: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      next_of_kin: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          name: string
          patient_id: string | null
          phone: string
          relationship: string
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          name: string
          patient_id?: string | null
          phone: string
          relationship: string
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          name?: string
          patient_id?: string | null
          phone?: string
          relationship?: string
        }
        Relationships: [
          {
            foreignKeyName: "next_of_kin_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_of_kin_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_documents: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          file_name: string
          file_size: number
          file_type: string
          id: string
          mime_type: string
          original_name: string
          patient_id: string
          storage_path: string
          tags: string[] | null
          updated_at: string | null
          uploaded_by: string | null
          visit_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          file_name: string
          file_size: number
          file_type: string
          id?: string
          mime_type: string
          original_name: string
          patient_id: string
          storage_path: string
          tags?: string[] | null
          updated_at?: string | null
          uploaded_by?: string | null
          visit_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          mime_type?: string
          original_name?: string
          patient_id?: string
          storage_path?: string
          tags?: string[] | null
          updated_at?: string | null
          uploaded_by?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_documents_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_documents_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit_timeline_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_documents_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          cell_number: string | null
          created_at: string | null
          date_of_birth: string
          email: string | null
          employer: string | null
          first_name: string
          gender: string
          home_address: string | null
          home_language: string | null
          id: string
          id_number: string
          last_name: string
          marital_status: string | null
          occupation: string | null
          postal_address: string | null
          postal_code: string | null
          practice_id: string | null
          system_patient_reference_number: number
          updated_at: string | null
        }
        Insert: {
          cell_number?: string | null
          created_at?: string | null
          date_of_birth: string
          email?: string | null
          employer?: string | null
          first_name: string
          gender: string
          home_address?: string | null
          home_language?: string | null
          id?: string
          id_number: string
          last_name: string
          marital_status?: string | null
          occupation?: string | null
          postal_address?: string | null
          postal_code?: string | null
          practice_id?: string | null
          system_patient_reference_number: number
          updated_at?: string | null
        }
        Update: {
          cell_number?: string | null
          created_at?: string | null
          date_of_birth?: string
          email?: string | null
          employer?: string | null
          first_name?: string
          gender?: string
          home_address?: string | null
          home_language?: string | null
          id?: string
          id_number?: string
          last_name?: string
          marital_status?: string | null
          occupation?: string | null
          postal_address?: string | null
          postal_code?: string | null
          practice_id?: string | null
          system_patient_reference_number?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "patients_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
        ]
      }
      practice_analytics: {
        Row: {
          active_users: number | null
          cancelled_appointments: number | null
          completed_appointments: number | null
          created_at: string | null
          id: string
          metrics: Json | null
          new_patients: number | null
          period_end: string
          period_start: string
          period_type: string
          practice_id: string
          total_appointments: number | null
          total_revenue: number | null
          total_visits: number | null
          updated_at: string | null
        }
        Insert: {
          active_users?: number | null
          cancelled_appointments?: number | null
          completed_appointments?: number | null
          created_at?: string | null
          id?: string
          metrics?: Json | null
          new_patients?: number | null
          period_end: string
          period_start: string
          period_type: string
          practice_id: string
          total_appointments?: number | null
          total_revenue?: number | null
          total_visits?: number | null
          updated_at?: string | null
        }
        Update: {
          active_users?: number | null
          cancelled_appointments?: number | null
          completed_appointments?: number | null
          created_at?: string | null
          id?: string
          metrics?: Json | null
          new_patients?: number | null
          period_end?: string
          period_start?: string
          period_type?: string
          practice_id?: string
          total_appointments?: number | null
          total_revenue?: number | null
          total_visits?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_analytics_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_analytics_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_analytics_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_analytics_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
        ]
      }
      practice_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invitation_token: string
          invited_by: string
          practice_id: string
          role: string
          status: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invitation_token: string
          invited_by: string
          practice_id: string
          role: string
          status?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invitation_token?: string
          invited_by?: string
          practice_id?: string
          role?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "visit_timeline_view"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "practice_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "visit_timeline_view"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "practice_invitations_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_invitations_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_invitations_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_invitations_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
        ]
      }
      practice_notification_templates: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_active: boolean | null
          practice_id: string
          subject: string | null
          template_name: string
          template_type: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          practice_id: string
          subject?: string | null
          template_name: string
          template_type: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          practice_id?: string
          subject?: string | null
          template_name?: string
          template_type?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_notification_templates_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_notification_templates_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_notification_templates_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_notification_templates_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
        ]
      }
      practice_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_public: boolean | null
          practice_id: string
          setting_key: string
          setting_type: string | null
          setting_value: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          practice_id: string
          setting_key: string
          setting_type?: string | null
          setting_value?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          practice_id?: string
          setting_key?: string
          setting_type?: string | null
          setting_value?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_settings_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_settings_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_settings_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_settings_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
        ]
      }
      practice_sms_subscriptions: {
        Row: {
          additional_sms_purchased: number | null
          auto_renew: boolean | null
          billing_cycle_end: string
          billing_cycle_start: string
          created_at: string | null
          current_usage: number | null
          id: string
          is_active: boolean | null
          monthly_limit: number
          plan_id: string | null
          practice_id: string | null
          updated_at: string | null
        }
        Insert: {
          additional_sms_purchased?: number | null
          auto_renew?: boolean | null
          billing_cycle_end: string
          billing_cycle_start: string
          created_at?: string | null
          current_usage?: number | null
          id?: string
          is_active?: boolean | null
          monthly_limit: number
          plan_id?: string | null
          practice_id?: string | null
          updated_at?: string | null
        }
        Update: {
          additional_sms_purchased?: number | null
          auto_renew?: boolean | null
          billing_cycle_end?: string
          billing_cycle_start?: string
          created_at?: string | null
          current_usage?: number | null
          id?: string
          is_active?: boolean | null
          monthly_limit?: number
          plan_id?: string | null
          practice_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_sms_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "sms_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_sms_subscriptions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_sms_subscriptions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_sms_subscriptions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_sms_subscriptions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
        ]
      }
      practice_staff: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          practice_id: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          practice_id?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          practice_id?: string | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_staff_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_staff_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_staff_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_staff_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "visit_timeline_view"
            referencedColumns: ["doctor_id"]
          },
        ]
      }
      practice_tariffs: {
        Row: {
          business_rule_formula: string | null
          can_be_multiplied: string | null
          code: string
          created_at: string | null
          description: string | null
          effective_from: string | null
          effective_to: string | null
          example_calculation: string | null
          found_in_claims: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          official_2025_price_nad: number | null
          on_2025_list: string | null
          practice_type_id: string | null
          price: number
          requires_tooth_number: string | null
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          business_rule_formula?: string | null
          can_be_multiplied?: string | null
          code: string
          created_at?: string | null
          description?: string | null
          effective_from?: string | null
          effective_to?: string | null
          example_calculation?: string | null
          found_in_claims?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          official_2025_price_nad?: number | null
          on_2025_list?: string | null
          practice_type_id?: string | null
          price: number
          requires_tooth_number?: string | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          business_rule_formula?: string | null
          can_be_multiplied?: string | null
          code?: string
          created_at?: string | null
          description?: string | null
          effective_from?: string | null
          effective_to?: string | null
          example_calculation?: string | null
          found_in_claims?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          official_2025_price_nad?: number | null
          on_2025_list?: string | null
          practice_type_id?: string | null
          price?: number
          requires_tooth_number?: string | null
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_tariffs_practice_type_id_fkey"
            columns: ["practice_type_id"]
            isOneToOne: false
            referencedRelation: "practice_types"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_types: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      practices: {
        Row: {
          about_text: string | null
          address: string | null
          admin_user_id: string | null
          business_hours: Json | null
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          country: string | null
          created_at: string | null
          currency: string | null
          domain: string | null
          features: Json | null
          hero_image_url: string | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          license_number: string | null
          logo_url: string | null
          max_patients: number | null
          max_users: number | null
          metadata: Json | null
          name: string
          postal_code: string | null
          practice_number: string | null
          practice_subtypes: string[] | null
          practice_type: string | null
          practice_type_id: string | null
          primary_color: string | null
          secondary_color: string | null
          services: Json | null
          settings: Json | null
          slug: string
          social_links: Json | null
          status: string | null
          subscription_expires_at: string | null
          subscription_tier: string | null
          tax_number: string | null
          testimonials: Json | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          about_text?: string | null
          address?: string | null
          admin_user_id?: string | null
          business_hours?: Json | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          domain?: string | null
          features?: Json | null
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          license_number?: string | null
          logo_url?: string | null
          max_patients?: number | null
          max_users?: number | null
          metadata?: Json | null
          name: string
          postal_code?: string | null
          practice_number?: string | null
          practice_subtypes?: string[] | null
          practice_type?: string | null
          practice_type_id?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          services?: Json | null
          settings?: Json | null
          slug: string
          social_links?: Json | null
          status?: string | null
          subscription_expires_at?: string | null
          subscription_tier?: string | null
          tax_number?: string | null
          testimonials?: Json | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          about_text?: string | null
          address?: string | null
          admin_user_id?: string | null
          business_hours?: Json | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          domain?: string | null
          features?: Json | null
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          license_number?: string | null
          logo_url?: string | null
          max_patients?: number | null
          max_users?: number | null
          metadata?: Json | null
          name?: string
          postal_code?: string | null
          practice_number?: string | null
          practice_subtypes?: string[] | null
          practice_type?: string | null
          practice_type_id?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          services?: Json | null
          settings?: Json | null
          slug?: string
          social_links?: Json | null
          status?: string | null
          subscription_expires_at?: string | null
          subscription_tier?: string | null
          tax_number?: string | null
          testimonials?: Json | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practices_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practices_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "visit_timeline_view"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "practices_practice_type_id_fkey"
            columns: ["practice_type_id"]
            isOneToOne: false
            referencedRelation: "practice_types"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_plans: {
        Row: {
          created_at: string | null
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          monthly_sms_limit: number
          name: string
          price_per_additional_sms: number
          price_per_month: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          monthly_sms_limit: number
          name: string
          price_per_additional_sms: number
          price_per_month: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          monthly_sms_limit?: number
          name?: string
          price_per_additional_sms?: number
          price_per_month?: number
        }
        Relationships: []
      }
      sms_portal_config: {
        Row: {
          api_endpoint: string
          api_key: string
          created_at: string | null
          id: string
          is_active: boolean | null
          password: string | null
          portal_name: string
          practice_id: string | null
          sender_id: string
          settings: Json | null
          updated_at: string | null
          username: string | null
          webhook_url: string | null
        }
        Insert: {
          api_endpoint: string
          api_key: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          password?: string | null
          portal_name: string
          practice_id?: string | null
          sender_id: string
          settings?: Json | null
          updated_at?: string | null
          username?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_endpoint?: string
          api_key?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          password?: string | null
          portal_name?: string
          practice_id?: string | null
          sender_id?: string
          settings?: Json | null
          updated_at?: string | null
          username?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_portal_config_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: true
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_portal_config_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: true
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "sms_portal_config_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: true
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_portal_config_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: true
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
        ]
      }
      sms_templates: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          practice_id: string | null
          template_type: string | null
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          practice_id?: string | null
          template_type?: string | null
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          practice_id?: string | null
          template_type?: string | null
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_templates_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_templates_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "sms_templates_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_templates_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
        ]
      }
      sms_usage_logs: {
        Row: {
          cost: number
          created_at: string | null
          delivered_at: string | null
          failed_at: string | null
          failure_reason: string | null
          id: string
          message_content: string
          message_type: string | null
          portal_response: Json | null
          practice_id: string | null
          recipient_phone: string
          sent_at: string | null
          status: string | null
          subscription_id: string | null
        }
        Insert: {
          cost?: number
          created_at?: string | null
          delivered_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          message_content: string
          message_type?: string | null
          portal_response?: Json | null
          practice_id?: string | null
          recipient_phone: string
          sent_at?: string | null
          status?: string | null
          subscription_id?: string | null
        }
        Update: {
          cost?: number
          created_at?: string | null
          delivered_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          message_content?: string
          message_type?: string | null
          portal_response?: Json | null
          practice_id?: string | null
          recipient_phone?: string
          sent_at?: string | null
          status?: string | null
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_usage_logs_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_usage_logs_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "sms_usage_logs_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_usage_logs_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "sms_usage_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "practice_sms_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar: string | null
          can_manage_practices: boolean | null
          created_at: string | null
          email: string
          full_name: string
          hpcsa_number: string | null
          id: string
          is_super_admin: boolean | null
          last_active_at: string | null
          last_login: string | null
          permissions: Json | null
          practice_id: string | null
          role: string
        }
        Insert: {
          avatar?: string | null
          can_manage_practices?: boolean | null
          created_at?: string | null
          email: string
          full_name: string
          hpcsa_number?: string | null
          id?: string
          is_super_admin?: boolean | null
          last_active_at?: string | null
          last_login?: string | null
          permissions?: Json | null
          practice_id?: string | null
          role: string
        }
        Update: {
          avatar?: string | null
          can_manage_practices?: boolean | null
          created_at?: string | null
          email?: string
          full_name?: string
          hpcsa_number?: string | null
          id?: string
          is_super_admin?: boolean | null
          last_active_at?: string | null
          last_login?: string | null
          permissions?: Json | null
          practice_id?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "users_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
        ]
      }
      visit_media: {
        Row: {
          created_at: string | null
          date: string
          description: string | null
          id: string
          type: string
          url: string
          visit_id: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          description?: string | null
          id?: string
          type: string
          url: string
          visit_id?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          type?: string
          url?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visit_media_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_media_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit_timeline_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_media_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          appointment_id: string | null
          chief_complaint: string | null
          created_at: string | null
          diagnosis: string | null
          doctor_id: string | null
          encounter_date: string | null
          follow_up_date: string | null
          follow_up_required: boolean | null
          id: string
          notes: string | null
          patient_id: string | null
          practice_id: string | null
          prescription: string | null
          status: string
          treatment_plan: string | null
          updated_at: string | null
          visit_date: string
          visit_time: string
          visit_type: string
        }
        Insert: {
          appointment_id?: string | null
          chief_complaint?: string | null
          created_at?: string | null
          diagnosis?: string | null
          doctor_id?: string | null
          encounter_date?: string | null
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          practice_id?: string | null
          prescription?: string | null
          status?: string
          treatment_plan?: string | null
          updated_at?: string | null
          visit_date: string
          visit_time: string
          visit_type: string
        }
        Update: {
          appointment_id?: string | null
          chief_complaint?: string | null
          created_at?: string | null
          diagnosis?: string | null
          doctor_id?: string | null
          encounter_date?: string | null
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          practice_id?: string | null
          prescription?: string | null
          status?: string
          treatment_plan?: string | null
          updated_at?: string | null
          visit_date?: string
          visit_time?: string
          visit_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "visit_timeline_view"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "visits_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
        ]
      }
      vitals: {
        Row: {
          blood_pressure: string | null
          bmi: number | null
          created_at: string | null
          height: number | null
          id: string
          pulse_rate: number | null
          respiratory_rate: number | null
          temperature: number | null
          updated_at: string | null
          visit_id: string | null
          weight: number | null
        }
        Insert: {
          blood_pressure?: string | null
          bmi?: number | null
          created_at?: string | null
          height?: number | null
          id?: string
          pulse_rate?: number | null
          respiratory_rate?: number | null
          temperature?: number | null
          updated_at?: string | null
          visit_id?: string | null
          weight?: number | null
        }
        Update: {
          blood_pressure?: string | null
          bmi?: number | null
          created_at?: string | null
          height?: number | null
          id?: string
          pulse_rate?: number | null
          respiratory_rate?: number | null
          temperature?: number | null
          updated_at?: string | null
          visit_id?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vitals_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitals_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit_timeline_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitals_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_practice_overview: {
        Row: {
          about_text: string | null
          address: string | null
          admin_email: string | null
          admin_name: string | null
          admin_user_id: string | null
          appointments_last_30_days: number | null
          appointments_this_month: number | null
          business_hours: Json | null
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          country: string | null
          created_at: string | null
          currency: string | null
          domain: string | null
          features: Json | null
          hero_image_url: string | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string | null
          license_number: string | null
          logo_url: string | null
          max_patients: number | null
          max_users: number | null
          name: string | null
          postal_code: string | null
          primary_color: string | null
          secondary_color: string | null
          services: Json | null
          settings: Json | null
          slug: string | null
          social_links: Json | null
          status: string | null
          subscription_expires_at: string | null
          subscription_tier: string | null
          tax_number: string | null
          timezone: string | null
          total_patients: number | null
          total_users: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practices_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practices_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "visit_timeline_view"
            referencedColumns: ["doctor_id"]
          },
        ]
      }
      appointment_analytics: {
        Row: {
          avg_duration_minutes: number | null
          cancelled_appointments: number | null
          completed_appointments: number | null
          completion_rate: number | null
          date: string | null
          no_show_appointments: number | null
          peak_hour: number | null
          practice_id: string | null
          practice_name: string | null
          ready_appointments: number | null
          total_appointments: number | null
        }
        Relationships: []
      }
      batch_management_view: {
        Row: {
          batch_date: string | null
          batch_id: string | null
          batch_number: number | null
          confirmed_at: string | null
          created_at: string | null
          dat_filename: string | null
          detail_transactions: number | null
          medical_aid_email: string | null
          medical_aid_logo_url: string | null
          medical_aid_name: string | null
          medical_aid_reference: string | null
          medical_aid_short_name: string | null
          medical_aid_theme_color: string | null
          practice_email: string | null
          practice_name: string | null
          practice_number: string | null
          sent_at: string | null
          status: string | null
          total_amount: number | null
          total_amount_detail_transactions: number | null
          total_detail_transactions: number | null
          total_invoices: number | null
        }
        Relationships: []
      }
      batch_submission_summary: {
        Row: {
          batch_date: string | null
          batch_header_id: string | null
          batch_number: number | null
          delivered_at: string | null
          email_service: string | null
          file_name: string | null
          id: string | null
          medical_aid_reference: string | null
          practice_id: string | null
          practice_name: string | null
          recipient_email: string | null
          sent_at: string | null
          status: string | null
          submission_attempt: number | null
          submitted_at: string | null
          total_amount: number | null
          total_claims: number | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_submissions_batch_header_id_fkey"
            columns: ["batch_header_id"]
            isOneToOne: false
            referencedRelation: "batch_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_submissions_batch_header_id_fkey"
            columns: ["batch_header_id"]
            isOneToOne: false
            referencedRelation: "batch_management_view"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      daily_financial_kpis: {
        Row: {
          daily_medical_aid: number | null
          daily_paid: number | null
          daily_pending: number | null
          daily_revenue: number | null
          daily_self_pay: number | null
          invoices_created: number | null
          issue_date: string | null
        }
        Relationships: []
      }
      financial_dashboard_fast: {
        Row: {
          avg_invoice_value: number | null
          medical_aid_revenue: number | null
          monthly_revenue: number | null
          outstanding_amount: number | null
          paid_invoices: number | null
          pending_invoices: number | null
          prev_revenue: number | null
          revenue_growth_percent: number | null
          self_pay_revenue: number | null
          total_invoices: number | null
          total_revenue: number | null
        }
        Relationships: []
      }
      frequent_tariff_codes: {
        Row: {
          business_rule_formula: string | null
          can_be_multiplied: string | null
          code: string | null
          created_at: string | null
          description: string | null
          effective_from: string | null
          effective_to: string | null
          example_calculation: string | null
          found_in_claims: string | null
          id: string | null
          is_active: boolean | null
          is_frequent: number | null
          notes: string | null
          official_2025_price_nad: number | null
          on_2025_list: string | null
          practice_type_description: string | null
          practice_type_id: string | null
          practice_type_name: string | null
          price: number | null
          requires_tooth_number: string | null
          unit: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_tariffs_practice_type_id_fkey"
            columns: ["practice_type_id"]
            isOneToOne: false
            referencedRelation: "practice_types"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_revenue_summary: {
        Row: {
          avg_invoice_value: number | null
          medical_aid_revenue: number | null
          month: string | null
          paid_invoices: number | null
          pending_invoices: number | null
          self_pay_revenue: number | null
          total_invoices: number | null
          total_revenue: number | null
        }
        Relationships: []
      }
      patient_audit_logs: {
        Row: {
          action: string | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string | null
          ip_address: unknown | null
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string | null
          user_agent: string | null
          user_email: string | null
          user_full_name: string | null
          user_id: string | null
          user_role: string | null
        }
        Relationships: []
      }
      patient_details_view: {
        Row: {
          cell_number: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          employer: string | null
          first_name: string | null
          gender: string | null
          home_address: string | null
          home_language: string | null
          id: string | null
          id_number: string | null
          last_name: string | null
          marital_status: string | null
          medical_aid_details: Json | null
          next_of_kin: Json | null
          occupation: string | null
          postal_address: string | null
          postal_code: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      payment_status_analytics: {
        Row: {
          avg_amount: number | null
          earliest_date: string | null
          invoice_count: number | null
          latest_date: string | null
          month: string | null
          payment_status: string | null
          total_amount: number | null
        }
        Relationships: []
      }
      pending_requests_view: {
        Row: {
          description: string | null
          doctor_name: string | null
          expected_completion_date: string | null
          id: string | null
          patient_id: string | null
          patient_name: string | null
          priority: string | null
          request_type: string | null
          requested_at: string | null
          requesting_doctor_id: string | null
          status: string | null
          visit_id: string | null
        }
        Relationships: []
      }
      practice_tariffs_with_types: {
        Row: {
          business_rule_formula: string | null
          can_be_multiplied: string | null
          code: string | null
          created_at: string | null
          description: string | null
          effective_from: string | null
          effective_to: string | null
          example_calculation: string | null
          found_in_claims: string | null
          id: string | null
          is_active: boolean | null
          notes: string | null
          official_2025_price_nad: number | null
          on_2025_list: string | null
          practice_type_description: string | null
          practice_type_id: string | null
          practice_type_name: string | null
          price: number | null
          requires_tooth_number: string | null
          unit: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_tariffs_practice_type_id_fkey"
            columns: ["practice_type_id"]
            isOneToOne: false
            referencedRelation: "practice_types"
            referencedColumns: ["id"]
          },
        ]
      }
      service_performance_summary: {
        Row: {
          avg_unit_price: number | null
          code: string | null
          description: string | null
          medical_aid_covered: number | null
          month: string | null
          patient_portion: number | null
          service_count: number | null
          total_quantity: number | null
          total_revenue: number | null
        }
        Relationships: []
      }
      sms_analytics: {
        Row: {
          current_usage: number | null
          daily_sms_cost: number | null
          date: string | null
          delivery_rate: number | null
          message_types: string | null
          monthly_limit: number | null
          practice_id: string | null
          practice_name: string | null
          sms_delivered: number | null
          sms_failed: number | null
          sms_sent: number | null
          usage_percentage: number | null
        }
        Relationships: []
      }
      top_services_aggregate: {
        Row: {
          avg_price: number | null
          code: string | null
          frequency: number | null
          service_name: string | null
          total_quantity: number | null
          total_revenue: number | null
          unique_invoices: number | null
        }
        Relationships: []
      }
      visit_details_view: {
        Row: {
          appointment_id: string | null
          chief_complaint: string | null
          created_at: string | null
          diagnosis: string | null
          doctor_id: string | null
          doctor_name: string | null
          follow_up_date: string | null
          follow_up_required: boolean | null
          id: string | null
          lab_results: Json | null
          media: Json | null
          notes: string | null
          patient_first_name: string | null
          patient_id: string | null
          patient_last_name: string | null
          pending_requests: Json | null
          prescription: string | null
          status: string | null
          treatment_plan: string | null
          updated_at: string | null
          visit_date: string | null
          visit_time: string | null
          visit_type: string | null
          vitals: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "visit_timeline_view"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_timeline_view: {
        Row: {
          chief_complaint: string | null
          created_at: string | null
          diagnosis: string | null
          doctor_id: string | null
          doctor_name: string | null
          id: string | null
          lab_results_count: number | null
          media_count: number | null
          patient_id: string | null
          pending_lab_requests_count: number | null
          pending_media_requests_count: number | null
          prescription: string | null
          status: string | null
          treatment_plan: string | null
          updated_at: string | null
          visit_date: string | null
          visit_time: string | null
          visit_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_invoice_to_batch: {
        Args: { p_batch_id: string; p_invoice_id: string }
        Returns: undefined
      }
      create_batch_submission: {
        Args: {
          p_batch_header_id: string
          p_file_name: string
          p_file_content: string
          p_recipient_email: string
          p_sender_email?: string
          p_practice_id?: string
        }
        Returns: string
      }
      create_new_batch: {
        Args: {
          p_practice_id: string
          p_medical_aid_reference: string
          p_batch_date?: string
        }
        Returns: string
      }
      ensure_visit: {
        Args: { _appt: string }
        Returns: string
      }
      generate_invoice_number: {
        Args: { p_practice_id: string }
        Returns: string
      }
      get_medical_aid_providers: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          name: string
          short_name: string
          logo_url: string
          medical_aid_reference: string
        }[]
      }
      get_next_system_patient_reference_number: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      get_next_system_transaction_number: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      get_or_create_active_batch_id: {
        Args: { p_practice_id: string; p_medical_aid_reference: string }
        Returns: string
      }
      get_practice_statistics: {
        Args: { practice_uuid: string }
        Returns: Json
      }
      is_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
      log_admin_action: {
        Args: {
          action_name: string
          resource_type_name?: string
          resource_uuid?: string
          target_practice_uuid?: string
          old_data?: Json
          new_data?: Json
        }
        Returns: string
      }
      prepare_batch_for_sending: {
        Args: { p_batch_id: string }
        Returns: {
          file_content: string
          recipient_email: string
          file_name: string
        }[]
      }
      sync_invoice_to_batch: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
    }
    Enums: {
      user_role: "admin" | "doctor" | "nurse" | "receptionist"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      user_role: ["admin", "doctor", "nurse", "receptionist"],
    },
  },
} as const


// Custom helper types for better DX
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Insertable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type Updatable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

// Utility type for relationships
export type WithRelations<T, R extends Record<string, any>> = T & R;
