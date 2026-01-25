import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';

const connection = new Connection(
  process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  'confirmed'
);

export interface Listing {
  id: string;
  nftMint: string;
  seller: string;
  price: number; // in SOL
  claimId: string;
  claimAmount: number;
  status: 'active' | 'sold' | 'cancelled';
  createdAt: Date;
  escrowAccount?: string;
}

export interface Trade {
  id: string;
  listingId: string;
  buyer: string;
  seller: string;
  price: number;
  txSignature: string;
  completedAt: Date;
}

// In-memory store (replace with database)
const listings: Map<string, Listing> = new Map();
const trades: Trade[] = [];

export class MarketplaceService {
  /**
   * List an NFT surplus claim for sale
   */
  async listForSale(
    nftMint: string,
    price: number,
    claimId: string,
    claimAmount: number,
    sellerPublicKey: string
  ): Promise<Listing> {
    const id = `listing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Generate escrow account for holding NFT during sale
    const escrowKeypair = Keypair.generate();

    const listing: Listing = {
      id,
      nftMint,
      seller: sellerPublicKey,
      price,
      claimId,
      claimAmount,
      status: 'active',
      createdAt: new Date(),
      escrowAccount: escrowKeypair.publicKey.toString()
    };

    listings.set(id, listing);

    console.log(`[Marketplace] Listed NFT ${nftMint} for ${price} SOL`);

    return listing;
  }

  /**
   * Get all active listings
   */
  async getActiveListings(): Promise<Listing[]> {
    return Array.from(listings.values()).filter(l => l.status === 'active');
  }

  /**
   * Get listing by ID
   */
  async getListing(listingId: string): Promise<Listing | null> {
    return listings.get(listingId) || null;
  }

  /**
   * Buy a listed NFT
   */
  async buyListing(
    listingId: string,
    buyerPublicKey: string,
    buyerKeypair?: Keypair
  ): Promise<Trade> {
    const listing = listings.get(listingId);

    if (!listing) {
      throw new Error('Listing not found');
    }

    if (listing.status !== 'active') {
      throw new Error('Listing is no longer active');
    }

    // In production, this would:
    // 1. Transfer SOL from buyer to seller
    // 2. Transfer NFT from escrow to buyer
    // 3. Update listing status

    const trade: Trade = {
      id: `trade_${Date.now()}`,
      listingId,
      buyer: buyerPublicKey,
      seller: listing.seller,
      price: listing.price,
      txSignature: `sim_${Date.now()}`, // Simulated signature
      completedAt: new Date()
    };

    listing.status = 'sold';
    trades.push(trade);

    console.log(`[Marketplace] Sale completed: ${listing.nftMint} sold for ${listing.price} SOL`);

    return trade;
  }

  /**
   * Cancel a listing
   */
  async cancelListing(listingId: string, sellerPublicKey: string): Promise<boolean> {
    const listing = listings.get(listingId);

    if (!listing) {
      throw new Error('Listing not found');
    }

    if (listing.seller !== sellerPublicKey) {
      throw new Error('Only the seller can cancel this listing');
    }

    if (listing.status !== 'active') {
      throw new Error('Listing is not active');
    }

    listing.status = 'cancelled';

    console.log(`[Marketplace] Listing ${listingId} cancelled`);

    return true;
  }

  /**
   * Get user's listings
   */
  async getUserListings(userPublicKey: string): Promise<Listing[]> {
    return Array.from(listings.values()).filter(l => l.seller === userPublicKey);
  }

  /**
   * Get user's trade history
   */
  async getUserTrades(userPublicKey: string): Promise<Trade[]> {
    return trades.filter(t => t.buyer === userPublicKey || t.seller === userPublicKey);
  }

  /**
   * Get marketplace statistics
   */
  async getStatistics(): Promise<{
    totalListings: number;
    activeListings: number;
    totalVolume: number;
    averagePrice: number;
  }> {
    const allListings = Array.from(listings.values());
    const completedTrades = trades;

    const totalVolume = completedTrades.reduce((sum, t) => sum + t.price, 0);
    const averagePrice = completedTrades.length > 0
      ? totalVolume / completedTrades.length
      : 0;

    return {
      totalListings: allListings.length,
      activeListings: allListings.filter(l => l.status === 'active').length,
      totalVolume,
      averagePrice
    };
  }

  /**
   * Make an offer on a listing (negotiation feature)
   */
  async makeOffer(
    listingId: string,
    buyerPublicKey: string,
    offerPrice: number
  ): Promise<{ accepted: boolean; message: string }> {
    const listing = listings.get(listingId);

    if (!listing) {
      throw new Error('Listing not found');
    }

    // Auto-accept if offer is >= 90% of asking price
    if (offerPrice >= listing.price * 0.9) {
      return {
        accepted: true,
        message: 'Offer accepted! Proceed with purchase.'
      };
    }

    return {
      accepted: false,
      message: `Offer of ${offerPrice} SOL is below minimum (${listing.price * 0.9} SOL)`
    };
  }
}

export const marketplaceService = new MarketplaceService();
