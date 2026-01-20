export type RoleName = "ADMIN" | "EMPLOYEE" | "CLIENT";

export interface Role {
  id: string;
  name: RoleName;
  permissions: Permission[];
}

export type Permission =
  | "cases:read:all"
  | "cases:read:own"
  | "cases:write"
  | "cases:delete"
  | "employees:read"
  | "employees:write"
  | "employees:delete"
  | "clients:read"
  | "clients:write"
  | "payouts:read:all"
  | "payouts:read:own"
  | "payouts:process"
  | "settings:read"
  | "settings:write";

export const rolePermissions: Record<RoleName, Permission[]> = {
  ADMIN: [
    "cases:read:all",
    "cases:write",
    "cases:delete",
    "employees:read",
    "employees:write",
    "employees:delete",
    "clients:read",
    "clients:write",
    "payouts:read:all",
    "payouts:process",
    "settings:read",
    "settings:write",
  ],
  EMPLOYEE: [
    "cases:read:own",
    "payouts:read:own",
  ],
  CLIENT: [
    "cases:read:own",
  ],
};
