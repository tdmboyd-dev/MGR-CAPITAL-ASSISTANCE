/**
 * Auction Routes — MGR CAPITAL ASSISTANCE
 * Blockchain Surplus Auction API
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { auctionService } from '../services/AuctionService.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/auctions
 * Create a new auction
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      claimId,
      nftMintAddress,
      title,
      description,
      surplusAmount,
      minimumBid,
      startTime,
      endTime,
      fractions,
      propertyAddress,
      state,
      imageUrl,
    } = req.body;

    if (!claimId || !title || !surplusAmount || !minimumBid || !startTime || !endTime || !state) {
      return res.status(400).json({
        error: 'Missing required fields',
      });
    }

    const auction = await auctionService.createAuction({
      claimId,
      nftMintAddress: nftMintAddress || '',
      title,
      description: description || '',
      surplusAmount,
      minimumBid,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      fractions,
      propertyAddress,
      state,
      imageUrl,
    });

    res.status(201).json({ success: true, data: auction });
  } catch (error: any) {
    logger.error('Auction creation failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auctions
 * List auctions with optional filters
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, state, minValue, maxValue } = req.query;

    const auctions = await auctionService.listAuctions({
      status: status as any,
      state: state as string,
      minValue: minValue ? Number(minValue) : undefined,
      maxValue: maxValue ? Number(maxValue) : undefined,
    });

    res.json({ success: true, data: auctions });
  } catch (error: any) {
    logger.error('List auctions failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auctions/statistics
 * Get auction platform statistics
 */
router.get('/statistics', authenticate, async (req, res) => {
  try {
    const stats = await auctionService.getStatistics();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    logger.error('Get statistics failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auctions/:auctionId
 * Get auction details
 */
router.get('/:auctionId', authenticate, async (req, res) => {
  try {
    const { auctionId } = req.params;

    const auction = await auctionService.getAuction(auctionId);

    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    res.json({ success: true, data: auction });
  } catch (error: any) {
    logger.error('Get auction failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auctions/:auctionId/bid
 * Place a bid on an auction
 */
router.post('/:auctionId/bid', authenticate, async (req, res) => {
  try {
    const { auctionId } = req.params;
    const { bidderAddress, amount, fractionCount, bidderName } = req.body;

    if (!bidderAddress || !amount) {
      return res.status(400).json({
        error: 'Missing required fields: bidderAddress, amount',
      });
    }

    const result = await auctionService.placeBid(
      auctionId,
      bidderAddress,
      amount,
      fractionCount || 1,
      bidderName
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, data: result.bid });
  } catch (error: any) {
    logger.error('Bid placement failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auctions/:auctionId/buy-fractions
 * Buy fractional shares directly
 */
router.post('/:auctionId/buy-fractions', authenticate, async (req, res) => {
  try {
    const { auctionId } = req.params;
    const { buyerAddress, fractionCount, buyerName } = req.body;

    if (!buyerAddress || !fractionCount) {
      return res.status(400).json({
        error: 'Missing required fields: buyerAddress, fractionCount',
      });
    }

    const result = await auctionService.buyFractions(
      auctionId,
      buyerAddress,
      fractionCount,
      buyerName
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, data: result.ownership });
  } catch (error: any) {
    logger.error('Fractional purchase failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auctions/:auctionId/bids
 * Get bid history for auction
 */
router.get('/:auctionId/bids', authenticate, async (req, res) => {
  try {
    const { auctionId } = req.params;

    const bids = await auctionService.getBidHistory(auctionId);

    res.json({ success: true, data: bids });
  } catch (error: any) {
    logger.error('Get bids failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auctions/user/:walletAddress/bids
 * Get all bids by a user
 */
router.get('/user/:walletAddress/bids', authenticate, async (req, res) => {
  try {
    const { walletAddress } = req.params;

    const bids = await auctionService.getUserBids(walletAddress);

    res.json({ success: true, data: bids });
  } catch (error: any) {
    logger.error('Get user bids failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auctions/:auctionId/end
 * Manually end an auction
 */
router.post('/:auctionId/end', authenticate, async (req, res) => {
  try {
    const { auctionId } = req.params;

    const result = await auctionService.endAuction(auctionId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, winner: result.winner });
  } catch (error: any) {
    logger.error('End auction failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auctions/:auctionId/cancel
 * Cancel an auction
 */
router.post('/:auctionId/cancel', authenticate, async (req, res) => {
  try {
    const { auctionId } = req.params;

    const result = await auctionService.cancelAuction(auctionId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, message: 'Auction cancelled' });
  } catch (error: any) {
    logger.error('Cancel auction failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
