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
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system_role?: boolean | null
          name: string
          permissions?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system_role?: boolean | null
          name?: string
          permissions?: Json
          updated_at?: string | null
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
          updated_at: string | null
          user_agent: string | null
        }
        Insert: {
          admin_user_id?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          ip_address?: unknown | null
          session_token: string
          updated_at?: string | null
          user_agent?: string | null
        }
        Update: {
          admin_user_id?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: unknown | null
          session_token?: string
          updated_at?: string | null
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
          {
            foreignKeyName: "fk_admin_sessions_admin_user_id"
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
          {
            foreignKeyName: "fk_admin_users_role_id"
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
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "appointments_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
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
          {
            foreignKeyName: "fk_appointments_patient_id"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_appointments_patient_id"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_appointments_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_appointments_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "fk_appointments_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "fk_appointments_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "fk_appointments_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_appointments_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
        ]
      }
      appointments_backup_20250625: {
        Row: {
          created_at: string | null
          date: string | null
          doctor_id: string | null
          duration: number | null
          id: string | null
          notes: string | null
          patient_id: string | null
          practice_id: string | null
          status: string | null
          time: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date?: string | null
          doctor_id?: string | null
          duration?: number | null
          id?: string | null
          notes?: string | null
          patient_id?: string | null
          practice_id?: string | null
          status?: string | null
          time?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string | null
          doctor_id?: string | null
          duration?: number | null
          id?: string | null
          notes?: string | null
          patient_id?: string | null
          practice_id?: string | null
          status?: string | null
          time?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
          updated_at: string | null
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
          updated_at?: string | null
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
          updated_at?: string | null
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
            referencedRelation: "today_visits_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_details_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_batch_details_batch_header_id"
            columns: ["batch_header_id"]
            isOneToOne: false
            referencedRelation: "batch_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_batch_details_batch_header_id"
            columns: ["batch_header_id"]
            isOneToOne: false
            referencedRelation: "batch_management_view"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "fk_batch_details_patient_id"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_batch_details_patient_id"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
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
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "batch_headers_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
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
          {
            foreignKeyName: "fk_batch_headers_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_batch_headers_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "fk_batch_headers_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "fk_batch_headers_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "fk_batch_headers_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_batch_headers_practice_id"
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
          updated_at: string | null
        }
        Insert: {
          batch_header_id?: string | null
          created_at?: string | null
          id?: string
          total_amount_detail_transactions: number
          total_detail_transactions: number
          trailer_identifier?: string | null
          updated_at?: string | null
        }
        Update: {
          batch_header_id?: string | null
          created_at?: string | null
          id?: string
          total_amount_detail_transactions?: number
          total_detail_transactions?: number
          trailer_identifier?: string | null
          updated_at?: string | null
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
      benefits: {
        Row: {
          base_calculation: string | null
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_company_contribution: boolean | null
          is_recurring: boolean | null
          name: string
          practice_id: string | null
          type: string
          updated_at: string | null
          value: number
        }
        Insert: {
          base_calculation?: string | null
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_company_contribution?: boolean | null
          is_recurring?: boolean | null
          name: string
          practice_id?: string | null
          type: string
          updated_at?: string | null
          value: number
        }
        Update: {
          base_calculation?: string | null
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_company_contribution?: boolean | null
          is_recurring?: boolean | null
          name?: string
          practice_id?: string | null
          type?: string
          updated_at?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "benefits_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benefits_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "benefits_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "benefits_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "benefits_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benefits_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
        ]
      }
      bonus_configurations: {
        Row: {
          base_calculation: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_recurring: boolean | null
          name: string
          period_months: number[] | null
          period_type: string
          practice_id: string | null
          type: string
          updated_at: string | null
          value: number
        }
        Insert: {
          base_calculation?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_recurring?: boolean | null
          name: string
          period_months?: number[] | null
          period_type: string
          practice_id?: string | null
          type: string
          updated_at?: string | null
          value: number
        }
        Update: {
          base_calculation?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_recurring?: boolean | null
          name?: string
          period_months?: number[] | null
          period_type?: string
          practice_id?: string | null
          type?: string
          updated_at?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "bonus_configurations_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_configurations_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "bonus_configurations_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "bonus_configurations_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "bonus_configurations_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_configurations_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          business_hours: Json | null
          city: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          postal_code: string | null
          practice_id: string | null
          slug: string
          state_province: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          business_hours?: Json | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          postal_code?: string | null
          practice_id?: string | null
          slug: string
          state_province?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          business_hours?: Json | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          practice_id?: string | null
          slug?: string
          state_province?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "branches_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "branches_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "branches_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
        ]
      }
      deductions: {
        Row: {
          base_calculation: string | null
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_recurring: boolean | null
          is_statutory: boolean | null
          name: string
          practice_id: string | null
          type: string
          updated_at: string | null
          value: number
        }
        Insert: {
          base_calculation?: string | null
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_recurring?: boolean | null
          is_statutory?: boolean | null
          name: string
          practice_id?: string | null
          type: string
          updated_at?: string | null
          value: number
        }
        Update: {
          base_calculation?: string | null
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_recurring?: boolean | null
          is_statutory?: boolean | null
          name?: string
          practice_id?: string | null
          type?: string
          updated_at?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "deductions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deductions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "deductions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "deductions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "deductions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deductions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string | null
          color: string | null
          created_at: string | null
          description: string | null
          head_user_id: string | null
          id: string
          is_active: boolean | null
          name: string
          practice_id: string
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          head_user_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          practice_id: string
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          head_user_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          practice_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_head_user_id_fkey"
            columns: ["head_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "departments_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "departments_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "departments_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
        ]
      }
      doctor_branch_schedules: {
        Row: {
          branch_id: string | null
          created_at: string | null
          day_of_week: number | null
          doctor_id: string | null
          end_time: string
          id: string
          is_active: boolean | null
          start_time: string
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          day_of_week?: number | null
          doctor_id?: string | null
          end_time: string
          id?: string
          is_active?: boolean | null
          start_time: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          day_of_week?: number | null
          doctor_id?: string | null
          end_time?: string
          id?: string
          is_active?: boolean | null
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_branch_schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_branch_schedules_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_analytics: {
        Row: {
          clicked_count: number | null
          created_at: string | null
          delivered_count: number | null
          failed_count: number | null
          id: string
          opened_count: number | null
          period_end: string
          period_start: string
          period_type: string | null
          practice_id: string | null
          sent_count: number | null
        }
        Insert: {
          clicked_count?: number | null
          created_at?: string | null
          delivered_count?: number | null
          failed_count?: number | null
          id?: string
          opened_count?: number | null
          period_end: string
          period_start: string
          period_type?: string | null
          practice_id?: string | null
          sent_count?: number | null
        }
        Update: {
          clicked_count?: number | null
          created_at?: string | null
          delivered_count?: number | null
          failed_count?: number | null
          id?: string
          opened_count?: number | null
          period_end?: string
          period_start?: string
          period_type?: string | null
          practice_id?: string | null
          sent_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "email_analytics_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_analytics_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "email_analytics_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "email_analytics_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "email_analytics_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_analytics_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
        ]
      }
      email_plans: {
        Row: {
          created_at: string | null
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          monthly_limit: number
          name: string
          overage_rate: number | null
          price_per_email: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          monthly_limit: number
          name: string
          overage_rate?: number | null
          price_per_email?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          monthly_limit?: number
          name?: string
          overage_rate?: number | null
          price_per_email?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      employee_salaries: {
        Row: {
          basic_salary: number
          created_at: string | null
          created_by: string | null
          currency: string | null
          effective_from: string
          effective_to: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          basic_salary: number
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          basic_salary?: number
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_salaries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_salaries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_salary_components: {
        Row: {
          amount: number
          component_id: string | null
          created_at: string | null
          effective_from: string
          effective_to: string | null
          id: string
          is_active: boolean | null
          percentage: number | null
          user_id: string | null
        }
        Insert: {
          amount: number
          component_id?: string | null
          created_at?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          percentage?: number | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          component_id?: string | null
          created_at?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          percentage?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_salary_components_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "salary_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_salary_components_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_salary_configurations: {
        Row: {
          benefit_id: string | null
          bonus_configuration_id: string | null
          created_at: string | null
          custom_value: number | null
          deduction_id: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          benefit_id?: string | null
          bonus_configuration_id?: string | null
          created_at?: string | null
          custom_value?: number | null
          deduction_id?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          benefit_id?: string | null
          bonus_configuration_id?: string | null
          created_at?: string | null
          custom_value?: number | null
          deduction_id?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_salary_configurations_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: false
            referencedRelation: "benefits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_salary_configurations_bonus_configuration_id_fkey"
            columns: ["bonus_configuration_id"]
            isOneToOne: false
            referencedRelation: "bonus_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_salary_configurations_deduction_id_fkey"
            columns: ["deduction_id"]
            isOneToOne: false
            referencedRelation: "deductions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_salary_configurations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_items: {
        Row: {
          created_at: string | null
          expense_id: string
          id: string
          item_name: string
          quantity: number | null
          total_amount: number | null
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          expense_id: string
          id?: string
          item_name: string
          quantity?: number | null
          total_amount?: number | null
          unit_price: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          expense_id?: string
          id?: string
          item_name?: string
          quantity?: number | null
          total_amount?: number | null
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_items_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "practice_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_templates: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          practice_id: string
          steps: Json
          template_name: string
          trigger_type: string
          trigger_value: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          practice_id: string
          steps: Json
          template_name: string
          trigger_type: string
          trigger_value: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          practice_id?: string
          steps?: Json
          template_name?: string
          trigger_type?: string
          trigger_value?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_templates_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_templates_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "follow_up_templates_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "follow_up_templates_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "follow_up_templates_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_templates_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
        ]
      }
      hr_audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown | null
          new_values: Json | null
          old_values: Json | null
          performed_by: string | null
          record_id: string
          table_name: string
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          performed_by?: string | null
          record_id: string
          table_name: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          performed_by?: string | null
          record_id?: string
          table_name?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_audit_logs_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      imaging_requests: {
        Row: {
          body_part: string
          clinical_history: string | null
          clinical_indication: string
          completed_date: string | null
          contrast_required: boolean | null
          created_at: string | null
          expected_results_date: string | null
          facility_name: string | null
          id: string
          imaging_type: string
          notes: string | null
          patient_id: string
          preferred_date: string | null
          priority: string
          radiologist_name: string | null
          report_text: string | null
          request_date: string
          requested_by: string
          result_file_ids: string[] | null
          scheduled_date: string | null
          scheduled_time: string | null
          special_instructions: string | null
          status: string
          updated_at: string | null
          view_position: string | null
          visit_id: string | null
        }
        Insert: {
          body_part: string
          clinical_history?: string | null
          clinical_indication: string
          completed_date?: string | null
          contrast_required?: boolean | null
          created_at?: string | null
          expected_results_date?: string | null
          facility_name?: string | null
          id?: string
          imaging_type: string
          notes?: string | null
          patient_id: string
          preferred_date?: string | null
          priority?: string
          radiologist_name?: string | null
          report_text?: string | null
          request_date?: string
          requested_by: string
          result_file_ids?: string[] | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          special_instructions?: string | null
          status?: string
          updated_at?: string | null
          view_position?: string | null
          visit_id?: string | null
        }
        Update: {
          body_part?: string
          clinical_history?: string | null
          clinical_indication?: string
          completed_date?: string | null
          contrast_required?: boolean | null
          created_at?: string | null
          expected_results_date?: string | null
          facility_name?: string | null
          id?: string
          imaging_type?: string
          notes?: string | null
          patient_id?: string
          preferred_date?: string | null
          priority?: string
          radiologist_name?: string | null
          report_text?: string | null
          request_date?: string
          requested_by?: string
          result_file_ids?: string[] | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          special_instructions?: string | null
          status?: string
          updated_at?: string | null
          view_position?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imaging_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imaging_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imaging_requests_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "today_visits_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imaging_requests_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
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
          updated_at: string | null
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
          updated_at?: string | null
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
          updated_at?: string | null
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
            foreignKeyName: "fk_invoices_enhanced_batch_id"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoices_enhanced_batch_id"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_management_view"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "fk_invoices_enhanced_patient_id"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoices_enhanced_patient_id"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoices_enhanced_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoices_enhanced_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "fk_invoices_enhanced_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "fk_invoices_enhanced_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "fk_invoices_enhanced_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoices_enhanced_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "fk_invoices_enhanced_visit_id"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "today_visits_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoices_enhanced_visit_id"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
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
        ]
      }
      lab_requests: {
        Row: {
          created_at: string | null
          id: string
          lab_facility: string | null
          media_type: string | null
          media_url: string | null
          notes: string | null
          patient_id: string
          practice_id: string | null
          preferred_date: string | null
          request_date: string
          status: string
          updated_at: string | null
          visit_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          lab_facility?: string | null
          media_type?: string | null
          media_url?: string | null
          notes?: string | null
          patient_id: string
          practice_id?: string | null
          preferred_date?: string | null
          request_date?: string
          status?: string
          updated_at?: string | null
          visit_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          lab_facility?: string | null
          media_type?: string | null
          media_url?: string | null
          notes?: string | null
          patient_id?: string
          practice_id?: string | null
          preferred_date?: string | null
          request_date?: string
          status?: string
          updated_at?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
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
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "lab_requests_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
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
            foreignKeyName: "lab_requests_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "today_visits_view"
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
          id: string
          lab_request_id: string
          reference_range: string | null
          status: string | null
          test_name: string
          test_unit: string | null
          test_value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lab_request_id: string
          reference_range?: string | null
          status?: string | null
          test_name: string
          test_unit?: string | null
          test_value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lab_request_id?: string
          reference_range?: string | null
          status?: string | null
          test_name?: string
          test_unit?: string | null
          test_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_results_lab_request_id_fkey"
            columns: ["lab_request_id"]
            isOneToOne: false
            referencedRelation: "lab_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          accrued_this_month: number | null
          balance_days: number | null
          carried_over_days: number | null
          created_at: string | null
          entitled_days: number
          id: string
          last_accrual_date: string | null
          leave_type_id: string | null
          total_accrued: number | null
          updated_at: string | null
          used_days: number | null
          user_id: string | null
          year: number
        }
        Insert: {
          accrued_this_month?: number | null
          balance_days?: number | null
          carried_over_days?: number | null
          created_at?: string | null
          entitled_days: number
          id?: string
          last_accrual_date?: string | null
          leave_type_id?: string | null
          total_accrued?: number | null
          updated_at?: string | null
          used_days?: number | null
          user_id?: string | null
          year: number
        }
        Update: {
          accrued_this_month?: number | null
          balance_days?: number | null
          carried_over_days?: number | null
          created_at?: string | null
          entitled_days?: number
          id?: string
          last_accrual_date?: string | null
          leave_type_id?: string | null
          total_accrued?: number | null
          updated_at?: string | null
          used_days?: number | null
          user_id?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_request_history: {
        Row: {
          action: string
          comments: string | null
          created_at: string | null
          id: string
          leave_request_id: string | null
          new_status: string | null
          old_status: string | null
          performed_by: string | null
        }
        Insert: {
          action: string
          comments?: string | null
          created_at?: string | null
          id?: string
          leave_request_id?: string | null
          new_status?: string | null
          old_status?: string | null
          performed_by?: string | null
        }
        Update: {
          action?: string
          comments?: string | null
          created_at?: string | null
          id?: string
          leave_request_id?: string | null
          new_status?: string | null
          old_status?: string | null
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_request_history_leave_request_id_fkey"
            columns: ["leave_request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_request_history_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approver_comments: string | null
          approver_id: string | null
          created_at: string | null
          days_requested: number
          end_date: string
          half_day_period: string | null
          id: string
          is_half_day: boolean | null
          leave_type_id: string | null
          reason: string
          start_date: string
          status: string | null
          supporting_document_url: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approver_comments?: string | null
          approver_id?: string | null
          created_at?: string | null
          days_requested: number
          end_date: string
          half_day_period?: string | null
          id?: string
          is_half_day?: boolean | null
          leave_type_id?: string | null
          reason: string
          start_date: string
          status?: string | null
          supporting_document_url?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approver_comments?: string | null
          approver_id?: string | null
          created_at?: string | null
          days_requested?: number
          end_date?: string
          half_day_period?: string | null
          id?: string
          is_half_day?: boolean | null
          leave_type_id?: string | null
          reason?: string
          start_date?: string
          status?: string | null
          supporting_document_url?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          accrual_frequency: string | null
          accrual_rate: number | null
          carryover_allowed: boolean | null
          code: string
          color: string | null
          created_at: string | null
          days_per_year: number
          description: string | null
          id: string
          is_active: boolean | null
          is_paid: boolean | null
          max_carryover_days: number | null
          min_notice_days: number | null
          name: string
          practice_id: string | null
          requires_approval: boolean | null
          supporting_documents_required: boolean | null
          updated_at: string | null
        }
        Insert: {
          accrual_frequency?: string | null
          accrual_rate?: number | null
          carryover_allowed?: boolean | null
          code: string
          color?: string | null
          created_at?: string | null
          days_per_year: number
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_paid?: boolean | null
          max_carryover_days?: number | null
          min_notice_days?: number | null
          name: string
          practice_id?: string | null
          requires_approval?: boolean | null
          supporting_documents_required?: boolean | null
          updated_at?: string | null
        }
        Update: {
          accrual_frequency?: string | null
          accrual_rate?: number | null
          carryover_allowed?: boolean | null
          code?: string
          color?: string | null
          created_at?: string | null
          days_per_year?: number
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_paid?: boolean | null
          max_carryover_days?: number | null
          min_notice_days?: number | null
          name?: string
          practice_id?: string | null
          requires_approval?: boolean | null
          supporting_documents_required?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_types_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_types_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "leave_types_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "leave_types_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "leave_types_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_types_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
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
      medications: {
        Row: {
          created_at: string | null
          dosage: string | null
          duration: string | null
          frequency: string | null
          id: string
          instructions: string | null
          medication_name: string
          notes: string | null
          patient_id: string | null
          prescribed_by: string | null
          prescribed_date: string | null
          status: string | null
          updated_at: string | null
          visit_id: string | null
        }
        Insert: {
          created_at?: string | null
          dosage?: string | null
          duration?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          medication_name: string
          notes?: string | null
          patient_id?: string | null
          prescribed_by?: string | null
          prescribed_date?: string | null
          status?: string | null
          updated_at?: string | null
          visit_id?: string | null
        }
        Update: {
          created_at?: string | null
          dosage?: string | null
          duration?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          medication_name?: string
          notes?: string | null
          patient_id?: string | null
          prescribed_by?: string | null
          prescribed_date?: string | null
          status?: string | null
          updated_at?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "today_visits_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
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
          is_processed: boolean | null
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
          is_processed?: boolean | null
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
          is_processed?: boolean | null
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
            referencedRelation: "today_visits_view"
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
      patient_imaging: {
        Row: {
          body_part: string | null
          clinical_indication: string | null
          contrast_used: boolean | null
          created_at: string | null
          description: string | null
          file_name: string
          file_size: number
          file_type: string
          findings: string | null
          id: string
          imaging_type: string
          impression: string | null
          instance_number: string | null
          instance_uid: string | null
          is_urgent: boolean | null
          metadata: Json | null
          mime_type: string
          modality: string | null
          original_name: string
          patient_id: string
          radiation_dose: number | null
          radiologist_name: string | null
          recommendations: string | null
          referring_physician: string | null
          series_number: string | null
          series_uid: string | null
          storage_bucket: string
          storage_path: string
          study_date: string | null
          study_time: string | null
          study_uid: string | null
          title: string | null
          updated_at: string | null
          uploaded_at: string | null
          uploaded_by: string
          view_position: string | null
          visit_id: string | null
        }
        Insert: {
          body_part?: string | null
          clinical_indication?: string | null
          contrast_used?: boolean | null
          created_at?: string | null
          description?: string | null
          file_name: string
          file_size: number
          file_type: string
          findings?: string | null
          id?: string
          imaging_type: string
          impression?: string | null
          instance_number?: string | null
          instance_uid?: string | null
          is_urgent?: boolean | null
          metadata?: Json | null
          mime_type: string
          modality?: string | null
          original_name: string
          patient_id: string
          radiation_dose?: number | null
          radiologist_name?: string | null
          recommendations?: string | null
          referring_physician?: string | null
          series_number?: string | null
          series_uid?: string | null
          storage_bucket?: string
          storage_path: string
          study_date?: string | null
          study_time?: string | null
          study_uid?: string | null
          title?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by: string
          view_position?: string | null
          visit_id?: string | null
        }
        Update: {
          body_part?: string | null
          clinical_indication?: string | null
          contrast_used?: boolean | null
          created_at?: string | null
          description?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          findings?: string | null
          id?: string
          imaging_type?: string
          impression?: string | null
          instance_number?: string | null
          instance_uid?: string | null
          is_urgent?: boolean | null
          metadata?: Json | null
          mime_type?: string
          modality?: string | null
          original_name?: string
          patient_id?: string
          radiation_dose?: number | null
          radiologist_name?: string | null
          recommendations?: string | null
          referring_physician?: string | null
          series_number?: string | null
          series_uid?: string | null
          storage_bucket?: string
          storage_path?: string
          study_date?: string | null
          study_time?: string | null
          study_uid?: string | null
          title?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string
          view_position?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_imaging_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_imaging_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_imaging_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "today_visits_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_imaging_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_laboratory: {
        Row: {
          created_at: string | null
          critical_result: boolean | null
          description: string | null
          file_name: string
          file_size: number
          file_type: string
          id: string
          is_abnormal: boolean | null
          lab_name: string | null
          metadata: Json | null
          mime_type: string
          notes: string | null
          original_name: string
          patient_id: string
          reference_number: string | null
          result_date: string | null
          status: string | null
          storage_bucket: string
          storage_path: string
          test_code: string | null
          test_date: string | null
          test_name: string | null
          test_type: string
          title: string | null
          updated_at: string | null
          uploaded_at: string | null
          uploaded_by: string
          visit_id: string | null
        }
        Insert: {
          created_at?: string | null
          critical_result?: boolean | null
          description?: string | null
          file_name: string
          file_size: number
          file_type: string
          id?: string
          is_abnormal?: boolean | null
          lab_name?: string | null
          metadata?: Json | null
          mime_type: string
          notes?: string | null
          original_name: string
          patient_id: string
          reference_number?: string | null
          result_date?: string | null
          status?: string | null
          storage_bucket?: string
          storage_path: string
          test_code?: string | null
          test_date?: string | null
          test_name?: string | null
          test_type: string
          title?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by: string
          visit_id?: string | null
        }
        Update: {
          created_at?: string | null
          critical_result?: boolean | null
          description?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          is_abnormal?: boolean | null
          lab_name?: string | null
          metadata?: Json | null
          mime_type?: string
          notes?: string | null
          original_name?: string
          patient_id?: string
          reference_number?: string | null
          result_date?: string | null
          status?: string | null
          storage_bucket?: string
          storage_path?: string
          test_code?: string | null
          test_date?: string | null
          test_name?: string | null
          test_type?: string
          title?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_laboratory_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_laboratory_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_laboratory_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "today_visits_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_laboratory_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_media: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          file_name: string
          file_size: number
          file_type: string
          id: string
          is_sensitive: boolean | null
          metadata: Json | null
          mime_type: string
          original_name: string
          patient_id: string
          storage_bucket: string
          storage_path: string
          subcategory: string | null
          tags: string[] | null
          title: string | null
          updated_at: string | null
          uploaded_at: string | null
          uploaded_by: string
          visit_id: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          file_name: string
          file_size: number
          file_type: string
          id?: string
          is_sensitive?: boolean | null
          metadata?: Json | null
          mime_type: string
          original_name: string
          patient_id: string
          storage_bucket?: string
          storage_path: string
          subcategory?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by: string
          visit_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          is_sensitive?: boolean | null
          metadata?: Json | null
          mime_type?: string
          original_name?: string
          patient_id?: string
          storage_bucket?: string
          storage_path?: string
          subcategory?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_media_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_media_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_media_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "today_visits_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_media_visit_id_fkey"
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
            foreignKeyName: "fk_patients_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_patients_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "fk_patients_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "fk_patients_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "fk_patients_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_patients_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
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
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "patients_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
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
      payslip_adjustments: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          component_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_approved: boolean | null
          month: number
          name: string
          payslip_id: string | null
          reason: string | null
          type: string | null
          updated_at: string | null
          user_id: string | null
          year: number
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          component_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_approved?: boolean | null
          month: number
          name: string
          payslip_id?: string | null
          reason?: string | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
          year: number
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          component_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_approved?: boolean | null
          month?: number
          name?: string
          payslip_id?: string | null
          reason?: string | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "payslip_adjustments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslip_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslip_adjustments_payslip_id_fkey"
            columns: ["payslip_id"]
            isOneToOne: false
            referencedRelation: "payslips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslip_adjustments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payslip_items: {
        Row: {
          amount: number
          component_id: string | null
          component_name: string
          created_at: string | null
          id: string
          payslip_id: string | null
          type: string
        }
        Insert: {
          amount: number
          component_id?: string | null
          component_name: string
          created_at?: string | null
          id?: string
          payslip_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          component_id?: string | null
          component_name?: string
          created_at?: string | null
          id?: string
          payslip_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payslip_items_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "salary_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslip_items_payslip_id_fkey"
            columns: ["payslip_id"]
            isOneToOne: false
            referencedRelation: "payslips"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          bank_details: Json | null
          basic_salary: number
          created_at: string | null
          employee_code: string | null
          gross_earnings: number
          id: string
          leave_balances: Json | null
          net_pay: number
          notes: string | null
          pay_period_end: string
          pay_period_start: string
          payment_date: string
          payment_method: string | null
          practice_name: string | null
          status: string | null
          total_deductions: number
          updated_at: string | null
          user_id: string | null
          ytd_gross_earnings: number | null
          ytd_net_pay: number | null
          ytd_total_deductions: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          bank_details?: Json | null
          basic_salary: number
          created_at?: string | null
          employee_code?: string | null
          gross_earnings: number
          id?: string
          leave_balances?: Json | null
          net_pay: number
          notes?: string | null
          pay_period_end: string
          pay_period_start: string
          payment_date: string
          payment_method?: string | null
          practice_name?: string | null
          status?: string | null
          total_deductions: number
          updated_at?: string | null
          user_id?: string | null
          ytd_gross_earnings?: number | null
          ytd_net_pay?: number | null
          ytd_total_deductions?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          bank_details?: Json | null
          basic_salary?: number
          created_at?: string | null
          employee_code?: string | null
          gross_earnings?: number
          id?: string
          leave_balances?: Json | null
          net_pay?: number
          notes?: string | null
          pay_period_end?: string
          pay_period_start?: string
          payment_date?: string
          payment_method?: string | null
          practice_name?: string | null
          status?: string | null
          total_deductions?: number
          updated_at?: string | null
          user_id?: string | null
          ytd_gross_earnings?: number | null
          ytd_net_pay?: number | null
          ytd_total_deductions?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payslips_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
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
            foreignKeyName: "fk_practice_analytics_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_practice_analytics_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "fk_practice_analytics_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "fk_practice_analytics_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "fk_practice_analytics_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_practice_analytics_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
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
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_analytics_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
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
      practice_documents: {
        Row: {
          created_at: string | null
          description: string | null
          document_type: string
          expiry_date: string | null
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          is_active: boolean | null
          name: string
          practice_id: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          document_type: string
          expiry_date?: string | null
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          practice_id: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          document_type?: string
          expiry_date?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          practice_id?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_documents_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_documents_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_documents_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_documents_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_documents_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_documents_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_email_subscriptions: {
        Row: {
          additional_emails_purchased: number | null
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
          additional_emails_purchased?: number | null
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
          additional_emails_purchased?: number | null
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
            foreignKeyName: "practice_email_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "email_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_email_subscriptions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_email_subscriptions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_email_subscriptions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_email_subscriptions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_email_subscriptions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_email_subscriptions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
        ]
      }
      practice_expense_templates: {
        Row: {
          account_number: string | null
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          default_amount: number | null
          description: string | null
          expense_category: string
          expense_type: string
          id: string
          is_active: boolean | null
          payment_frequency: string | null
          payment_method: string | null
          practice_id: string
          template_name: string
          updated_at: string | null
          updated_by: string | null
          vendor_contact: string | null
          vendor_name: string | null
        }
        Insert: {
          account_number?: string | null
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          default_amount?: number | null
          description?: string | null
          expense_category: string
          expense_type: string
          id?: string
          is_active?: boolean | null
          payment_frequency?: string | null
          payment_method?: string | null
          practice_id: string
          template_name: string
          updated_at?: string | null
          updated_by?: string | null
          vendor_contact?: string | null
          vendor_name?: string | null
        }
        Update: {
          account_number?: string | null
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          default_amount?: number | null
          description?: string | null
          expense_category?: string
          expense_type?: string
          id?: string
          is_active?: boolean | null
          payment_frequency?: string | null
          payment_method?: string | null
          practice_id?: string
          template_name?: string
          updated_at?: string | null
          updated_by?: string | null
          vendor_contact?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_expense_templates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_expense_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_expense_templates_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_expense_templates_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_expense_templates_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_expense_templates_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_expense_templates_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_expense_templates_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_expense_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_expenses: {
        Row: {
          account_number: string | null
          amount: number
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          description: string | null
          due_date: string | null
          expense_category: string
          expense_date: string
          expense_type: string
          id: string
          is_active: boolean | null
          is_recurring: boolean | null
          name: string
          next_payment_date: string | null
          paid_date: string | null
          payment_frequency: string | null
          payment_method: string | null
          practice_id: string
          status: string | null
          updated_at: string | null
          updated_by: string | null
          vendor_contact: string | null
          vendor_name: string | null
        }
        Insert: {
          account_number?: string | null
          amount: number
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          due_date?: string | null
          expense_category: string
          expense_date: string
          expense_type: string
          id?: string
          is_active?: boolean | null
          is_recurring?: boolean | null
          name: string
          next_payment_date?: string | null
          paid_date?: string | null
          payment_frequency?: string | null
          payment_method?: string | null
          practice_id: string
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
          vendor_contact?: string | null
          vendor_name?: string | null
        }
        Update: {
          account_number?: string | null
          amount?: number
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          due_date?: string | null
          expense_category?: string
          expense_date?: string
          expense_type?: string
          id?: string
          is_active?: boolean | null
          is_recurring?: boolean | null
          name?: string
          next_payment_date?: string | null
          paid_date?: string | null
          payment_frequency?: string | null
          payment_method?: string | null
          practice_id?: string
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
          vendor_contact?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_expenses_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_expenses_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_expenses_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_expenses_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_expenses_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_expenses_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_expenses_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_features: {
        Row: {
          created_at: string | null
          current_usage: number | null
          expires_at: string | null
          feature_key: string
          id: string
          is_enabled: boolean | null
          limit_value: number | null
          practice_id: string | null
          settings: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_usage?: number | null
          expires_at?: string | null
          feature_key: string
          id?: string
          is_enabled?: boolean | null
          limit_value?: number | null
          practice_id?: string | null
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_usage?: number | null
          expires_at?: string | null
          feature_key?: string
          id?: string
          is_enabled?: boolean | null
          limit_value?: number | null
          practice_id?: string | null
          settings?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_features_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_features_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_features_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_features_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_features_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_features_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
        ]
      }
      practice_inventory: {
        Row: {
          assignee_id: string | null
          category: string
          created_at: string | null
          description: string | null
          expiry_date: string | null
          id: string
          last_updated: string | null
          location: string | null
          name: string
          notes: string | null
          practice_id: string
          quantity: number
          reorder_level: number | null
          sku: string | null
          supplier: string | null
          total_value: number
          unit: string
          unit_cost: number
          updated_at: string | null
        }
        Insert: {
          assignee_id?: string | null
          category: string
          created_at?: string | null
          description?: string | null
          expiry_date?: string | null
          id?: string
          last_updated?: string | null
          location?: string | null
          name: string
          notes?: string | null
          practice_id: string
          quantity?: number
          reorder_level?: number | null
          sku?: string | null
          supplier?: string | null
          total_value?: number
          unit: string
          unit_cost?: number
          updated_at?: string | null
        }
        Update: {
          assignee_id?: string | null
          category?: string
          created_at?: string | null
          description?: string | null
          expiry_date?: string | null
          id?: string
          last_updated?: string | null
          location?: string | null
          name?: string
          notes?: string | null
          practice_id?: string
          quantity?: number
          reorder_level?: number | null
          sku?: string | null
          supplier?: string | null
          total_value?: number
          unit?: string
          unit_cost?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_inventory_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_inventory_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_inventory_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_inventory_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_inventory_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_inventory_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_inventory_practice_id_fkey"
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
            foreignKeyName: "practice_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
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
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_invitations_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
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
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_notification_templates_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
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
      practice_service_subscriptions: {
        Row: {
          auto_renew: boolean | null
          billing_cycle_end: string
          billing_cycle_start: string
          created_at: string | null
          current_usage: Json | null
          id: string
          practice_id: string | null
          service_plan_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          auto_renew?: boolean | null
          billing_cycle_end: string
          billing_cycle_start: string
          created_at?: string | null
          current_usage?: Json | null
          id?: string
          practice_id?: string | null
          service_plan_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_renew?: boolean | null
          billing_cycle_end?: string
          billing_cycle_start?: string
          created_at?: string | null
          current_usage?: Json | null
          id?: string
          practice_id?: string | null
          service_plan_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_service_subscriptions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_service_subscriptions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_service_subscriptions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_service_subscriptions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_service_subscriptions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_service_subscriptions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_service_subscriptions_service_plan_id_fkey"
            columns: ["service_plan_id"]
            isOneToOne: false
            referencedRelation: "service_plans"
            referencedColumns: ["id"]
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
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_settings_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
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
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_sms_subscriptions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
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
      practice_social_accounts: {
        Row: {
          access_token: string | null
          access_token_encrypted: string | null
          account_id: string | null
          account_name: string
          analytics_enabled: boolean | null
          api_base_url: string | null
          api_version: string | null
          app_id: string | null
          app_secret: string | null
          auto_post_enabled: boolean | null
          broadcasting_enabled: boolean | null
          business_category: string | null
          can_post: boolean | null
          can_post_images: boolean | null
          can_post_text: boolean | null
          can_post_videos: boolean | null
          can_schedule_posts: boolean | null
          client_id: string | null
          client_secret: string | null
          consecutive_failures: number | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string
          default_hashtags: string[] | null
          description: string | null
          follower_count: number | null
          follower_count_last_updated: string | null
          following_count: number | null
          id: string
          image_max_height: number | null
          image_max_size_mb: number | null
          image_max_width: number | null
          is_active: boolean | null
          is_business_account: boolean | null
          is_suspended: boolean | null
          is_verified: boolean | null
          last_analytics_sync: string | null
          last_broadcast_at: string | null
          last_broadcast_error: string | null
          last_sync_at: string | null
          latitude: number | null
          location_name: string | null
          longitude: number | null
          max_hashtags: number | null
          max_mentions: number | null
          max_text_length: number | null
          next_retry_at: string | null
          oauth_authorization_url: string | null
          oauth_authorized_at: string | null
          oauth_code_verifier: string | null
          oauth_state: string | null
          optimal_posting_times: string[] | null
          platform: string
          posting_timezone: string | null
          posts_count: number | null
          practice_id: string
          profile_url: string
          rate_limit_posts_per_day: number | null
          rate_limit_posts_per_hour: number | null
          rate_limit_reset_time: string | null
          refresh_token: string | null
          refresh_token_encrypted: string | null
          requires_approval: boolean | null
          supported_image_formats: string[] | null
          supported_video_formats: string[] | null
          supports_link_preview: boolean | null
          supports_live_streaming: boolean | null
          supports_polls: boolean | null
          supports_stories: boolean | null
          suspension_reason: string | null
          sync_error_message: string | null
          sync_status: string | null
          token_expires_at: string | null
          token_last_refreshed: string | null
          token_scope: string[] | null
          total_broadcasts_failed: number | null
          total_broadcasts_sent: number | null
          updated_at: string | null
          updated_by: string | null
          username: string | null
          video_max_duration_seconds: number | null
          video_max_size_mb: number | null
          webhook_secret: string | null
          webhook_url: string | null
          website_url: string | null
        }
        Insert: {
          access_token?: string | null
          access_token_encrypted?: string | null
          account_id?: string | null
          account_name: string
          analytics_enabled?: boolean | null
          api_base_url?: string | null
          api_version?: string | null
          app_id?: string | null
          app_secret?: string | null
          auto_post_enabled?: boolean | null
          broadcasting_enabled?: boolean | null
          business_category?: string | null
          can_post?: boolean | null
          can_post_images?: boolean | null
          can_post_text?: boolean | null
          can_post_videos?: boolean | null
          can_schedule_posts?: boolean | null
          client_id?: string | null
          client_secret?: string | null
          consecutive_failures?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by: string
          default_hashtags?: string[] | null
          description?: string | null
          follower_count?: number | null
          follower_count_last_updated?: string | null
          following_count?: number | null
          id?: string
          image_max_height?: number | null
          image_max_size_mb?: number | null
          image_max_width?: number | null
          is_active?: boolean | null
          is_business_account?: boolean | null
          is_suspended?: boolean | null
          is_verified?: boolean | null
          last_analytics_sync?: string | null
          last_broadcast_at?: string | null
          last_broadcast_error?: string | null
          last_sync_at?: string | null
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          max_hashtags?: number | null
          max_mentions?: number | null
          max_text_length?: number | null
          next_retry_at?: string | null
          oauth_authorization_url?: string | null
          oauth_authorized_at?: string | null
          oauth_code_verifier?: string | null
          oauth_state?: string | null
          optimal_posting_times?: string[] | null
          platform: string
          posting_timezone?: string | null
          posts_count?: number | null
          practice_id: string
          profile_url: string
          rate_limit_posts_per_day?: number | null
          rate_limit_posts_per_hour?: number | null
          rate_limit_reset_time?: string | null
          refresh_token?: string | null
          refresh_token_encrypted?: string | null
          requires_approval?: boolean | null
          supported_image_formats?: string[] | null
          supported_video_formats?: string[] | null
          supports_link_preview?: boolean | null
          supports_live_streaming?: boolean | null
          supports_polls?: boolean | null
          supports_stories?: boolean | null
          suspension_reason?: string | null
          sync_error_message?: string | null
          sync_status?: string | null
          token_expires_at?: string | null
          token_last_refreshed?: string | null
          token_scope?: string[] | null
          total_broadcasts_failed?: number | null
          total_broadcasts_sent?: number | null
          updated_at?: string | null
          updated_by?: string | null
          username?: string | null
          video_max_duration_seconds?: number | null
          video_max_size_mb?: number | null
          webhook_secret?: string | null
          webhook_url?: string | null
          website_url?: string | null
        }
        Update: {
          access_token?: string | null
          access_token_encrypted?: string | null
          account_id?: string | null
          account_name?: string
          analytics_enabled?: boolean | null
          api_base_url?: string | null
          api_version?: string | null
          app_id?: string | null
          app_secret?: string | null
          auto_post_enabled?: boolean | null
          broadcasting_enabled?: boolean | null
          business_category?: string | null
          can_post?: boolean | null
          can_post_images?: boolean | null
          can_post_text?: boolean | null
          can_post_videos?: boolean | null
          can_schedule_posts?: boolean | null
          client_id?: string | null
          client_secret?: string | null
          consecutive_failures?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string
          default_hashtags?: string[] | null
          description?: string | null
          follower_count?: number | null
          follower_count_last_updated?: string | null
          following_count?: number | null
          id?: string
          image_max_height?: number | null
          image_max_size_mb?: number | null
          image_max_width?: number | null
          is_active?: boolean | null
          is_business_account?: boolean | null
          is_suspended?: boolean | null
          is_verified?: boolean | null
          last_analytics_sync?: string | null
          last_broadcast_at?: string | null
          last_broadcast_error?: string | null
          last_sync_at?: string | null
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          max_hashtags?: number | null
          max_mentions?: number | null
          max_text_length?: number | null
          next_retry_at?: string | null
          oauth_authorization_url?: string | null
          oauth_authorized_at?: string | null
          oauth_code_verifier?: string | null
          oauth_state?: string | null
          optimal_posting_times?: string[] | null
          platform?: string
          posting_timezone?: string | null
          posts_count?: number | null
          practice_id?: string
          profile_url?: string
          rate_limit_posts_per_day?: number | null
          rate_limit_posts_per_hour?: number | null
          rate_limit_reset_time?: string | null
          refresh_token?: string | null
          refresh_token_encrypted?: string | null
          requires_approval?: boolean | null
          supported_image_formats?: string[] | null
          supported_video_formats?: string[] | null
          supports_link_preview?: boolean | null
          supports_live_streaming?: boolean | null
          supports_polls?: boolean | null
          supports_stories?: boolean | null
          suspension_reason?: string | null
          sync_error_message?: string | null
          sync_status?: string | null
          token_expires_at?: string | null
          token_last_refreshed?: string | null
          token_scope?: string[] | null
          total_broadcasts_failed?: number | null
          total_broadcasts_sent?: number | null
          updated_at?: string | null
          updated_by?: string | null
          username?: string | null
          video_max_duration_seconds?: number | null
          video_max_size_mb?: number | null
          webhook_secret?: string | null
          webhook_url?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_social_accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_social_accounts_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_social_accounts_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_social_accounts_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_social_accounts_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_social_accounts_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_social_accounts_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "practice_social_accounts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
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
          account_holder_name: string | null
          account_number: string | null
          account_type: string | null
          address: string | null
          admin_user_id: string | null
          bank_name: string | null
          branch_code: string | null
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
          is_follow_up_automation_enabled: boolean | null
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
          sms_limit: number | null
          sms_used: number | null
          social_links: Json | null
          status: string | null
          subscription_expires_at: string | null
          subscription_tier: string | null
          swift_code: string | null
          tax_number: string | null
          testimonials: Json | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          about_text?: string | null
          account_holder_name?: string | null
          account_number?: string | null
          account_type?: string | null
          address?: string | null
          admin_user_id?: string | null
          bank_name?: string | null
          branch_code?: string | null
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
          is_follow_up_automation_enabled?: boolean | null
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
          sms_limit?: number | null
          sms_used?: number | null
          social_links?: Json | null
          status?: string | null
          subscription_expires_at?: string | null
          subscription_tier?: string | null
          swift_code?: string | null
          tax_number?: string | null
          testimonials?: Json | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          about_text?: string | null
          account_holder_name?: string | null
          account_number?: string | null
          account_type?: string | null
          address?: string | null
          admin_user_id?: string | null
          bank_name?: string | null
          branch_code?: string | null
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
          is_follow_up_automation_enabled?: boolean | null
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
          sms_limit?: number | null
          sms_used?: number | null
          social_links?: Json | null
          status?: string | null
          subscription_expires_at?: string | null
          subscription_tier?: string | null
          swift_code?: string | null
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
            foreignKeyName: "practices_practice_type_id_fkey"
            columns: ["practice_type_id"]
            isOneToOne: false
            referencedRelation: "practice_types"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_components: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          is_recurring: boolean | null
          is_taxable: boolean | null
          name: string
          practice_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          is_taxable?: boolean | null
          name: string
          practice_id?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          is_taxable?: boolean | null
          name?: string
          practice_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_components_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_components_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "salary_components_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "salary_components_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "salary_components_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_components_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
        ]
      }
      service_plans: {
        Row: {
          created_at: string | null
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          limits: Json | null
          name: string
          plan_type: string
          price_monthly: number | null
          price_yearly: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          limits?: Json | null
          name: string
          plan_type: string
          price_monthly?: number | null
          price_yearly?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          limits?: Json | null
          name?: string
          plan_type?: string
          price_monthly?: number | null
          price_yearly?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sms_logs: {
        Row: {
          cost: number | null
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          id: string
          message_content: string
          message_id: string | null
          practice_id: string | null
          recipient_phone: string
          sent_at: string | null
          status: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message_content: string
          message_id?: string | null
          practice_id?: string | null
          recipient_phone: string
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message_content?: string
          message_id?: string | null
          practice_id?: string | null
          recipient_phone?: string
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "sms_logs_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "sms_logs_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "sms_logs_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
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
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "sms_portal_config_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: true
            referencedRelation: "practice_performance_dashboard"
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
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "sms_templates_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
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
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "sms_usage_logs_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
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
      social_media_accounts: {
        Row: {
          access_token: string | null
          account_name: string
          auto_post_enabled: boolean | null
          created_at: string | null
          follower_count: number | null
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          last_post_at: string | null
          page_id: string | null
          platform: string
          post_frequency: string | null
          practice_id: string
          profile_url: string
          refresh_token: string | null
          settings: Json | null
          token_expires_at: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          access_token?: string | null
          account_name: string
          auto_post_enabled?: boolean | null
          created_at?: string | null
          follower_count?: number | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          last_post_at?: string | null
          page_id?: string | null
          platform: string
          post_frequency?: string | null
          practice_id: string
          profile_url: string
          refresh_token?: string | null
          settings?: Json | null
          token_expires_at?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          access_token?: string | null
          account_name?: string
          auto_post_enabled?: boolean | null
          created_at?: string | null
          follower_count?: number | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          last_post_at?: string | null
          page_id?: string | null
          platform?: string
          post_frequency?: string | null
          practice_id?: string
          profile_url?: string
          refresh_token?: string | null
          settings?: Json | null
          token_expires_at?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_media_accounts_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_media_accounts_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "social_media_accounts_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "social_media_accounts_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "social_media_accounts_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_media_accounts_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
        ]
      }
      staff_titles: {
        Row: {
          code: string | null
          created_at: string | null
          department_id: string | null
          id: string
          is_active: boolean | null
          name: string
          practice_id: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          department_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          practice_id?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          department_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          practice_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_titles_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_titles_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "staff_titles_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "staff_titles_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "staff_titles_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_titles_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
        ]
      }
      system_config: {
        Row: {
          config_key: string
          config_type: string | null
          config_value: Json
          created_at: string | null
          description: string | null
          id: string
          is_public: boolean | null
          updated_at: string | null
        }
        Insert: {
          config_key: string
          config_type?: string | null
          config_value: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          updated_at?: string | null
        }
        Update: {
          config_key?: string
          config_type?: string | null
          config_value?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      timesheet_entries: {
        Row: {
          break_duration: unknown | null
          created_at: string | null
          date: string
          end_time: string | null
          id: string
          is_holiday: boolean | null
          is_overtime: boolean | null
          project_code: string | null
          start_time: string | null
          task_description: string | null
          timesheet_id: string | null
          total_hours: number
          updated_at: string | null
        }
        Insert: {
          break_duration?: unknown | null
          created_at?: string | null
          date: string
          end_time?: string | null
          id?: string
          is_holiday?: boolean | null
          is_overtime?: boolean | null
          project_code?: string | null
          start_time?: string | null
          task_description?: string | null
          timesheet_id?: string | null
          total_hours: number
          updated_at?: string | null
        }
        Update: {
          break_duration?: unknown | null
          created_at?: string | null
          date?: string
          end_time?: string | null
          id?: string
          is_holiday?: boolean | null
          is_overtime?: boolean | null
          project_code?: string | null
          start_time?: string | null
          task_description?: string | null
          timesheet_id?: string | null
          total_hours?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_entries_timesheet_id_fkey"
            columns: ["timesheet_id"]
            isOneToOne: false
            referencedRelation: "timesheets"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets: {
        Row: {
          approved_at: string | null
          approver_comments: string | null
          approver_id: string | null
          created_at: string | null
          id: string
          notes: string | null
          overtime_hours: number | null
          pdf_url: string | null
          period_end: string
          period_start: string
          regular_hours: number | null
          status: string | null
          submitted_at: string | null
          total_hours: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approver_comments?: string | null
          approver_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          overtime_hours?: number | null
          pdf_url?: string | null
          period_end: string
          period_start: string
          regular_hours?: number | null
          status?: string | null
          submitted_at?: string | null
          total_hours?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approver_comments?: string | null
          approver_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          overtime_hours?: number | null
          pdf_url?: string | null
          period_end?: string
          period_start?: string
          regular_hours?: number | null
          status?: string | null
          submitted_at?: string | null
          total_hours?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_practice_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          is_active: boolean | null
          practice_id: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          is_active?: boolean | null
          practice_id?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          is_active?: boolean | null
          practice_id?: string | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_practice_assignments_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_practice_assignments_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "user_practice_assignments_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "user_practice_assignments_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "user_practice_assignments_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_practice_assignments_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          account_number: string | null
          account_type: string | null
          address: string | null
          allowed_branches: string[] | null
          avatar: string | null
          bank_name: string | null
          branch_code: string | null
          branch_id: string | null
          can_manage_practices: boolean | null
          contact_number: string | null
          created_at: string | null
          department: string | null
          email: string
          employee_number: string | null
          full_name: string
          hpcsa_number: string | null
          id: string
          is_active: boolean | null
          is_super_admin: boolean | null
          job_title: string | null
          last_active_at: string | null
          last_login: string | null
          permissions: Json | null
          practice_id: string | null
          reporting_manager_id: string | null
          role: string
          staff_title: string | null
          start_date: string | null
          swift_code: string | null
          updated_at: string | null
        }
        Insert: {
          account_number?: string | null
          account_type?: string | null
          address?: string | null
          allowed_branches?: string[] | null
          avatar?: string | null
          bank_name?: string | null
          branch_code?: string | null
          branch_id?: string | null
          can_manage_practices?: boolean | null
          contact_number?: string | null
          created_at?: string | null
          department?: string | null
          email: string
          employee_number?: string | null
          full_name: string
          hpcsa_number?: string | null
          id?: string
          is_active?: boolean | null
          is_super_admin?: boolean | null
          job_title?: string | null
          last_active_at?: string | null
          last_login?: string | null
          permissions?: Json | null
          practice_id?: string | null
          reporting_manager_id?: string | null
          role: string
          staff_title?: string | null
          start_date?: string | null
          swift_code?: string | null
          updated_at?: string | null
        }
        Update: {
          account_number?: string | null
          account_type?: string | null
          address?: string | null
          allowed_branches?: string[] | null
          avatar?: string | null
          bank_name?: string | null
          branch_code?: string | null
          branch_id?: string | null
          can_manage_practices?: boolean | null
          contact_number?: string | null
          created_at?: string | null
          department?: string | null
          email?: string
          employee_number?: string | null
          full_name?: string
          hpcsa_number?: string | null
          id?: string
          is_active?: boolean | null
          is_super_admin?: boolean | null
          job_title?: string | null
          last_active_at?: string | null
          last_login?: string | null
          permissions?: Json | null
          practice_id?: string | null
          reporting_manager_id?: string | null
          role?: string
          staff_title?: string | null
          start_date?: string | null
          swift_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "users_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
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
          {
            foreignKeyName: "users_reporting_manager_id_fkey"
            columns: ["reporting_manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          applied_template_id: string | null
          branch_id: string | null
          care_plan_step: number | null
          chief_complaint: string | null
          created_at: string | null
          diagnosis: string | null
          doctor_id: string | null
          encounter_date: string | null
          follow_up_date: string | null
          follow_up_required: boolean | null
          id: string
          is_cancelled: boolean | null
          is_checked_in: boolean | null
          is_confirmed: boolean | null
          is_from_website: boolean | null
          is_handoff: boolean | null
          is_ready: boolean | null
          is_scheduled: boolean | null
          notes: string | null
          patient_id: string | null
          practice_id: string | null
          preceding_visit_id: string | null
          prescription: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          status: string
          treatment_plan: string | null
          updated_at: string | null
          visit_date: string | null
          visit_number: number | null
          visit_time: string | null
          visit_type: string
        }
        Insert: {
          applied_template_id?: string | null
          branch_id?: string | null
          care_plan_step?: number | null
          chief_complaint?: string | null
          created_at?: string | null
          diagnosis?: string | null
          doctor_id?: string | null
          encounter_date?: string | null
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          id?: string
          is_cancelled?: boolean | null
          is_checked_in?: boolean | null
          is_confirmed?: boolean | null
          is_from_website?: boolean | null
          is_handoff?: boolean | null
          is_ready?: boolean | null
          is_scheduled?: boolean | null
          notes?: string | null
          patient_id?: string | null
          practice_id?: string | null
          preceding_visit_id?: string | null
          prescription?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: string
          treatment_plan?: string | null
          updated_at?: string | null
          visit_date?: string | null
          visit_number?: number | null
          visit_time?: string | null
          visit_type: string
        }
        Update: {
          applied_template_id?: string | null
          branch_id?: string | null
          care_plan_step?: number | null
          chief_complaint?: string | null
          created_at?: string | null
          diagnosis?: string | null
          doctor_id?: string | null
          encounter_date?: string | null
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          id?: string
          is_cancelled?: boolean | null
          is_checked_in?: boolean | null
          is_confirmed?: boolean | null
          is_from_website?: boolean | null
          is_handoff?: boolean | null
          is_ready?: boolean | null
          is_scheduled?: boolean | null
          notes?: string | null
          patient_id?: string | null
          practice_id?: string | null
          preceding_visit_id?: string | null
          prescription?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: string
          treatment_plan?: string | null
          updated_at?: string | null
          visit_date?: string | null
          visit_number?: number | null
          visit_time?: string | null
          visit_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_visits_patient_id"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_visits_patient_id"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_visits_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_visits_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "fk_visits_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "fk_visits_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "fk_visits_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_visits_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "visits_applied_template_id_fkey"
            columns: ["applied_template_id"]
            isOneToOne: false
            referencedRelation: "follow_up_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
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
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "visits_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
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
          {
            foreignKeyName: "visits_preceding_visit_id_fkey"
            columns: ["preceding_visit_id"]
            isOneToOne: false
            referencedRelation: "today_visits_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_preceding_visit_id_fkey"
            columns: ["preceding_visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
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
            foreignKeyName: "fk_vitals_visit_id"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "today_visits_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_vitals_visit_id"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitals_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "today_visits_view"
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
      dashboard_stats_mv: {
        Row: {
          completed_visits: number | null
          email_limit: number | null
          email_usage: number | null
          female_patients: number | null
          in_progress_visits: number | null
          last_refreshed: string | null
          male_patients: number | null
          new_patients_month: number | null
          new_patients_week: number | null
          pending_visits: number | null
          practice_id: string | null
          quarterly_invoices: number | null
          quarterly_paid_invoices: number | null
          quarterly_revenue: number | null
          sms_limit: number | null
          sms_usage: number | null
          today_visits: number | null
          total_invoices: number | null
          total_patients: number | null
          total_revenue: number | null
          total_visits: number | null
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
      medications_with_details: {
        Row: {
          cell_number: string | null
          chief_complaint: string | null
          created_at: string | null
          date_of_birth: string | null
          diagnosis: string | null
          dosage: string | null
          duration: string | null
          encounter_date: string | null
          frequency: string | null
          id: string | null
          instructions: string | null
          medication_name: string | null
          notes: string | null
          patient_id: string | null
          patient_name: string | null
          prescribed_by: string | null
          prescribed_by_email: string | null
          prescribed_date: string | null
          status: string | null
          treatment_plan: string | null
          updated_at: string | null
          visit_date: string | null
          visit_id: string | null
          visit_number: number | null
          visit_time: string | null
          visit_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "today_visits_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
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
      practice_performance_dashboard: {
        Row: {
          active_services: number | null
          appointments_last_30_days: number | null
          appointments_last_7_days: number | null
          cancelled_appointments: number | null
          city: string | null
          completed_appointments: number | null
          completion_rate_percentage: number | null
          contact_email: string | null
          contact_phone: string | null
          new_patients_30_days: number | null
          new_patients_7_days: number | null
          no_show_appointments: number | null
          practice_created_at: string | null
          practice_id: string | null
          practice_name: string | null
          slug: string | null
          sms_current_usage: number | null
          sms_monthly_limit: number | null
          sms_sent_last_30_days: number | null
          sms_usage_percentage: number | null
          status: string | null
          subscription_tier: string | null
          total_appointments: number | null
          total_patients: number | null
          total_potential_revenue: number | null
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
      service_usage_frequency: {
        Row: {
          code: string | null
          description: string | null
          first_used: string | null
          frequency_rank: number | null
          last_used: string | null
          usage_count: number | null
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
      today_visits_view: {
        Row: {
          chief_complaint: string | null
          created_at: string | null
          doctor_full_name: string | null
          doctor_id: string | null
          doctor_role: string | null
          id: string | null
          is_cancelled: boolean | null
          is_checked_in: boolean | null
          is_confirmed: boolean | null
          is_ready: boolean | null
          is_scheduled: boolean | null
          notes: string | null
          patient_cell_number: string | null
          patient_date_of_birth: string | null
          patient_email: string | null
          patient_first_name: string | null
          patient_id: string | null
          patient_last_name: string | null
          practice_id: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          status: string | null
          updated_at: string | null
          visit_date: string | null
          visit_time: string | null
          visit_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_visits_patient_id"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_visits_patient_id"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_visits_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "admin_practice_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_visits_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "appointment_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "fk_visits_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "fk_visits_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "fk_visits_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_visits_practice_id"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "sms_analytics"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "visits_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
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
            referencedRelation: "dashboard_stats_mv"
            referencedColumns: ["practice_id"]
          },
          {
            foreignKeyName: "visits_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_performance_dashboard"
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
    }
    Functions: {
      add_invoice_to_batch: {
        Args: { p_batch_id: string; p_invoice_id: string }
        Returns: undefined
      }
      calculate_leave_accrual: {
        Args: { p_user_id: string; p_leave_type_id: string; p_year: number }
        Returns: {
          months_worked: number
          total_accrued: number
          used_days: number
          balance_days: number
        }[]
      }
      calculate_leave_days: {
        Args: { start_date: string; end_date: string; is_half_day: boolean }
        Returns: number
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
      exec_raw_sql: {
        Args: { sql_query: string }
        Returns: string
      }
      generate_invoice_number: {
        Args: { p_practice_id: string }
        Returns: string
      }
      get_appointment_stats: {
        Args: { p_practice_id: string; p_date?: string }
        Returns: {
          total_appointments: number
          confirmed_count: number
          pending_count: number
          completed_count: number
          cancelled_count: number
          no_show_count: number
          in_progress_count: number
        }[]
      }
      get_appointments_optimized: {
        Args: {
          p_practice_id: string
          p_date?: string
          p_doctor_id?: string
          p_status?: string
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          id: string
          patient_id: string
          doctor_id: string
          scheduled_date: string
          scheduled_time: string
          visit_type: string
          status: string
          is_confirmed: boolean
          is_cancelled: boolean
          patient_name: string
          patient_phone: string
          doctor_name: string
        }[]
      }
      get_dashboard_stats: {
        Args: { p_practice_id: string }
        Returns: Json
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
      get_visit_state: {
        Args: { visit_row: Database["public"]["Tables"]["visits"]["Row"] }
        Returns: string
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
      refresh_dashboard_stats: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_today_visits_view: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      sync_invoice_to_batch: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      transition_visit_state: {
        Args: { visit_id: string; new_state: string }
        Returns: boolean
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
