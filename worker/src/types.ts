export type ActionForExecution = {
  id: string;
  actionId: string;
  metadata: unknown;
};

export type ActionExecutionResult = {
  success: boolean;
  shouldRetry: boolean;
  error?: string;
  requestSummary: Record<string, unknown>;
  responseStatus?: number;
  responseBody?: string;
  output?: Record<string, unknown>;
};
