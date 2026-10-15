import LocalSession from "./local-session";

// Cangkang statis tanpa data pribadi: aman di-cache service worker agar bisa dibuka offline.
// Data diambil di klien dari penyimpanan lokal (lib/local).
export default function BelajarPage() {
  return <LocalSession mode="belajar" />;
}
