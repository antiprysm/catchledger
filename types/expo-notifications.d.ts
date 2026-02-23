declare module "expo-notifications" {
  export const IosAuthorizationStatus: { PROVISIONAL: number };
  export const SchedulableTriggerInputTypes: { DAILY: "daily"; DATE: "date" };

  export function getPermissionsAsync(): Promise<{ granted?: boolean; ios?: { status?: number } }>;
  export function requestPermissionsAsync(): Promise<{ granted?: boolean }>;

  export function scheduleNotificationAsync(input: {
    identifier?: string;
    content: { title?: string; body?: string; sound?: string };
    trigger:
      | null
      | { type: "daily"; hour: number; minute: number }
      | { type: "date"; date: Date };
  }): Promise<string>;

  export function cancelScheduledNotificationAsync(identifier: string): Promise<void>;
  export function getAllScheduledNotificationsAsync(): Promise<Array<{ identifier: string }>>;
}
