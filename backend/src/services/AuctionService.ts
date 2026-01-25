/**
 * AuctionService.ts — MGR CAPITAL ASSISTANCE
 * Blockchain Surplus Auctions with Solana
 * Fractional NFT claims, real-time bidding, wallet integration
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { EventEmitter } from 'events';

const prisma = new PrismaClient();

// Solana connection
const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const connection = new Connection(SOLANA_RPC, 'confirmed');

interface Auction {
  id: string;
  claimId: string;
  nftMintAddress: string;
  title: string;
  description: string;
  surplusAmount: number;
  minimumBid: number;
  currentBid: number;
  currentBidder?: string;
  startTime: Date;
  endTime: Date;
  status: 'upcoming' | 'active' | 'ended' | 'cancelled';
  fractions: number; // Total fractional shares available
  fractionsRemaining: number;
  pricePerFraction: number;
  escrowAddress: string;
  bids: Bid[];
  createdAt: Date;
  propertyAddress?: string;
  state: string;
  imageUrl?: string;
}

interface Bid {
  id: string;
  auctionId: string;
  bidderAddress: string;
  bidderName?: string;
  amount: number;
  fractionCount: number;
  timestamp: Date;
  txSignature?: string;
  status: 'pending' | 'confirmed' | 'outbid' | 'won';
}

interface FractionalOwnership {
  ownerAddress: string;
  fractionCount: number;
  percentageOwnership: number;
  purchasePrice: number;
  purchaseDate: Date;
}

// Event emitter for real-time updates
const auctionEvents = new EventEmitter();

export class AuctionService {
  private auctions: Map<string, Auction> = new Map();

  /**
   * Create a new surplus claim auction
   */
  async createAuction(data: {
    claimId: string;
    nftMintAddress: string;
    title: string;
    description: string;
    surplusAmount: number;
    minimumBid: number;
    startTime: Date;
    endTime: Date;
    fractions?: number;
    propertyAddress?: string;
    state: string;
    imageUrl?: string;
  }): Promise<Auction> {
    const auctionId = `auction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Generate escrow keypair for auction funds
    const escrowKeypair = Keypair.generate();

    const fractions = data.fractions || 100; // Default 100 fractional shares
    const pricePerFraction = data.minimumBid / fractions;

    const auction: Auction = {
      id: auctionId,
      claimId: data.claimId,
      nftMintAddress: data.nftMintAddress,
      title: data.title,
      description: data.description,
      surplusAmount: data.surplusAmount,
      minimumBid: data.minimumBid,
      currentBid: 0,
      startTime: data.startTime,
      endTime: data.endTime,
      status: new Date() >= data.startTime ? 'active' : 'upcoming',
      fractions,
      fractionsRemaining: fractions,
      pricePerFraction,
      escrowAddress: escrowKeypair.publicKey.toBase58(),
      bids: [],
      createdAt: new Date(),
      propertyAddress: data.propertyAddress,
      state: data.state,
      imageUrl: data.imageUrl,
    };

    this.auctions.set(auctionId, auction);

    // Schedule status updates
    this.scheduleStatusUpdates(auction);

    logger.info('Auction created', {
      auctionId,
      claimId: data.claimId,
      surplusAmount: data.surplusAmount,
    });

    // Emit event for WebSocket subscribers
    auctionEvents.emit('auction:created', auction);

    return auction;
  }

  /**
   * Place a bid on an auction
   */
  async placeBid(
    auctionId: string,
    bidderAddress: string,
    amount: number,
    fractionCount: number = 1,
    bidderName?: string
  ): Promise<{ success: boolean; bid?: Bid; error?: string }> {
    const auction = this.auctions.get(auctionId);

    if (!auction) {
      return { success: false, error: 'Auction not found' };
    }

    if (auction.status !== 'active') {
      return { success: false, error: 'Auction is not active' };
    }

    if (new Date() > auction.endTime) {
      auction.status = 'ended';
      return { success: false, error: 'Auction has ended' };
    }

    if (fractionCount > auction.fractionsRemaining) {
      return { success: false, error: `Only ${auction.fractionsRemaining} fractions available` };
    }

    const minBidForFractions = auction.pricePerFraction * fractionCount;
    if (amount < minBidForFractions) {
      return { success: false, error: `Minimum bid for ${fractionCount} fractions is $${minBidForFractions}` };
    }

    // Verify wallet has sufficient funds (on Solana)
    const hasFunds = await this.verifyWalletFunds(bidderAddress, amount);
    if (!hasFunds) {
      return { success: false, error: 'Insufficient wallet balance' };
    }

    const bid: Bid = {
      id: `bid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      auctionId,
      bidderAddress,
      bidderName,
      amount,
      fractionCount,
      timestamp: new Date(),
      status: 'pending',
    };

    // Process bid on blockchain
    try {
      const txSignature = await this.processBlockchainBid(auction, bid);
      bid.txSignature = txSignature;
      bid.status = 'confirmed';

      // Update auction state
      auction.bids.push(bid);
      auction.currentBid = Math.max(auction.currentBid, amount);
      auction.currentBidder = bidderAddress;

      // Mark previous bids as outbid
      auction.bids
        .filter(b => b.id !== bid.id && b.status === 'confirmed')
        .forEach(b => {
          if (b.amount < amount) b.status = 'outbid';
        });

      logger.info('Bid placed', { auctionId, bidId: bid.id, amount, fractionCount });

      // Emit real-time update
      auctionEvents.emit('bid:placed', { auction, bid });

      // Extend auction if bid placed in last 5 minutes
      if (auction.endTime.getTime() - Date.now() < 5 * 60 * 1000) {
        auction.endTime = new Date(auction.endTime.getTime() + 5 * 60 * 1000);
        auctionEvents.emit('auction:extended', auction);
      }

      return { success: true, bid };
    } catch (error: any) {
      logger.error('Bid processing failed', { error: error.message });
      return { success: false, error: 'Blockchain transaction failed' };
    }
  }

  /**
   * Buy fractional shares directly (not auction-style)
   */
  async buyFractions(
    auctionId: string,
    buyerAddress: string,
    fractionCount: number,
    buyerName?: string
  ): Promise<{ success: boolean; ownership?: FractionalOwnership; error?: string }> {
    const auction = this.auctions.get(auctionId);

    if (!auction) {
      return { success: false, error: 'Auction not found' };
    }

    if (fractionCount > auction.fractionsRemaining) {
      return { success: false, error: `Only ${auction.fractionsRemaining} fractions available` };
    }

    const totalPrice = auction.pricePerFraction * fractionCount;

    // Verify and transfer funds
    const hasFunds = await this.verifyWalletFunds(buyerAddress, totalPrice);
    if (!hasFunds) {
      return { success: false, error: 'Insufficient wallet balance' };
    }

    try {
      // Process purchase on blockchain
      await this.processFractionalPurchase(auction, buyerAddress, fractionCount, totalPrice);

      // Update auction
      auction.fractionsRemaining -= fractionCount;

      const ownership: FractionalOwnership = {
        ownerAddress: buyerAddress,
        fractionCount,
        percentageOwnership: (fractionCount / auction.fractions) * 100,
        purchasePrice: totalPrice,
        purchaseDate: new Date(),
      };

      logger.info('Fractions purchased', {
        auctionId,
        buyer: buyerAddress,
        fractionCount,
        totalPrice,
      });

      // Emit event
      auctionEvents.emit('fractions:purchased', { auction, ownership });

      return { success: true, ownership };
    } catch (error: any) {
      logger.error('Fractional purchase failed', { error: error.message });
      return { success: false, error: 'Transaction failed' };
    }
  }

  /**
   * Get auction details
   */
  async getAuction(auctionId: string): Promise<Auction | null> {
    const auction = this.auctions.get(auctionId);

    if (auction) {
      // Update status based on time
      this.updateAuctionStatus(auction);
    }

    return auction || null;
  }

  /**
   * List active auctions
   */
  async listAuctions(filters?: {
    status?: Auction['status'];
    state?: string;
    minValue?: number;
    maxValue?: number;
  }): Promise<Auction[]> {
    let auctions = Array.from(this.auctions.values());

    // Update all statuses
    auctions.forEach(a => this.updateAuctionStatus(a));

    if (filters?.status) {
      auctions = auctions.filter(a => a.status === filters.status);
    }

    if (filters?.state) {
      auctions = auctions.filter(a => a.state === filters.state);
    }

    if (filters?.minValue) {
      auctions = auctions.filter(a => a.surplusAmount >= filters.minValue!);
    }

    if (filters?.maxValue) {
      auctions = auctions.filter(a => a.surplusAmount <= filters.maxValue!);
    }

    return auctions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get bid history for auction
   */
  async getBidHistory(auctionId: string): Promise<Bid[]> {
    const auction = this.auctions.get(auctionId);
    if (!auction) return [];

    return auction.bids.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get user's bids across all auctions
   */
  async getUserBids(walletAddress: string): Promise<{ auction: Auction; bid: Bid }[]> {
    const results: { auction: Auction; bid: Bid }[] = [];

    for (const auction of this.auctions.values()) {
      const userBids = auction.bids.filter(b => b.bidderAddress === walletAddress);
      for (const bid of userBids) {
        results.push({ auction, bid });
      }
    }

    return results.sort((a, b) => b.bid.timestamp.getTime() - a.bid.timestamp.getTime());
  }

  /**
   * End auction and distribute funds
   */
  async endAuction(auctionId: string): Promise<{ success: boolean; winner?: Bid; error?: string }> {
    const auction = this.auctions.get(auctionId);

    if (!auction) {
      return { success: false, error: 'Auction not found' };
    }

    if (auction.status === 'ended') {
      return { success: false, error: 'Auction already ended' };
    }

    auction.status = 'ended';

    // Find winning bid
    const winningBid = auction.bids
      .filter(b => b.status === 'confirmed')
      .sort((a, b) => b.amount - a.amount)[0];

    if (winningBid) {
      winningBid.status = 'won';

      // Transfer NFT to winner and funds to seller
      try {
        await this.finalizeAuction(auction, winningBid);
      } catch (error: any) {
        logger.error('Auction finalization failed', { error: error.message });
      }

      logger.info('Auction ended', { auctionId, winner: winningBid.bidderAddress });
      auctionEvents.emit('auction:ended', { auction, winner: winningBid });

      return { success: true, winner: winningBid };
    }

    logger.info('Auction ended with no bids', { auctionId });
    auctionEvents.emit('auction:ended', { auction, winner: null });

    return { success: true };
  }

  /**
   * Cancel auction (only if no bids)
   */
  async cancelAuction(auctionId: string): Promise<{ success: boolean; error?: string }> {
    const auction = this.auctions.get(auctionId);

    if (!auction) {
      return { success: false, error: 'Auction not found' };
    }

    if (auction.bids.filter(b => b.status === 'confirmed').length > 0) {
      return { success: false, error: 'Cannot cancel auction with confirmed bids' };
    }

    auction.status = 'cancelled';

    logger.info('Auction cancelled', { auctionId });
    auctionEvents.emit('auction:cancelled', auction);

    return { success: true };
  }

  /**
   * Subscribe to auction events (for WebSocket)
   */
  subscribeToAuction(auctionId: string, callback: (event: string, data: any) => void): () => void {
    const handler = (data: any) => {
      if (data.auction?.id === auctionId || data.id === auctionId) {
        callback('update', data);
      }
    };

    auctionEvents.on('bid:placed', handler);
    auctionEvents.on('auction:extended', handler);
    auctionEvents.on('auction:ended', handler);
    auctionEvents.on('fractions:purchased', handler);

    // Return unsubscribe function
    return () => {
      auctionEvents.off('bid:placed', handler);
      auctionEvents.off('auction:extended', handler);
      auctionEvents.off('auction:ended', handler);
      auctionEvents.off('fractions:purchased', handler);
    };
  }

  /**
   * Get global auction events emitter
   */
  getEventEmitter(): EventEmitter {
    return auctionEvents;
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  /**
   * Verify wallet has sufficient funds
   */
  private async verifyWalletFunds(walletAddress: string, amountUSD: number): Promise<boolean> {
    try {
      const publicKey = new PublicKey(walletAddress);
      const balance = await connection.getBalance(publicKey);
      const balanceSOL = balance / LAMPORTS_PER_SOL;

      // Assume $100 per SOL for conversion (would use price oracle in production)
      const balanceUSD = balanceSOL * 100;

      return balanceUSD >= amountUSD;
    } catch {
      // Invalid wallet or connection error
      return false;
    }
  }

  /**
   * Process bid on blockchain
   */
  private async processBlockchainBid(auction: Auction, bid: Bid): Promise<string> {
    // In production, this would:
    // 1. Lock funds in escrow
    // 2. Sign transaction
    // 3. Return signature

    // Simulate transaction signature
    return `sim_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  /**
   * Process fractional purchase on blockchain
   */
  private async processFractionalPurchase(
    auction: Auction,
    buyerAddress: string,
    fractionCount: number,
    totalPrice: number
  ): Promise<string> {
    // In production:
    // 1. Transfer funds from buyer to escrow
    // 2. Update fractional ownership on-chain
    // 3. Return transaction signature

    return `sim_frac_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  /**
   * Finalize auction - transfer NFT and funds
   */
  private async finalizeAuction(auction: Auction, winningBid: Bid): Promise<void> {
    // In production:
    // 1. Transfer NFT from escrow to winner
    // 2. Transfer funds from escrow to seller
    // 3. Update on-chain state

    logger.info('Auction finalized', {
      auctionId: auction.id,
      winner: winningBid.bidderAddress,
      amount: winningBid.amount,
    });
  }

  /**
   * Update auction status based on time
   */
  private updateAuctionStatus(auction: Auction): void {
    const now = new Date();

    if (auction.status === 'upcoming' && now >= auction.startTime) {
      auction.status = 'active';
      auctionEvents.emit('auction:started', auction);
    }

    if (auction.status === 'active' && now > auction.endTime) {
      this.endAuction(auction.id);
    }
  }

  /**
   * Schedule automatic status updates
   */
  private scheduleStatusUpdates(auction: Auction): void {
    // Schedule start
    if (auction.startTime > new Date()) {
      const startDelay = auction.startTime.getTime() - Date.now();
      setTimeout(() => {
        if (auction.status === 'upcoming') {
          auction.status = 'active';
          auctionEvents.emit('auction:started', auction);
        }
      }, startDelay);
    }

    // Schedule end
    const endDelay = auction.endTime.getTime() - Date.now();
    if (endDelay > 0) {
      setTimeout(() => {
        if (auction.status === 'active') {
          this.endAuction(auction.id);
        }
      }, endDelay);
    }
  }

  /**
   * Get auction statistics
   */
  async getStatistics(): Promise<{
    totalAuctions: number;
    activeAuctions: number;
    totalValueLocked: number;
    totalBids: number;
    averageBidAmount: number;
  }> {
    const auctions = Array.from(this.auctions.values());
    const allBids = auctions.flatMap(a => a.bids);
    const confirmedBids = allBids.filter(b => b.status === 'confirmed');

    return {
      totalAuctions: auctions.length,
      activeAuctions: auctions.filter(a => a.status === 'active').length,
      totalValueLocked: auctions.reduce((sum, a) => sum + a.currentBid, 0),
      totalBids: confirmedBids.length,
      averageBidAmount: confirmedBids.length > 0
        ? confirmedBids.reduce((sum, b) => sum + b.amount, 0) / confirmedBids.length
        : 0,
    };
  }
}

export const auctionService = new AuctionService();
