export type WeightUnit = "lb" | "kg";
export type TemperatureUnit = "fahrenheit" | "celsius";
export type DateFormat = "MM/DD/YYYY" | "DD/MM/YYYY";
export type BuyerType = "Wholesale" | "Retail" | "Restaurant";
export type PaymentMethod = "Cash" | "Card" | "Bank Transfer" | "Check";
export type UserRole = "Owner" | "Employee" | "Viewer";

export type CompanyProfile = {
  businessName: string;
  businessAddress: string;
  phone: string;
  email: string;
  licenseNumber: string;
  ein?: string;
  logoUri?: string;
};

export type AppSettings = {
  weightUnit: WeightUnit;
  temperatureUnit: TemperatureUnit;
  dateFormat: DateFormat;

  companyProfile: CompanyProfile;

  autoSync: boolean;
  lastSyncedAt?: string;

  deliveryReminders: boolean;
  paymentReminders: boolean;
  lowInventoryAlerts: boolean;
  expiringProductAlerts: boolean;

  defaultBuyerType: BuyerType;
  defaultPaymentMethod: PaymentMethod;
  requireSignature: boolean;
  requirePhoto: boolean;
  autoGenerateInvoice: boolean;

  userRole: UserRole;

  passcodeLockEnabled: boolean;
  biometricsEnabled: boolean;
  autoLockTimerMinutes: 1 | 5 | 10 | 15;
  sessionTimeoutMinutes: 5 | 15 | 30 | 60;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  weightUnit: "lb",
  temperatureUnit: "fahrenheit",
  dateFormat: "MM/DD/YYYY",

  companyProfile: {
    businessName: "",
    businessAddress: "",
    phone: "",
    email: "",
    licenseNumber: "",
    ein: "",
    logoUri: "",
  },

  autoSync: true,
  lastSyncedAt: "",

  deliveryReminders: true,
  paymentReminders: true,
  lowInventoryAlerts: true,
  expiringProductAlerts: true,

  defaultBuyerType: "Wholesale",
  defaultPaymentMethod: "Cash",
  requireSignature: false,
  requirePhoto: false,
  autoGenerateInvoice: true,

  userRole: "Owner",

  passcodeLockEnabled: false,
  biometricsEnabled: false,
  autoLockTimerMinutes: 5,
  sessionTimeoutMinutes: 30,
};