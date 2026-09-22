"use server";

import type { Page } from "@/lib/pagination";
import { runAction } from "@/lib/run-action";
import { attendanceService } from "@/modules/attendance/services/attendance-service";
import type {
  MarkAttendanceBulkInput,
  MarkAttendanceEntryInput,
} from "@/modules/attendance/validation/attendance-schema";
import type { ActionResult } from "@/types/api";
import type { Attendance, AttendanceListFilters, AttendanceWithRelations } from "@/types/attendance";

const ROSTER_PATH = "/employees/attendance";
const HISTORY_PATH = "/employees/attendance/history";

/** Infinite-scroll "load more" for the Attendance History list — a pure
 * read, so no paths are revalidated. */
export async function loadMoreAttendanceAction(
  filters: AttendanceListFilters,
  skip: number,
  take: number
): Promise<ActionResult<Page<AttendanceWithRelations>>> {
  return runAction(() => attendanceService.listAttendancePage(filters, { skip, take }), []);
}

export async function markAttendanceAction(
  input: MarkAttendanceEntryInput
): Promise<ActionResult<Attendance>> {
  return runAction(() => attendanceService.markAttendance(input), [ROSTER_PATH, HISTORY_PATH]);
}

export async function markAttendanceBulkAction(
  input: MarkAttendanceBulkInput
): Promise<ActionResult<number>> {
  return runAction(() => attendanceService.markAttendanceBulk(input), [ROSTER_PATH, HISTORY_PATH]);
}
