/**
 * Types for the audio generation service
 */

export interface Voice {
  id: string;
  name: string;
  voiceId: string;
  stability?: number;
  similarityBoost?: number;
}

export interface Personality {
  name: string;
  alias: string;
  tone: string;
  humorStyle: string;
  interests: string[];
  voice: Voice;
  openingLines: string[];
  closingLines: string[];
}

export interface DialogueTurn {
  speaker: string;
  text: string;
  audioFile?: string;
}

export interface FalseRedactions {
  found?: boolean;
  pageCount?: number;
  totalHiddenWords?: number;
  hiddenWords?: string[];
  hiddenPhrases?: string[];
  pages?: {
    pageNumber: number;
    hiddenWords?: string[];
    hiddenPhrases?: string[];
  }[];
}

export interface DocumentInput {
  documentId: string;
  url?: string;
  summary?: string;
  pageSummary?: string;
  content?: string;
  names?: string[];
  dates?: string[];
  places?: string[];
  objects?: string[];
  pageNumber?: number;
  date?: string;
  falseRedactions?: FalseRedactions;
}

export interface GenerationProgress {
  status: string;
  message: string;
  currentStep?: number;
  totalSteps?: number;
}

export interface GenerationResult {
  success: boolean;
  audioFile?: string;
  audioUrl?: string;
  title?: string;
  tags?: string[];
  error?: string;
}

export interface InvestigativeReportRequest {
  documents: DocumentInput[];
  investigation?: string;
  selectedInvestigators?: string[];
  targetLengthSeconds?: number;
}

export interface PodcastRequest {
  articles: {
    id: string;
    title?: string;
    url?: string;
    content: string;
    summary?: string;
  }[];
  selectedHosts?: string[];
  targetLengthSeconds?: number;
}
