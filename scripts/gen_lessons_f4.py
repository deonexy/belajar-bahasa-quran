#!/usr/bin/env python3
"""Membangun supabase/seed/lessons_nahwu_sharaf.sql (F4).
Teks ayat dalam {{s:a}} diganti dengan teks Utsmani terverifikasi dari data/raw/fawaz.
Jalankan dari akar repo: python3 scripts/gen_lessons_f4.py
"""
import json, re

ara = {(v["chapter"], v["verse"]): v["text"] for v in json.load(open("data/raw/fawaz/ara-uthmani.min.json"))["quran"]}

def ayat(m):
    s, a = map(int, m.group(1).split(":"))
    return f"> {ara[(s, a)]}  \n> *(QS {s}:{a})*"

L = []  # (code, kind, title, seq, body, exercises)

def q(text, opts, ans):
    return {"q": text, "options": opts, "answer": ans}

L.append(("tasrif-dasar", "sharaf", "Tasrif dasar: madhi, mudhari', amr", 400, """
Kata kerja Arab berubah bentuk menurut **waktu** dan **perintah**. Tiga bentuk dasar:

| Bentuk | Makna | Contoh (akar ك-ت-ب) |
| --- | --- | --- |
| **فِعْل مَاضٍ** (madhi) | sudah dilakukan | **كَتَبَ** (ia telah menulis) |
| **فِعْل مُضَارِع** (mudhari') | sedang/akan dilakukan | **يَكْتُبُ** (ia menulis / akan menulis) |
| **فِعْل أَمْر** (amr) | perintah | **اُكْتُبْ** (tulislah!) |

Huruf akar (ك ت ب) tetap; yang berubah hanya pola harakat dan awalan. Awalan mudhari': **ي** (dia lk), **ت** (kamu / dia pr), **أ** (aku), **ن** (kami).

## Contoh dalam Al-Qur'an

{{1:5}}

**نَعْبُدُ** adalah mudhari' dengan awalan **ن** (kami menyembah).

{{96:1}}

**ٱقْرَأْ** adalah amr (bacalah!).
""", [
 q("كَتَبَ adalah fi'il...", ["madhi", "mudhari'", "amr"], 0),
 q("يَكْتُبُ adalah fi'il...", ["madhi", "mudhari'", "amr"], 1),
 q("اُكْتُبْ adalah fi'il...", ["madhi", "mudhari'", "amr"], 2),
 q("Awalan ن pada نَعْبُدُ menunjukkan pelaku...", ["dia (lk)", "aku", "kami"], 2),
]))

L.append(("isim-isyarah", "nahwu", "Isim isyarah: kata tunjuk", 600, """
**Isim isyarah** menunjuk sesuatu.

| Kata | Arti | Dipakai untuk |
| --- | --- | --- |
| **هَذَا** | ini (lk) | dekat, mudzakkar |
| **هَذِهِ** | ini (pr) | dekat, mu'annats |
| **ذَلِكَ** | itu (lk) | jauh, mudzakkar |
| **تِلْكَ** | itu (pr) | jauh, mu'annats |

## Contoh

{{2:2}}

**ذَٰلِكَ** menunjuk **ٱلْكِتَابُ** (Kitab itu).

Kata yang ditunjuk biasanya memakai **ال**: ذَلِكَ **الْ**كِتَابُ.
""", [
 q("ذَٰلِكَ berarti...", ["ini", "itu", "dan"], 1),
 q("Untuk menunjuk benda mu'annats yang dekat dipakai...", ["هَذَا", "هَذِهِ", "ذَلِكَ"], 1),
 q("Pada ذَٰلِكَ ٱلْكِتَٰبُ, yang ditunjuk adalah...", ["ذَٰلِكَ", "ٱلْكِتَٰبُ", "لَا"], 1),
]))

L.append(("isim-maushul", "nahwu", "Isim maushul: yang / orang yang", 800, """
**Isim maushul** berarti "yang" dan menyambung kata dengan kalimat penjelasnya (shilah).

| Kata | Arti |
| --- | --- |
| **الَّذِي** | yang (lk tunggal) |
| **الَّتِي** | yang (pr tunggal) |
| **الَّذِينَ** | yang (lk jamak) |

## Contoh

{{2:3}}

**الَّذِينَ** = orang-orang yang; kalimat penjelasnya: **يُؤْمِنُونَ بِالْغَيْبِ** (beriman kepada yang gaib).

{{1:7}}

Pola: **الَّذِينَ** + kalimat penjelas = "orang-orang yang ...".
""", [
 q("الَّذِينَ berarti...", ["yang (lk jamak)", "yang (pr tunggal)", "ini"], 0),
 q("الَّتِي dipakai untuk...", ["lk jamak", "pr tunggal", "lk tunggal"], 1),
 q("Kalimat setelah isim maushul disebut...", ["shilah", "khabar", "na't"], 0),
]))

L.append(("jumlah-ismiyah", "nahwu", "Jumlah ismiyah: mubtada' dan khabar", 1000, """
**Jumlah ismiyah** adalah kalimat yang diawali isim. Unsur intinya:

- **مُبْتَدَأ** (mubtada'): pokok kalimat, biasanya marfu'
- **خَبَر** (khabar): keterangan tentang pokok

Dalam bahasa Indonesia, kata "adalah" sering tidak ditulis di Arab.

## Contoh

{{1:2}}

**ٱلْحَمْدُ** = mubtada'; **لِلَّهِ** = khabar (milik Allah). Maknanya "Segala puji milik Allah."

{{112:1}}

**هُوَ** = mubtada'; **ٱللَّهُ أَحَدٌ** = khabar.
""", [
 q("Jumlah ismiyah diawali...", ["fi'il", "isim", "huruf jarr saja"], 1),
 q("Pada ٱلْحَمْدُ لِلَّهِ, mubtada'-nya...", ["ٱلْحَمْدُ", "لِلَّهِ", "رَبِّ"], 0),
 q("Keterangan tentang mubtada' disebut...", ["khabar", "fa'il", "shilah"], 0),
]))

L.append(("jumlah-filiyah", "nahwu", "Jumlah fi'liyah: fi'il dan fa'il", 1300, """
**Jumlah fi'liyah** diawali kata kerja.

- **فِعْل**: kata kerja
- **فَاعِل** (fa'il): pelaku, marfu'
- **مَفْعُول بِه** (maf'ul bih): objek, manshub

Urutan umum: fi'il → fa'il → maf'ul.

## Contoh

{{110:1}}

**جَاءَ** = fi'il (telah datang); **نَصْرُ ٱللَّهِ** = fa'il (pertolongan Allah).

{{1:5}}

**نَعْبُدُ** = fi'il; **إِيَّاكَ** didahulukan sebagai objek ("hanya kepada-Mu kami menyembah").
""", [
 q("Jumlah fi'liyah diawali...", ["isim", "fi'il", "khabar"], 1),
 q("Pelaku disebut...", ["fa'il", "maf'ul", "mubtada'"], 0),
 q("Pada إِذَا جَاءَ نَصْرُ ٱللَّهِ, fi'il-nya...", ["جَاءَ", "نَصْرُ", "إِذَا"], 0),
]))

L.append(("idhafah", "nahwu", "Idhafah: rangkaian kepemilikan", 1600, """
**Idhafah** menggabungkan dua isim: yang pertama (**مُضَاف**) dimiliki oleh yang kedua (**مُضَاف إِلَيْه**).

Aturan:
1. **Mudhaf** tidak boleh memakai ال dan tidak bertanwin.
2. **Mudhaf ilaih** selalu **majrur** (berharakat kasrah).

| Idhafah | Arti |
| --- | --- |
| **كِتَابُ اللَّهِ** | kitab Allah |
| **رَسُولُ اللَّهِ** | utusan Allah |

## Contoh

{{1:4}}

**مَالِكِ يَوْمِ ٱلدِّينِ**: *malik* (raja/pemilik) dari *yaum* (hari), dan *yaum* dari *ad-din* (pembalasan). Dua idhafah berantai.
""", [
 q("Mudhaf ilaih selalu...", ["marfu'", "manshub", "majrur"], 2),
 q("Mudhaf tidak boleh memakai...", ["ال", "kasrah", "dhammah"], 0),
 q("رَسُولُ اللَّهِ berarti...", ["rasul-rasul", "utusan Allah", "Allah mengutus"], 1),
]))

L.append(("nat", "nahwu", "Na't: kata sifat", 2000, """
**Na't** (sifat) mengikuti kata yang disifati (**مَنْعُوت**) dalam empat hal: **kasus** (marfu'/manshub/majrur), **jenis** (lk/pr), **jumlah**, dan **ma'rifah/nakirah**.

| Contoh | Arti |
| --- | --- |
| **كِتَابٌ كَبِيرٌ** | kitab yang besar |
| **الْكِتَابُ الْكَبِيرُ** | kitab yang besar itu |

## Contoh

{{1:6}}

**ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ**: *ash-shirath* (jalan) disifati *al-mustaqim* (yang lurus); keduanya manshub dan memakai ال.

{{1:3}}

**ٱلرَّحِيمِ** adalah sifat bagi **ٱلرَّحْمَٰنِ**; keduanya majrur.
""", [
 q("Na't harus sama dengan kata yang disifati dalam...", ["kasus", "panjang kata", "akar kata"], 0),
 q("Pada ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ, yang disifati adalah...", ["ٱلصِّرَٰطَ", "ٱلْمُسْتَقِيمَ", "keduanya"], 0),
 q("كِتَابٌ كَبِيرٌ berarti...", ["kitab besar (sebuah)", "kitab itu", "besar kitab itu"], 0),
]))

L.append(("irab-dasar", "nahwu", "I'rab dasar: marfu', manshub, majrur", 2500, """
Akhir kata benda berubah menurut perannya. Tiga keadaan:

| Keadaan | Tanda umum | Peran khas |
| --- | --- | --- |
| **مَرْفُوع** (marfu') | dhammah (ـُ / ـٌ) | mubtada', khabar, fa'il |
| **مَنْصُوب** (manshub) | fathah (ـَ / ـً) | maf'ul bih |
| **مَجْرُور** (majrur) | kasrah (ـِ / ـٍ) | setelah huruf jarr; mudhaf ilaih |

## Contoh

{{1:2}}

- **ٱلْحَمْدُ** marfu' (mubtada')
- **لِلَّهِ** majrur (setelah **لِ**)
- **رَبِّ** majrur (mudhaf ilaih/na't), **ٱلْعَٰلَمِينَ** majrur (mudhaf ilaih)

Data morfologi di aplikasi menandai kasus tiap kata (NOM/ACC/GEN); lihat di pembaca ayat.
""", [
 q("Tanda umum marfu' adalah...", ["dhammah", "fathah", "kasrah"], 0),
 q("Kata setelah huruf jarr berstatus...", ["marfu'", "manshub", "majrur"], 2),
 q("Objek (maf'ul bih) berstatus...", ["marfu'", "manshub", "majrur"], 1),
 q("Mudhaf ilaih berstatus...", ["marfu'", "manshub", "majrur"], 2),
]))

def sql_str(s):
    return s.replace("'", "''")

out = ["-- F4 (nahwu-sharaf). DIHASILKAN oleh scripts/gen_lessons_f4.py; jangan edit manual.",
       "-- Setelah dijalankan, buat item pelajaran: lihat bagian akhir file.", "",
       "insert into lessons (code, phase, kind, title, seq, body_md, exercises) values"]
vals = []
for code, kind, title, seq, body, ex in L:
    body = re.sub(r"\{\{(\d+:\d+)\}\}", ayat, body.strip())
    vals.append(f"('{sql_str(code)}', 1, '{kind}', '{sql_str(title)}', {seq},\n$md$\n{body}\n$md$,\n$js${json.dumps(ex, ensure_ascii=False)}$js$::jsonb)")
out.append(",\n\n".join(vals))
out.append("""on conflict (code) do update set
  title = excluded.title, kind = excluded.kind, seq = excluded.seq,
  body_md = excluded.body_md, exercises = excluded.exercises;

insert into items (kind, ref_id, phase, seq)
select 'lesson', l.id, 1, l.seq from lessons l
where l.code in (%s)
on conflict (kind, ref_id) do update set seq = excluded.seq;""" % ", ".join(f"'{c[0]}'" for c in L))
open("supabase/seed/lessons_nahwu_sharaf.sql", "w").write("\n".join(out) + "\n")
print(len(L), "pelajaran")
