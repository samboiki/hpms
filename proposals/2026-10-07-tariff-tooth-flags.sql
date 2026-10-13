-- Tariff codes wrongly marked as needing a tooth number (proposal, 2026-10-07). Not applied: review, then run in the
-- Supabase SQL editor.
--
-- Why: the dental tariff seed (src/components/billing/practice_tariffs_rows.sql) marks these per-visit codes
-- requires_tooth_number = 'YES': 8104, 8109, 8110, 8145, 8151, 8155, 8159, 8161, 8304 (dental_codes_Sheet1.csv also marks
-- 8101, so it is included in case the live list came from that file). The claim check then blocks
-- the line until a tooth is typed, and the service selector asks for one, so staff type a tooth that means nothing
-- (seen on July 2025 invoices). None of these codes carried a tooth on any of the 12,527 claim lines the practice's
-- funds accepted from Eminance (December 2023 - May 2025), and the NAMAF schedule's mouth-part column does not ask
-- for one. The app reads the flag as 'YES' / anything else.

-- Only the dental schedule is touched: OneHealth also serves GPs and specialists, whose tariffs are other schedules.

-- 1. Look first
SELECT pt.code, pt.description, pt.requires_tooth_number, t.name AS practice_type
FROM practice_tariffs pt
JOIN practice_types t ON t.id = pt.practice_type_id
WHERE pt.code IN ('8101', '8104', '8109', '8110', '8145', '8151', '8155', '8159', '8161', '8304')
ORDER BY pt.code, t.name;

-- 2. Correct the flags (dental practice type only)
UPDATE practice_tariffs
SET requires_tooth_number = 'NO', updated_at = now()
WHERE code IN ('8101', '8104', '8109', '8110', '8145', '8151', '8155', '8159', '8161', '8304')
  AND requires_tooth_number = 'YES'
  AND practice_type_id IN (SELECT id FROM practice_types WHERE lower(btrim(name)) = 'dental');

-- 3. Check: run step 1 again; every row must show NO.
-- Undo: set 'YES' again for the same codes.
