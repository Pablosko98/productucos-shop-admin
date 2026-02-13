import { createClient } from "@supabase/supabase-js";
import "expo-sqlite/localStorage/install";

const supabaseUrl = "https://mljdghhebfkxyjmlotks.supabase.co";
const supabasePublishableKey = "sb_publishable_sh5-EQAgAQ3jjltXu6EizA_S1m6QGln";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
