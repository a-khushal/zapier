export interface CreateZapRequest {
  availableTriggerId: string;
  actions: {
    availableActionId: string;
    actionMetadata?: Record<string, unknown>;
  }[];
}

export interface CreateZapResponse {
  message: string;
  zapId: string;
}
