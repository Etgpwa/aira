# Karen PWA — Design Brief for Google Stitch

Dokumen ini adalah panduan desain komprehensif untuk membuat mockup UI aplikasi **Karen** — Personal Assistant PWA berbasis Next.js. Setiap layar, komponen, state, dan interaksi dijelaskan secara mendetail agar tidak ada tampilan yang terlewat.

---

## 1. DESIGN SYSTEM & BRAND IDENTITY

### 1.1 Identitas Aplikasi
- **Nama Aplikasi**: Karen (Asisten Pribadi)
- **Tagline**: Asisten harian berbasis WhatsApp + Dashboard Web
- **Platform**: PWA (Progressive Web App), responsif desktop & mobile
- **Tone**: Bersih, modern, minimal, profesional tapi tetap personal
- **Target User**: Mahasiswa aktif yang juga bekerja (multitasker)

### 1.2 Tipografi
- **Font Utama**: Inter (Google Fonts) — sans-serif, modern
- **Heading**: Font weight 700 (Bold), letter-spacing -0.02em
- **Body**: Font weight 400–500
- **Ukuran Skala**:
  - `xs`: 0.75rem (12px) — label kecil, tanggal
  - `sm`: 0.875rem (14px) — body text, deskripsi
  - `base`: 1rem (16px) — body utama
  - `lg`: 1.125rem (18px) — sub-heading
  - `xl`: 1.25rem (20px) — card title
  - `2xl`: 1.5rem (24px) — page heading
  - `3xl`: 1.875rem (30px) — metric besar

### 1.3 Color Palette

#### Light Mode (Default)
| Token | Hex | Penggunaan |
|:---|:---|:---|
| `--bg-primary` | `#ffffff` | Background halaman, card |
| `--bg-secondary` | `#f4f4f5` | Background hover, row alternating |
| `--bg-tertiary` | `#e4e4e7` | Progress bar track, chip/tag |
| `--text-primary` | `#18181b` | Teks utama |
| `--text-secondary` | `#52525b` | Label, deskripsi |
| `--text-muted` | `#a1a1aa` | Placeholder, info minor |
| `--border-color` | `#e4e4e7` | Border card, input, divider |
| `--accent-color` | `#4f46e5` | Indigo-600. CTA utama, nav aktif |
| `--accent-hover` | `#4338ca` | Indigo-700. Hover CTA |
| `--success` | `#16a34a` | Green-600. Status positif |
| `--danger` | `#dc2626` | Red-600. Hapus, error |
| `--warning` | `#d97706` | Amber-600. Hutang, peringatan |

#### Dark Mode (`data-theme="dark"`)
| Token | Hex |
|:---|:---|
| `--bg-primary` | `#09090b` |
| `--bg-secondary` | `#18181b` |
| `--bg-tertiary` | `#27272a` |
| `--text-primary` | `#fafafa` |
| `--text-secondary` | `#a1a1aa` |
| `--text-muted` | `#52525b` |
| `--border-color` | `#27272a` |
| `--accent-color` | `#6366f1` |
| `--success` | `#22c55e` |
| `--danger` | `#ef4444` |
| `--warning` | `#f59e0b` |

### 1.4 Komponen Dasar

#### Card
- Background: `--bg-primary`
- Border: `1px solid --border-color`
- Border Radius: `8px`
- Padding: `1.5rem` (24px)
- Box Shadow: `0 1px 3px rgba(0,0,0,0.1)`

#### Button — Primary
- Background: `--accent-color` (indigo)
- Color: white, font-weight 500, font-size 14px
- Padding: `0.5rem 1rem`, border-radius: `6px`
- Hover: `--accent-hover`
- Loading state: spinner kecil + text "Menyimpan..."

#### Button — Outline
- Background: transparent
- Border: `1px solid --border-color`
- Color: `--text-primary`
- Hover: Background `--bg-secondary`

#### Button — Ghost/Danger
- Background: transparent, color `--danger`
- Hover: Background merah-muda opacity 10%

#### Badge / Tag (Pill)
- Font-size: 0.75rem (12px)
- Padding: `2px 8px`, border-radius: `9999px`
- Varian:
  - **Success**: background green-100/green-900 (dark), text green-700/green-300
  - **Warning**: background amber-100/amber-900, text amber-700/amber-400
  - **Danger**: background red-100/red-900, text red-700/red-400
  - **Accent**: background indigo-100/indigo-900, text indigo-700/indigo-400
  - **Neutral**: background `--bg-tertiary`, text `--text-secondary`

#### Form Input / Select / Textarea
- Width: 100%
- Padding: `0.5rem 0.75rem`, border-radius: `6px`
- Border: `1px solid --border-color`
- Font: Inter, 14px, color `--text-primary`
- Background: `--bg-primary`
- Focus: border-color `--accent-color`, box-shadow `0 0 0 3px rgba(99,102,241,0.2)`
- Textarea: min-height 96px, resize vertical

#### Progress Bar
- Container: height 8px, border-radius pill, background `--bg-tertiary`
- Fill: `--accent-color` (default), `--success` (100%), `--danger` (over-budget)
- Transisi: `width 0.3s ease-in-out`

---

## 2. LAYOUT UTAMA

### 2.1 Desktop Layout (≥ 769px)
```
┌─────────────────────────────────────────────────────────┐
│  SIDEBAR (fixed kiri, 240px lebar, full height 100vh)   │
│  + MAIN CONTENT (flex-1, padding 2rem, scrollable)      │
└─────────────────────────────────────────────────────────┘
Grid: `grid-template-columns: 240px 1fr`
```

### 2.2 Mobile Layout (≤ 768px)
```
┌────────────────────────────┐
│  MAIN CONTENT (full width) │
│  padding-bottom: 64px      │
├────────────────────────────┤
│  BOTTOM NAV BAR            │
│  position: fixed, bottom:0 │
│  height: 64px + safe-area  │
└────────────────────────────┘
```

### 2.3 Sidebar (Desktop)

**Dimensi**: 240px lebar, position sticky, height 100vh, border-right 1px

**Isi dari atas ke bawah:**

**1. Header** (padding 1.5rem, border-bottom):
- Kiri: Nama "Aira" — font-bold, 1.25rem
- Kanan: ThemeToggle button (icon Sun/Moon, 20px, text-secondary)

**2. Nav List** (padding 1rem, flex-1, gap 0.5rem antar item):

| # | Icon (Lucide) | Label | Route |
|:---:|:---|:---|:---|
| 1 | `LayoutDashboard` | Dashboard | `/` |
| 2 | `Wallet` | Keuangan | `/finance` |
| 3 | `Target` | Tabungan | `/goals` |
| 4 | `CheckSquare` | Tasks | `/tasks` |
| 5 | `CalendarDays` | Jadwal | `/schedule` |
| 6 | `GraduationCap` | **Kuliah** *(BARU)* | `/academic` |

**Nav Item Styling:**
- Padding: `0.75rem 1rem`, border-radius: `6px`
- Flex row, gap 0.75rem (icon + label)
- **Active**: Background `--accent-color`, color white
- **Hover**: Background `--bg-secondary`, color `--text-primary`
- **Inactive**: color `--text-secondary`

**3. Footer** (mt-auto, padding, border-top):
- Icon `LogOut` + label "Keluar"
- Color `--danger`, hover: background danger opacity 10%

### 2.4 Bottom Navigation (Mobile)

- position: fixed, bottom: 0, width: 100%
- height: `calc(64px + env(safe-area-inset-bottom))`
- background: `--bg-primary`, border-top 1px
- Flex row, justify-content: space-around

**Tiap item** (flex-col, icon atas + label bawah):
- Icon: 20px
- Label: 0.75rem, display block
- Gap: 0.25rem, padding: 0.5rem
- **Active**: color `--accent-color` (NO background fill — berbeda dari desktop)
- **Inactive**: color `--text-secondary`

> Karena ada 6 item, pertimbangkan icon-only di mobile dengan label hanya pada active item, atau horizontal scroll.

---

## 3. HALAMAN — LOGIN

Route: `/login` | Layout: Full screen, no sidebar, centered

```
[Full screen — bg: --bg-secondary atau gradient sangat halus]

          [Logo Aira: ikon sederhana indigo atau huruf A stylized]
          [Tagline: "Asisten Pribadimu" — text-secondary, 14px]

     ┌──────────────────────────────────────┐
     │            Masuk ke Aira             │  ← h1, 20px, bold
     │                                      │
     │  Email                               │
     │  ┌────────────────────────────────┐  │
     │  │ nama@email.com                 │  │
     │  └────────────────────────────────┘  │
     │                                      │
     │  Password                            │
     │  ┌────────────────────────────────┐  │
     │  │ ••••••••••                     │  │
     │  └────────────────────────────────┘  │
     │                                      │
     │  ┌────────────────────────────────┐  │
     │  │         Masuk          [Btn]   │  │  ← btn-primary, full width
     │  └────────────────────────────────┘  │
     │                                      │
     │  [Error message — merah, jika ada]   │
     └──────────────────────────────────────┘
           Card: max-w 400px, shadow medium

     Versi kecil di bawah: "Aira v1.0 — Personal Assistant"
```

**States yang perlu ditampilkan:**
- Default (kosong)
- Loading: tombol "Memuat..." + spinner inline, disabled
- Error: Alert strip merah di atas form, teks dari server

---

## 4. HALAMAN — DASHBOARD (Overview)

Route: `/` | Menampilkan ringkasan keuangan.

```
Header:
  h1 "Ringkasan"
  p "Senin, 1 September 2026" ← tanggal hari ini, text-secondary

─────────────────────────────────────────────

[Summary Cards — grid 2 kolom x 2 baris]

┌──────────────────┐  ┌──────────────────┐
│ Total Saldo      │  │ Pengeluaran      │
│ ── [Wallet ↗]   │  │ Bulan Ini        │
│                  │  │ ── [TrendingDown]│
│ Rp 12.500.000    │  │ Rp 2.300.000    │
└──────────────────┘  └──────────────────┘
┌──────────────────┐  ┌──────────────────┐
│ Pemasukan        │  │ Hutang Aktif     │
│ Bulan Ini        │  │ ── [AlertCircle] │
│ ── [TrendingUp]  │  │                  │
│ Rp 5.000.000    │  │ Rp 800.000       │
└──────────────────┘  └──────────────────┘

Keterangan warna icon:
- Wallet → accent (indigo)
- TrendingDown → danger (merah)
- TrendingUp → success (hijau)
- AlertCircle → warning (amber)

─────────────────────────────────────────────

[Chart Card — full width]
┌────────────────────────────────────────────┐
│ Arus Kas (6 Bulan Terakhir)                │
│                                            │
│  5jt ┤        ▓                            │
│  4jt ┤   ▓    ▓   ▓                       │
│  3jt ┤   ▓▒   ▓   ▓▒  ▓                  │
│  2jt ┤ ▓ ▓▒ ▓ ▓   ▓▒  ▓▒  ▓             │
│  1jt ┤ ▓▒▓▒ ▓▒▓  ▓▒▓▒ ▓▒  ▓▒            │
│      └────────────────────────────────     │
│       Apr   Mei   Jun   Jul  Agu   Sep     │
│                                            │
│  ▓ Pemasukan (indigo)  ▒ Pengeluaran (merah)|
└────────────────────────────────────────────┘
  Height card: ~350px, chart area: ~250px
```

---

## 5. HALAMAN — KEUANGAN

Route: `/finance`

```
Header Row:
  h1 "Keuangan"              [BTN + Tambah Transaksi]

─────────────────────────────────────────────

[Grid 2 kolom (desktop) — stacked di mobile]

KOLOM KIRI (finance-main):               KOLOM KANAN (finance-side):

┌──────────────────────────┐             ┌──────────────────────────┐
│ Rekening & Dompet        │             │ Budget Kategori          │
│                          │             │ (Bulan Ini)              │
│ BCA          Rp 8.000.000│             │                          │
│ ──────────────────────── │             │ Makan                    │
│ GoPay        Rp 500.000  │             │ Rp 750k / Rp 1.000.000   │
│ ──────────────────────── │             │ ████████░░ 75%           │
│ Cash         Rp 200.000  │             │                          │
└──────────────────────────┘             │ Transport                │
                                         │ Rp 210k / Rp 200.000     │
┌──────────────────────────┐             │ ██████████ 105%          │
│ Transaksi Terbaru        │             │ ⚠ Melebihi budget!       │
│                          │             └──────────────────────────┘
│ Makan Siang              │
│ 31 Agt 2026 • GoPay  [-] │             ┌──────────────────────────┐
│ Rp 35.000      merah     │             │ Hutang & Piutang         │
│ ──────────────────────── │             │                          │
│ Gaji Agustus             │             │ Budi                     │
│ 25 Agt 2026 • BCA    [+] │             │ Hutangku  Rp 500.000     │
│ Rp 5.000.000   hijau     │             │ ──────────────────────── │
│ ──────────────────────── │             │ Andi                     │
│ [10 item transaksi]      │             │ Piutangku  Rp 200.000    │
└──────────────────────────┘             └──────────────────────────┘
```

**Detail Transaction Item:**
- Kiri: Nama/deskripsi (bold, 14px) + baris bawah: tanggal + nama rekening (12px, text-secondary)
- Kanan: `+Rp X.XXX` hijau (income) atau `-Rp X.XXX` merah (expense), font-bold
- Divider tipis antar item

**Detail Budget Item:**
- Baris atas: Nama kategori (kiri) | "Rp spent / Rp total" (kanan), 14px
- Progress bar 8px
- Jika over: label "Melebihi budget!" di bawah bar, warna danger, 12px

**Detail Debt Item:**
- Card kecil (border, border-radius 8px, padding 12px), flex row
- Kiri: Nama (bold) + keterangan (text-secondary, 12px)
- Kanan: Jumlah (bold) + badge "Hutang" (merah) atau "Piutang" (hijau)

**Modal: Tambah Transaksi**
- Tipe: Segmented control "Pengeluaran | Pemasukan | Transfer"
- Nominal: input angka, prefix "Rp"
- Rekening: Select dropdown
- Kategori: Select dropdown (difilter berdasarkan tipe)
- Deskripsi: Text input (opsional)
- Tanggal: DateTime input, default sekarang
- Footer: [Batal] [Simpan Transaksi]

---

## 6. HALAMAN — TABUNGAN & GOALS

Route: `/goals`

```
Header Row:
  h1 "Tabungan & Goals"      [BTN + Tambah Goal]

[Grid Cards — 2-3 kolom desktop, 1 kolom mobile]

┌─────────────────────────┐  ┌─────────────────────────┐
│ Beli Laptop             │  │ Liburan ke Bali ✓        │
│             [Proses][🗑]│  │           [Tercapai][🗑] │
│                         │  │                         │
│  Terkumpul   Target     │  │  Terkumpul   Target     │
│  Rp 2jt   Rp 8.000.000  │  │  Rp 5jt     Rp 5jt     │
│                         │  │                         │
│  ████░░░░░░░░ 25%       │  │  █████████████ 100%     │
│  [bar indigo]           │  │  [bar hijau]            │
│                         │  │                         │
│  Target: 31 Des 2026    │  │  (Sudah tercapai!)      │
└─────────────────────────┘  └─────────────────────────┘

Empty state (jika tidak ada goal):
┌─────────────────────────────────────────────┐
│         [Target icon besar, muted]          │
│         Belum ada target tabungan.          │
│         Mulai buat goal pertamamu!          │
│         [BTN: + Tambah Goal pertama]        │
└─────────────────────────────────────────────┘
```

**Goal Card Detail:**
- Header: nama goal (font-semibold, 18px) + kanan: badge status + icon hapus (🗑)
- Badge "Proses": bg amber-muda, text amber-dark
- Badge "Tercapai ✓": bg green-muda, text green-dark
- Amount row: Terkumpul (kiri, accent) | Target (kanan)
- Label-label: text-secondary, 12px
- Progress bar 8px + persentase teks di kanan bawah
- Target date (jika ada): text-secondary, 12px

**Modal: Tambah Goal**
- Nama Goal: text input
- Target Nominal: number input, prefix "Rp"
- Target Tanggal: date input (opsional)
- Footer: [Batal] [Buat Goal]

---

## 7. HALAMAN — TASKS / KANBAN BOARD

Route: `/tasks`

```
Header Row:
  h1 "Tugas"                 [BTN + Tambah Tugas]

[Kanban Board — 3 kolom horizontal]

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  TO DO (3)      │  │  IN PROGRESS (1)│  │  DONE (2)       │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │
│ │ Tugas A     │ │  │ │ Tugas C     │ │  │ │ Tugas E ✓   │ │
│ │    [HIGH]   │ │  │ │    [MEDIUM] │ │  │ │    [LOW]    │ │
│ │             │ │  │ │ ┌─────────┐ │ │  │ │             │ │
│ │ Tenggat:    │ │  │ │ │Progres: │ │ │  │ │ Selesai     │ │
│ │ 5 Sep 11:59 │ │  │ │ │Sudah bab│ │ │  │             │ │
│ │             │ │  │ │ │1, skrg  │ │ │  │ [←] [🗑]   │ │
│ │ [Maju→][🗑]│ │  │ │ │kuesioner│ │ │  └─────────────┘ │
│ └─────────────┘ │  │ │ └─────────┘ │ │  │               │
│ ┌─────────────┐ │  │ │             │ │  │ ┌─────────────┐│
│ │ Tugas B     │ │  │ │ Tenggat:    │ │  │ │ Tugas F ✓   ││
│ │    [MEDIUM] │ │  │ │ 10 Sep 23:00│ │  │ │             ││
│ │             │ │  │ │             │ │  │ │ [←] [🗑]   ││
│ │ [Maju→][🗑]│ │  │ │[←][✎][→][🗑]│ │  └─────────────┘ │
│ └─────────────┘ │  │ └─────────────┘ │                   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

**Task Card Detail:**
- Header: Judul (font-medium, 14px) + Priority badge (kanan)
- Priority badges: HIGH=merah, MEDIUM=amber, LOW=hijau (border + text warna, bg transparan)
- Catatan Progres box (jika ada description):
  - IN_PROGRESS: bg biru sangat muda, left-border biru 3px, label "📌 Progres Saat Ini:" biru
  - TODO: bg `--bg-secondary`, left-border abu, label "Catatan:"
  - Text di-clamp 3 baris
- Tenggat: text-secondary, 12px
- Footer actions (border-top, flex, justify-between):
  - [← Mundur] — hanya jika bukan TODO
  - [✎ Update Progres] — hanya jika IN_PROGRESS, outline biru
  - [Maju →] — hanya jika bukan DONE
  - [🗑] — selalu ada, align kanan, text-secondary → danger

**Modal: Input Progres (wajib saat masuk IN_PROGRESS):**
- Title: "Mulai Kerjakan: [Nama Tugas]"
- Textarea: "Prosesnya sudah sampai mana? *", rows 4, required
- Help: "Catatan ini bisa diperbarui sewaktu-waktu"
- Footer: [Batal] [Simpan & Masuk In Progress]

**Modal: Tambah Tugas:**
- Nama Tugas: text
- Prioritas: Select LOW/MEDIUM/HIGH
- Deadline: datetime (opsional)
- Footer: [Batal] [Tambah Tugas]

---

## 8. HALAMAN — JADWAL MINGGUAN

Route: `/schedule`

```
Header Row:
  h1 "Jadwal Mingguan"       [BTN + Tambah Jadwal]

[Grid 7 kolom — scroll horizontal di mobile]

┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ SENIN  │ │SELASA  │ │ RABU   │ │ KAMIS  │ │JUM'AT  │ │ SABTU  │ │MINGGU  │
│────────│ │────────│ │────────│ │────────│ │────────│ │────────│ │────────│
│ 07:00  │ │        │ │ 10:00  │ │        │ │ 09:00  │ │        │ │        │
│ -08:00 │ │        │ │ -11:00 │ │        │ │ -10:00 │ │        │ │        │
│ Gym    │ │ Kosong │ │ Rapat  │ │ Kosong │ │Meeting │ │ Kosong │ │ Kosong │
│ [🗑]  │ │        │ │ [🗑]  │ │        │ │ [🗑]  │ │        │ │        │
└────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
```

**Day Column (card):**
- Header: nama hari (font-semibold, 18px) + border-bottom
- Jadwal item: jam (accent, bold, 12px) + nama kegiatan (font-medium, 14px) + icon hapus
- Empty: "Kosong" teks centered, text-secondary

**Modal: Tambah Jadwal:**
- Nama Kegiatan: text
- Hari: Select (Senin–Minggu)
- Jam Mulai: time input
- Jam Selesai: time input
- Footer: [Batal] [Simpan Jadwal]

---

## 9. HALAMAN — KULIAH (ACADEMIC MODULE) ← BARU

Route: `/academic`

### 9.0 Shell Layout Halaman Kuliah

```
Header Row:
  h1 "Kuliah"                [Tombol kontekstual — berubah per tab]

[Sub-Tab Navigation]
┌─────────────────────────────────────────────────────────┐
│  [ Jadwal ]  [ Materi/Target ]  [ Bank Soal ]  [ Progress ]│
│    ↑ aktif: underline accent 2px, font-bold, text accent│
└─────────────────────────────────────────────────────────┘

[Konten Tab — area di bawah tab nav]
```

**Tab Nav Styling:**
- Flex row, gap 0, border-bottom `1px solid --border-color`
- Per tab: padding `0.75rem 1.25rem`, cursor pointer
- Active: `border-bottom: 2px solid --accent-color`, `color: --accent-color`, font-semibold
- Inactive: `color: --text-secondary`, hover `color: --text-primary`
- Mobile: horizontally scrollable

---

### 9.1 Sub-Tab: JADWAL

Tombol header: `[+ Tambah Matkul]`

```
[Jika belum ada matkul — Empty State]
┌──────────────────────────────────────────────────┐
│                                                  │
│    [GraduationCap icon besar, 64px, text-muted]  │
│                                                  │
│         Belum ada jadwal kuliah.                 │
│     Tambahkan mata kuliah untuk memulai.         │
│                                                  │
│         [BTN: + Tambah Matkul Pertama]           │
│                                                  │
└──────────────────────────────────────────────────┘

[Jika ada matkul — Grid Cards 2 kolom desktop]

┌────────────────────────────────┐  ┌────────────────────────────────┐
│  🎓 Sistem Operasi             │  │  🌐 Jaringan Komputer          │
│  MKWU4109  ← code, text-muted  │  │  MKWU5202                      │
│                                │  │                                │
│  📅 Senin, 08:00 – 10:00       │  │  📅 Rabu & Jumat, 13:00–15:00  │
│  📍 Lab Komputer 2             │  │  📍 Ruang 204                  │
│  👨‍🏫 Dr. Budi Santoso           │  │  👨‍🏫 Dra. Sari Indah          │
│                                │  │                                │
│  ─────────────────────────── │  │  ─────────────────────────── │
│  Mulai: 1 Sep 2026            │  │  Mulai: 1 Sep 2026            │
│  Minggu ke-1 aktif            │  │  Minggu ke-1 aktif            │
│                                │  │                                │
│  [✎ Edit]        [🗑 Hapus]   │  │  [✎ Edit]        [🗑 Hapus]   │
└────────────────────────────────┘  └────────────────────────────────┘
```

**Course Schedule Card:**
- Icon matkul (GraduationCap atau ikon sesuai bidang, 20px, accent) + Nama matkul (font-semibold, 18px)
- Kode matkul: text-muted, 12px, di bawah nama
- Info rows dengan ikon kecil (16px, text-secondary):
  - `CalendarDays` + hari + jam
  - `MapPin` + ruang/lab
  - `UserRound` + nama dosen
- Divider tipis
- Info semester: "Mulai: DD MMM YYYY | Minggu ke-N" — text-muted, 12px
- Footer: tombol Edit (outline, kecil) + Hapus (ghost, danger)

**Modal: Tambah / Edit Matkul** (max-width 520px):
1. Nama Mata Kuliah *(wajib)*
2. Kode Matkul *(opsional)*
3. Hari — Select (Senin / Selasa / Rabu / Kamis / Jumat / Sabtu)
4. Jam Mulai — Time input
5. Jam Selesai — Time input
6. Ruang / Lab *(opsional)*
7. Nama Dosen *(opsional)*
8. Tanggal Mulai Semester *(wajib)* + helper text: "Digunakan untuk menghitung minggu ke-N perkuliahan secara otomatis"
- Footer: [Batal] [Simpan Matkul]

---

### 9.2 Sub-Tab: MATERI / TARGET MINGGUAN

Tombol header: `[+ Tambah Target]`

```
[Dropdown filter: "Semua Matkul ▾" — atau pilih spesifik]

═══════════════════════════════════════════════════
▼  Sistem Operasi                  6 / 14 topik selesai
═══════════════════════════════════════════════════

  ┌──────────────────────────────────────────────────────┐
  │ MINGGU 1 ─────────────────────── [+ Tambah target]  │
  │                                                      │
  │ ☑  Modul 1 KB 1: Pengantar Sistem Operasi           │
  │    Sub-topik: Definisi SO, Sejarah, Jenis-jenis SO   │
  │                                     [✎] [🗑]        │
  │                                                      │
  │ ☑  Modul 1 KB 2: Manajemen Proses                   │
  │    Sub-topik: PCB, State Diagram, Context Switch     │
  │                                     [✎] [🗑]        │
  └──────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────┐
  │ MINGGU 2  [MINGGU INI ←badge accent]  [+ Tambah]    │
  │                                                      │
  │ ☐  Modul 2 KB 1: Penjadwalan CPU                    │
  │    Sub-topik: FCFS, SJF, Priority, Round Robin       │
  │                                     [✎] [🗑]        │
  │                                                      │
  │ ☐  Modul 2 KB 2: Deadlock                           │
  │    Sub-topik: Kondisi Deadlock, Pencegahan, Pemulihan│
  │                                     [✎] [🗑]        │
  └──────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────┐
  │ MINGGU 3 ─────────────────────── [+ Tambah target]  │
  │   [belum ada target]                                 │
  │   "Belum ada target untuk minggu ini. + Tambahkan"   │
  └──────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════
▶  Jaringan Komputer               0 / 8 topik selesai
═══════════════════════════════════════════════════
```

**Accordion Matkul (Level 1):**
- Header: Nama matkul (font-semibold) + badge "X/Y topik selesai" (neutral) + chevron
- Hover: background `--bg-secondary`
- Background header saat open: `--bg-secondary`

**Accordion Minggu (Level 2 — nested):**
- Header: "MINGGU N" (uppercase, font-bold, 12px, text-muted) + badge "MINGGU INI" (accent, jika aktif) + tombol [+ Tambah] kecil di kanan
- Padding: 1rem

**Target Item:**
- Checkbox (interaktif): ☑ selesai, ☐ belum
  - Checked: background accent, icon centang putih
- Label: "Modul X KB Y: [Topik]" — font-medium, 14px
  - Jika selesai: ~~strikethrough~~, text-muted
- Sub-topik: baris di bawah, text-secondary, 12px, "Sub-topik: ..."
- Actions (on hover, atau selalu visible di mobile): ikon ✎ + ikon 🗑, 14px

**Modal: Tambah / Edit Target:**
1. Mata Kuliah — Select *(wajib)*
2. Minggu ke- — Number input
3. Nomor Modul — Number *(opsional)*
4. Nomor KB (Kegiatan Belajar) — Number *(opsional)*
5. Topik Utama — Text *(wajib)*, placeholder "Process Scheduling"
6. Sub-topik — **Tag/Chip Input**: ketik + Enter → jadi chip. Chip punya tombol ×. Contoh chips: `FCFS` `SJF` `Round Robin`
- Footer: [Batal] [Simpan Target]

---

### 9.3 Sub-Tab: BANK SOAL

Tombol header: `[+ Buat Set Soal]`

```
[Dropdown filter: "Semua Matkul ▾"]

═══════════════════════════════════════════════════════════
▼  Test Formatif Modul 3 — Sistem Operasi           [🗑]
   Minggu ke-3 | 10 soal | 8 terkirim | Akurasi: 80%
═══════════════════════════════════════════════════════════

  ┌──────────────────────────────────────────────────────────┐
  │ 1.  Algoritma penjadwalan CPU yang memilih proses        │
  │     berdasarkan waktu burst terpendek adalah...          │
  │                                                          │
  │  ┌──────────────────────────────────────────────────┐   │
  │  │ ✓ A.  SJF (Shortest Job First)    ← BG HIJAU MUDA│   │
  │  │       + border-left hijau 3px                    │   │
  │  └──────────────────────────────────────────────────┘   │
  │     B.  FCFS (First Come First Served)                   │
  │     C.  Round Robin                                      │
  │     D.  Priority Scheduling (non-preemptive)            │
  │     E.  Multilevel Queue                                 │
  │                                                          │
  │  Jawaban Benar: A — SJF            ← text-success, bold  │
  │  Penjelasan: SJF memilih proses dengan CPU burst...      │
  │             [Lihat selengkapnya ▾] ← expand on click    │
  │                                                          │
  │  [Badge: Terkirim 31 Agt 2026]     [✎ Edit] [🗑 Hapus] │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │ 2.  [Soal berikutnya...]                                 │
  └──────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════
▶  Test Formatif Modul 2 — Sistem Operasi
   8 soal | 5 terkirim | Akurasi: 60%
═══════════════════════════════════════════════════════════

▶  Test Formatif Modul 1 — Jaringan Komputer
   5 soal | 0 terkirim
```

**Quiz Set Accordion (Level 1):**
- Header baris 1: Nama set (font-semibold) + ikon hapus + chevron
- Header baris 2: info stats (text-secondary, 12px)
- Background open: `--bg-secondary`

**Question Card (Level 2):**
- Nomor soal bold + teks soal (font-medium, 14px, multi-line)
- Opsi A–E (list, gap kecil):
  - Format: "A. [Teks pilihan]"
  - **Jawaban benar**: Background hijau-muda, left-border hijau 3px, ikon ✓ kecil
- Footer card:
  - "Jawaban Benar: X — [teks singkat]" — text-success, 13px
  - Penjelasan (collapsible, "Lihat selengkapnya ▾")
  - Badge "Terkirim DD MMM YYYY" (jika sudah dikirim) — neutral, kecil
  - [✎ Edit soal] + [🗑 Hapus soal]

**Modal: Buat Set Soal Baru:**
1. Nama Set Soal — Text *(wajib)*, placeholder "Test Formatif Modul 3"
2. Mata Kuliah — Select
3. Minggu ke- — Number *(opsional)*
4. Nomor Modul — Number *(opsional)*
5. Info banner: "Setelah membuat set, kirim foto halaman soal via WhatsApp dengan caption: 'soal [nama matkul] [nama set]'"
- Footer: [Batal] [Buat Set]

**Modal: Edit Soal:**
1. Teks Soal — Textarea *(wajib)*
2. Opsi A — Text *(wajib)*
3. Opsi B — Text *(wajib)*
4. Opsi C — Text *(wajib)*
5. Opsi D — Text *(wajib)*
6. Opsi E — Text *(opsional)*
7. Jawaban Benar — Select: A / B / C / D / E
8. Penjelasan — Textarea *(opsional)*
- Footer: [Batal] [Simpan Soal]

---

### 9.4 Sub-Tab: PROGRESS AKADEMIK

Tombol header: *(tidak ada, read-only)*

```
[Grid Cards — 1 kolom (atau 2 kolom jika banyak matkul)]

┌──────────────────────────────────────────────────────────┐
│  🎓 Sistem Operasi                                       │
│     Senin 08:00–10:00                                    │
│  ────────────────────────────────────────────────────    │
│                                                          │
│  [Stats Grid — 3 kolom dengan divider vertikal]          │
│  ┌──────────────┬──────────────┬──────────────┐         │
│  │ Topik Selesai│  Bank Soal   │ Kuis Terkirim│         │
│  │              │              │              │         │
│  │     6        │     45       │     30       │         │
│  │   dari 14    │  (3 set)     │   dari 45    │         │
│  │    (42%)     │              │    (67%)     │         │
│  └──────────────┴──────────────┴──────────────┘         │
│                                                          │
│  Progress Materi:                                        │
│  ████████░░░░░░░░░░░░ 42%    (6/14 topik selesai)       │
│  [bar indigo]                                            │
│                                                          │
│  Akurasi Kuis Terakhir:                                  │
│  ████████████████░░░░ 80%    (4/5 benar)                │
│  [bar hijau]   Modul 3 — 31 Agt 2026                    │
│                                                          │
│  ────────────────────────────────────────────────────    │
│  Minggu Aktif: [Minggu ke-2 ← badge accent]             │
│                                                          │
│  Target Minggu Ini:                                      │
│  ☐ Modul 2 KB 1: Penjadwalan CPU                        │
│  ☐ Modul 2 KB 2: Deadlock                               │
│                                                          │
│                          [Lihat Detail Materi →]        │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  🌐 Jaringan Komputer                                    │
│  [konten serupa, data berbeda]                           │
└──────────────────────────────────────────────────────────┘

[Empty state jika belum ada matkul:]
┌──────────────────────────────────────────────────────────┐
│              [GraduationCap 64px, text-muted]            │
│              Belum ada data perkuliahan.                 │
│          Mulai dengan menambahkan jadwal matkul.         │
│              [BTN: Pergi ke Tab Jadwal →]                │
└──────────────────────────────────────────────────────────┘
```

**Progress Card Detail:**
- Header: ikon + nama matkul (font-semibold, 20px) + info hari/jam (text-secondary, 14px)
- Stats Grid: 3 kolom dengan divider, tiap stat: angka besar (font-bold, 24px) + label (text-secondary, 12px) + sub-info (12px, muted)
- Progress Bar Materi: label + bar (8px) + persentase
- Progress Bar Akurasi:
  - ≥ 80%: hijau
  - 60–79%: amber
  - < 60%: merah
  - Sub-label: "X/5 benar — Set Soal, Tanggal"
- Minggu Aktif: badge accent pill
- Target Minggu Ini: max 3 item checklist (tidak interaktif, link ke Tab Materi)
- CTA: "[Lihat Detail Materi →]" — text link, accent, 13px, align-right

---

## 10. OVERLAY KOMPONEN

### 10.1 Modal (Universal)

```
┌────────────────────────────────────────────┐
│  Overlay: rgba(0,0,0,0.5) + backdrop-blur  │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │  Judul Modal                    [✕]  │  │ ← header, border-bottom
│  │  ────────────────────────────────    │  │
│  │                                      │  │
│  │  [Konten form / informasi]           │  │
│  │                                      │  │
│  │  ────────────────────────────────    │  │ ← border-top
│  │              [Batal]  [Simpan →]    │  │ ← footer
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

**Spesifikasi Modal:**
- Position: fixed, inset 0 (overlay penuh)
- Dialog: position absolute, top 50%, left 50%, transform: -50% -50%
- Max-width: 480px (default), 520px (form panjang), width: 90%
- Max-height: 90vh, overflow-y: auto
- Background: `--bg-primary`
- Border-radius: 12px
- Box-shadow: `0 20px 60px rgba(0,0,0,0.3)` — heavy shadow
- Padding: 1.5rem
- Tombol ✕: kanan atas header, text-secondary, hover text-primary
- **Animasi masuk**: transform scale(0.95)→1 + opacity 0→1, 200ms ease-out
- **Mobile**: Bottom Sheet — slide up dari bawah, border-radius top-left top-right 16px, max-height 90vh

### 10.2 Tag / Chip Input (Subtopik)

```
┌─────────────────────────────────────────────────┐
│ [FCFS ×] [SJF ×] [Round Robin ×]  ketik lagi..│
└─────────────────────────────────────────────────┘
```

- Area click-anywhere untuk fokus input
- Chip: bg `--bg-tertiary`, border `1px solid --border-color`, border-radius 9999px
- Chip padding: `2px 8px`, font-size 12px
- Tombol × di dalam chip: 10px, text-secondary
- Ketik + Enter/koma → chip baru
- Backspace pada input kosong → hapus chip terakhir

### 10.3 Confirm Delete Dialog

Bukan native `confirm()`. Modal kecil (max-w: 360px):
- Ikon ⚠️ atau 🗑 besar (48px, warna warning/danger)
- Title: "Hapus [Nama Item]?" — font-semibold, 18px
- Body: "Tindakan ini tidak dapat dibatalkan." — text-secondary
- Footer: [Batal] (outline) | [Hapus] (btn-danger, merah)

### 10.4 Toast Notification

```
[Muncul di sudut kanan atas desktop, kanan bawah mobile]

┌─────────────────────────────────────────┐
│ ✓  Berhasil disimpan                   │ ← success (hijau)
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ✕  Gagal menyimpan. Coba lagi.         │ ← error (merah)
└─────────────────────────────────────────┘
```

- Width: max 320px
- Background: `--bg-primary` dengan border-left 4px berwarna
- Border-radius: 8px, box-shadow medium
- Auto-dismiss: 3 detik
- Animasi: slide-in dari kanan + fade-out

---

## 11. EMPTY STATES

Setiap section yang mungkin kosong harus informatif, bukan blankspace.

| Halaman / Section | Ikon | Teks Utama | Sub-teks / CTA |
|:---|:---:|:---|:---|
| Rekening (Keuangan) | Wallet | "Belum ada rekening." | "Kirim ke Aira: 'saldo BCA 5jt'" |
| Transaksi Terbaru | Receipt | "Belum ada transaksi." | — |
| Budget Kategori | PieChart | "Belum ada budget bulan ini." | Contoh pesan WA |
| Hutang/Piutang | Handshake | "Tidak ada hutang aktif." | — |
| Goals | Target | "Belum ada target tabungan." | [BTN: + Tambah Goal] |
| Kanban — per kolom | — | "Tidak ada tugas" | — |
| Jadwal — per hari | — | "Kosong" | — |
| Kuliah — Jadwal | GraduationCap | "Belum ada jadwal kuliah." | [BTN: + Tambah Matkul] |
| Kuliah — Materi | BookOpen | "Tambahkan matkul terlebih dahulu." | Link ke tab Jadwal |
| Kuliah — Soal | FileQuestion | "Buat set soal terlebih dahulu." | [BTN: + Buat Set Soal] |
| Kuliah — Progress | GraduationCap | "Belum ada data perkuliahan." | [BTN: Pergi ke Jadwal] |

---

## 12. RESPONSIF & MOBILE

### Breakpoint ≤ 768px

| Elemen | Desktop | Mobile |
|:---|:---|:---|
| Sidebar | Kiri 240px, sticky | Bottom nav 64px, fixed |
| Summary Grid | 2×2 | 2×2 compact |
| Finance Grid | 2 kolom | 1 kolom stacked |
| Goals Grid | 2–3 kolom | 1 kolom |
| Kanban | 3 kolom horizontal | Scroll horizontal |
| Schedule Grid | 7 kolom | Scroll horizontal |
| Academic Tabs | Tabs biasa | Scroll horizontal |
| Course Cards | 2 kolom | 1 kolom |
| Modal | Centered overlay | Bottom sheet |
| Toast | Kanan atas | Kanan bawah |

**Touch-Friendly:**
- Minimum touch target: 44×44px
- Tidak ada hover-only interactions

---

## 13. DARK MODE

Semua halaman mendukung `data-theme="dark"` pada `<html>`. ThemeToggle: ikon `Sun` (light) ↔ `Moon` (dark), 20px, di header sidebar.

Semua warna WAJIB menggunakan CSS variables — tidak ada hard-coded hex di komponen. Dark mode akan otomatis bekerja karena variable-nya sudah di-swap via `[data-theme='dark']`.

---

## 14. DAFTAR LAYAR UNTUK STITCH (Ordered by Priority)

### Batch 1 — Halaman Utama Existing (generate dengan data terisi, dark mode)
1. **Dashboard / Overview** — dark mode, 4 summary cards + chart
2. **Keuangan** — light mode, 2 kolom terisi lengkap
3. **Tabungan & Goals** — dark mode, 3–4 goal cards
4. **Tasks / Kanban** — light mode, ketiga kolom terisi
5. **Jadwal Mingguan** — dark mode, beberapa jadwal
6. **Login Page** — light mode

### Batch 2 — Halaman Kuliah (semua sub-tab, light mode)
7. **Kuliah — Tab Jadwal** — 2 matkul cards terisi
8. **Kuliah — Tab Materi** — accordion terbuka, ada yang selesai + belum
9. **Kuliah — Tab Bank Soal** — quiz set terbuka, soal dengan highlight jawaban
10. **Kuliah — Tab Progress** — 2 progress cards lengkap

### Batch 3 — Modal States
11. **Modal Tambah Matkul** — overlay di atas Tab Jadwal
12. **Modal Tambah Target** — dengan tag input berisi chips
13. **Modal Buat Set Soal** — form sederhana + info banner WA
14. **Modal Edit Soal** — form soal PG lengkap A–E
15. **Modal Tambah Tugas** — overlay Kanban
16. **Modal Input Progres** — overlay Kanban (pindah ke IN_PROGRESS)
17. **Confirm Delete Dialog** — modal kecil hapus

### Batch 4 — Mobile Views
18. **Dashboard Mobile** — bottom nav aktif, kartu stacked
19. **Kuliah Mobile — Tab Jadwal** — 1 kolom, tab scroll
20. **Kanban Mobile** — horizontal scroll kanban

### Batch 5 — States & Edges
21. **Empty State: Kuliah belum ada data** — full empty screen
22. **Dark Mode: Halaman Kuliah — Tab Progress**
23. **Loading / Skeleton State** — pulsating abu di tempat card

---

## 15. CATATAN KHUSUS UNTUK STITCH

1. **Ikon**: Semua dari **Lucide React** (stroke, consistent weight)
2. **Animasi**: Halus — modal scale+fade, toast slide, progress bar ease
3. **Border radius**: Card = 8px, Button = 6px, Pill/badge = 9999px
4. **Konsistensi padding**: Card = 1.5rem, Modal = 1.5rem, Nav item = 0.75rem 1rem
5. **WhatsApp Integration Hints**: Beberapa empty state menampilkan contoh pesan WA — ini adalah fitur unik Aira, tolong tampilkan agar desain mencerminkan hybrid nature-nya
6. **Tidak ada Tailwind**: Gunakan design tokens via CSS variables
7. **Font**: Inter dari Google Fonts, antialiased
8. **Aksesibilitas**: WCAG AA kontras minimum, focus ring visible (indigo 3px), label pada semua input
