/** Tanggal lokal (YYYY-MM-DD) pada zona waktu tertentu. Murni, aman dipakai server dan klien. */
export function localDate(tz: string, d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
}
