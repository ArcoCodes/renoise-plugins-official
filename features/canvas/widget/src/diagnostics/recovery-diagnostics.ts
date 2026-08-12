export type RecoveryDiagnosticStatus = "info" | "success" | "warning" | "error";

export type RecoveryDiagnosticEvent = {
  stage: string;
  message: string;
  status?: RecoveryDiagnosticStatus;
  detail?: string;
};

export type RecoveryDiagnosticEntry = RecoveryDiagnosticEvent & {
  id: number;
  occurredAt: number;
};
