-- Migration 0000: Shared helpers
-- Auto-update updated_at timestamp on row modification

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
