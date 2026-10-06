/**
 * Name saved as patient_documents.original_name (the table has no title column). Document lists
 * show it and downloads are saved under it, so a title typed in the upload modal keeps the file's
 * extension.
 */
export function documentDisplayName(title: string | undefined, fileName: string): string {
  const trimmed = (title ?? '').trim();
  if (!trimmed) return fileName;

  const dot = fileName.lastIndexOf('.');
  const extension = dot > 0 ? fileName.slice(dot) : '';
  if (!extension || trimmed.toLowerCase().endsWith(extension.toLowerCase())) return trimmed;
  return `${trimmed}${extension}`;
}
