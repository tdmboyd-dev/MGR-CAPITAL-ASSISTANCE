/**
 * Blockchain Service — MGR CAPITAL ASSISTANCE
 * Phase 21: ETH Payout Integration
 *
 * Handles cryptocurrency payouts via Ethereum (Sepolia testnet).
 * Production: Switch to mainnet and secure key management.
 *
 * REAL PRICE FEED: Uses CoinGecko API for live ETH/USD conversion
 */

import Web3 from "web3";
import { PrismaClient, LedgerEntryType, LedgerEntryStatus } from "@prisma/client";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

const prisma = new PrismaClient();

// Price cache to avoid excessive API calls
let priceCache: {
  ethUsdPrice: number;
  cachedAt: number;
} | null = null;

const PRICE_CACHE_TTL = 60000; // 1 minute cache

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
      logger.warn("BlockchainService: Missing wallet configuration. Blockchain payouts disabled.");
    }
  }

  /**
   * Get current ETH/USD price from CoinGecko (FREE, no API key required)
   * Implements caching to avoid rate limits (30 req/min on free tier)
   */
  async getEthUsdPrice(): Promise<number> {
    // Check cache first
    if (priceCache && (Date.now() - priceCache.cachedAt) < PRICE_CACHE_TTL) {
      return priceCache.ethUsdPrice;
    }

    try {
      // CoinGecko free API - no key required
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      const ethUsdPrice = data.ethereum?.usd;

      if (!ethUsdPrice || typeof ethUsdPrice !== 'number') {
        throw new Error('Invalid price data from CoinGecko');
      }

      // Update cache
      priceCache = {
        ethUsdPrice,
        cachedAt: Date.now(),
      };

      logger.info('ETH/USD price updated', { price: ethUsdPrice });
      return ethUsdPrice;
    } catch (error: any) {
      logger.error('Failed to fetch ETH price from CoinGecko', { error: error.message });

      // If cache exists but is stale, use it as fallback
      if (priceCache) {
        logger.warn('Using stale ETH price from cache', { price: priceCache.ethUsdPrice });
        return priceCache.ethUsdPrice;
      }

      // Last resort fallback - approximate ETH price
      // This should rarely happen and will be logged
      logger.error('No cached ETH price available, using fallback of $2500');
      return 2500;
    }
  }

  /**
   * Convert USD cents to ETH using live price feed
   */
  async usdToEth(amountCents: number): Promise<{ ethAmount: number; ethPrice: number }> {
    const ethPrice = await this.getEthUsdPrice();
    const usdAmount = amountCents / 100;
    const ethAmount = usdAmount / ethPrice;

    return {
      ethAmount,
      ethPrice,
    };
  }

  /**
   * Convert ETH to USD cents using live price feed
   */
  async ethToUsd(ethAmount: number): Promise<{ usdCents: number; ethPrice: number }> {
    const ethPrice = await this.getEthUsdPrice();
    const usdAmount = ethAmount * ethPrice;
    const usdCents = Math.round(usdAmount * 100);

    return {
      usdCents,
      ethPrice,
    };
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
      // Convert USD cents to ETH using live CoinGecko price feed
      const { ethAmount, ethPrice } = await this.usdToEth(amountCents);

      // Validate minimum amount (prevent dust transactions)
      const MIN_ETH_AMOUNT = 0.0001; // ~$0.25 at $2500 ETH
      if (ethAmount < MIN_ETH_AMOUNT) {
        return {
          success: false,
          error: `Amount too small. Minimum is ${MIN_ETH_AMOUNT} ETH (~$${(MIN_ETH_AMOUNT * ethPrice).toFixed(2)} USD)`,
        };
      }

      const amountWei = this.web3.utils.toWei(ethAmount.toFixed(18), "ether");

      logger.info('Preparing ETH payout', {
        amountCents,
        ethAmount: ethAmount.toFixed(8),
        ethPrice,
        recipientAddress,
      });

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
            ethAmount: ethAmount.toFixed(8),
            ethPriceUsd: ethPrice,
            usdAmount: (amountCents / 100).toFixed(2),
            network: config.ethereumNetwork || "sepolia",
            priceSource: 'coingecko',
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
      logger.error("BlockchainService payout error:", error);

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
      logger.error("BlockchainService getBalance error:", error);
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
      logger.error("BlockchainService verifyTransaction error:", error);
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
