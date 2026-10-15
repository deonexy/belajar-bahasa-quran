import type { ExerciseType } from "@/lib/engine";

export interface WordView {
  text: string;
  gloss: string | null;
  target: boolean;
}

export interface ExampleView {
  surah: number;
  ayah: number;
  words: WordView[];
  translation: string;
}

export interface LemmaCard {
  kind: "lemma";
  itemId: number;
  isNew: boolean;
  exercise: ExerciseType; // recognize | recall | context
  lemmaAr: string;
  gloss: string;
  pos: string;
  rootAr: string | null;
  /** Pilihan jawaban: label yang ditampilkan; indeks benar ada di `answer`. */
  options: string[];
  answer: number;
  example: ExampleView | null;
}

export interface AyahCard {
  kind: "ayah";
  itemId: number;
  isNew: boolean;
  surah: number;
  ayah: number;
  textAr: string;
  translation: string;
  words: WordView[];
}

export interface LessonCard {
  kind: "lesson";
  itemId: number;
  isNew: boolean;
  code: string;
  title: string;
  bodyMd: string;
  exercises: { q: string; options: string[]; answer: number }[];
}

export type SessionCard = LemmaCard | AyahCard | LessonCard;
