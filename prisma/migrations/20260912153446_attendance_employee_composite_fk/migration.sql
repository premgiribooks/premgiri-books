-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_employeeId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "Employee_companyId_id_key" ON "Employee"("companyId", "id");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_companyId_employeeId_fkey" FOREIGN KEY ("companyId", "employeeId") REFERENCES "Employee"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
