// Tipos das tabelas próprias do Hub QGO (ver supabase/migrations/). Ao
// contrário das outras ferramentas, este arquivo não é gerado automaticamente
// a partir do schema inteiro do projeto — o hub só enxerga suas próprias
// tabelas, então os tipos foram escritos à mão para elas.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      hub_tools: {
        Row: {
          id: string;
          slug: string;
          nome: string;
          descricao: string;
          url: string;
          icone: string;
          cor: string;
          ordem: number;
          ativo: boolean;
          auto_login: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          nome: string;
          descricao?: string;
          url: string;
          icone?: string;
          cor?: string;
          ordem?: number;
          ativo?: boolean;
          auto_login?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          nome?: string;
          descricao?: string;
          url?: string;
          icone?: string;
          cor?: string;
          ordem?: number;
          ativo?: boolean;
          auto_login?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      hub_admins: {
        Row: { user_id: string; created_at: string };
        Insert: { user_id: string; created_at?: string };
        Update: { user_id?: string; created_at?: string };
        Relationships: [];
      };
      hub_user_tool_access: {
        Row: { user_id: string; tool_id: string; created_at: string };
        Insert: { user_id: string; tool_id: string; created_at?: string };
        Update: { user_id?: string; tool_id?: string; created_at?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_hub_admin: {
        Args: { _user_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
