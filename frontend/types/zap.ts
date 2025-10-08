export interface CreateZapRequest {
  availableTriggerId: string;
  actions: {
    availableActionId: string;
  }[];
}

export interface CreateZapResponse {
  message: string;
  zapId: string;
}
