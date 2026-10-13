/**
 * The documents printed from a handed-off visit card. Every save of a visit stores a new copy of its documents and
 * older copies stay active, so the newest copy of each kind is the one to print (the visit as it is now).
 */
export interface StoredVisitDocument {
  document_type?: string | null;
  file_path?: string | null;
  storage_bucket?: string | null;
  created_at?: string | null;
}

/** The newest copy of each document type, from a list in any order. */
export function latestDocumentByType(docs: StoredVisitDocument[]): Record<string, { path: string; bucket: string | null }> {
  const newestFirst = [...docs].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  const byType: Record<string, { path: string; bucket: string | null }> = {};
  for (const doc of newestFirst) {
    if (doc.document_type && doc.file_path && !byType[doc.document_type]) {
      byType[doc.document_type] = { path: doc.file_path, bucket: doc.storage_bucket ?? null };
    }
  }
  return byType;
}
