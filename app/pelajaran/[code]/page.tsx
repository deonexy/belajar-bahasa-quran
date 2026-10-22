import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/server";
import { LESSON_KIND_LABEL } from "@/lib/lesson-labels";

export default function PelajaranDetailPage(props: PageProps<"/pelajaran/[code]">) {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-5 py-6">
      <Link href="/pelajaran" className="text-sm opacity-70">← Pelajaran</Link>
      <Suspense fallback={<p className="text-sm opacity-60">Memuat pelajaran...</p>}>
        <Content {...props} />
      </Suspense>
    </main>
  );
}

async function Content({ params }: PageProps<"/pelajaran/[code]">) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id,kind,title,body_md")
    .eq("code", decodeURIComponent(code))
    .maybeSingle();
  if (!lesson) notFound();

  // Hanya pelajaran yang sudah dibuka lewat mastery gate yang boleh dibaca ulang.
  const { data: item } = await supabase
    .from("items")
    .select("id")
    .eq("kind", "lesson")
    .eq("ref_id", lesson.id)
    .maybeSingle();
  if (!item) notFound();
  const { data: opened } = await supabase
    .from("user_items")
    .select("item_id")
    .eq("user_id", auth.user!.id)
    .eq("item_id", item.id)
    .maybeSingle();
  if (!opened) notFound();

  return (
    <>
      <p className="text-xs opacity-60">{LESSON_KIND_LABEL[lesson.kind] ?? lesson.kind}</p>
      <h1 className="text-xl font-semibold">{lesson.title}</h1>
      <div className="prose-lesson">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{lesson.body_md}</ReactMarkdown>
      </div>
    </>
  );
}
