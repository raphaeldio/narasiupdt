// Metadata rekaman demo asli. File ini ditimpa oleh extension/e2e/record-demo.spec.ts
// setelah rekaman selesai. Semua waktu dalam detik sejak rekaman mulai.
export type Box = { x: number; y: number; w: number; h: number };

export type DemoRec = {
  file: string; // relatif ke public/
  url: string;
  title: string;
  viewport: { w: number; h: number };
  player: Box; // area video Shorts di halaman
  badge: Box | null;
  panel: Box | null;
  t: {
    feedStart: number;
    feedEnd: number;
    videoStart: number; // video target mulai diputar
    badge: number; // "Membaca teks…" muncul
    firstLabel: number;
    labelChange: number; // label berubah setelah teks layar/audio masuk (sama dengan firstLabel bila tidak berubah)
    final: number; // OCR + audio sudah masuk
    panelOpen: number;
    panelEnd: number;
    reportOpen: number;
    reportSent: number;
  };
  firstText: string;
  finalText: string;
};

export type DashRec = {
  file: string;
  viewport: { w: number; h: number };
  situation: Box | null; // banner status siaga
  narrative: Box | null; // narasi teratas (kasus yang baru direkam)
  topClaim: string;
  t: { start: number; end: number };
};

export const DEMO: DemoRec | null = {
  "file": "rec/demo.mp4",
  "url": "https://www.youtube.com/shorts/DwvC_FjYxoU",
  "title": "18000 pasukan TNI dikerahkan ke Aceh",
  "viewport": {
    "w": 1280,
    "h": 900
  },
  "player": {
    "x": 402,
    "y": 64,
    "w": 452,
    "h": 804
  },
  "badge": {
    "x": 418,
    "y": 795,
    "w": 170,
    "h": 30
  },
  "panel": {
    "x": 418,
    "y": 325,
    "w": 342,
    "h": 462
  },
  "t": {
    "feedStart": 0,
    "videoStart": 4.426,
    "feedEnd": 4.426,
    "badge": 6.487,
    "firstLabel": 6.523,
    "labelChange": 9.268,
    "final": 17.449,
    "panelOpen": 19.119,
    "panelEnd": 23.399,
    "reportOpen": 24.179,
    "reportSent": 26.896
  },
  "firstText": "Belum Terverifikasi",
  "finalText": "100%\nIndikasi Hoaks\nMencatut TNI"
};
export const DASH: DashRec | null = {
  "file": "rec/dash.mp4",
  "viewport": {
    "w": 1500,
    "h": 776
  },
  "situation": {
    "x": 146,
    "y": 113,
    "w": 1208,
    "h": 75
  },
  "narrative": {
    "x": 163,
    "y": 403,
    "w": 661,
    "h": 122
  },
  "topClaim": "18000 pasukan TNI dikerahkan ke Aceh",
  "t": {
    "start": 0.926,
    "end": 7.475
  }
};
