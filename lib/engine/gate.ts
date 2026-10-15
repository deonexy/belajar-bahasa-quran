export interface GateInput {
  /** Retensi 7 hari (0..1). */
  R: number;
  /** Backlog: item jatuh tempo hingga akhir hari ini. */
  B: number;
  /** Tumpukan learning: item dengan level < 2. */
  L: number;
  /** Kuota maksimum harian dari pengaturan. */
  N: number;
}

export interface GateResult {
  quota: number;
  reason: string;
}

export const DEFAULT_RETENTION = 0.9;
export const MIN_ANSWERS_FOR_RETENTION = 20;

/** Retensi 7 hari; bila jawaban < 20 pakai 0,90 (SPEC 6.5). */
export function retentionOrDefault(correct: number, total: number): number {
  if (total < MIN_ANSWERS_FOR_RETENTION) return DEFAULT_RETENTION;
  return correct / total;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Mastery gate: kuota item baru harian (SPEC 6.5). */
export function computeQuota({ R, B, L, N }: GateInput): GateResult {
  if (B > 100) {
    return {
      quota: 0,
      reason: `Ada ${B} review menunggu, hari ini fokus mengulang.`,
    };
  }
  if (R < 0.8) {
    return {
      quota: 0,
      reason: `Retensi 7 hari ${pct(R)}, hari ini fokus mengulang.`,
    };
  }

  let q0: number;
  if (R < 0.85) q0 = Math.min(2, N);
  else if (R < 0.9) q0 = Math.min(3, N);
  else q0 = N;

  const penalty = Math.max(0, L - 20);
  const quota = Math.max(0, q0 - penalty);

  if (quota === 0) {
    return {
      quota: 0,
      reason: `Ada ${L} kata baru yang belum kokoh, hari ini fokus mengulang.`,
    };
  }
  return {
    quota,
    reason: `Retensi 7 hari ${pct(R)}, hari ini boleh membuka ${quota} item baru.`,
  };
}
