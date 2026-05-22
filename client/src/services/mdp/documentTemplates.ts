import { mdpClient } from './client';
import { MDP_ENDPOINTS } from './endpoints';

export interface DocumentTemplate {
  id: string;
  body?: string;
  department?: string;
  document_type?: string;
  document_types?: string[];
  name_en?: string;
  name_de?: string;
  description_en?: string;
  description_de?: string;
  category_en?: string;
  category_de?: string;
  output_format_en?: string;
  output_format_de?: string;
  [key: string]: unknown;
}

export async function listDocumentTemplates({
  department,
  documentType,
}: {
  department?: string;
  documentType?: string;
} = {}): Promise<DocumentTemplate[]> {
  const response = await mdpClient.get<unknown>(MDP_ENDPOINTS.documentTemplates, {
    params: {
      ...(department ? { department } : {}),
      ...(documentType ? { document_type: documentType } : {}),
    },
  });
  return Array.isArray(response.data) ? (response.data as DocumentTemplate[]) : [];
}
