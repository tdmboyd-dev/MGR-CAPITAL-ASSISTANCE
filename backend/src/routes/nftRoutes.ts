/**
 * NFT Routes — MGR CAPITAL ASSISTANCE
 * Surplus Claim NFT Minting and Management
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { nftService } from '../services/NFTService.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/nft/mint
 * Mint a new claim NFT
 */
router.post('/mint', authenticate, async (req, res) => {
  try {
    const { claimId, amount, state, propertyId, ownerAddress, clientName } = req.body;

    if (!claimId || !amount || !state || !propertyId) {
      return res.status(400).json({
        error: 'Missing required fields: claimId, amount, state, propertyId',
      });
    }

    const result = await nftService.mintClaimNFT({
      claimId,
      amount,
      state,
      propertyId,
      ownerAddress: ownerAddress || 'platform',
      clientName: clientName || 'Unknown',
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    logger.error('NFT minting failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/nft/list
 * List all minted NFTs
 */
router.get('/list', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    const nfts = await nftService.listMintedNFTs(limit);

    res.json({ success: true, data: nfts });
  } catch (error: any) {
    logger.error('NFT list failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/nft/:mintAddress
 * Get NFT details
 */
router.get('/:mintAddress', authenticate, async (req, res) => {
  try {
    const { mintAddress } = req.params;

    const nft = await nftService.getNFTDetails(mintAddress);

    if (!nft) {
      return res.status(404).json({ error: 'NFT not found' });
    }

    res.json({ success: true, data: nft });
  } catch (error: any) {
    logger.error('NFT details fetch failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/nft/transfer
 * Transfer NFT ownership
 */
router.post('/transfer', authenticate, async (req, res) => {
  try {
    const { mintAddress, fromAddress, toAddress } = req.body;

    if (!mintAddress || !fromAddress || !toAddress) {
      return res.status(400).json({
        error: 'Missing required fields: mintAddress, fromAddress, toAddress',
      });
    }

    const result = await nftService.transferNFT(mintAddress, fromAddress, toAddress);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ success: true, txId: result.txId });
  } catch (error: any) {
    logger.error('NFT transfer failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/nft/burn/:mintAddress
 * Burn an NFT after claim resolution
 */
router.post('/burn/:mintAddress', authenticate, async (req, res) => {
  try {
    const { mintAddress } = req.params;

    const result = await nftService.burnNFT(mintAddress);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ success: true, message: 'NFT burned successfully' });
  } catch (error: any) {
    logger.error('NFT burn failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
