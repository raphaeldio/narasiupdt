# Scan feed Instagram & Facebook — desain

Tanggal: 29 Oktober 2026 · Status: disetujui, menunggu rencana implementasi

## Tujuan

NARASI saat ini hanya memberi badge pada **satu video aktif** (Reels, Shorts, TikTok). Fitur ini menambah
**scan feed**: setiap postingan yang terlihat di beranda/feed Instagram dan Facebook (teks, foto/carousel,
video) mendapat chip label sendiri. Analisis otomatis dibuat murah (teks saja, tanpa LLM); analisis penuh
berjalan saat chip diklik.

### Keputusan

| Topik | Keputusan |
|---|---|
| Kedalaman scan otomatis | Teks (caption + hashtag) dicocokkan ke cache kolektif + korpus terkurasi, tanpa LLM/Fact Check/Tavily |
| Analisis penuh | Hanya saat chip diklik |
| Platform iterasi ini | Instagram + Facebook (feed/beranda) + testbed feed lokal |
| Tampilan | Semua postingan dapat chip; `supported`/`unverified`/`satire` samar, `caution`/`hoax` warna penuh |
| Pendekatan | `FeedScanner` terpisah di samping `Controller` lama + endpoint batch `POST /v1/scan` |

### Di luar lingkup

- Beranda YouTube (video longform). Iterasi berikutnya, memakai `FeedAdapter` yang sama.
- Komentar, Stories, dan iklan bersponsor.
- Perubahan dashboard. Laporan dari postingan feed masuk ke antrean yang sudah ada.

## Arsitektur extension

### Pemilihan mode di content script

`entrypoints/content/index.tsx` memantau `location.pathname` (navigasi SPA):

- `/reel`, `/reels/…`, `/shorts/…` → `Controller` lama, **tanpa perubahan perilaku**.
- Halaman lain di domain yang punya `FeedAdapter` dengan `matchesFeed(location) === true` → `FeedScanner`.
- Saat mode berganti, instance lama di-`destroy()` sebelum instance baru dibuat.

### Unit baru

| Berkas | Tanggung jawab | Bergantung pada |
|---|---|---|
| `lib/feed/types.ts` | `FeedAdapter`, `FeedItem` | `lib/types.ts` |
| `lib/feed/instagram.ts` | Item dari `article`; ID dari tautan `/p/{id}` atau `/reel/{id}`; caption via `longestTextElement` | `lib/adapters/dom.ts` |
| `lib/feed/facebook.ts` | Item dari `[role=article]`; ID dari tautan `/posts/{id}`, `story_fbid`, atau `/videos/{id}` | `lib/adapters/dom.ts` |
| `lib/feed/testbed.ts` | Memakai ulang fungsi parsing IG/FB; hanya `matchesFeed` yang berbeda (`localhost:8765/feed-*.html`) | `lib/feed/instagram.ts`, `lib/feed/facebook.ts` |
| `lib/feed/index.ts` | `feedAdapterFor(location)` | adapter feed |
| `lib/feed/scanner.ts` | Observasi, antrean, batch, retry, membuka analisis penuh saat klik | adapter, `lib/messages.ts`, store |
| `lib/feed/store.ts` | Zustand `useFeed`: hasil per item, LRU 500 | — |
| `components/FeedBadges.tsx` | Satu shadow root; satu `FeedChip` per item terlihat | `useFeed`, `components/labels.ts` |

```ts
// lib/feed/types.ts
export type FeedItemKind = 'text' | 'image' | 'video';

export interface FeedItem {
  id: string;             // ID postingan platform, dipakai sebagai video_id di backend
  kind: FeedItemKind;     // video bila ada <video>; image bila ada <img> konten; selain itu text
  text: string;           // caption lengkap, sama seperti splitCaption() pada adapter video
  hashtags: string[];
  url: string;            // permalink postingan
  root: Element;          // elemen postingan (diobservasi)
  anchor: Element;        // tempat chip ditempel (elemen caption, atau root bila caption kosong)
  media: Element | null;  // <img>/<video> utama yang sedang tampil (untuk analisis penuh)
}

export interface FeedAdapter {
  platform: Platform;
  matchesFeed(location: Location): boolean;
  /** Hanya item yang punya ID dan anchor; iklan bersponsor dilewati. */
  findItems(): FeedItem[];
}
```

`findItems()` mendeteksi iklan dari teks label "Sponsored"/"Bersponsor" di dalam `root` dan melewatinya.

### `FeedScanner`

- Setiap 400 ms memanggil `findItems()` lalu mengobservasi
  `root` yang baru dengan `IntersectionObserver` (`threshold: 0.4`).
- Item yang terlihat ≥ 40% selama ≥ 400 ms masuk antrean, kecuali ID-nya sudah ada di `useFeed`.
- Antrean dikirim tiap 500 ms sebagai satu pesan `feed:scan` berisi maksimal 10 item. Item berstatus
  `queued` sebelum dikirim.
- Elemen terkini per ID disimpan di `Map<id, FeedItem>` yang diperbarui tiap pemindaian. Feed dapat merender ulang
  elemen untuk ID yang sama.
- Mengikuti `enabledItem`, `platformsItem`, dan pengaturan baru `feedEnabledItem` (default `true`).

### Chip

- Posisi mengikuti `anchor.getBoundingClientRect()` lewat `requestAnimationFrame`, hanya untuk item yang
  sedang terlihat. Bila `anchor.isConnected === false`, chip disembunyikan, sedangkan hasilnya tetap disimpan.
- Postingan yang sedang dianalisis penuh tidak memakai chip; `Badge` biasa ditampilkan di posisi yang sama.
  Setiap chip punya atribut `data-item-id` untuk e2e.
- `supported`, `unverified`, dan `satire`: opacity 0,5, ukuran kecil, tanpa skor. `caution` dan `hoax`: warna penuh dari
  `labels.ts`, dengan skor persen seperti badge video. `queued`: titik abu-abu berdenyut. `error`: "–" abu-abu.

### Klik chip → analisis penuh

Memakai `useOverlay` dan `Panel` yang sudah ada. Hanya satu panel terbuka; membuka panel lain menutup yang
sebelumnya (`analyze:cancel`).

| `kind` | Alur |
|---|---|
| `text` | `analyze:start` dengan `mode: 'caption'` → `analyze:complete` |
| `image` | `analyze:start` dengan `mode: 'multimodal'` → satu gambar `media` diambil dengan `cropFromTab()` → `analyze:frames` → `analyze:complete`. Carousel: hanya slide yang sedang tampil. |
| `video` | `analyze:start` dengan `mode: 'multimodal'` → `FrameCapturer` + `AudioCapturer` pada `<video>` di postingan itu, sama seperti alur Reels |

`cropFromTab()` di `lib/capture/frames.ts` digeneralisasi dari `HTMLVideoElement` menjadi `Element` (480 px,
JPEG 0,7). Saat hasil final masuk, `useFeed` untuk ID itu diperbarui ke label final.

Logika penangkapan frame/audio di `Controller.capture()` dipindah ke fungsi bersama di `lib/capture/` sehingga
`Controller` dan `FeedScanner` memakai kode yang sama. Perilaku `Controller` tidak berubah.

### Pesan & background

`lib/messages.ts` menambah:

```ts
{ type: 'feed:scan'; platform: Platform; items: ScanItem[] }   // → ScanResponse
```

Background meneruskan pesan ini ke `POST /v1/scan` dengan timeout 5 dtk. Pesan lain tidak berubah.

### Popup

Toggle baru "Scan feed" (`feedEnabledItem`) di bawah toggle per platform.

## Backend

### `POST /v1/scan`

```python
class ScanItem(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    kind: Literal["text", "image", "video"]
    text: str = Field(default="", max_length=5000)
    hashtags: list[str] = Field(default_factory=list, max_length=50)
    url: str = Field(default="", max_length=2048)

class ScanRequest(BaseModel):
    platform: Platform
    items: list[ScanItem] = Field(min_length=1, max_length=10)

class ScanResult(BaseModel):
    id: str
    label: Label
    score: int | None     # sama dengan AnalysisResult.score
    tni_related: bool     # chip menampilkan tag TNI seperti badge video
    claims: int
    cached: bool

class ScanResponse(BaseModel):
    results: list[ScanResult]
```

Metode baru `Pipeline.scan(platform, items)`. Untuk setiap item, dijalankan bersamaan dengan dibatasi
`_prefetch_slots`:

1. Bila `cache.get(result_key(platform, id))` ada → label dan skor dari hasil tersimpan, `cached: True`.
2. Selain itu: `extract_claims(text, "caption")` (heuristik) → `finder.quick()` untuk setiap klaim faktual →
   `aggregate(claims, evidence)` (fungsi yang sama dengan `_emit_result`) memberi `label` dan `score`;
   `tni_related = any(c.tni_related for c in claims)`.
3. Teks kosong atau tanpa klaim faktual → `label: "unverified"`, `score: None`, `claims: 0`.
4. Pengecualian per item → `label: "error"` untuk item itu saja; item lain tetap dikembalikan.

Scan **tidak** memanggil LLM, Fact Check, Tavily, atau embedding, **tidak** membuat sesi, **tidak** menulis
`result_key`, dan **tidak** mencatat `stats` maupun sinyal penonton peringatan dini. Sinyal penonton baru
tercatat ketika chip diklik (lewat `/v1/analyze`).

`Platform` tidak berubah: item feed memakai `instagram`/`facebook`/`testbed` dengan ID postingan sebagai
`video_id`. Laporan ke TNI AD dari Panel bekerja tanpa perubahan.

## Penanganan error

| Situasi | Perilaku |
|---|---|
| `/v1/scan` gagal atau timeout | Item batch itu → `status: 'error'`; dicoba ulang sekali saat terlihat lagi ≥ 30 dtk kemudian |
| 3 batch berturut-turut gagal | Scanner jeda 60 dtk; popup menampilkan status backend seperti sekarang |
| Item tanpa ID atau anchor | Dilewati di adapter, tanpa chip |
| Iklan bersponsor | Dilewati di adapter |
| Anchor lepas dari DOM | Chip disembunyikan; muncul lagi saat elemen dengan ID sama dirender ulang |
| `cropFromTab()` gagal saat klik | Analisis lanjut dengan teks saja; Panel menampilkan catatan "Gambar tidak dapat dibaca." |
| Feed tanpa ujung | `useFeed` dibatasi 500 item (LRU); `Map` elemen dan observer ikut dibersihkan |

## Testbed feed

- `testbed/feed-ig.html`: tiruan struktur feed IG (`article`, tautan `/p/{id}`, `span[dir=auto]`).
- `testbed/feed-fb.html`: tiruan struktur feed FB (`[role=article]`, tautan `/posts/{id}`, `div[dir=auto]`).
- Masing-masing sekitar 8 postingan berlabel `[DATA UJI]`:
  - hoaks teks yang mencatut TNI
  - klaim benar
  - satire
  - gambar dengan teks hoaks di dalam gambar dan caption netral
  - carousel
  - video
  - satu iklan bersponsor
  - satu postingan tanpa caption
- Caption memakai teks persis dari `testbed/cases.json`, sehingga korpus dan fixture yang ada langsung berlaku;
  `backend/data/testbed_fixtures.json` tidak berubah. Gambar uji berupa berkas SVG statis di `testbed/img/`
  berisi teks yang terbaca OCR.

## Pengujian

**Backend (`uv run pytest`)**
- Teks hoaks yang ada di korpus → label `hoax`/`caution` dengan `claims ≥ 1`.
- Item dengan `result_key` di cache → `cached: true`, label dari cache.
- 11 item → 422; teks kosong → `unverified`.
- Provider LLM, Fact Check, Tavily, dan embedding dimock: tidak ada yang dipanggil. `stats` dan sinyal
  penonton tidak berubah.
- Satu item memicu pengecualian → item itu `error`, item lain tetap normal.

**Extension (`npm test`)**
- `findItems()` IG/FB pada fixture HTML: ID, `kind`, caption/hashtag, iklan dan item tanpa ID dilewati.
- Scanner: batch maksimal 10, dedupe ID, retry setelah error, jeda setelah 3 kegagalan.
- Store: batas LRU 500.

**E2E (`npm run e2e`, testbed)**
- Semua postingan non-iklan di `feed-ig.html` dan `feed-fb.html` mendapat chip; chip aman tampil samar.
- Postingan hoaks teks → chip hoaks.
- Klik chip postingan gambar → Panel terbuka dengan bukti; setelah selesai, chip menampilkan label final.
- Seluruh tes testbed Reels yang sudah ada tetap lolos.

## Batasan yang diketahui

- Selector feed IG/FB asli belum diuji pada akun sungguhan (butuh login); testbed hanya meniru struktur DOM.
- Hoaks baru yang tidak ada di korpus atau cache berlabel `unverified` sampai ada pengguna yang mengklik
  chipnya; setelah itu label final tersimpan di cache kolektif untuk semua pengguna.
- Hoaks yang hanya ada di dalam gambar (caption netral) baru terdeteksi saat chip diklik.
