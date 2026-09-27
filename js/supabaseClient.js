import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://rwxbbyuilyvmmywkyboc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_BO_jT5ne0KPMiQp7JjFheQ_rJ8k1AyV";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
