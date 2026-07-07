/**
 * Tipos de la base de datos, derivados a mano de `db/all_in_one.sql` (estado a
 * migración 14). Sigue la forma del generador oficial de Supabase
 * (`supabase gen types typescript`), así el día que el proyecto esté linkeado
 * a la CLI este archivo se reemplaza por el generado sin tocar los call sites.
 *
 * Mantenimiento: cada `db/NN_*.sql` que agregue/cambie una tabla o el shape de
 * retorno de una función RPC debe reflejarse acá.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          group_name: string | null;
          role: "student" | "teacher";
          onboarded: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          group_name?: string | null;
          role?: "student" | "teacher";
          onboarded?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      exams: {
        Row: {
          id: string;
          title: string;
          year: number | null;
          duration_min: number;
          shuffle: boolean;
          student_review: boolean;
          pass_mark: number;
          is_published: boolean;
          allow_back: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          year?: number | null;
          duration_min?: number;
          shuffle?: boolean;
          student_review?: boolean;
          pass_mark?: number;
          is_published?: boolean;
          allow_back?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["exams"]["Insert"]>;
        Relationships: [];
      };
      questions: {
        Row: {
          id: string;
          exam_id: string;
          number: number;
          topic: string | null;
          prompt: string;
          figure_url: string | null;
          options: Json | null; // string[] serializado ("A".."E"); null para 'open'
          explanation: string | null;
          kind: "mcq" | "open";
          rubrica: string | null;
          nature: "conceptual" | "numeric";
        };
        Insert: {
          id?: string;
          exam_id: string;
          number: number;
          topic?: string | null;
          prompt: string;
          figure_url?: string | null;
          options?: Json | null;
          explanation?: string | null;
          kind?: "mcq" | "open";
          rubrica?: string | null;
          nature?: "conceptual" | "numeric";
        };
        Update: Partial<Database["public"]["Tables"]["questions"]["Insert"]>;
        Relationships: [];
      };
      answer_keys: {
        Row: {
          question_id: string;
          correct: "A" | "B" | "C" | "D" | "E";
        };
        Insert: {
          question_id: string;
          correct: "A" | "B" | "C" | "D" | "E";
        };
        Update: Partial<Database["public"]["Tables"]["answer_keys"]["Insert"]>;
        Relationships: [];
      };
      attempts: {
        Row: {
          id: string;
          exam_id: string;
          user_id: string;
          started_at: string;
          submitted_at: string | null;
          score: number | null;
          total: number | null;
          auto: boolean | null;
          per_topic: Json | null;
          mode: "exam" | "practice";
        };
        Insert: {
          id?: string;
          exam_id: string;
          user_id: string;
          started_at?: string;
          submitted_at?: string | null;
          score?: number | null;
          total?: number | null;
          auto?: boolean | null;
          per_topic?: Json | null;
          mode?: "exam" | "practice";
        };
        Update: Partial<Database["public"]["Tables"]["attempts"]["Insert"]>;
        // Declaradas para tipar los embeds usados en el código (`exams(...)`,
        // `profiles(...)`) — el nombre no necesita matchear la FK real de Postgres,
        // es metadata solo para que postgrest-js infiera la forma del join.
        Relationships: [
          {
            foreignKeyName: "attempts_exam_id_fkey";
            columns: ["exam_id"];
            isOneToOne: false;
            referencedRelation: "exams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attempts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      responses: {
        Row: {
          attempt_id: string;
          question_id: string;
          choice: "A" | "B" | "C" | "D" | "E" | null;
        };
        Insert: {
          attempt_id: string;
          question_id: string;
          choice?: "A" | "B" | "C" | "D" | "E" | null;
        };
        Update: Partial<Database["public"]["Tables"]["responses"]["Insert"]>;
        Relationships: [];
      };
      open_responses: {
        Row: {
          id: string;
          attempt_id: string;
          question_id: string;
          answer_text: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          attempt_id: string;
          question_id: string;
          answer_text: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["open_responses"]["Insert"]>;
        // Embeds usados por el pipeline de corrección (`questions(...)`, `attempts(...)`).
        Relationships: [
          {
            foreignKeyName: "open_responses_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "open_responses_attempt_id_fkey";
            columns: ["attempt_id"];
            isOneToOne: false;
            referencedRelation: "attempts";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_gradings: {
        Row: {
          id: string;
          open_response_id: string;
          feedback_borrador: string | null;
          nota_sugerida: number | null; // nota que sugiere la IA (0-10)
          nota: number | null; // nota FINAL del docente (0-10), la que ve el alumno
          estado: "pending" | "failed" | "approved" | "rejected";
          was_edited: boolean;
          temas_flojos: string[];
          aprobado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          open_response_id: string;
          feedback_borrador?: string | null;
          nota_sugerida?: number | null;
          nota?: number | null;
          estado?: "pending" | "failed" | "approved" | "rejected";
          was_edited?: boolean;
          temas_flojos?: string[];
          aprobado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_gradings"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "ai_gradings_open_response_id_fkey";
            columns: ["open_response_id"];
            isOneToOne: true;
            referencedRelation: "open_responses";
            referencedColumns: ["id"];
          },
        ];
      };
      exam_assignments: {
        Row: {
          exam_id: string;
          user_id: string;
          attempts_allowed: number;
          created_at: string;
        };
        Insert: {
          exam_id: string;
          user_id: string;
          attempts_allowed?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["exam_assignments"]["Insert"]>;
        Relationships: [];
      };
      waitlist: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          use_case: string | null;
          pain: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          email: string;
          use_case?: string | null;
          pain?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["waitlist"]["Insert"]>;
        Relationships: [];
      };
      review_cards: {
        Row: {
          user_id: string;
          question_id: string;
          box: number;
          due_at: string;
          reps: number;
          lapses: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          question_id: string;
          box?: number;
          due_at?: string;
          reps?: number;
          lapses?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["review_cards"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      grade_attempt: {
        Args: { p_attempt: string };
        Returns: { score: number; total: number; per_topic: Json }[];
      };
      exam_question_stats: {
        Args: { p_exam: string; p_mode?: string };
        Returns: {
          number: number;
          topic: string | null;
          ok: number;
          tot: number;
          pct: number;
          correct: string;
        }[];
      };
      exam_topic_stats: {
        Args: { p_exam: string; p_mode?: string };
        Returns: { topic: string | null; ok: number; tot: number; pct: number }[];
      };
      get_review_queue: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          exam_id: string;
          number: number;
          topic: string | null;
          prompt: string;
          figure_url: string | null;
          options: Json;
        }[];
      };
      schedule_review_card: {
        Args: { p_question: string; p_correct: boolean };
        Returns: string; // nuevo due_at (timestamptz ISO)
      };
      get_attempt_review: {
        Args: { p_attempt: string };
        Returns: {
          number: number;
          topic: string | null;
          prompt: string;
          your_choice: string | null;
          correct: string;
          is_correct: boolean;
          explanation: string | null;
        }[];
      };
      create_exam: {
        Args: { p: Json };
        Returns: string; // uuid del examen creado
      };
      update_exam: {
        Args: { p_exam: string; p: Json };
        Returns: void;
      };
      delete_exam: {
        Args: { p_exam: string };
        Returns: void;
      };
      is_teacher: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      clerk_uid: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
