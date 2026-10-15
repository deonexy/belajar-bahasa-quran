-- F4 (nahwu-sharaf). DIHASILKAN oleh scripts/gen_lessons_f4.py; jangan edit manual.
-- Setelah dijalankan, buat item pelajaran: lihat bagian akhir file.

insert into lessons (code, phase, kind, title, seq, body_md, exercises) values
('tasrif-dasar', 1, 'sharaf', 'Tasrif dasar: madhi, mudhari'', amr', 400,
$md$
Kata kerja Arab berubah bentuk menurut **waktu** dan **perintah**. Tiga bentuk dasar:

| Bentuk | Makna | Contoh (akar ك-ت-ب) |
| --- | --- | --- |
| **فِعْل مَاضٍ** (madhi) | sudah dilakukan | **كَتَبَ** (ia telah menulis) |
| **فِعْل مُضَارِع** (mudhari') | sedang/akan dilakukan | **يَكْتُبُ** (ia menulis / akan menulis) |
| **فِعْل أَمْر** (amr) | perintah | **اُكْتُبْ** (tulislah!) |

Huruf akar (ك ت ب) tetap; yang berubah hanya pola harakat dan awalan. Awalan mudhari': **ي** (dia lk), **ت** (kamu / dia pr), **أ** (aku), **ن** (kami).

## Contoh dalam Al-Qur'an

> إِيَّاكَ نَعۡبُدُ وَإِيَّاكَ نَسۡتَعِينُ  
> *(QS 1:5)*

**نَعْبُدُ** adalah mudhari' dengan awalan **ن** (kami menyembah).

> ٱقۡرَأۡ بِٱسۡمِ رَبِّكَ ٱلَّذِي خَلَقَ  
> *(QS 96:1)*

**ٱقْرَأْ** adalah amr (bacalah!).
$md$,
$js$[{"q": "كَتَبَ adalah fi'il...", "options": ["madhi", "mudhari'", "amr"], "answer": 0}, {"q": "يَكْتُبُ adalah fi'il...", "options": ["madhi", "mudhari'", "amr"], "answer": 1}, {"q": "اُكْتُبْ adalah fi'il...", "options": ["madhi", "mudhari'", "amr"], "answer": 2}, {"q": "Awalan ن pada نَعْبُدُ menunjukkan pelaku...", "options": ["dia (lk)", "aku", "kami"], "answer": 2}]$js$::jsonb),

('isim-isyarah', 1, 'nahwu', 'Isim isyarah: kata tunjuk', 600,
$md$
**Isim isyarah** menunjuk sesuatu.

| Kata | Arti | Dipakai untuk |
| --- | --- | --- |
| **هَذَا** | ini (lk) | dekat, mudzakkar |
| **هَذِهِ** | ini (pr) | dekat, mu'annats |
| **ذَلِكَ** | itu (lk) | jauh, mudzakkar |
| **تِلْكَ** | itu (pr) | jauh, mu'annats |

## Contoh

> ذَٰلِكَ ٱلۡكِتَٰبُ لَا رَيۡبَۛ فِيهِۛ هُدࣰ ى لِّلۡمُتَّقِينَ  
> *(QS 2:2)*

**ذَٰلِكَ** menunjuk **ٱلْكِتَابُ** (Kitab itu).

Kata yang ditunjuk biasanya memakai **ال**: ذَلِكَ **الْ**كِتَابُ.
$md$,
$js$[{"q": "ذَٰلِكَ berarti...", "options": ["ini", "itu", "dan"], "answer": 1}, {"q": "Untuk menunjuk benda mu'annats yang dekat dipakai...", "options": ["هَذَا", "هَذِهِ", "ذَلِكَ"], "answer": 1}, {"q": "Pada ذَٰلِكَ ٱلْكِتَٰبُ, yang ditunjuk adalah...", "options": ["ذَٰلِكَ", "ٱلْكِتَٰبُ", "لَا"], "answer": 1}]$js$::jsonb),

('isim-maushul', 1, 'nahwu', 'Isim maushul: yang / orang yang', 800,
$md$
**Isim maushul** berarti "yang" dan menyambung kata dengan kalimat penjelasnya (shilah).

| Kata | Arti |
| --- | --- |
| **الَّذِي** | yang (lk tunggal) |
| **الَّتِي** | yang (pr tunggal) |
| **الَّذِينَ** | yang (lk jamak) |

## Contoh

> ٱلَّذِينَ يُؤۡمِنُونَ بِٱلۡغَيۡبِ وَيُقِيمُونَ ٱلصَّلَوٰةَ وَمِمَّا رَزَقۡنَٰهُمۡ يُنفِقُونَ  
> *(QS 2:3)*

**الَّذِينَ** = orang-orang yang; kalimat penjelasnya: **يُؤْمِنُونَ بِالْغَيْبِ** (beriman kepada yang gaib).

> صِرَٰطَ ٱلَّذِينَ أَنۡعَمۡتَ عَلَيۡهِمۡ غَيۡرِ ٱلۡمَغۡضُوبِ عَلَيۡهِمۡ وَلَا ٱلضَّآلِّينَ  
> *(QS 1:7)*

Pola: **الَّذِينَ** + kalimat penjelas = "orang-orang yang ...".
$md$,
$js$[{"q": "الَّذِينَ berarti...", "options": ["yang (lk jamak)", "yang (pr tunggal)", "ini"], "answer": 0}, {"q": "الَّتِي dipakai untuk...", "options": ["lk jamak", "pr tunggal", "lk tunggal"], "answer": 1}, {"q": "Kalimat setelah isim maushul disebut...", "options": ["shilah", "khabar", "na't"], "answer": 0}]$js$::jsonb),

('jumlah-ismiyah', 1, 'nahwu', 'Jumlah ismiyah: mubtada'' dan khabar', 1000,
$md$
**Jumlah ismiyah** adalah kalimat yang diawali isim. Unsur intinya:

- **مُبْتَدَأ** (mubtada'): pokok kalimat, biasanya marfu'
- **خَبَر** (khabar): keterangan tentang pokok

Dalam bahasa Indonesia, kata "adalah" sering tidak ditulis di Arab.

## Contoh

> ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱلۡعَٰلَمِينَ  
> *(QS 1:2)*

**ٱلْحَمْدُ** = mubtada'; **لِلَّهِ** = khabar (milik Allah). Maknanya "Segala puji milik Allah."

> قُلۡ هُوَ ٱللَّهُ أَحَدٌ  
> *(QS 112:1)*

**هُوَ** = mubtada'; **ٱللَّهُ أَحَدٌ** = khabar.
$md$,
$js$[{"q": "Jumlah ismiyah diawali...", "options": ["fi'il", "isim", "huruf jarr saja"], "answer": 1}, {"q": "Pada ٱلْحَمْدُ لِلَّهِ, mubtada'-nya...", "options": ["ٱلْحَمْدُ", "لِلَّهِ", "رَبِّ"], "answer": 0}, {"q": "Keterangan tentang mubtada' disebut...", "options": ["khabar", "fa'il", "shilah"], "answer": 0}]$js$::jsonb),

('jumlah-filiyah', 1, 'nahwu', 'Jumlah fi''liyah: fi''il dan fa''il', 1300,
$md$
**Jumlah fi'liyah** diawali kata kerja.

- **فِعْل**: kata kerja
- **فَاعِل** (fa'il): pelaku, marfu'
- **مَفْعُول بِه** (maf'ul bih): objek, manshub

Urutan umum: fi'il → fa'il → maf'ul.

## Contoh

> إِذَا جَآءَ نَصۡرُ ٱللَّهِ وَٱلۡفَتۡحُ  
> *(QS 110:1)*

**جَاءَ** = fi'il (telah datang); **نَصْرُ ٱللَّهِ** = fa'il (pertolongan Allah).

> إِيَّاكَ نَعۡبُدُ وَإِيَّاكَ نَسۡتَعِينُ  
> *(QS 1:5)*

**نَعْبُدُ** = fi'il; **إِيَّاكَ** didahulukan sebagai objek ("hanya kepada-Mu kami menyembah").
$md$,
$js$[{"q": "Jumlah fi'liyah diawali...", "options": ["isim", "fi'il", "khabar"], "answer": 1}, {"q": "Pelaku disebut...", "options": ["fa'il", "maf'ul", "mubtada'"], "answer": 0}, {"q": "Pada إِذَا جَاءَ نَصْرُ ٱللَّهِ, fi'il-nya...", "options": ["جَاءَ", "نَصْرُ", "إِذَا"], "answer": 0}]$js$::jsonb),

('idhafah', 1, 'nahwu', 'Idhafah: rangkaian kepemilikan', 1600,
$md$
**Idhafah** menggabungkan dua isim: yang pertama (**مُضَاف**) dimiliki oleh yang kedua (**مُضَاف إِلَيْه**).

Aturan:
1. **Mudhaf** tidak boleh memakai ال dan tidak bertanwin.
2. **Mudhaf ilaih** selalu **majrur** (berharakat kasrah).

| Idhafah | Arti |
| --- | --- |
| **كِتَابُ اللَّهِ** | kitab Allah |
| **رَسُولُ اللَّهِ** | utusan Allah |

## Contoh

> مَٰلِكِ يَوۡمِ ٱلدِّينِ  
> *(QS 1:4)*

**مَالِكِ يَوْمِ ٱلدِّينِ**: *malik* (raja/pemilik) dari *yaum* (hari), dan *yaum* dari *ad-din* (pembalasan). Dua idhafah berantai.
$md$,
$js$[{"q": "Mudhaf ilaih selalu...", "options": ["marfu'", "manshub", "majrur"], "answer": 2}, {"q": "Mudhaf tidak boleh memakai...", "options": ["ال", "kasrah", "dhammah"], "answer": 0}, {"q": "رَسُولُ اللَّهِ berarti...", "options": ["rasul-rasul", "utusan Allah", "Allah mengutus"], "answer": 1}]$js$::jsonb),

('nat', 1, 'nahwu', 'Na''t: kata sifat', 2000,
$md$
**Na't** (sifat) mengikuti kata yang disifati (**مَنْعُوت**) dalam empat hal: **kasus** (marfu'/manshub/majrur), **jenis** (lk/pr), **jumlah**, dan **ma'rifah/nakirah**.

| Contoh | Arti |
| --- | --- |
| **كِتَابٌ كَبِيرٌ** | kitab yang besar |
| **الْكِتَابُ الْكَبِيرُ** | kitab yang besar itu |

## Contoh

> ٱهۡدِنَا ٱلصِّرَٰطَ ٱلۡمُسۡتَقِيمَ  
> *(QS 1:6)*

**ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ**: *ash-shirath* (jalan) disifati *al-mustaqim* (yang lurus); keduanya manshub dan memakai ال.

> ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ  
> *(QS 1:3)*

**ٱلرَّحِيمِ** adalah sifat bagi **ٱلرَّحْمَٰنِ**; keduanya majrur.
$md$,
$js$[{"q": "Na't harus sama dengan kata yang disifati dalam...", "options": ["kasus", "panjang kata", "akar kata"], "answer": 0}, {"q": "Pada ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ, yang disifati adalah...", "options": ["ٱلصِّرَٰطَ", "ٱلْمُسْتَقِيمَ", "keduanya"], "answer": 0}, {"q": "كِتَابٌ كَبِيرٌ berarti...", "options": ["kitab besar (sebuah)", "kitab itu", "besar kitab itu"], "answer": 0}]$js$::jsonb),

('irab-dasar', 1, 'nahwu', 'I''rab dasar: marfu'', manshub, majrur', 2500,
$md$
Akhir kata benda berubah menurut perannya. Tiga keadaan:

| Keadaan | Tanda umum | Peran khas |
| --- | --- | --- |
| **مَرْفُوع** (marfu') | dhammah (ـُ / ـٌ) | mubtada', khabar, fa'il |
| **مَنْصُوب** (manshub) | fathah (ـَ / ـً) | maf'ul bih |
| **مَجْرُور** (majrur) | kasrah (ـِ / ـٍ) | setelah huruf jarr; mudhaf ilaih |

## Contoh

> ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱلۡعَٰلَمِينَ  
> *(QS 1:2)*

- **ٱلْحَمْدُ** marfu' (mubtada')
- **لِلَّهِ** majrur (setelah **لِ**)
- **رَبِّ** majrur (mudhaf ilaih/na't), **ٱلْعَٰلَمِينَ** majrur (mudhaf ilaih)

Data morfologi di aplikasi menandai kasus tiap kata (NOM/ACC/GEN); lihat di pembaca ayat.
$md$,
$js$[{"q": "Tanda umum marfu' adalah...", "options": ["dhammah", "fathah", "kasrah"], "answer": 0}, {"q": "Kata setelah huruf jarr berstatus...", "options": ["marfu'", "manshub", "majrur"], "answer": 2}, {"q": "Objek (maf'ul bih) berstatus...", "options": ["marfu'", "manshub", "majrur"], "answer": 1}, {"q": "Mudhaf ilaih berstatus...", "options": ["marfu'", "manshub", "majrur"], "answer": 2}]$js$::jsonb)
on conflict (code) do update set
  title = excluded.title, kind = excluded.kind, seq = excluded.seq,
  body_md = excluded.body_md, exercises = excluded.exercises;

insert into items (kind, ref_id, phase, seq)
select 'lesson', l.id, 1, l.seq from lessons l
where l.code in ('tasrif-dasar', 'isim-isyarah', 'isim-maushul', 'jumlah-ismiyah', 'jumlah-filiyah', 'idhafah', 'nat', 'irab-dasar')
on conflict (kind, ref_id) do update set seq = excluded.seq;
