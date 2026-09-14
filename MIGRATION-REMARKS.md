# Legacy Migration Remarks

Generated 2026-09-13T15:57:00.605Z by scripts/migrate-legacy-data.ts.

Items below are gaps, defaults, or judgment calls made while importing the legacy
SQLite database (`prod.db`) into this Postgres schema. Review each and configure
the corresponding setting/master before relying on the migrated data.

1. A PLATFORM super admin user already existed — did not create a second one.
2. A user named "admin" already existed in this database before this migration ran (likely from an earlier prisma/seed.ts bootstrap of a "Default Company") and was left untouched. If that company has no real data, consider deleting it; the migrated company's admin is "bpg_admin" instead.
3. 28 HSN codes were migrated with a placeholder description ("Migrated from legacy system…") — the legacy data only stored bare codes. Please enter real descriptions under Masters > HSN Codes.
4. 8 products had no HSN code in the legacy data and were migrated with hsnCodeId left unset. Please assign the correct HSN code to each under Masters > Products.
5. The legacy system had no warehouse concept, so every product/stock movement was migrated into a single synthesized "Main Warehouse". Create additional warehouses and use Stock Transfer if stock actually needs splitting across locations.
6. The legacy system posted both output (sales) and input (purchase) GST into one combined "GST Payable" ledger. This migration splits that into 8 proper Output/Input CGST/SGST/IGST/Cess ledgers under "Duties & Taxes" (correct GST/ITC accounting practice) — the old combined ledger was not recreated.
7. 2 product(s) named "TEST", "test1" look like test data (never used in any legacy transaction) — migrated as-is for faithfulness; consider deactivating/deleting them under Masters > Products.
8. Company Admin created: username "bpg_admin" (not "admin" — that username was already taken by a pre-existing "Default Company" seeded earlier in this database) — password from SEED_ADMIN_PASSWORD if set in your environment, otherwise the local-development default documented in prisma/seed.ts ("Admin@12345"). Change it after first login.
9. Super Admin created (if none existed): username "superadmin" — password from SEED_SUPER_ADMIN_PASSWORD if set, otherwise the local-development default documented in prisma/seed.ts. Change it after first login.
10. The legacy admin user (admin@premgiribooks.com) was NOT migrated as a login — its password hash uses an incompatible scheme. Use the new "admin" Company Admin account above instead.
11. 8 purchase invoice line(s) in the legacy data had a `discountAmt` equal to the full line value (recorded as if the item were free) — cross-checked against the legacy ledger entries and confirmed it never actually reduced the amount owed to the supplier, so it was dropped rather than migrated (GST was, and still is, computed on the full line value for these). Review purchase invoices dated 2026-06-07, 2026-07-18, 2026-07-26, 2026-08-04, 2026-08-21, and 2026-09-07 if this needs a different treatment.
12. 10 product(s) were inactive in the legacy data — created active (so their historical stock movements could be recorded) and deactivated again once every voucher was migrated.
13. Per explicit request, all Sales Invoice, Purchase Invoice, and their corresponding Sales/Purchase Voucher numbers were renamed to a single shared "BPG-" prefix (e.g. "BPG-0001") instead of the app's per-type defaults ("INV-"/"PINV-"/"SV-"/"PV-") — both retroactively on every migrated document and going forward (the DocumentSequence rows for these four document types were updated). Other document types (Quotations, Sales Orders, etc.) are untouched and will still use their own default prefixes if/when used, since none were part of this migration — change them under Settings > Document Numbering if you want the same "BPG-" prefix there too.
