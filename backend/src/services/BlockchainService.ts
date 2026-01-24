/**
 * Blockchain Service — MGR CAPITAL ASSISTANCE
 * Phase 21: ETH Payout Integration
 *
 * Handles cryptocurrency payouts via Ethereum (Sepolia testnet).
 * Production: Switch to mainnet and secure key management.
 */

import Web3 from "web3";
import { PrismaClient, LedgerEntryType, LedgerEntryStatus } from "@prisma/client";
import { config } from "../config/env.js";

const prisma = new PrismaClient();

interface PayoutResult {
  success: boolean;
  txHash?: string;
  error?: string;
  ledgerEntryId?: string;
}

interface PayoutOptions {
  caseId: string;
  recipientAddress: string;
  amountCents: number;
  userId: string;
  description?: string;
}

class BlockchainService {
  private web3: Web3;
  private isEnabled: boolean;

  constructor() {
    // Use Sepolia testnet for development, mainnet for production
    const rpcUrl = config.ethereumRpcUrl || "https://sepolia.infura.io/v3/YOUR_INFURA_KEY";
    this.web3 = new Web3(rpcUrl);
    this.isEnabled = !!config.ethereumPrivateKey && !!config.ethereumWalletAddress;

    if (!this.isEnabled) {
      console.warn("BlockchainService: Missing wallet configuration. Blockchain payouts disabled.");
    }
  }

  /**
   * Execute a payout to a recipient address
   */
  async payout(options: PayoutOptions): Promise<PayoutResult> {
    const { caseId, recipientAddress, amountCents, userId, description } = options;

    if (!this.isEnabled) {
      return {
        success: false,
        error: "Blockchain payouts are not configured. Set ETHEREUM_PRIVATE_KEY and ETHEREUM_WALLET_ADDRESS.",
      };
    }

    // Validate address
    if (!this.web3.utils.isAddress(recipientAddress)) {
      return {
        success: false,
        error: "Invalid Ethereum address",
      };
    }

    try {
      // Convert cents to ETH (simplified - in production use proper conversion rate)
      // This is a stub conversion: $1 = 0.001 ETH (adjust based on actual rate)
      const ethAmount = (amountCents / 100) * 0.001;
      const amountWei = this.web3.utils.toWei(ethAmount.toString(), "ether");

      // Build transaction
      const tx = {
        from: config.ethereumWalletAddress!,
        to: recipientAddress,
        value: amountWei,
        gas: 21000,
        gasPrice: await this.web3.eth.getGasPrice(),
      };

      // Sign and send transaction
      const signedTx = await this.web3.eth.accounts.signTransaction(
        tx,
        config.ethereumPrivateKey!
      );

      const receipt = await this.web3.eth.sendSignedTransaction(
        signedTx.rawTransaction!
      );

      const txHash = receipt.transactionHash as string;

      // Create ledger entry for the payout
      const ledgerEntry = await prisma.ledgerEntry.create({
        data: {
          caseId,
          type: LedgerEntryType.CLIENT_PAYOUT,
          status: LedgerEntryStatus.COMPLETED,
          amountCents,
          displayedAmountCents: amountCents,
          description: description || `Blockchain payout to ${recipientAddress}`,
          metadata: {
            txHash,
            recipientAddress,
            ethAmount: ethAmount.toString(),
            network: config.ethereumNetwork || "sepolia",
          },
          createdById: userId,
        },
      });

      // Update case if needed
      await prisma.case.update({
        where: { id: caseId },
        data: {
          lastPayoutAt: new Date(),
          metadata: {
            lastTxHash: txHash,
          },
        },
      });

      return {
        success: true,
        txHash,
        ledgerEntryId: ledgerEntry.id,
      };
    } catch (error: any) {
      console.error("BlockchainService payout error:", error);

      // Log failed attempt
      await prisma.ledgerEntry.create({
        data: {
          caseId,
          type: LedgerEntryType.CLIENT_PAYOUT,
          status: LedgerEntryStatus.FAILED,
          amountCents,
          displayedAmountCents: amountCents,
          description: `Failed blockchain payout: ${error.message}`,
          metadata: {
            recipientAddress,
            error: error.message,
          },
          createdById: userId,
        },
      });

      return {
        success: false,
        error: error.message || "Payout failed",
      };
    }
  }

  /**
   * Get wallet balance
   */
  async getBalance(): Promise<{ balanceEth: string; balanceWei: string } | null> {
    if (!this.isEnabled) return null;

    try {
      const balanceWei = await this.web3.eth.getBalance(config.ethereumWalletAddress!);
      const balanceEth = this.web3.utils.fromWei(balanceWei, "ether");
      return { balanceEth, balanceWei: balanceWei.toString() };
    } catch (error) {
      console.error("BlockchainService getBalance error:", error);
      return null;
    }
  }

  /**
   * Verify a transaction
   */
  async verifyTransaction(txHash: string): Promise<{
    confirmed: boolean;
    blockNumber?: number;
    status?: boolean;
  }> {
    try {
      const receipt = await this.web3.eth.getTransactionReceipt(txHash);
      if (!receipt) {
        return { confirmed: false };
      }
      return {
        confirmed: true,
        blockNumber: Number(receipt.blockNumber),
        status: receipt.status,
      };
    } catch (error) {
      console.error("BlockchainService verifyTransaction error:", error);
      return { confirmed: false };
    }
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<string> {
    try {
      const gasPrice = await this.web3.eth.getGasPrice();
      return this.web3.utils.fromWei(gasPrice, "gwei") + " gwei";
    } catch (error) {
      return "unknown";
    }
  }

  /**
   * Check if service is enabled
   */
  isServiceEnabled(): boolean {
    return this.isEnabled;
  }
}

export const blockchainService = new BlockchainService();
