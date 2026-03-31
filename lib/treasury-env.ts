import "server-only";

export function getTreasuryEnvironment() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  const circleApiKey = process.env.CIRCLE_API_KEY?.trim() ?? "";
  const circleEntitySecret = process.env.CIRCLE_ENTITY_SECRET?.trim() ?? "";
  const circleApiBaseUrl = process.env.CIRCLE_API_BASE_URL?.trim() || undefined;

  return {
    supabaseUrl,
    supabasePublishableKey,
    supabaseServiceRoleKey,
    circleApiKey,
    circleEntitySecret,
    circleApiBaseUrl,
    hasSupabaseBrowser: Boolean(supabaseUrl && supabasePublishableKey),
    hasSupabasePersistence: Boolean(supabaseUrl && supabaseServiceRoleKey),
    hasCircleWallets: Boolean(circleApiKey && circleEntitySecret),
    isLiveModeEnabled: Boolean(supabaseUrl && supabaseServiceRoleKey && circleApiKey && circleEntitySecret)
  };
}
