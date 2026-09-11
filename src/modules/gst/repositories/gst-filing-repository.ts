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
