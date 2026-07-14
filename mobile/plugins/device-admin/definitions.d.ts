export interface FraptoDeviceAdminPlugin {
  isAdminActive(): Promise<{ active: boolean }>;
  requestAdmin(): Promise<void>;
  removeAdmin(): Promise<void>;
}
