declare module "web-push" {
  export interface PushSubscription {
    endpoint: string;
    keys?: {
      auth?: string;
      p256dh?: string;
    };
  }

  export function setVapidDetails(
    subject: string,
    publicKey: string,
    privateKey: string
  ): void;

  export function sendNotification(
    subscription: PushSubscription,
    payload?: string | Buffer
  ): Promise<unknown>;

  const webpush: {
    setVapidDetails: typeof setVapidDetails;
    sendNotification: typeof sendNotification;
  };

  export default webpush;
}
