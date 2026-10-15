import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Belajar Bahasa Al-Qur'an",
    short_name: "Bahasa Qur'an",
    description: "Belajar memahami bahasa Al-Qur'an sedikit demi sedikit.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#064430",
    theme_color: "#047857",
    lang: "id",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Belajar", url: "/belajar" },
      { name: "Baca", url: "/baca" },
      { name: "Kuis", url: "/kuis" },
    ],
  };
}
