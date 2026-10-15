-- MENUNGGU PERSETUJUAN PEMILIK: perubahan RLS (menghapus policy) yang dibatalkan saat diterapkan.
-- Setelah disetujui, terapkan ke proyek lalu pindahkan file ini ke supabase/migrations/.
-- review_logs append-only: hanya select dan insert (riwayat tidak boleh diubah).
drop policy if exists own_rows on review_logs;
create policy own_select on review_logs for select to authenticated
  using (user_id = auth.uid());
create policy own_insert on review_logs for insert to authenticated
  with check (user_id = auth.uid());

