import type { GstFilingRecord, GstFilingStatus, GstReturnType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export interface GstFilingUpsertData {
  status: GstFilingStatus;
  arn: string | null;
  filedAt: Date | null;
  filedByUserId: string | null;
}

/** The only Prisma access for `GstFilingRecord` — shared verbatim by
 * 59-gstr-3b.md's own service, parameterized by `returnType`. */
export const gstFilingRepository = {
  findById(id: string): Promise<GstFilingRecord | null> {
    return prisma.gstFilingRecord.findUnique({ where: { id } });
  },

  findOne(
    companyId: string,
    returnType: GstReturnType,
    periodStart: Date,
    periodEnd: Date
  ): Promise<GstFilingRecord | null> {
    return prisma.gstFilingRecord.findUnique({
      where: { companyId_returnType_periodStart_periodEnd: { companyId, returnType, periodStart, periodEnd } },
    });
  },

  /**
   * Every `GstFilingRecord` of `returnType` whose period overlaps
   * `[from, to]` — 74-gst-reports.md's own read for the GST Dashboard's
   * Filed/Open overlay (read-only here; `markPeriodFiled`/`reopenPeriod`
   * remain 58-gstr-1.md's exclusive mutations). Overlap (not exact-period
   * match) so a quarterly filer's record — whose own period spans 3
   * calendar months — is still returned for any month inside that span.
   */
  findMany(companyId: string, returnType: GstReturnType, from: Date, to: Date): Promise<GstFilingRecord[]> {
    return prisma.gstFilingRecord.findMany({
      where: { companyId, returnType, periodStart: { lte: to }, periodEnd: { gte: from } },
      orderBy: { periodStart: "asc" },
    });
  },

  upsert(
    companyId: string,
    financialYearId: string,
    returnType: GstReturnType,
    periodStart: Date,
    periodEnd: Date,
    data: GstFilingUpsertData
  ): Promise<GstFilingRecord> {
    return prisma.gstFilingRecord.upsert({
      where: { companyId_returnType_periodStart_periodEnd: { companyId, returnType, periodStart, periodEnd } },
      create: { companyId, financialYearId, returnType, periodStart, periodEnd, ...data },
      update: data,
    });
  },
};
