export interface CreateZapRequest {
  availableTriggerId: string;
  triggerMetadata?: Record<string, unknown>;
  actions: {
    availableActionId: string;
    actionMetadata?: Record<string, unknown>;
  }[];
}

export interface CreateZapResponse {
  message: string;
  zapId: string;
}
