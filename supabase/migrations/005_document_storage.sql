-- ============================================================
-- ONE70 CRM - Migration 005
-- Document Storage Setup
-- ============================================================

-- Create storage bucket (run this in SQL, not in Storage UI)
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Storage policies: authenticated users can upload and read
create policy "Documents: upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents');

create policy "Documents: read" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents');

create policy "Documents: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents');
