// PREVIEW ONLY — stub Supabase (sandbox blocks supabase.co)
const sb = {
  auth: {
    onAuthStateChange() {},
    async getSession() { return { data: { session: null } }; },
    async signOut() {},
  },
  from() { return { select(){return this}, eq(){return this}, order(){return {data:[],error:null}}, insert(){return {error:null}}, delete(){return this}, update(){return this} }; }
};
async function getSession() { return null; }
async function signIn() { return { error: null }; }
async function signUp() { return { error: null }; }
async function signOut() {}
async function resetPassword() { return { error: null }; }
async function requireAuth() { return null; }
