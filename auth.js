// ════════════════════════════════════════════════════════
//  SUPABASE CONFIG
//  Remplace les 2 valeurs ci-dessous par tes clés Supabase
//  Settings → API → Project URL + anon public key
// ════════════════════════════════════════════════════════

const SUPABASE_URL  = 'https://yxzdvwvarfkdczchrpwz.supabase.co'
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4emR2d3ZhcmZrZGN6Y2hycHd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Mjg5NzAsImV4cCI6MjA5NjAwNDk3MH0.7sFKo_IPIDnWJdaw1Z2XALfbVpBuNReAZp5hSo5PJ8c'

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Helpers ─────────────────────────────────────────────
async function getSession() {
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

async function signIn(email, password) {
  return await sb.auth.signInWithPassword({ email, password });
}

async function signUp(email, password) {
  return await sb.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin + '/app.html',
    },
  });
}

async function signOut() {
  await sb.auth.signOut();
  window.location.href = 'index.html';
}

async function resetPassword(email) {
  return await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/login.html?reset=1',
  });
}

// ─── Auth guard — appelé dans index.html ─────────────────
// Redirige vers login.html si pas de session active
async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.href = 'login.html';
  }
  return session;
}
