-- OCR for scanned pages of uploaded medical records.

ALTER TABLE cases.case_records ADD COLUMN ocr_pages INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE cases.case_records ADD COLUMN ocr_completed_at TIMESTAMP(3);
ALTER TABLE cases.case_record_pages ADD COLUMN ocr_confidence INTEGER;
