import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getTreasuryEnvironment } from "@/lib/treasury-env";

let supabaseServiceClient: SupabaseClient | null = null;

export function hasSupabaseServiceClientConfig() {
  return getTreasuryEnvironment().hasSupabasePersistence;
}

export function getSupabaseServiceClient() {
  const environment = getTreasuryEnvironment();

  if (!environment.hasSupabasePersistence) {
    throw new Error("Supabase persistence is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  if (!supabaseServiceClient) {
    supabaseServiceClient = createClient(environment.supabaseUrl, environment.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return supabaseServiceClient;
}
