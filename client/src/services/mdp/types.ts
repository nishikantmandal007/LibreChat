export type FileRole = 'case_file' | 'reference_file' | 'knowledge_source' | 'transcription';

export interface MDPApiResponse<T> {
  success: boolean;
  message: string;
  response_code: number;
  data: T;
}

export interface MDPChatRequest {
  llm_type: string;
  chat_dto: {
    lang: string;
    chat_id?: string;
    original_prompt: string;
    model_key?: string;
    chat_model?: string;
    anonymized_prompt?: string;
    anonymized_values?: Record<string, string[]>;
    detected_values?: Record<string, string[]>;
    choices?: string[];
    doc?: string;
    docs?: string[];
    skill_instructions?: Array<{
      name: string;
      description?: string;
      body: string;
    }>;
  };
}

export interface MDPChatModelCatalogItem {
  key: string;
  label: string;
  provider: string;
  company?: string;
  endpoint?: string;
  default?: boolean;
}

export interface MDPChatModelCatalog {
  default_model: string;
  models: MDPChatModelCatalogItem[];
  models_by_endpoint?: Record<string, string[]>;
}

// export interface MDPActivityItem {
//   type?: string;
//   label?: string;
//   detail?: string;
//   sources?: string[];
// }

export interface MDPCitation {
  file_name?: string;
  filename?: string;
  page?: number | string;
  chunk_id?: string;
  text?: string;
  source?: string;
}

export interface MDPChatResponse {
  session_id: string;
  anonymized_prompt?: string;
  replaced_response: string;
  llm_response: string;
  total_tokens: number;
  anonymized_values: Record<string, string[]>;
  reidentify_job_id?: string;
  file_names?: string[];
  // citations?: MDPCitation[];
  // activity?: MDPActivityItem[];
  // artifacts?: Array<{
  //   artifact_id: string;
  //   kind?: string;
  //   format?: string;
  //   content_type?: string;
  //   filename?: string;
  //   download_url?: string;
  //   preview_url?: string;
  //   metadata?: Record<string, unknown>;
  //   created_at?: string;
  // }>;
  model_key?: string;
  // workflow?: {
  //   privacy?: string;
  //   rag?: string;
  //   skills?: string[];
  //   artifact_count?: number;
  // };
}

export interface MDPSession {
  session_id: string;
  session_name: string;
  created_at: string;
  updated_at: string;
}

export interface MDPPromptData {
  prompt_id: number;
  session_id: string;
  original_prompt: string;
  anonymized_prompt: string;
  llm_response: string;
  replaced_response: string;
  total_tokens: number;
  anonymized_values: string;
  created_at: string;
  model_key?: string;
  citations?: MDPCitation[] | string;
  sources?: MDPCitation[] | string;
  metadata?:
    | {
        citations?: MDPCitation[];
        sources?: MDPCitation[];
      }
    | string;
}

export interface MDPAnonymizeRequest {
  prompt: string;
  choices: string[];
  lang?: string;
  privacy_context_id?: string;
  project_id?: string;
  model?: string;
  requires_anonymization?: boolean;
  case_correction?: boolean;
}

export interface MDPAnonymizeResponse {
  anonymized_prompt: string;
  detected_values: Record<string, string[]>;
  anonymized_values: Record<string, string>;
}

export interface MDPDetectRequest {
  prompt: string;
  choices: string[];
  lang?: string;
}

export interface MDPDetectResponse {
  detected_values: Record<string, string[]>;
}

export interface MDPFileUploadResponse {
  file_id?: string;
  doc_id?: string;
  file_name?: string;
  filename?: string;
  filepath?: string;
  file_path?: string;
  url?: string;
  type?: string;
  job_id?: string;
  raw_file_id?: string;
  safe_file_id?: string;
  safe_doc_id?: string;
  status?: string;
  download_url?: string;
  preview_original_url?: string;
  preview_anonymized_url?: string;
  pii_summary?: unknown;
  rag_index_status?: string;
}

export interface MDPHistorySession {
  session_id: string;
  session_name?: string;
  chat_title?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MDPSessionRenameRequest {
  session_id: string;
  new_name: string;
}

export interface MDPSessionDeleteRequest {
  session_id: string;
}

export interface MDPAgentChatRequest {
  message: string;
  mode?: 'auto' | 'sql' | 'docs';
  session_id?: string;
}

export interface MDPAgentChatResponse {
  reply: string;
  session_id: string;
  mode: string;
  prompt_id: string;
  sql?: string;
  csv_download_url?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}
