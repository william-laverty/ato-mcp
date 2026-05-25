INSERT INTO meta(key, value) VALUES ('schema_version', '0.1.0');

INSERT INTO docs(doc_id, source, url, title, jurisdiction, doc_type, retrieved_at)
VALUES
  ('ato:test/deductions', 'ato', 'https://www.ato.gov.au/test/deductions', 'Deductions you can claim', 'AU', 'ATO_GUIDE', '2026-05-25T00:00:00Z'),
  ('ato:test/gst',        'ato', 'https://www.ato.gov.au/test/gst',        'GST registration',         'AU', 'ATO_GUIDE', '2026-05-25T00:00:00Z'),
  ('ato:test/vehicle',    'ato', 'https://www.ato.gov.au/test/vehicle',    'Vehicle expenses',         'AU', 'ATO_GUIDE', '2026-05-25T00:00:00Z');

INSERT INTO chunks(chunk_id, doc_id, ord, text, heading_path, char_start, char_end)
VALUES
  ('ato:test/deductions#0', 'ato:test/deductions', 0, 'You can claim a deduction for work uniform expenses if they are occupation specific.', '["Deductions","Uniforms"]', 0, 90),
  ('ato:test/deductions#1', 'ato:test/deductions', 1, 'Keep receipts for five years to substantiate your deduction claims.',                  '["Deductions","Records"]', 90, 160),
  ('ato:test/gst#0',        'ato:test/gst',        0, 'Register for GST when your annual turnover reaches 75000 dollars.',                  '["GST","Threshold"]',     0, 70),
  ('ato:test/vehicle#0',    'ato:test/vehicle',    0, 'You can claim vehicle expenses using the cents per kilometre method.',               '["Vehicle","Methods"]',   0, 80);

INSERT INTO fts_chunks(chunk_id, text)
SELECT chunk_id, text FROM chunks;
