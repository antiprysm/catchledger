export type LicenseProfile = {
    legalName: string;       // required
    dbaName?: string;        // optional
    licenseNumber: string;   // required
    state: string;           // required (IL, WI, etc.)
    phone?: string;          // optional
    email?: string;          // optional
    vehiclePlate?: string;   // optional
    homeBaseCity?: string;   // optional
    updatedAt: string;       // ISO
  };
  