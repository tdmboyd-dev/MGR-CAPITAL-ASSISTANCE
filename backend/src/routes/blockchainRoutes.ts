/**
 * Blockchain Routes — MGR CAPITAL ASSISTANCE
 * Phase 21: ETH Payout Endpoints
 */

import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { blockchainService } from "../services/BlockchainService.js";

const router = Router();

/**
 * POST /api/blockchain/payout/:caseId
 * Execute a blockchain payout for a case (FOUNDER only)
 */
router.post(
  "/payout/:caseId",
  authMiddleware,
  roleGuard(["FOUNDER"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { caseId } = req.params;
      const { recipientAddress, amountCents, description } = req.body;

      if (!recipientAddress || !amountCents) {
        return res.status(400).json({
          success: false,
          error: "recipientAddress and amountCents are required",
        });
      }

      if (amountCents <= 0) {
        return res.status(400).json({
          success: false,
          error: "amountCents must be positive",
        });
      }

      const result = await blockchainService.payout({
        caseId,
        recipientAddress,
        amountCents,
        userId: req.user!.userId,
        description,
      });

      if (result.success) {
        return res.json({
          success: true,
          txHash: result.txHash,
          ledgerEntryId: result.ledgerEntryId,
          message: "Payout executed successfully",
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error: any) {
      console.error("Blockchain payout error:", error);
      return res.status(500).json({
        success: false,
        error: "Payout failed",
      });
    }
  }
);

/**
 * GET /api/blockchain/balance
 * Get wallet balance (FOUNDER only)
 */
router.get(
  "/balance",
  authMiddleware,
  roleGuard(["FOUNDER"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const balance = await blockchainService.getBalance();

      if (!balance) {
        return res.status(503).json({
          success: false,
          error: "Blockchain service not configured",
        });
      }

      return res.json({
        success: true,
        balance,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Failed to get balance",
      });
    }
  }
);

/**
 * GET /api/blockchain/verify/:txHash
 * Verify a transaction (FOUNDER only)
 */
router.get(
  "/verify/:txHash",
  authMiddleware,
  roleGuard(["FOUNDER"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { txHash } = req.params;
      const result = await blockchainService.verifyTransaction(txHash);

      return res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Failed to verify transaction",
      });
    }
  }
);

/**
 * GET /api/blockchain/gas-price
 * Get current gas price (FOUNDER only)
 */
router.get(
  "/gas-price",
  authMiddleware,
  roleGuard(["FOUNDER"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const gasPrice = await blockchainService.getGasPrice();

      return res.json({
        success: true,
        gasPrice,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Failed to get gas price",
      });
    }
  }
);

/**
 * GET /api/blockchain/status
 * Check if blockchain service is enabled
 */
router.get("/status", authMiddleware, async (req: AuthRequest, res: Response) => {
  return res.json({
    success: true,
    enabled: blockchainService.isServiceEnabled(),
  });
});

export default router;
