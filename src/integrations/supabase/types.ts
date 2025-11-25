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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      "Clientes DBIANCO": {
        Row: {
          "Customer ID": string
          "Default Address Phone": string | null
          Email: string | null
          "First Name": string | null
          "Last Name": string | null
        }
        Insert: {
          "Customer ID": string
          "Default Address Phone"?: string | null
          Email?: string | null
          "First Name"?: string | null
          "Last Name"?: string | null
        }
        Update: {
          "Customer ID"?: string
          "Default Address Phone"?: string | null
          Email?: string | null
          "First Name"?: string | null
          "Last Name"?: string | null
        }
        Relationships: []
      }
      contatos_total: {
        Row: {
          country: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: number
          last_name: string | null
          nome_contato: string | null
          telefone: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: number
          last_name?: string | null
          nome_contato?: string | null
          telefone?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: number
          last_name?: string | null
          nome_contato?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      despachante_infos: {
        Row: {
          categoria: string | null
          created_at: string | null
          id: string
          pergunta: string
          resposta: string
          updated_at: string | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          id?: string
          pergunta: string
          resposta: string
          updated_at?: string | null
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          id?: string
          pergunta?: string
          resposta?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      despachantes_clientes: {
        Row: {
          conversa_id: string | null
          CPF: number | null
          created_at: string
          email: string | null
          id: string
          id_assas: string | null
          invoiceUrl: string | null
          multas_total: string | null
          observacao: string | null
          placa: string | null
          renavam: string | null
          session_id: number | null
          status_consulta: string
          telefone: string
          updated_at: string
        }
        Insert: {
          conversa_id?: string | null
          CPF?: number | null
          created_at?: string
          email?: string | null
          id?: string
          id_assas?: string | null
          invoiceUrl?: string | null
          multas_total?: string | null
          observacao?: string | null
          placa?: string | null
          renavam?: string | null
          session_id?: number | null
          status_consulta?: string
          telefone: string
          updated_at?: string
        }
        Update: {
          conversa_id?: string | null
          CPF?: number | null
          created_at?: string
          email?: string | null
          id?: string
          id_assas?: string | null
          invoiceUrl?: string | null
          multas_total?: string | null
          observacao?: string | null
          placa?: string | null
          renavam?: string | null
          session_id?: number | null
          status_consulta?: string
          telefone?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          content: string | null
          embedding: string | null
          id: number
          metadata: Json | null
          title: string | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
          title?: string | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
          title?: string | null
        }
        Relationships: []
      }
      "Iphones Contato": {
        Row: {
          Celular: string | null
          "E-mail": string | null
          id: number
          Nome: string
        }
        Insert: {
          Celular?: string | null
          "E-mail"?: string | null
          id: number
          Nome: string
        }
        Update: {
          Celular?: string | null
          "E-mail"?: string | null
          id?: number
          Nome?: string
        }
        Relationships: []
      }
      mensagem_processos: {
        Row: {
          conteudo_texto: string | null
          id: number
          message_id: string | null
          metadados_imagem: Json | null
          status: string | null
          timestamp_chegada: string | null
          tipo: string
          url_imagem: string | null
        }
        Insert: {
          conteudo_texto?: string | null
          id?: number
          message_id?: string | null
          metadados_imagem?: Json | null
          status?: string | null
          timestamp_chegada?: string | null
          tipo: string
          url_imagem?: string | null
        }
        Update: {
          conteudo_texto?: string | null
          id?: number
          message_id?: string | null
          metadados_imagem?: Json | null
          status?: string | null
          timestamp_chegada?: string | null
          tipo?: string
          url_imagem?: string | null
        }
        Relationships: []
      }
      n8n_chat_agentesdr: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      n8n_chat_histories: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      oli_inspection_photos: {
        Row: {
          created_at: string
          description: string | null
          has_damage: boolean
          id: string
          image_url: string
          inspection_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          has_damage?: boolean
          id?: string
          image_url: string
          inspection_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          has_damage?: boolean
          id?: string
          image_url?: string
          inspection_id?: string
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
          created_at: string
          id: string
          inspection_kind: Database["public"]["Enums"]["oli_inspection_type"]
          notes: string | null
          performed_by: string
          rental_id: string
          side: Database["public"]["Enums"]["oli_inspection_side"]
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inspection_kind: Database["public"]["Enums"]["oli_inspection_type"]
          notes?: string | null
          performed_by: string
          rental_id: string
          side: Database["public"]["Enums"]["oli_inspection_side"]
          vehicle_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inspection_kind?: Database["public"]["Enums"]["oli_inspection_type"]
          notes?: string | null
          performed_by?: string
          rental_id?: string
          side?: Database["public"]["Enums"]["oli_inspection_side"]
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oli_inspections_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "oli_profiles"
            referencedColumns: ["id"]
          },
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
      oli_payments: {
        Row: {
          amount: number
          created_at: string
          external_reference: string | null
          id: string
          method: string | null
          payment_type: Database["public"]["Enums"]["oli_payment_type"]
          rental_id: string
          status: Database["public"]["Enums"]["oli_payment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          external_reference?: string | null
          id?: string
          method?: string | null
          payment_type: Database["public"]["Enums"]["oli_payment_type"]
          rental_id: string
          status?: Database["public"]["Enums"]["oli_payment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          external_reference?: string | null
          id?: string
          method?: string | null
          payment_type?: Database["public"]["Enums"]["oli_payment_type"]
          rental_id?: string
          status?: Database["public"]["Enums"]["oli_payment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oli_payments_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "oli_rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oli_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "oli_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      oli_profiles: {
        Row: {
          birth_date: string | null
          cpf: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["oli_user_role"]
          updated_at: string
          whatsapp_phone: string | null
        }
        Insert: {
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["oli_user_role"]
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Update: {
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["oli_user_role"]
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      oli_rental_contracts: {
        Row: {
          contract_number: string | null
          created_at: string
          file_url: string | null
          id: string
          owner_signed_at: string | null
          rental_id: string
          renter_signed_at: string | null
          status: Database["public"]["Enums"]["oli_contract_status"]
          updated_at: string
          version: string | null
        }
        Insert: {
          contract_number?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          owner_signed_at?: string | null
          rental_id: string
          renter_signed_at?: string | null
          status?: Database["public"]["Enums"]["oli_contract_status"]
          updated_at?: string
          version?: string | null
        }
        Update: {
          contract_number?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          owner_signed_at?: string | null
          rental_id?: string
          renter_signed_at?: string | null
          status?: Database["public"]["Enums"]["oli_contract_status"]
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oli_rental_contracts_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: true
            referencedRelation: "oli_rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      oli_rentals: {
        Row: {
          created_at: string
          deposit_amount: number | null
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
            foreignKeyName: "oli_rentals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "oli_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oli_rentals_renter_id_fkey"
            columns: ["renter_id"]
            isOneToOne: false
            referencedRelation: "oli_profiles"
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
        Relationships: [
          {
            foreignKeyName: "oli_user_addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "oli_profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "oli_user_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "oli_profiles"
            referencedColumns: ["id"]
          },
        ]
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
          brand: string | null
          color: string | null
          created_at: string
          daily_price: number | null
          deposit_amount: number | null
          fuel_type: string | null
          id: string
          is_active: boolean
          location_city: string | null
          location_state: string | null
          model: string | null
          monthly_price: number | null
          owner_id: string
          plate: string | null
          renavam: string | null
          seats: number | null
          status: Database["public"]["Enums"]["oli_vehicle_status"]
          title: string | null
          transmission:
            | Database["public"]["Enums"]["oli_transmission_type"]
            | null
          updated_at: string
          weekly_price: number | null
          year: number | null
        }
        Insert: {
          brand?: string | null
          color?: string | null
          created_at?: string
          daily_price?: number | null
          deposit_amount?: number | null
          fuel_type?: string | null
          id?: string
          is_active?: boolean
          location_city?: string | null
          location_state?: string | null
          model?: string | null
          monthly_price?: number | null
          owner_id: string
          plate?: string | null
          renavam?: string | null
          seats?: number | null
          status?: Database["public"]["Enums"]["oli_vehicle_status"]
          title?: string | null
          transmission?:
            | Database["public"]["Enums"]["oli_transmission_type"]
            | null
          updated_at?: string
          weekly_price?: number | null
          year?: number | null
        }
        Update: {
          brand?: string | null
          color?: string | null
          created_at?: string
          daily_price?: number | null
          deposit_amount?: number | null
          fuel_type?: string | null
          id?: string
          is_active?: boolean
          location_city?: string | null
          location_state?: string | null
          model?: string | null
          monthly_price?: number | null
          owner_id?: string
          plate?: string | null
          renavam?: string | null
          seats?: number | null
          status?: Database["public"]["Enums"]["oli_vehicle_status"]
          title?: string | null
          transmission?:
            | Database["public"]["Enums"]["oli_transmission_type"]
            | null
          updated_at?: string
          weekly_price?: number | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "oli_vehicles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "oli_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_assas_pagamento: {
        Row: {
          cobranca_id: string | null
          created_at: string | null
          id_asaas: string | null
          invoiceUrl: string | null
          pedido_id: number
          resumo: string | null
          status: string | null
          user_id: number | null
          valor: number | null
        }
        Insert: {
          cobranca_id?: string | null
          created_at?: string | null
          id_asaas?: string | null
          invoiceUrl?: string | null
          pedido_id?: number
          resumo?: string | null
          status?: string | null
          user_id?: number | null
          valor?: number | null
        }
        Update: {
          cobranca_id?: string | null
          created_at?: string | null
          id_asaas?: string | null
          invoiceUrl?: string | null
          pedido_id?: number
          resumo?: string | null
          status?: string | null
          user_id?: number | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_assas_pagamento_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "usuarios_asas_pagamento"
            referencedColumns: ["user_id"]
          },
        ]
      }
      reparo_iphone: {
        Row: {
          alto_falante: number | null
          bateria: number | null
          camera_frontal: number | null
          carcaca: number | null
          conector_carga: number | null
          created_at: string
          id: number
          modelo_iphone: string | null
          tampa_traseira: number | null
          tela_original: number | null
          tela_premium: number | null
          vidro_frontal: number | null
        }
        Insert: {
          alto_falante?: number | null
          bateria?: number | null
          camera_frontal?: number | null
          carcaca?: number | null
          conector_carga?: number | null
          created_at?: string
          id?: number
          modelo_iphone?: string | null
          tampa_traseira?: number | null
          tela_original?: number | null
          tela_premium?: number | null
          vidro_frontal?: number | null
        }
        Update: {
          alto_falante?: number | null
          bateria?: number | null
          camera_frontal?: number | null
          carcaca?: number | null
          conector_carga?: number | null
          created_at?: string
          id?: number
          modelo_iphone?: string | null
          tampa_traseira?: number | null
          tela_original?: number | null
          tela_premium?: number | null
          vidro_frontal?: number | null
        }
        Relationships: []
      }
      usuarios_asas_pagamento: {
        Row: {
          cpf: string | null
          created_at: string | null
          email: string | null
          id_assas: string | null
          nome: string | null
          user_id: number
        }
        Insert: {
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          id_assas?: string | null
          nome?: string | null
          user_id?: number
        }
        Update: {
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          id_assas?: string | null
          nome?: string | null
          user_id?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      enqueue_inbox: {
        Args: {
          p_chat_id: string
          p_payload: Json
          p_source_msg_id: string
          p_ts_arrival_ms?: number
        }
        Returns: {
          id: number
        }[]
      }
      match_documents: {
        Args: { filter?: Json; match_count?: number; query_embedding: string }
        Returns: {
          content: string
          id: number
          metadata: Json
          similarity: number
        }[]
      }
      normalize_br_phone: {
        Args: { ddd_default?: string; p_in: string }
        Returns: string
      }
      normalize_email: { Args: { e_in: string }; Returns: string }
    }
    Enums: {
      oli_contract_status:
        | "pending"
        | "partially_signed"
        | "signed"
        | "cancelled"
      oli_document_status: "pending" | "approved" | "rejected"
      oli_document_type:
        | "cpf"
        | "cnh"
        | "rg"
        | "passport"
        | "selfie"
        | "address_proof"
        | "other"
      oli_inspection_side: "owner" | "renter" | "platform"
      oli_inspection_type: "checkin" | "checkout"
      oli_payment_status: "pending" | "paid" | "failed" | "refunded"
      oli_payment_type: "deposit" | "rental" | "fine" | "other"
      oli_rental_status:
        | "pending_approval"
        | "awaiting_payment"
        | "confirmed"
        | "in_use"
        | "completed"
        | "cancelled"
        | "no_show"
        | "problem"
      oli_transmission_type: "manual" | "automatic" | "other"
      oli_user_role: "renter" | "owner" | "both"
      oli_vehicle_status: "available" | "unavailable" | "maintenance"
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
      oli_contract_status: [
        "pending",
        "partially_signed",
        "signed",
        "cancelled",
      ],
      oli_document_status: ["pending", "approved", "rejected"],
      oli_document_type: [
        "cpf",
        "cnh",
        "rg",
        "passport",
        "selfie",
        "address_proof",
        "other",
      ],
      oli_inspection_side: ["owner", "renter", "platform"],
      oli_inspection_type: ["checkin", "checkout"],
      oli_payment_status: ["pending", "paid", "failed", "refunded"],
      oli_payment_type: ["deposit", "rental", "fine", "other"],
      oli_rental_status: [
        "pending_approval",
        "awaiting_payment",
        "confirmed",
        "in_use",
        "completed",
        "cancelled",
        "no_show",
        "problem",
      ],
      oli_transmission_type: ["manual", "automatic", "other"],
      oli_user_role: ["renter", "owner", "both"],
      oli_vehicle_status: ["available", "unavailable", "maintenance"],
    },
  },
} as const
