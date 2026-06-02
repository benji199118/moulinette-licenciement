// ════════════════════════════════════════════════════════
//  SUPABASE CONFIG
//  Remplace les 2 valeurs ci-dessous par tes clés Supabase
//  Settings → API → Project URL + anon public key
// ════════════════════════════════════════════════════════

const SUPABASE_URL  = 'REMPLACE_PAR_TON_PROJECT_URL';   // ex: https://xxxxx.supabase.co
const SUPABASE_KEY  = 'REMPLACE_PAR_TA_ANON_KEY';       // longue clé JWT

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
  return await sb.auth.signUp({ email, password });
}

async function signOut() {
  await sb.auth.signOut();
  window.location.href = 'login.html';
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
