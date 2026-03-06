export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      oli_conversation_participants: {
        Row: {
          conversation_id: string
          joined_at: string
          last_read_at: string | null
          muted_until: string | null
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          last_read_at?: string | null
          muted_until?: string | null
          role?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          last_read_at?: string | null
          muted_until?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oli_conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "oli_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      oli_conversations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          last_message_at: string | null
          subject: string | null
          type: Database["public"]["Enums"]["oli_conversation_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          last_message_at?: string | null
          subject?: string | null
          type?: Database["public"]["Enums"]["oli_conversation_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          last_message_at?: string | null
          subject?: string | null
          type?: Database["public"]["Enums"]["oli_conversation_type"]
          updated_at?: string
        }
        Relationships: []
      }
      oli_driver_licenses: {
        Row: {
          back_path: string | null
          category: string | null
          codigo_segurança: number | null
          cpf: number | null
          created_at: string
          document_url: string | null
          expires_at: string | null
          front_path: string | null
          full_name: string | null
          id: string
          license_number: string | null
          nome_mae: string | null
          notes: string | null
          selfie_path: string | null
          status: Database["public"]["Enums"]["oli_driver_license_status"]
          storage_path: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          back_path?: string | null
          category?: string | null
          codigo_segurança?: number | null
          cpf?: number | null
          created_at?: string
          document_url?: string | null
          expires_at?: string | null
          front_path?: string | null
          full_name?: string | null
          id?: string
          license_number?: string | null
          nome_mae?: string | null
          notes?: string | null
          selfie_path?: string | null
          status?: Database["public"]["Enums"]["oli_driver_license_status"]
          storage_path?: string | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          back_path?: string | null
          category?: string | null
          codigo_segurança?: number | null
          cpf?: number | null
          created_at?: string
          document_url?: string | null
          expires_at?: string | null
          front_path?: string | null
          full_name?: string | null
          id?: string
          license_number?: string | null
          nome_mae?: string | null
          notes?: string | null
          selfie_path?: string | null
          status?: Database["public"]["Enums"]["oli_driver_license_status"]
          storage_path?: string | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      oli_inspection_photos: {
        Row: {
          ai_damage_detected: boolean
          ai_labels: Json | null
          created_at: string
          description: string | null
          has_damage: boolean
          id: string
          image_url: string
          inspection_id: string
          metadata: Json | null
          photo_type: string | null
          sort_order: number | null
          updated_at: string
          uploaded_by: string | null
          validation_confidence: number | null
          validation_reason: string | null
          validation_status: Database["public"]["Enums"]["inspection_photo_status"]
        }
        Insert: {
          ai_damage_detected?: boolean
          ai_labels?: Json | null
          created_at?: string
          description?: string | null
          has_damage?: boolean
          id?: string
          image_url: string
          inspection_id: string
          metadata?: Json | null
          photo_type?: string | null
          sort_order?: number | null
          updated_at?: string
          uploaded_by?: string | null
          validation_confidence?: number | null
          validation_reason?: string | null
          validation_status?: Database["public"]["Enums"]["inspection_photo_status"]
        }
        Update: {
          ai_damage_detected?: boolean
          ai_labels?: Json | null
          created_at?: string
          description?: string | null
          has_damage?: boolean
          id?: string
          image_url?: string
          inspection_id?: string
          metadata?: Json | null
          photo_type?: string | null
          sort_order?: number | null
          updated_at?: string
          uploaded_by?: string | null
          validation_confidence?: number | null
          validation_reason?: string | null
          validation_status?: Database["public"]["Enums"]["inspection_photo_status"]
        }
        Relationships: [
          {
            foreignKeyName: "oli_inspection_photos_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "oli_inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      oli_inspections: {
        Row: {
          actor_role:
            | Database["public"]["Enums"]["oli_inspection_actor_role"]
            | null
          approved_photos_count: number
          completed_at: string | null
          created_at: string
          id: string
          inspection_kind: Database["public"]["Enums"]["oli_inspection_kind"]
          inspection_stage: string | null
          notes: string | null
          owner_approved_at: string | null
          performed_by: string
          rejected_photos_count: number
          rental_id: string
          renter_approved_at: string | null
          required_photos_count: number
          side: Database["public"]["Enums"]["oli_inspection_side"]
          status: string
          submitted_at: string | null
          uploaded_photos_count: number
          validated_at: string | null
          validated_by_ai: boolean
          validation_summary: string | null
          vehicle_id: string
          webhook_payload: Json | null
        }
        Insert: {
          actor_role?:
            | Database["public"]["Enums"]["oli_inspection_actor_role"]
            | null
          approved_photos_count?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          inspection_kind: Database["public"]["Enums"]["oli_inspection_kind"]
          inspection_stage?: string | null
          notes?: string | null
          owner_approved_at?: string | null
          performed_by: string
          rejected_photos_count?: number
          rental_id: string
          renter_approved_at?: string | null
          required_photos_count?: number
          side: Database["public"]["Enums"]["oli_inspection_side"]
          status?: string
          submitted_at?: string | null
          uploaded_photos_count?: number
          validated_at?: string | null
          validated_by_ai?: boolean
          validation_summary?: string | null
          vehicle_id: string
          webhook_payload?: Json | null
        }
        Update: {
          actor_role?:
            | Database["public"]["Enums"]["oli_inspection_actor_role"]
            | null
          approved_photos_count?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          inspection_kind?: Database["public"]["Enums"]["oli_inspection_kind"]
          inspection_stage?: string | null
          notes?: string | null
          owner_approved_at?: string | null
          performed_by?: string
          rejected_photos_count?: number
          rental_id?: string
          renter_approved_at?: string | null
          required_photos_count?: number
          side?: Database["public"]["Enums"]["oli_inspection_side"]
          status?: string
          submitted_at?: string | null
          uploaded_photos_count?: number
          validated_at?: string | null
          validated_by_ai?: boolean
          validation_summary?: string | null
          vehicle_id?: string
          webhook_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "oli_inspections_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "oli_rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oli_inspections_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "oli_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      oli_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          metadata: Json
          sender_id: string
          type: Database["public"]["Enums"]["oli_message_type"]
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          metadata?: Json
          sender_id: string
          type?: Database["public"]["Enums"]["oli_message_type"]
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          metadata?: Json
          sender_id?: string
          type?: Database["public"]["Enums"]["oli_message_type"]
        }
        Relationships: [
          {
            foreignKeyName: "oli_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "oli_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      oli_payments: {
        Row: {
          amount: number
          bank_slip_url: string | null
          billingType: string | null
          created_at: string
          due_date: string | null
          external_reference: string | null
          id: string
          invoice_url: string | null
          method: string | null
          payment_link: string | null
          payment_type: string
          pix_copy_paste: string | null
          pix_qr_code: string | null
          provider: string | null
          provider_customer_id: string
          provider_payment_id: string | null
          rental_id: string
          status: Database["public"]["Enums"]["oli_payment_status"]
          status_detail: string | null
          updated_at: string
          user_id: string
          webhook_payload: Json | null
        }
        Insert: {
          amount: number
          bank_slip_url?: string | null
          billingType?: string | null
          created_at?: string
          due_date?: string | null
          external_reference?: string | null
          id?: string
          invoice_url?: string | null
          method?: string | null
          payment_link?: string | null
          payment_type: string
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          provider?: string | null
          provider_customer_id: string
          provider_payment_id?: string | null
          rental_id: string
          status?: Database["public"]["Enums"]["oli_payment_status"]
          status_detail?: string | null
          updated_at?: string
          user_id: string
          webhook_payload?: Json | null
        }
        Update: {
          amount?: number
          bank_slip_url?: string | null
          billingType?: string | null
          created_at?: string
          due_date?: string | null
          external_reference?: string | null
          id?: string
          invoice_url?: string | null
          method?: string | null
          payment_link?: string | null
          payment_type?: string
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          provider?: string | null
          provider_customer_id?: string
          provider_payment_id?: string | null
          rental_id?: string
          status?: Database["public"]["Enums"]["oli_payment_status"]
          status_detail?: string | null
          updated_at?: string
          user_id?: string
          webhook_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "oli_payments_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "oli_rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      oli_profiles: {
        Row: {
          birth_date: string | null
          complemention: string | null
          cpf: string | null
          created_at: string
          driver_license_id: string | null
          driver_license_status:
            | Database["public"]["Enums"]["oli_driver_license_status"]
            | null
          driver_license_verified_at: string | null
          email: string | null
          full_name: string | null
          id: string
          marital_status: string | null
          nationality: string | null
          neigbhorhood: string | null
          number: number | null
          phone: string | null
          profession: string | null
          rg: string | null
          role: Database["public"]["Enums"]["oli_user_role"]
          score: number | null
          signature_url: string | null
          street: string | null
          updated_at: string
          whatsapp_phone: string | null
        }
        Insert: {
          birth_date?: string | null
          complemention?: string | null
          cpf?: string | null
          created_at?: string
          driver_license_id?: string | null
          driver_license_status?:
            | Database["public"]["Enums"]["oli_driver_license_status"]
            | null
          driver_license_verified_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          marital_status?: string | null
          nationality?: string | null
          neigbhorhood?: string | null
          number?: number | null
          phone?: string | null
          profession?: string | null
          rg?: string | null
          role?: Database["public"]["Enums"]["oli_user_role"]
          score?: number | null
          signature_url?: string | null
          street?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Update: {
          birth_date?: string | null
          complemention?: string | null
          cpf?: string | null
          created_at?: string
          driver_license_id?: string | null
          driver_license_status?:
            | Database["public"]["Enums"]["oli_driver_license_status"]
            | null
          driver_license_verified_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          marital_status?: string | null
          nationality?: string | null
          neigbhorhood?: string | null
          number?: number | null
          phone?: string | null
          profession?: string | null
          rg?: string | null
          role?: Database["public"]["Enums"]["oli_user_role"]
          score?: number | null
          signature_url?: string | null
          street?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oli_profiles_driver_license_id_fkey"
            columns: ["driver_license_id"]
            isOneToOne: false
            referencedRelation: "oli_driver_licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      oli_rental_contracts: {
        Row: {
          clicksign_document_id: string | null
          clicksign_envelope_id: string | null
          clicksign_last_event: string | null
          clicksign_last_event_at: string | null
          clicksign_owner_signer_id: string | null
          clicksign_payload: Json | null
          clicksign_renter_signer_id: string | null
          clicksign_status: string | null
          contract_number: string | null
          created_at: string
          driver_license_id: string | null
          file_url: string | null
          id: string
          inspection_released_at: string | null
          owner_signed_at: string | null
          rental_id: string
          renter_signed_at: string | null
          signed_completed_at: string | null
          status: Database["public"]["Enums"]["oli_contract_status"]
          updated_at: string
          version: string | null
        }
        Insert: {
          clicksign_document_id?: string | null
          clicksign_envelope_id?: string | null
          clicksign_last_event?: string | null
          clicksign_last_event_at?: string | null
          clicksign_owner_signer_id?: string | null
          clicksign_payload?: Json | null
          clicksign_renter_signer_id?: string | null
          clicksign_status?: string | null
          contract_number?: string | null
          created_at?: string
          driver_license_id?: string | null
          file_url?: string | null
          id?: string
          inspection_released_at?: string | null
          owner_signed_at?: string | null
          rental_id: string
          renter_signed_at?: string | null
          signed_completed_at?: string | null
          status?: Database["public"]["Enums"]["oli_contract_status"]
          updated_at?: string
          version?: string | null
        }
        Update: {
          clicksign_document_id?: string | null
          clicksign_envelope_id?: string | null
          clicksign_last_event?: string | null
          clicksign_last_event_at?: string | null
          clicksign_owner_signer_id?: string | null
          clicksign_payload?: Json | null
          clicksign_renter_signer_id?: string | null
          clicksign_status?: string | null
          contract_number?: string | null
          created_at?: string
          driver_license_id?: string | null
          file_url?: string | null
          id?: string
          inspection_released_at?: string | null
          owner_signed_at?: string | null
          rental_id?: string
          renter_signed_at?: string | null
          signed_completed_at?: string | null
          status?: Database["public"]["Enums"]["oli_contract_status"]
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oli_rental_contracts_driver_license_id_fkey"
            columns: ["driver_license_id"]
            isOneToOne: false
            referencedRelation: "oli_driver_licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oli_rental_contracts_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "oli_rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      oli_rentals: {
        Row: {
          created_at: string
          deposit_amount: number | null
          driver_license_id: string | null
          dropoff_location: string | null
          end_date: string
          id: string
          notes: string | null
          owner_id: string
          payment_deadline: string | null
          pickup_location: string | null
          renter_id: string
          start_date: string
          status: Database["public"]["Enums"]["oli_rental_status"]
          total_price: number | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          deposit_amount?: number | null
          driver_license_id?: string | null
          dropoff_location?: string | null
          end_date: string
          id?: string
          notes?: string | null
          owner_id: string
          payment_deadline?: string | null
          pickup_location?: string | null
          renter_id: string
          start_date: string
          status?: Database["public"]["Enums"]["oli_rental_status"]
          total_price?: number | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          deposit_amount?: number | null
          driver_license_id?: string | null
          dropoff_location?: string | null
          end_date?: string
          id?: string
          notes?: string | null
          owner_id?: string
          payment_deadline?: string | null
          pickup_location?: string | null
          renter_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["oli_rental_status"]
          total_price?: number | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oli_rentals_driver_license_id_fkey"
            columns: ["driver_license_id"]
            isOneToOne: false
            referencedRelation: "oli_driver_licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oli_rentals_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "oli_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      oli_user_addresses: {
        Row: {
          city: string | null
          complement: string | null
          country: string | null
          created_at: string
          id: string
          is_default: boolean
          label: string | null
          neighborhood: string | null
          number: string | null
          postal_code: string | null
          state: string | null
          street: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          complement?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          neighborhood?: string | null
          number?: string | null
          postal_code?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          complement?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          neighborhood?: string | null
          number?: string | null
          postal_code?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      oli_user_documents: {
        Row: {
          back_image_url: string | null
          created_at: string
          doc_type: Database["public"]["Enums"]["oli_document_type"]
          expiration_date: string | null
          extra_image_url: string | null
          front_image_url: string | null
          id: string
          number: string | null
          observations: string | null
          status: Database["public"]["Enums"]["oli_document_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          back_image_url?: string | null
          created_at?: string
          doc_type: Database["public"]["Enums"]["oli_document_type"]
          expiration_date?: string | null
          extra_image_url?: string | null
          front_image_url?: string | null
          id?: string
          number?: string | null
          observations?: string | null
          status?: Database["public"]["Enums"]["oli_document_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          back_image_url?: string | null
          created_at?: string
          doc_type?: Database["public"]["Enums"]["oli_document_type"]
          expiration_date?: string | null
          extra_image_url?: string | null
          front_image_url?: string | null
          id?: string
          number?: string | null
          observations?: string | null
          status?: Database["public"]["Enums"]["oli_document_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      oli_vehicle_photos: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_cover: boolean
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          is_cover?: boolean
          vehicle_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_cover?: boolean
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oli_vehicle_photos_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "oli_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      oli_vehicles: {
        Row: {
          body_type: Database["public"]["Enums"]["oli_vehicle_body_type"] | null
          brand: string | null
          color: string | null
          created_at: string
          daily_price: number | null
          deposit_amount: number | null
          fuel_type: string | null
          id: string
          is_active: boolean
          is_popular: boolean
          location_city: string | null
          location_state: string | null
          model: string | null
          monthly_price: number | null
          owner_id: string
          pickup_complement: string | null
          pickup_neighborhood: string | null
          pickup_number: string | null
          pickup_street: string | null
          pickup_zip_code: string | null
          plate: string | null
          renavam: string | null
          seats: number | null
          segment: Database["public"]["Enums"]["oli_vehicle_segment"] | null
          status: Database["public"]["Enums"]["oli_vehicle_status"]
          title: string | null
          transmission: Database["public"]["Enums"]["oli_transmission"] | null
          updated_at: string
          vehicle_type: Database["public"]["Enums"]["oli_vehicle_type"]
          weekly_price: number | null
          year: number | null
        }
        Insert: {
          body_type?:
            | Database["public"]["Enums"]["oli_vehicle_body_type"]
            | null
          brand?: string | null
          color?: string | null
          created_at?: string
          daily_price?: number | null
          deposit_amount?: number | null
          fuel_type?: string | null
          id?: string
          is_active?: boolean
          is_popular?: boolean
          location_city?: string | null
          location_state?: string | null
          model?: string | null
          monthly_price?: number | null
          owner_id: string
          pickup_complement?: string | null
          pickup_neighborhood?: string | null
          pickup_number?: string | null
          pickup_street?: string | null
          pickup_zip_code?: string | null
          plate?: string | null
          renavam?: string | null
          seats?: number | null
          segment?: Database["public"]["Enums"]["oli_vehicle_segment"] | null
          status?: Database["public"]["Enums"]["oli_vehicle_status"]
          title?: string | null
          transmission?: Database["public"]["Enums"]["oli_transmission"] | null
          updated_at?: string
          vehicle_type?: Database["public"]["Enums"]["oli_vehicle_type"]
          weekly_price?: number | null
          year?: number | null
        }
        Update: {
          body_type?:
            | Database["public"]["Enums"]["oli_vehicle_body_type"]
            | null
          brand?: string | null
          color?: string | null
          created_at?: string
          daily_price?: number | null
          deposit_amount?: number | null
          fuel_type?: string | null
          id?: string
          is_active?: boolean
          is_popular?: boolean
          location_city?: string | null
          location_state?: string | null
          model?: string | null
          monthly_price?: number | null
          owner_id?: string
          pickup_complement?: string | null
          pickup_neighborhood?: string | null
          pickup_number?: string | null
          pickup_street?: string | null
          pickup_zip_code?: string | null
          plate?: string | null
          renavam?: string | null
          seats?: number | null
          segment?: Database["public"]["Enums"]["oli_vehicle_segment"] | null
          status?: Database["public"]["Enums"]["oli_vehicle_status"]
          title?: string | null
          transmission?: Database["public"]["Enums"]["oli_transmission"] | null
          updated_at?: string
          vehicle_type?: Database["public"]["Enums"]["oli_vehicle_type"]
          weekly_price?: number | null
          year?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      oli_create_direct_conversation: {
        Args: { other_user_id: string }
        Returns: string
      }
      oli_is_conversation_participant: {
        Args: { _conversation_id: string }
        Returns: boolean
      }
      oli_shares_conversation_with: {
        Args: { profile_id: string }
        Returns: boolean
      }
      refresh_oli_inspection_photo_counters: {
        Args: { p_inspection_id: string }
        Returns: undefined
      }
    }
    Enums: {
      inspection_photo_status:
        | "pending"
        | "approved"
        | "rejected"
        | "missing"
        | "error"
      oli_contract_status:
        | "pending"
        | "signed"
        | "cancelled"
        | "pending_owner_signature"
        | "pending_renter_signature"
      oli_conversation_type: "direct" | "support" | "group"
      oli_document_status: "pending" | "approved" | "rejected"
      oli_document_type: "cnh" | "rg" | "cpf" | "comprovante_residencia"
      oli_driver_license_status: "pending" | "approved" | "rejected"
      oli_inspection_actor_role: "owner" | "renter"
      oli_inspection_kind: "pickup" | "dropoff"
      oli_inspection_side: "front" | "back" | "left" | "right" | "interior"
      oli_license_status: "pending" | "approved" | "rejected"
      oli_message_type: "text" | "system"
      oli_payment_status:
        | "pending"
        | "paid"
        | "failed"
        | "refunded"
        | "confirmed"
      oli_payment_type: "rental" | "deposit" | "fine"
      oli_rental_status:
        | "pending_approval"
        | "approved"
        | "active"
        | "completed"
        | "cancelled"
      oli_transmission: "manual" | "automatic"
      oli_user_role: "renter" | "owner" | "both"
      oli_vehicle_body_type:
        | "hatch"
        | "sedan"
        | "suv"
        | "pickup"
        | "van"
        | "coupe"
        | "wagon"
        | "other"
      oli_vehicle_segment: "economy" | "standard" | "premium" | "luxury"
      oli_vehicle_status: "available" | "rented" | "maintenance" | "inactive"
      oli_vehicle_type:
        | "carro"
        | "moto"
        | "van"
        | "caminhonete"
        | "suv"
        | "outro"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      inspection_photo_status: [
        "pending",
        "approved",
        "rejected",
        "missing",
        "error",
      ],
      oli_contract_status: [
        "pending",
        "signed",
        "cancelled",
        "pending_owner_signature",
        "pending_renter_signature",
      ],
      oli_conversation_type: ["direct", "support", "group"],
      oli_document_status: ["pending", "approved", "rejected"],
      oli_document_type: ["cnh", "rg", "cpf", "comprovante_residencia"],
      oli_driver_license_status: ["pending", "approved", "rejected"],
      oli_inspection_actor_role: ["owner", "renter"],
      oli_inspection_kind: ["pickup", "dropoff"],
      oli_inspection_side: ["front", "back", "left", "right", "interior"],
      oli_license_status: ["pending", "approved", "rejected"],
      oli_message_type: ["text", "system"],
      oli_payment_status: [
        "pending",
        "paid",
        "failed",
        "refunded",
        "confirmed",
      ],
      oli_payment_type: ["rental", "deposit", "fine"],
      oli_rental_status: [
        "pending_approval",
        "approved",
        "active",
        "completed",
        "cancelled",
      ],
      oli_transmission: ["manual", "automatic"],
      oli_user_role: ["renter", "owner", "both"],
      oli_vehicle_body_type: [
        "hatch",
        "sedan",
        "suv",
        "pickup",
        "van",
        "coupe",
        "wagon",
        "other",
      ],
      oli_vehicle_segment: ["economy", "standard", "premium", "luxury"],
      oli_vehicle_status: ["available", "rented", "maintenance", "inactive"],
      oli_vehicle_type: ["carro", "moto", "van", "caminhonete", "suv", "outro"],
    },
  },
} as const
