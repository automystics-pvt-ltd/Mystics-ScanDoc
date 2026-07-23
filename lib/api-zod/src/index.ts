// Auto-fixed by lib/api-spec/fix-zod-index.mjs after orval codegen.
// Do not edit manually — re-run `pnpm --filter @workspace/api-spec run codegen` instead.

// Zod schemas and associated values from generated/api.ts
export * from "./generated/api";

// TypeScript types from generated/types/ — files with name collisions use
// `export type { … }` so the zod schema value in api.ts is not shadowed.
export * from "./generated/types/auditLog";
export * from "./generated/types/authResponse";
export * from "./generated/types/changePasswordInput";
export * from "./generated/types/dashboardFailure";
export * from "./generated/types/dashboardStats";
export * from "./generated/types/dashboardTrends";
export * from "./generated/types/dashboardVolumeSeries";
export * from "./generated/types/document";
export * from "./generated/types/documentWithLogs";
export * from "./generated/types/documentWithUser";
export * from "./generated/types/emailLog";
export * from "./generated/types/emailLogStatus";
export * from "./generated/types/errorResponse";
export * from "./generated/types/healthStatus";
export * from "./generated/types/listAuditLogsParams";
export * from "./generated/types/loginInput";
export * from "./generated/types/messageResponse";
export * from "./generated/types/recipient";
export * from "./generated/types/recipientInput";
export * from "./generated/types/sendResult";
export * from "./generated/types/settings";
export * from "./generated/types/settingsInput";
export type { UploadDocumentBody } from "./generated/types/uploadDocumentBody"; // type-only: value exported as zod schema above
export * from "./generated/types/user";
export * from "./generated/types/userInput";
export * from "./generated/types/userInputRole";
export * from "./generated/types/userRole";
export * from "./generated/types/userStatus";
export * from "./generated/types/userUpdate";
export * from "./generated/types/userUpdateRole";
export * from "./generated/types/userUpdateStatus";
