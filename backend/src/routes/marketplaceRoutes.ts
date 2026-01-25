import { Router, Request, Response } from 'express';
import { marketplaceService } from '../services/MarketplaceService.js';

const router = Router();

/**
 * GET /api/marketplace/listings
 * Get all active listings
 */
router.get('/listings', async (req: Request, res: Response) => {
  try {
    const listings = await marketplaceService.getActiveListings();
    res.json(listings);
  } catch (error) {
    console.error('Get listings error:', error);
    res.status(500).json({ error: 'Failed to get listings' });
  }
});

/**
 * GET /api/marketplace/listings/:id
 * Get a specific listing
 */
router.get('/listings/:id', async (req: Request, res: Response) => {
  try {
    const listing = await marketplaceService.getListing(req.params.id);

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    res.json(listing);
  } catch (error) {
    console.error('Get listing error:', error);
    res.status(500).json({ error: 'Failed to get listing' });
  }
});

/**
 * POST /api/marketplace/list
 * Create a new listing
 */
router.post('/list', async (req: Request, res: Response) => {
  try {
    const { nftMint, price, claimId, claimAmount, sellerPublicKey } = req.body;

    if (!nftMint || !price || !claimId || !sellerPublicKey) {
      return res.status(400).json({
        error: 'Missing required fields: nftMint, price, claimId, sellerPublicKey'
      });
    }

    const listing = await marketplaceService.listForSale(
      nftMint,
      price,
      claimId,
      claimAmount || 0,
      sellerPublicKey
    );

    res.status(201).json(listing);
  } catch (error) {
    console.error('Create listing error:', error);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

/**
 * POST /api/marketplace/buy
 * Buy a listing
 */
router.post('/buy', async (req: Request, res: Response) => {
  try {
    const { listingId, buyerPublicKey } = req.body;

    if (!listingId || !buyerPublicKey) {
      return res.status(400).json({
        error: 'Missing required fields: listingId, buyerPublicKey'
      });
    }

    const trade = await marketplaceService.buyListing(listingId, buyerPublicKey);

    res.json(trade);
  } catch (error: any) {
    console.error('Buy listing error:', error);
    res.status(400).json({ error: error.message || 'Failed to buy listing' });
  }
});

/**
 * POST /api/marketplace/cancel/:id
 * Cancel a listing
 */
router.post('/cancel/:id', async (req: Request, res: Response) => {
  try {
    const { sellerPublicKey } = req.body;

    if (!sellerPublicKey) {
      return res.status(400).json({ error: 'sellerPublicKey required' });
    }

    const result = await marketplaceService.cancelListing(req.params.id, sellerPublicKey);

    res.json({ success: result });
  } catch (error: any) {
    console.error('Cancel listing error:', error);
    res.status(400).json({ error: error.message || 'Failed to cancel listing' });
  }
});

/**
 * GET /api/marketplace/stats
 * Get marketplace statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await marketplaceService.getStatistics();
    res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

/**
 * GET /api/marketplace/user/:address
 * Get user's listings and trades
 */
router.get('/user/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    const [listings, trades] = await Promise.all([
      marketplaceService.getUserListings(address),
      marketplaceService.getUserTrades(address)
    ]);

    res.json({
      listings,
      trades
    });
  } catch (error) {
    console.error('Get user data error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

/**
 * POST /api/marketplace/offer
 * Make an offer on a listing
 */
router.post('/offer', async (req: Request, res: Response) => {
  try {
    const { listingId, buyerPublicKey, offerPrice } = req.body;

    if (!listingId || !buyerPublicKey || offerPrice === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: listingId, buyerPublicKey, offerPrice'
      });
    }

    const result = await marketplaceService.makeOffer(listingId, buyerPublicKey, offerPrice);

    res.json(result);
  } catch (error: any) {
    console.error('Make offer error:', error);
    res.status(400).json({ error: error.message || 'Failed to make offer' });
  }
});

export default router;
