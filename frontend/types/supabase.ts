export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      saved_properties: {
        Row: {
          id: number;
          user_id: string;
          property_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          property_id: string;
        };
        Update: {
          user_id?: string;
          property_id?: string;
        };
      };
    };
  };
}
