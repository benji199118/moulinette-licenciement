-- ════════════════════════════════════════════════════════════════
--  MOULINETTE LICENCIEMENT — Schéma Supabase
--  Table des dossiers RH (persistance cross-device)
--
--  ▸ À exécuter UNE FOIS dans : Supabase → SQL Editor → New query
--  ▸ Row Level Security activé : chaque RH ne voit que SES dossiers
-- ════════════════════════════════════════════════════════════════

-- 1 ── Table
create table if not exists public.dossiers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),

  nom_salarie text,
  poste       text,
  ref         text,

  type        text,
  category    text,
  seniority   int,
  salary      numeric,
  total       numeric,
  status      text default 'draft',   -- draft | in_progress | closed

  data        jsonb                    -- snapshot complet (form + dossier)
);

-- 2 ── Index pour tri rapide par utilisateur
create index if not exists dossiers_user_created_idx
  on public.dossiers (user_id, created_at desc);

-- 3 ── Row Level Security
alter table public.dossiers enable row level security;

-- 4 ── Politique : chaque utilisateur gère uniquement ses propres dossiers
drop policy if exists "Users manage own dossiers" on public.dossiers;
create policy "Users manage own dossiers"
  on public.dossiers
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
