export type UserRole = "ADMIN" | "EMPLOYEE" | "CLIENT";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  name: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;

  // Employee-specific
  tierName?: string;
  teamLeaderId?: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  role: UserRole;
  name: string;
  phone?: string;
  tierName?: string;
  teamLeaderId?: string;
}

export interface UpdateUserInput {
  name?: string;
  phone?: string;
  tierName?: string;
  teamLeaderId?: string;
}
