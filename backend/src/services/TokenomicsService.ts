import {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl
} from '@solana/web3.js';
import prisma from "../lib/prisma.js";

import { createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount, associatedTokenAddress } from './SolanaTokenAdapter.js';

// Solana connection
const connection = new Connection(
  process.env.SOLANA_RPC_URL || clusterApiUrl('devnet'),
  'confirmed'
);

/**
 * Tokenomics Service - MGR Surplus Reward Token
 *
 * Implements SPL token for rewarding users:
 * - 1% of recovered surplus paid as MGR tokens
 * - Tokens can be redeemed for fee discounts
 * - Staking for priority processing
 *
 * NOTE: Requires Solana wallet setup:
 * 1. Generate keypair: solana-keygen new
 * 2. Fund with SOL: solana airdrop 2 (devnet)
 * 3. Set SOLANA_PRIVATE_KEY in env
 */
export class TokenomicsService {
  private walletPromise: Promise<Keypair> | null = null;
  private mintAddress: PublicKey | null = null;
  private async getWallet(): Promise<Keypair> {
    const secret = process.env.SOLANA_PRIVATE_KEY;
    if (!secret) throw new Error('Solana signing wallet is not configured');
    if (!this.walletPromise) {
      const parsed: unknown = JSON.parse(secret);
      if (!Array.isArray(parsed) || parsed.length !== 64 || !parsed.every(value => Number.isInteger(value) && value >= 0 && value <= 255)) throw new Error('Invalid Solana signing wallet');
      this.walletPromise = Keypair.fromSecretKey(Uint8Array.from(parsed));
    }
    return this.walletPromise;
  }

  /**
   * Create the MGR reward token (one-time setup)
   */
  async createRewardToken(): Promise<string> {
    try {
      const mint = await createMint(
        connection,
        await this.getWallet(),           // Payer
        (await this.getWallet()).publicKey, // Mint authority
        (await this.getWallet()).publicKey, // Freeze authority
        9                      // 9 decimals (standard)
      );

      this.mintAddress = mint;

      // Store mint address
      await prisma.setting.upsert({
        where: { key: 'MGR_TOKEN_MINT' },
        update: { value: mint.toString() },
        create: { key: 'MGR_TOKEN_MINT', value: mint.toString() }
      });

      console.log(`[Tokenomics] Created MGR token: ${mint.toString()}`);

      return mint.toString();
    } catch (error: any) {
      console.error('[Tokenomics] Token creation failed:', error.message);
      throw new Error('Failed to create reward token');
    }
  }

  /**
   * Get or load existing mint address
   */
  private async getMintAddress(): Promise<PublicKey> {
    if (this.mintAddress) return this.mintAddress;

    const setting = await prisma.setting.findUnique({
      where: { key: 'MGR_TOKEN_MINT' }
    });

    if (setting) {
      this.mintAddress = new PublicKey(setting.value);
      return this.mintAddress;
    }

    // Create if doesn't exist
    const mint = await this.createRewardToken();
    return new PublicKey(mint);
  }

  /**
   * Reward user with MGR tokens
   */
  async rewardUser(userWalletAddress: string, amount: number): Promise<{
    success: boolean;
    txSignature?: string;
    tokensRewarded: number;
  }> {
    try {
      const mint = await this.getMintAddress();
      const userPubkey = new PublicKey(userWalletAddress);

      // Get or create user's token account
      const tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        await this.getWallet(),
        mint,
        userPubkey
      );

      // Mint tokens (amount * 10^9 for 9 decimals)
      const tokenAmount = BigInt(Math.floor(amount * 1e9));

      const signature = await mintTo(
        connection,
        await this.getWallet(),
        mint,
        tokenAccount.address,
        await this.getWallet(),
        tokenAmount
      );

      // Log reward
      await prisma.tokenReward.create({
        data: {
          userId: userWalletAddress,
          amount,
          reason: `Surplus reward - tx: ${signature}`,
          type: 'SURPLUS_REWARD'
        } as any
      });

      console.log(`[Tokenomics] Rewarded ${amount} MGR to ${userWalletAddress}`);

      return {
        success: true,
        txSignature: signature,
        tokensRewarded: amount
      };
    } catch (error: any) {
      console.error('[Tokenomics] Reward failed:', error.message);
      return { success: false, tokensRewarded: 0 };
    }
  }

  /**
   * Calculate reward for a payment (1% of amount)
   */
  calculateReward(paymentAmount: number): number {
    return paymentAmount * 0.01; // 1% reward
  }

  /**
   * Process payment with automatic reward
   */
  async processPaymentWithReward(
    paymentAmount: number,
    userWalletAddress: string
  ): Promise<{
    reward: number;
    txSignature?: string;
  }> {
    const reward = this.calculateReward(paymentAmount);

    if (reward >= 0.001) { // Minimum 0.001 MGR
      const result = await this.rewardUser(userWalletAddress, reward);
      return {
        reward: result.tokensRewarded,
        txSignature: result.txSignature
      };
    }

    return { reward: 0 };
  }

  /**
   * Get user's token balance
   */
  async getUserBalance(userWalletAddress: string): Promise<number> {
    try {
      const mint = await this.getMintAddress();
      const userPubkey = new PublicKey(userWalletAddress);

      const address = await associatedTokenAddress(mint,userPubkey);
      const account = await getAccount(connection,address);
      return Number(account.amount) / 1e9; // Convert from base units
    } catch {
      return 0;
    }
  }

  /**
   * Get total tokens in circulation
   */
  async getTotalSupply(): Promise<number> {
    try {
      const mint = await this.getMintAddress();
      const info = await connection.getTokenSupply(mint);
      return Number(info.value.amount) / 1e9;
    } catch {
      return 0;
    }
  }

  /**
   * Get tokenomics stats
   */
  async getStats(): Promise<{
    totalSupply: number;
    totalRewards: number;
    uniqueHolders: number;
    mintAddress: string;
  }> {
    const mint = await this.getMintAddress();
    const totalSupply = await this.getTotalSupply();

    const rewards = await prisma.tokenReward.aggregate({
      _sum: { amount: true },
      _count: { userId: true }
    });

    const uniqueHolders = await prisma.tokenReward.groupBy({
      by: ['userId']
    });

    return {
      totalSupply,
      totalRewards: rewards._sum?.amount || 0,
      uniqueHolders: uniqueHolders.length,
      mintAddress: mint.toString()
    };
  }
}

export const tokenomicsService = new TokenomicsService();
