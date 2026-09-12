"use server";

import { runAction } from "@/lib/run-action";
import { attendanceService } from "@/modules/attendance/services/attendance-service";
import type {
  MarkAttendanceBulkInput,
  MarkAttendanceEntryInput,
} from "@/modules/attendance/validation/attendance-schema";
import type { ActionResult } from "@/types/api";
import type { Attendance } from "@/types/attendance";

const ROSTER_PATH = "/employees/attendance";
const HISTORY_PATH = "/employees/attendance/history";

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
