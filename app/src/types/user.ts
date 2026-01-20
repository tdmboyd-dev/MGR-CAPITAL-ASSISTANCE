export type UserRole = "ADMIN" | "EMPLOYEE" | "CLIENT";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  createdAt: string;
}

export interface Employee extends User {
  role: "EMPLOYEE";
  tierName: string;
  teamLeaderId?: string;
  displayedRate: string;
  lifetimeEarnings: number;
  monthEarnings: number;
}

export interface Client extends User {
  role: "CLIENT";
  caseIds: string[];
}

export interface Admin extends User {
  role: "ADMIN";
}
