import LocalSession from "../belajar/local-session";

// Cangkang statis tanpa data pribadi (lihat app/belajar/page.tsx). Soal dibangun di klien
// setiap kali halaman dibuka, jadi tiap kuis berbeda.
export default function KuisPage() {
  return <LocalSession mode="kuis" />;
}
