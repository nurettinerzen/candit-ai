export type NotificationChannel = "email" | "sms" | "in_app";

export type NotificationMessageInput = {
  tenantId: string;
  channel: NotificationChannel;
  to: string;
  subject?: string;
  body: string;
  metadata?: Record<string, unknown>;
  traceId?: string;
  deliveryId?: string;
};

export type NotificationSendResult = {
  provider: string;
  channel: NotificationChannel;
  messageId: string;
  status: "sent" | "queued" | "failed";
  errorMessage?: string;
};

export interface NotificationProvider {
  readonly channel: NotificationChannel;
  send(input: NotificationMessageInput): Promise<NotificationSendResult>;
}
