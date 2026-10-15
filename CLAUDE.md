# Instruksi untuk agen (Claude Code dan sub agent)

Proyek: aplikasi belajar bahasa Arab Al-Qur'an (Next.js 16 + Supabase + Vercel). Pemilik berbahasa Indonesia.

**Mulai di sini:** baca `docs/PROJECT_CONTEXT.md` sampai habis sebelum mengerjakan apa pun, lalu `TASKS.md` dan `docs/DECISIONS.md`. Spesifikasi fitur ada di `docs/SPEC_FASE1.md` (status keputusan terbuka ada di PROJECT_CONTEXT bagian 9).

**Wajib sebelum selesai:** perbarui `docs/PROJECT_CONTEXT.md` (status, keputusan, jebakan baru, entri "Log sesi") dan `TASKS.md` dalam PR yang sama dengan perubahan kode. Tujuannya agar sesi berikutnya, dengan model berbeda, tidak kehilangan konteks.

Aturan singkat:
- Baca juga `AGENTS.md`: Next.js di repo ini punya perubahan besar; baca `node_modules/next/dist/docs/` sebelum menulis kode Next.
- Jangan menaruh rahasia di repo. Jangan mengubah skema langsung di dashboard; pakai file di `supabase/migrations/`.
- Cek sebelum push: `npm run lint && npx tsc --noEmit && npm test && npm run build`.
- Alur: branch → PR (lewat `gh api`, bukan `gh pr create`) → squash merge ke `main`.
