-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE 'PAYROLL';
ALTER TYPE "DocumentType" ADD VALUE 'SALARY_VOUCHER';

-- AlterEnum
ALTER TYPE "VoucherType" ADD VALUE 'SALARY';

-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "salaryExpenseLedgerId" TEXT,
ADD COLUMN     "salaryPayableLedgerId" TEXT;

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "payrollNumber" TEXT,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "narration" TEXT,
    "totalNetSalary" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "voucherId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRunItem" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "employeeId" TEXT NOT NULL,
    "basicSalary" DECIMAL(14,2) NOT NULL,
    "totalDaysInPeriod" INTEGER NOT NULL,
    "workedDays" DECIMAL(5,2) NOT NULL,
    "netSalary" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "PayrollRunItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_voucherId_key" ON "PayrollRun"("voucherId");

-- CreateIndex
CREATE INDEX "PayrollRun_companyId_status_idx" ON "PayrollRun"("companyId", "status");

-- CreateIndex
CREATE INDEX "PayrollRun_companyId_periodStart_periodEnd_idx" ON "PayrollRun"("companyId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_companyId_financialYearId_payrollNumber_key" ON "PayrollRun"("companyId", "financialYearId", "payrollNumber");

-- CreateIndex
CREATE INDEX "PayrollRunItem_employeeId_idx" ON "PayrollRunItem"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRunItem_payrollRunId_lineNumber_key" ON "PayrollRunItem"("payrollRunId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRunItem_payrollRunId_employeeId_key" ON "PayrollRunItem"("payrollRunId", "employeeId");

-- AddForeignKey
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_salaryExpenseLedgerId_fkey" FOREIGN KEY ("salaryExpenseLedgerId") REFERENCES "Ledger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_salaryPayableLedgerId_fkey" FOREIGN KEY ("salaryPayableLedgerId") REFERENCES "Ledger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRunItem" ADD CONSTRAINT "PayrollRunItem_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRunItem" ADD CONSTRAINT "PayrollRunItem_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
