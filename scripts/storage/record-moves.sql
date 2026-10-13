-- Which patient and staff records of the public bucket "documents" move into the private bucket "records", where
-- to, and which rows point at them. Read-only: scripts/storage/move-records.ts runs it, prints counts and, with
-- --apply, moves the files (proposals/2026-10-08-records-bucket.sql, "Moving the existing files").
--
-- One row per file of "documents" that is a record (logos, avatars and signatures stay public on purpose):
--   old_path, size, practice_id, practice_source, new_path (null when the file stays), keep_reason (why it stays),
--   existing_copy_size (the file already at new_path: an earlier run copied it), refs (the rows to repoint).
-- The practice: that of the rows pointing at the file; for a file no row points at, the practice of a copy an earlier
-- run made, else the practice its path names (practice, patient, staff member, visit, leave form or invoice number),
-- else that of the staff member who uploaded it. A file that rows of two practices point at, or whose practice
-- cannot be found, stays where it is. New path: <practice>/<kind>/<tail>, the tail being the old path without its
-- folder (a patient folder keeps the patient id: <practice>/patient-media/<patient>/<file>).
WITH
files AS (
  SELECT o.name, o.owner, (o.metadata->>'size')::bigint AS size,
         split_part(o.name, '/', 1) AS folder, split_part(o.name, '/', 2) AS next,
         split_part(o.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AS id_folder
  FROM storage.objects o
  WHERE o.bucket_id = 'documents' AND split_part(o.name, '/', 1) NOT IN ('practice-logos', 'avatars', 'signatures')
),
refs AS (
  -- Every row that points at a file of "documents", the column it uses, the practice of the row and the kind of record
  SELECT 'visit_documents'::text AS tbl, vd.id, 'file_path'::text AS col, vd.file_path AS val, vd.practice_id,
         NULL::text AS kind
    FROM public.visit_documents vd WHERE COALESCE(vd.storage_bucket, 'documents') = 'documents'
  UNION ALL
  SELECT 'patient_documents', d.id, 'storage_path', d.storage_path, p.practice_id, 'patient-documents'
    FROM public.patient_documents d LEFT JOIN public.patients p ON p.id = d.patient_id
  UNION ALL
  SELECT 'patient_media', m.id, 'storage_path', m.storage_path, p.practice_id, 'patient-media'
    FROM public.patient_media m LEFT JOIN public.patients p ON p.id = m.patient_id WHERE m.storage_bucket = 'documents'
  UNION ALL
  SELECT 'patient_imaging', i.id, 'storage_path', i.storage_path, p.practice_id, 'imaging-results'
    FROM public.patient_imaging i LEFT JOIN public.patients p ON p.id = i.patient_id WHERE i.storage_bucket = 'documents'
  UNION ALL
  SELECT 'patient_laboratory', l.id, 'storage_path', l.storage_path, p.practice_id, 'lab-results'
    FROM public.patient_laboratory l LEFT JOIN public.patients p ON p.id = l.patient_id WHERE l.storage_bucket = 'documents'
  UNION ALL
  SELECT 'practice_documents', pd.id, 'file_path', pd.file_path, pd.practice_id, 'practice-documents'
    FROM public.practice_documents pd
  UNION ALL
  SELECT 'lab_requests', r.id, 'media_url', r.media_url, COALESCE(r.practice_id, p.practice_id), 'lab-results'
    FROM public.lab_requests r LEFT JOIN public.patients p ON p.id = r.patient_id WHERE r.media_url IS NOT NULL
  UNION ALL
  SELECT 'timesheets', t.id, 'pdf_url', t.pdf_url, u.practice_id, 'timesheets'
    FROM public.timesheets t LEFT JOIN public.users u ON u.id = t.user_id WHERE t.pdf_url IS NOT NULL
  UNION ALL
  SELECT 'leave_requests', q.id, 'supporting_document_url', q.supporting_document_url, u.practice_id, 'leave-documents'
    FROM public.leave_requests q LEFT JOIN public.users u ON u.id = q.user_id WHERE q.supporting_document_url IS NOT NULL
),
ref_paths AS (
  -- The stored value as a path in "documents": the path itself, or the path inside a public or signed link (decoded)
  SELECT r.*,
         CASE WHEN r.val !~* '^https?://' THEN r.val
              ELSE (SELECT convert_from(string_agg(CASE WHEN x.m[1] IS NOT NULL THEN decode(x.m[1], 'hex')
                                                         ELSE convert_to(x.m[2], 'UTF8') END, ''::bytea ORDER BY x.ord), 'UTF8')
                      FROM regexp_matches(substring(split_part(r.val, '?', 1)
                                                    FROM '/storage/v1/object/(?:public|sign|authenticated)/documents/(.*)$'),
                                          '%([0-9A-Fa-f]{2})|([^%]+)', 'g') WITH ORDINALITY AS x(m, ord))
         END AS path
  FROM refs r
),
per_file AS (
  SELECT f.name, f.owner, f.size, f.folder, f.next, f.id_folder,
         count(rp.id) AS n_refs,
         count(DISTINCT rp.practice_id) AS n_practices,
         COALESCE(bool_or(rp.id IS NOT NULL AND rp.practice_id IS NULL), false) AS ref_without_practice,
         min(rp.practice_id::text) AS ref_practice,
         count(DISTINCT rp.kind) AS n_kinds,
         min(rp.kind) AS ref_kind,
         COALESCE(jsonb_agg(jsonb_build_object('table', rp.tbl, 'id', rp.id, 'column', rp.col, 'old', rp.val)
                            ORDER BY rp.tbl, rp.id) FILTER (WHERE rp.id IS NOT NULL), '[]'::jsonb) AS refs
  FROM files f LEFT JOIN ref_paths rp ON rp.path = f.name
  GROUP BY f.name, f.owner, f.size, f.folder, f.next, f.id_folder
),
planned AS (
  SELECT pf.*,
         -- The kind of record, and the part of the old path that is kept after <practice>/<kind>/
         CASE WHEN pf.folder IN ('invoices', 'leave_forms', 'prescriptions', 'lab-results', 'imaging-results', 'timesheets', 'leave-documents')
                THEN pf.folder
              WHEN pf.id_folder AND pf.next = 'documents' AND EXISTS (SELECT 1 FROM public.practices x WHERE x.id::text = pf.folder)
                THEN 'practice-documents'
              WHEN pf.id_folder AND pf.n_kinds <= 1 THEN COALESCE(pf.ref_kind, 'patient-documents')
         END AS kind,
         CASE WHEN pf.folder IN ('invoices', 'leave_forms', 'prescriptions', 'lab-results', 'imaging-results', 'timesheets', 'leave-documents')
                THEN substr(pf.name, length(pf.folder) + 2)
              WHEN pf.id_folder AND pf.next = 'documents' AND EXISTS (SELECT 1 FROM public.practices x WHERE x.id::text = pf.folder)
                THEN substr(pf.name, length(pf.folder) + length('/documents/') + 1)
              WHEN pf.id_folder THEN pf.name
         END AS tail,
         -- The practice the path names (for files no row points at)
         CASE
           WHEN pf.id_folder THEN
             COALESCE((SELECT pr.id::text FROM public.practices pr WHERE pr.id::text = pf.folder),
                      (SELECT p.practice_id::text FROM public.patients p WHERE p.id::text = pf.folder))
           WHEN pf.folder IN ('lab-results', 'imaging-results') THEN
             (SELECT p.practice_id::text FROM public.patients p WHERE p.id::text = pf.next)
           WHEN pf.folder IN ('timesheets', 'leave-documents') THEN
             (SELECT u.practice_id::text FROM public.users u WHERE u.id::text = pf.next)
           WHEN pf.folder = 'prescriptions' THEN
             (SELECT COALESCE(v.practice_id, p.practice_id)::text FROM public.visits v LEFT JOIN public.patients p ON p.id = v.patient_id
               WHERE v.id::text = substring(pf.next FROM '^prescription_(.{36})_'))
           WHEN pf.folder = 'leave_forms' THEN
             COALESCE((SELECT COALESCE(v.practice_id, p.practice_id)::text FROM public.visits v LEFT JOIN public.patients p ON p.id = v.patient_id
                        WHERE v.id::text = substring(pf.next FROM '^leave_form_(.+)_[0-9]+\.pdf$')),
                      (SELECT min(lf.practice_id::text) FROM public.leave_forms lf
                        WHERE lf.form_number = substring(pf.next FROM '^leave_form_(.+)_[0-9]+\.pdf$')
                       HAVING count(DISTINCT lf.practice_id) = 1))
           WHEN pf.folder = 'invoices' THEN
             (SELECT min(ie.practice_id::text) FROM public.invoices_enhanced ie
               WHERE ie.invoice_number = substring(pf.next FROM '^invoice_(.+)_[0-9]+\.pdf$')
              HAVING count(DISTINCT ie.practice_id) = 1)
         END AS path_practice,
         (SELECT u.practice_id::text FROM public.users u WHERE u.id = pf.owner) AS uploader_practice
  FROM per_file pf
),
copies AS (
  -- Copies an earlier run made (<practice>/<kind>/<tail> in "records"): a stopped run carries on with them
  SELECT p.name, min(o.name) AS copy_name, count(*) AS n_copies
  FROM planned p
  JOIN storage.objects o ON o.bucket_id = 'records' AND p.tail IS NOT NULL
   AND split_part(o.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   AND substr(o.name, 39 + length(split_part(o.name, '/', 2))) = p.tail
  GROUP BY p.name
),
targets AS (
  SELECT p.*, c.copy_name, COALESCE(c.n_copies, 0) AS n_copies,
         CASE WHEN p.n_refs > 0 THEN CASE WHEN p.n_practices = 1 AND NOT p.ref_without_practice THEN p.ref_practice END
              ELSE COALESCE(split_part(c.copy_name, '/', 1), p.path_practice, p.uploader_practice) END AS practice_id,
         CASE WHEN p.n_refs > 0 THEN 'rows' WHEN c.copy_name IS NOT NULL THEN 'earlier copy'
              WHEN p.path_practice IS NOT NULL THEN 'path' WHEN p.uploader_practice IS NOT NULL THEN 'uploader' END AS practice_source
  FROM planned p LEFT JOIN copies c ON c.name = p.name
),
decided AS (
  SELECT t.*,
         CASE WHEN t.n_copies = 1 THEN t.copy_name
              WHEN t.practice_id IS NOT NULL AND t.kind IS NOT NULL THEN t.practice_id || '/' || t.kind || '/' || t.tail END AS target,
         CASE
           WHEN t.n_refs > 0 AND t.n_practices > 1 THEN 'rows of more than one practice point at it'
           WHEN t.n_refs > 0 AND t.ref_without_practice THEN 'a row pointing at it has no practice'
           WHEN t.n_copies > 1 THEN 'more than one earlier copy'
           WHEN t.n_copies = 1 AND split_part(t.copy_name, '/', 1) IS DISTINCT FROM t.practice_id THEN 'an earlier copy is under another practice'
           WHEN t.practice_id IS NULL THEN 'no practice found'
           WHEN t.kind IS NULL THEN 'unknown folder or kind'
         END AS reason
  FROM targets t
),
deduped AS (
  -- Two files must never be moved onto the same path
  SELECT d.*, count(*) OVER (PARTITION BY d.target) AS same_target
  FROM decided d
)
SELECT d.name AS old_path,
       d.size,
       d.practice_id,
       d.practice_source,
       CASE WHEN d.reason IS NULL AND d.same_target = 1 THEN d.target END AS new_path,
       COALESCE(d.reason, CASE WHEN d.same_target > 1 THEN 'another file would move to the same path' END) AS keep_reason,
       (SELECT (o.metadata->>'size')::bigint FROM storage.objects o WHERE o.bucket_id = 'records' AND o.name = d.target) AS existing_copy_size,
       d.refs
FROM deduped d
ORDER BY d.name
