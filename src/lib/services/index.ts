export type { ServiceResult, ServiceErrorCode } from "./result";
export { ok, fail } from "./result";
export type { ServiceContext, ActorRole } from "./context";
export { WEB_ADMIN_CONTEXT, requireRole } from "./context";
export {
  TOOL_CATALOG,
  markAttendanceTool,
  findAvailableSlotsTool,
  confirmMakeupLessonTool,
  createMakeupLessonTool,
  cancelMakeupLessonTool,
  findAvailableTeachersTool,
  getStudentScheduleTool,
  getTeacherScheduleTool,
  getParentBalanceTool,
  createPaymentTool,
  sendParentMessageTool,
  sendTeacherMessageTool,
  createStudentTool,
  createTeacherTool,
  createRoomTool,
  createLessonTool,
  suggestLessonSlotsTool,
  createPaymentRecordTool,
  resetDemoTool,
} from "./tools";
