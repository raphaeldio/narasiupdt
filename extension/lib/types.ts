// Cerminan model backend (backend/app/models.py).

export type Platform = 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'testbed';
export type Label = 'hoax' | 'caution' | 'supported' | 'unverified' | 'satire' | 'neutral' | 'error';
export type Modality = 'caption' | 'ocr' | 'audio';
export type StageName = Modality;
export type StageStatus = 'started' | 'done' | 'skipped' | 'failed';
export type Mode = 'multimodal' | 'caption';

export interface Claim {
  id: string;
  text: string;
  source: Modality;
  kind: 'factual' | 'opinion' | 'satire';
  tni_related: boolean;
  topic?: string;
  language?: string;
  /** Kalimat asli bila klaim berbahasa asing dan sudah diterjemahkan. */
  original?: string | null;
}

export type Basis = 'evidence' | 'signals' | 'ai' | 'none';

export interface Risk {
  score: number;
  level: 'rendah' | 'sedang' | 'tinggi';
  signals: { id: string; label: string; weight: number; hits: string[] }[];
}

export interface Evidence {
  claim_id: string;
  publisher: string;
  title: string;
  url: string;
  rating: string;
  verdict: number | null;
  date: string | null;
  claim_reviewed: string | null;
  match: number;
  credibility: number;
  origin: 'factcheck' | 'search' | 'corpus' | 'feed' | 'news';
}

export interface AnalysisResult {
  platform: Platform;
  video_id: string;
  stage: StageName | 'final';
  final: boolean;
  score: number | null;
  label: Label;
  confidence: 'high' | 'medium' | 'low' | null;
  tni_related: boolean;
  basis?: Basis;
  topics?: string[];
  language?: string;
  risk?: Risk | null;
  ai?: { verdict: string; confidence: number; reason: string } | null;
  claims: Claim[];
  evidence: Evidence[];
  conclusion: string | null;
  notes: string[];
  cached: boolean;
}

export interface AnalyzeRequest {
  platform: Platform;
  video_id: string;
  url: string;
  caption: string;
  hashtags: string[];
  mode: Mode;
}

export interface StageEvent {
  stage: StageName;
  status: StageStatus;
  chunk?: number;
}

export type ReportReason = 'mencatut_tni' | 'provokasi' | 'hoaks' | 'lainnya';

export interface Health {
  status: string;
  mode: 'live' | 'local';
  providers: Record<string, boolean | string>;
}

export type FeedItemKind = 'text' | 'image' | 'video';

export interface ScanItem {
  id: string;
  kind: FeedItemKind;
  text: string;
  hashtags: string[];
  url: string;
}

export interface ScanResult {
  id: string;
  label: Label;
  score: number | null;
  tni_related: boolean;
  claims: number;
  cached: boolean;
  basis?: Basis;
  topic?: string;
  language?: string;
  risk?: number;
}
