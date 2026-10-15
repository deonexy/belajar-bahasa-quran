import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card,
  type Grade,
} from "ts-fsrs";
import type { FsrsCardJson, Rating } from "./types";

function toJson(card: Card): FsrsCardJson {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as number,
    last_review: card.last_review ? card.last_review.toISOString() : null,
    learning_steps: card.learning_steps,
  };
}

function fromJson(json: FsrsCardJson): Card {
  return {
    due: new Date(json.due),
    stability: json.stability,
    difficulty: json.difficulty,
    elapsed_days: json.elapsed_days,
    scheduled_days: json.scheduled_days,
    reps: json.reps,
    lapses: json.lapses,
    state: json.state,
    last_review: json.last_review ? new Date(json.last_review) : undefined,
    learning_steps: json.learning_steps ?? 0,
  } as Card;
}

/** Kartu FSRS baru, jatuh tempo sekarang. */
export function newCard(now: Date): FsrsCardJson {
  return toJson(createEmptyCard(now));
}

/** Jadwalkan review berikutnya dengan ts-fsrs (SPEC 6.3). */
export function scheduleReview(
  card: FsrsCardJson,
  rating: Rating,
  now: Date,
  retention: number,
): FsrsCardJson {
  const f = fsrs(
    generatorParameters({
      request_retention: retention,
      enable_fuzz: false,
    }),
  );
  const result = f.next(fromJson(card), now, rating as Grade);
  return toJson(result.card);
}
