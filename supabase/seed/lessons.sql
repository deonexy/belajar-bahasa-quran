-- Pelajaran awal Q1 (SPEC 7.1). Idempoten: upsert berdasarkan code.
-- exercises: [{ "q": "...", "options": ["..."], "answer": <indeks jawaban benar> }]

insert into lessons (code, phase, kind, title, seq, body_md, exercises) values
('tiga-jenis-kata', 1, 'nahwu', 'Tiga jenis kata: isim, fi''il, huruf', 5,
$md$
Setiap kata dalam bahasa Arab masuk ke salah satu dari tiga jenis.

## 1. Isim (kata benda dan kata sifat)

Menunjukkan makna tanpa kaitan waktu: **كِتَابٌ** (sebuah kitab), **رَسُولٌ** (seorang rasul), **كَبِيرٌ** (besar).

Ciri umum isim: bisa diawali **ال** (kata sandang), bisa bertanwin (ـٌ ـً ـٍ), dan bisa didahului huruf jarr seperti **فِي** atau **مِنْ**.

## 2. Fi'il (kata kerja)

Menunjukkan perbuatan **sekaligus waktu**: **كَتَبَ** (telah menulis), **يَكْتُبُ** (sedang/akan menulis), **اُكْتُبْ** (tulislah!).

Ciri umum fi'il: bisa didahului **قَدْ** atau **سَوْفَ**.

## 3. Huruf (partikel)

Maknanya baru lengkap bila bersama kata lain: **فِي** (di, dalam), **مِنْ** (dari), **عَلَى** (di atas), **لَا** (tidak).

## Cara cepat mengenali

Tanyakan: apakah kata ini punya makna sendiri tanpa waktu (isim), punya makna dengan waktu (fi'il), atau hanya menghubungkan/menegaskan (huruf)?
$md$,
'[
 {"q":"كَتَبَ termasuk jenis kata apa?","options":["Isim","Fi''il","Huruf"],"answer":1},
 {"q":"فِي termasuk jenis kata apa?","options":["Isim","Fi''il","Huruf"],"answer":2},
 {"q":"كِتَابٌ termasuk jenis kata apa?","options":["Isim","Fi''il","Huruf"],"answer":0},
 {"q":"Jenis kata yang maknanya mengandung waktu adalah...","options":["Isim","Fi''il","Huruf"],"answer":1}
]'::jsonb),

('huruf-menempel', 1, 'partikel', 'Huruf yang menempel pada kata', 105,
$md$
Beberapa huruf tidak berdiri sendiri, melainkan **menempel di awal kata**. Mengenalinya membuat Anda bisa membaca kata yang tampak panjang.

| Huruf | Arti | Contoh |
| --- | --- | --- |
| **وَ** | dan | وَكِتَابٌ (dan sebuah kitab) |
| **فَ** | maka; lalu | فَقَالَ (maka ia berkata) |
| **بِ** | dengan; di | بِسْمِ (dengan nama) |
| **لِ** | untuk; milik | لِلَّهِ (milik Allah) |
| **كَ** | seperti | كَالْجِبَالِ (seperti gunung-gunung) |
| **ٱل** | kata sandang (penentu) | ٱلْكِتَابُ (kitab itu) |

## Cara membaca kata panjang

Lepaskan dari depan: **وَبِٱلْكِتَابِ** = **وَ** (dan) + **بِ** (dengan) + **ٱل** + **كِتَاب** → "dan dengan kitab itu".

Kata yang tersisa setelah semua huruf menempel dilepas adalah kata inti yang Anda pelajari di kosakata.
$md$,
'[
 {"q":"بِسْمِ: huruf بِ di awalnya berarti...","options":["dan","dengan","untuk"],"answer":1},
 {"q":"وَ di awal kata berarti...","options":["dan","maka","seperti"],"answer":0},
 {"q":"لِلَّهِ berarti...","options":["dari Allah","milik Allah","bersama Allah"],"answer":1},
 {"q":"ٱلْكِتَابُ: bagian ٱل berfungsi sebagai...","options":["kata sandang penentu","kata penghubung","kata kerja"],"answer":0}
]'::jsonb),

('dhamir-dasar', 1, 'nahwu', 'Dhamir: kata ganti dasar', 135,
$md$
Dhamir adalah kata ganti. Ada yang berdiri sendiri, ada yang menempel di akhir kata.

## Dhamir yang berdiri sendiri

| Bentuk | Arti |
| --- | --- |
| **هُوَ** | dia (laki-laki) |
| **هِيَ** | dia (perempuan) |
| **هُمْ** | mereka (laki-laki) |
| **أَنْتَ** | kamu (laki-laki) |
| **أَنْتُمْ** | kalian |
| **أَنَا** | aku |
| **نَحْنُ** | kami |

## Dhamir yang menempel

| Bentuk | Arti | Contoh |
| --- | --- | --- |
| **ـهُ** | -nya (laki-laki) | كِتَابُهُ (kitabnya) |
| **ـهَا** | -nya (perempuan) | رَبُّهَا (Tuhannya) |
| **ـهُمْ** | -mereka | رَبُّهُمْ (Tuhan mereka) |
| **ـكَ** | -mu | رَبُّكَ (Tuhanmu) |
| **ـنَا** | -kami | رَبُّنَا (Tuhan kami) |
| **ـي** | -ku | رَبِّي (Tuhanku) |

Dhamir yang menempel bukan bagian dari kata intinya; lepaskan dulu untuk menemukan kata dasarnya.
$md$,
'[
 {"q":"هُمْ berarti...","options":["dia (laki-laki)","mereka","kami"],"answer":1},
 {"q":"رَبُّنَا berarti...","options":["Tuhanku","Tuhanmu","Tuhan kami"],"answer":2},
 {"q":"أَنَا berarti...","options":["aku","kamu","dia"],"answer":0},
 {"q":"كِتَابُهُ berarti...","options":["kitabku","kitabnya","kitab mereka"],"answer":1}
]'::jsonb)
on conflict (code) do update set
  title = excluded.title, kind = excluded.kind, seq = excluded.seq,
  body_md = excluded.body_md, exercises = excluded.exercises;
