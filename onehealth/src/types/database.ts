export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin' | 'practice_manager' | 'doctor' | 'nurse' | 'receptionist'
export type PracticeStatus = 'active' | 'inactive' | 'suspended'
export type TariffCategory = 'consultation' | 'procedure' | 'diagnostic' | 'treatment' | 'emergency'
export type BillingStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'

export interface Database {
  public: {
    Tables: {
      practices: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          email: string | null
          phone: string | null
          website: string | null
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          state_province: string | null
          postal_code: string | null
          country: string | null
          specialties: string[] | null
          license_number: string | null
          tax_number: string | null
          registration_number: string | null
          business_hours: Json | null
          timezone: string | null
          currency: string | null
          language: string | null
          status: PracticeStatus | null
          logo_url: string | null
          banner_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          email?: string | null
          phone?: string | null
          website?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          state_province?: string | null
          postal_code?: string | null
          country?: string | null
          specialties?: string[] | null
          license_number?: string | null
          tax_number?: string | null
          registration_number?: string | null
          business_hours?: Json | null
          timezone?: string | null
          currency?: string | null
          language?: string | null
          status?: PracticeStatus | null
          logo_url?: string | null
          banner_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          email?: string | null
          phone?: string | null
          website?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          state_province?: string | null
          postal_code?: string | null
          country?: string | null
          specialties?: string[] | null
          license_number?: string | null
          tax_number?: string | null
          registration_number?: string | null
          business_hours?: Json | null
          timezone?: string | null
          currency?: string | null
          language?: string | null
          status?: PracticeStatus | null
          logo_url?: string | null
          banner_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_profiles: {
        Row: {
          id: string
          first_name: string | null
          last_name: string | null
          title: string | null
          display_name: string | null
          email: string | null
          phone: string | null
          mobile: string | null
          role: UserRole
          license_number: string | null
          specialization: string | null
          qualifications: string[] | null
          avatar_url: string | null
          bio: string | null
          preferences: Json | null
          notification_settings: Json | null
          is_active: boolean | null
          last_login_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          first_name?: string | null
          last_name?: string | null
          title?: string | null
          display_name?: string | null
          email?: string | null
          phone?: string | null
          mobile?: string | null
          role?: UserRole
          license_number?: string | null
          specialization?: string | null
          qualifications?: string[] | null
          avatar_url?: string | null
          bio?: string | null
          preferences?: Json | null
          notification_settings?: Json | null
          is_active?: boolean | null
          last_login_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          first_name?: string | null
          last_name?: string | null
          title?: string | null
          display_name?: string | null
          email?: string | null
          phone?: string | null
          mobile?: string | null
          role?: UserRole
          license_number?: string | null
          specialization?: string | null
          qualifications?: string[] | null
          avatar_url?: string | null
          bio?: string | null
          preferences?: Json | null
          notification_settings?: Json | null
          is_active?: boolean | null
          last_login_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_practice_assignments: {
        Row: {
          id: string
          user_id: string
          practice_id: string
          role: UserRole
          is_primary: boolean | null
          permissions: Json | null
          schedule: Json | null
          is_active: boolean | null
          start_date: string | null
          end_date: string | null
          assigned_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          practice_id: string
          role: UserRole
          is_primary?: boolean | null
          permissions?: Json | null
          schedule?: Json | null
          is_active?: boolean | null
          start_date?: string | null
          end_date?: string | null
          assigned_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          practice_id?: string
          role?: UserRole
          is_primary?: boolean | null
          permissions?: Json | null
          schedule?: Json | null
          is_active?: boolean | null
          start_date?: string | null
          end_date?: string | null
          assigned_at?: string
          updated_at?: string
        }
      }
      tariffs: {
        Row: {
          id: string
          practice_id: string
          code: string
          name: string
          description: string | null
          category: TariffCategory
          base_price: number
          currency: string | null
          medical_aid_rates: Json | null
          unit: string | null
          duration_minutes: number | null
          tags: string[] | null
          is_emergency: boolean | null
          requires_authorization: boolean | null
          is_active: boolean | null
          effective_from: string | null
          effective_until: string | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          practice_id: string
          code: string
          name: string
          description?: string | null
          category: TariffCategory
          base_price: number
          currency?: string | null
          medical_aid_rates?: Json | null
          unit?: string | null
          duration_minutes?: number | null
          tags?: string[] | null
          is_emergency?: boolean | null
          requires_authorization?: boolean | null
          is_active?: boolean | null
          effective_from?: string | null
          effective_until?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          practice_id?: string
          code?: string
          name?: string
          description?: string | null
          category?: TariffCategory
          base_price?: number
          currency?: string | null
          medical_aid_rates?: Json | null
          unit?: string | null
          duration_minutes?: number | null
          tags?: string[] | null
          is_emergency?: boolean | null
          requires_authorization?: boolean | null
          is_active?: boolean | null
          effective_from?: string | null
          effective_until?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
      }
      tariff_history: {
        Row: {
          id: string
          tariff_id: string
          old_price: number | null
          new_price: number | null
          change_reason: string | null
          changed_by: string | null
          changed_at: string
          effective_date: string | null
        }
        Insert: {
          id?: string
          tariff_id: string
          old_price?: number | null
          new_price?: number | null
          change_reason?: string | null
          changed_by?: string | null
          changed_at?: string
          effective_date?: string | null
        }
        Update: {
          id?: string
          tariff_id?: string
          old_price?: number | null
          new_price?: number | null
          change_reason?: string | null
          changed_by?: string | null
          changed_at?: string
          effective_date?: string | null
        }
      }
      practice_settings: {
        Row: {
          id: string
          practice_id: string
          category: string
          key: string
          value: Json
          description: string | null
          is_system: boolean | null
          created_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          practice_id: string
          category: string
          key: string
          value: Json
          description?: string | null
          is_system?: boolean | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          practice_id?: string
          category?: string
          key?: string
          value?: Json
          description?: string | null
          is_system?: boolean | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
      }
      patients: {
        Row: {
          id: string
          practice_id: string
          patient_number: string | null
          first_name: string
          last_name: string
          title: string | null
          preferred_name: string | null
          email: string | null
          phone: string | null
          mobile: string | null
          date_of_birth: string | null
          gender: string | null
          id_number: string | null
          nationality: string | null
          language: string | null
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          state_province: string | null
          postal_code: string | null
          country: string | null
          blood_type: string | null
          allergies: string[] | null
          chronic_conditions: string[] | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          medical_aid_provider: string | null
          medical_aid_number: string | null
          medical_aid_scheme: string | null
          is_active: boolean | null
          communication_preferences: Json | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          practice_id: string
          patient_number?: string | null
          first_name: string
          last_name: string
          title?: string | null
          preferred_name?: string | null
          email?: string | null
          phone?: string | null
          mobile?: string | null
          date_of_birth?: string | null
          gender?: string | null
          id_number?: string | null
          nationality?: string | null
          language?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          state_province?: string | null
          postal_code?: string | null
          country?: string | null
          blood_type?: string | null
          allergies?: string[] | null
          chronic_conditions?: string[] | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          medical_aid_provider?: string | null
          medical_aid_number?: string | null
          medical_aid_scheme?: string | null
          is_active?: boolean | null
          communication_preferences?: Json | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          practice_id?: string
          patient_number?: string | null
          first_name?: string
          last_name?: string
          title?: string | null
          preferred_name?: string | null
          email?: string | null
          phone?: string | null
          mobile?: string | null
          date_of_birth?: string | null
          gender?: string | null
          id_number?: string | null
          nationality?: string | null
          language?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          state_province?: string | null
          postal_code?: string | null
          country?: string | null
          blood_type?: string | null
          allergies?: string[] | null
          chronic_conditions?: string[] | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          medical_aid_provider?: string | null
          medical_aid_number?: string | null
          medical_aid_scheme?: string | null
          is_active?: boolean | null
          communication_preferences?: Json | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
      }
      appointments: {
        Row: {
          id: string
          practice_id: string
          patient_id: string
          doctor_id: string | null
          appointment_number: string | null
          title: string | null
          description: string | null
          appointment_date: string
          start_time: string
          end_time: string
          duration_minutes: number | null
          type: string | null
          category: string | null
          priority: string | null
          status: AppointmentStatus | null
          notes: string | null
          internal_notes: string | null
          estimated_cost: number | null
          tariff_ids: string[] | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          practice_id: string
          patient_id: string
          doctor_id?: string | null
          appointment_number?: string | null
          title?: string | null
          description?: string | null
          appointment_date: string
          start_time: string
          end_time: string
          type?: string | null
          category?: string | null
          priority?: string | null
          status?: AppointmentStatus | null
          notes?: string | null
          internal_notes?: string | null
          estimated_cost?: number | null
          tariff_ids?: string[] | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          practice_id?: string
          patient_id?: string
          doctor_id?: string | null
          appointment_number?: string | null
          title?: string | null
          description?: string | null
          appointment_date?: string
          start_time?: string
          end_time?: string
          type?: string | null
          category?: string | null
          priority?: string | null
          status?: AppointmentStatus | null
          notes?: string | null
          internal_notes?: string | null
          estimated_cost?: number | null
          tariff_ids?: string[] | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
      }
      billing_records: {
        Row: {
          id: string
          practice_id: string
          patient_id: string
          appointment_id: string | null
          invoice_number: string
          reference_number: string | null
          subtotal: number
          tax_amount: number
          discount_amount: number
          total_amount: number
          currency: string | null
          status: BillingStatus | null
          issue_date: string | null
          due_date: string | null
          paid_date: string | null
          payment_method: string | null
          payment_reference: string | null
          line_items: Json
          notes: string | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          practice_id: string
          patient_id: string
          appointment_id?: string | null
          invoice_number: string
          reference_number?: string | null
          subtotal?: number
          tax_amount?: number
          discount_amount?: number
          total_amount: number
          currency?: string | null
          status?: BillingStatus | null
          issue_date?: string | null
          due_date?: string | null
          paid_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          line_items?: Json
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          practice_id?: string
          patient_id?: string
          appointment_id?: string | null
          invoice_number?: string
          reference_number?: string | null
          subtotal?: number
          tax_amount?: number
          discount_amount?: number
          total_amount?: number
          currency?: string | null
          status?: BillingStatus | null
          issue_date?: string | null
          due_date?: string | null
          paid_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          line_items?: Json
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
      }
      audit_logs: {
        Row: {
          id: string
          practice_id: string | null
          entity_type: string
          entity_id: string | null
          action: string
          old_values: Json | null
          new_values: Json | null
          changes: Json | null
          user_id: string | null
          ip_address: string | null
          user_agent: string | null
          description: string | null
          severity: string | null
          created_at: string
        }
        Insert: {
          id?: string
          practice_id?: string | null
          entity_type: string
          entity_id?: string | null
          action: string
          old_values?: Json | null
          new_values?: Json | null
          changes?: Json | null
          user_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          description?: string | null
          severity?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          practice_id?: string | null
          entity_type?: string
          entity_id?: string | null
          action?: string
          old_values?: Json | null
          new_values?: Json | null
          changes?: Json | null
          user_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          description?: string | null
          severity?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      appointment_status: AppointmentStatus
      billing_status: BillingStatus
      practice_status: PracticeStatus
      tariff_category: TariffCategory
      user_role: UserRole
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}