import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./authMiddleware.js";

export function roleGuard(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    // FOUNDER has all permissions (superuser)
    if (req.user.role === "FOUNDER") {
      next();
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    next();
  };
}
