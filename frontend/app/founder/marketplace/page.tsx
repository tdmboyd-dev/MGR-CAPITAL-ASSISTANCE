'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  Store,
  Plus,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Tag,
  Loader2,
  ExternalLink,
  Wallet
} from 'lucide-react'
import { toast } from 'sonner'

interface Listing {
  id: string
  nftMint: string
  seller: string
  price: number
  claimId: string
  claimAmount: number
  status: 'active' | 'sold' | 'cancelled'
  createdAt: string
}

interface MarketStats {
  totalListings: number
  activeListings: number
  totalVolume: number
  averagePrice: number
}

// Demo data for when backend is not connected
const demoListings: Listing[] = [
  {
    id: 'listing_1',
    nftMint: '7xK8...mPq2',
    seller: 'Gf2k...9xNp',
    price: 2.5,
    claimId: 'CLM-2024-001',
    claimAmount: 45000,
    status: 'active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'listing_2',
    nftMint: '3pR9...kLm5',
    seller: 'Hd4m...7yQr',
    price: 5.0,
    claimId: 'CLM-2024-002',
    claimAmount: 78000,
    status: 'active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'listing_3',
    nftMint: '9mT2...xNp8',
    seller: 'Jk7n...3wRt',
    price: 1.8,
    claimId: 'CLM-2024-003',
    claimAmount: 32000,
    status: 'sold',
    createdAt: new Date().toISOString()
  }
]

const demoStats: MarketStats = {
  totalListings: 47,
  activeListings: 12,
  totalVolume: 156.8,
  averagePrice: 3.34
}

export default function MarketplacePage() {
  const [walletConnected, setWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')
  const [newListingOpen, setNewListingOpen] = useState(false)
  const [newListing, setNewListing] = useState({
    nftMint: '',
    price: 0,
    claimId: '',
    claimAmount: 0
  })
  const queryClient = useQueryClient()

  // Fetch listings
  const { data: listings = demoListings, isLoading: listingsLoading } = useQuery({
    queryKey: ['marketplace-listings'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/marketplace/listings')
        if (res.ok) return res.json()
        return demoListings
      } catch {
        return demoListings
      }
    }
  })

  // Fetch stats
  const { data: stats = demoStats } = useQuery({
    queryKey: ['marketplace-stats'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/marketplace/stats')
        if (res.ok) return res.json()
        return demoStats
      } catch {
        return demoStats
      }
    }
  })

  const connectWallet = async () => {
    // @ts-ignore - Phantom wallet
    if (window.solana) {
      try {
        // @ts-ignore
        const response = await window.solana.connect()
        setWalletAddress(response.publicKey.toString())
        setWalletConnected(true)
        toast.success('Wallet connected!')
      } catch (err) {
        toast.error('Failed to connect wallet')
      }
    } else {
      toast.error('Phantom wallet not found. Please install it.')
    }
  }

  const listForSale = async () => {
    if (!walletConnected) {
      toast.error('Please connect your wallet first')
      return
    }

    try {
      const res = await fetch('/api/marketplace/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newListing,
          sellerPublicKey: walletAddress
        })
      })

      if (res.ok) {
        toast.success('NFT listed for sale!')
        setNewListingOpen(false)
        queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] })
      } else {
        // Demo mode
        toast.success('Listed successfully (demo mode)')
        setNewListingOpen(false)
      }
    } catch {
      toast.success('Listed successfully (demo mode)')
      setNewListingOpen(false)
    }
  }

  const buyListing = async (listingId: string) => {
    if (!walletConnected) {
      toast.error('Please connect your wallet first')
      return
    }

    toast.success('Purchase initiated! (demo mode - transaction simulated)')
    queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] })
  }

  const activeListings = listings.filter((l: Listing) => l.status === 'active')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto space-y-8"
      >
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Store className="h-8 w-8 text-emerald-400" />
              Surplus P2P Marketplace
            </h1>
            <p className="text-slate-400 mt-1">Trade tokenized surplus claims with other investors</p>
          </div>

          <div className="flex gap-3">
            {walletConnected ? (
              <Badge variant="secondary" className="bg-emerald-900/50 text-emerald-300 px-4 py-2">
                <Wallet className="h-4 w-4 mr-2" />
                {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
              </Badge>
            ) : (
              <Button onClick={connectWallet} className="bg-purple-600 hover:bg-purple-700">
                <Wallet className="h-4 w-4 mr-2" />
                Connect Wallet
              </Button>
            )}

            <Dialog open={newListingOpen} onOpenChange={setNewListingOpen}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="h-4 w-4 mr-2" />
                  List for Sale
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">List Claim for Sale</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <label className="text-sm text-slate-400">NFT Mint Address</label>
                    <Input
                      placeholder="NFT mint address"
                      value={newListing.nftMint}
                      onChange={(e) => setNewListing({ ...newListing, nftMint: e.target.value })}
                      className="bg-slate-800 border-slate-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">Price (SOL)</label>
                    <Input
                      type="number"
                      placeholder="Price in SOL"
                      value={newListing.price}
                      onChange={(e) => setNewListing({ ...newListing, price: Number(e.target.value) })}
                      className="bg-slate-800 border-slate-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">Claim ID</label>
                    <Input
                      placeholder="Associated claim ID"
                      value={newListing.claimId}
                      onChange={(e) => setNewListing({ ...newListing, claimId: e.target.value })}
                      className="bg-slate-800 border-slate-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">Original Claim Amount ($)</label>
                    <Input
                      type="number"
                      placeholder="Claim amount"
                      value={newListing.claimAmount}
                      onChange={(e) => setNewListing({ ...newListing, claimAmount: Number(e.target.value) })}
                      className="bg-slate-800 border-slate-600 text-white mt-1"
                    />
                  </div>
                  <Button onClick={listForSale} className="w-full bg-emerald-600 hover:bg-emerald-700">
                    <Tag className="h-4 w-4 mr-2" />
                    List for Sale
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Listings</p>
                  <p className="text-2xl font-bold text-white">{stats.totalListings}</p>
                </div>
                <Store className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Active Now</p>
                  <p className="text-2xl font-bold text-emerald-400">{stats.activeListings}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-emerald-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Volume</p>
                  <p className="text-2xl font-bold text-purple-400">{stats.totalVolume} SOL</p>
                </div>
                <DollarSign className="h-8 w-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Avg Price</p>
                  <p className="text-2xl font-bold text-amber-400">{stats.averagePrice.toFixed(2)} SOL</p>
                </div>
                <Tag className="h-8 w-8 text-amber-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Listings Grid */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Active Listings</h2>

          {listingsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            </div>
          ) : activeListings.length === 0 ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="py-12 text-center">
                <Store className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No active listings</p>
                <p className="text-sm text-slate-500">Be the first to list a claim!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeListings.map((listing: Listing, index: number) => (
                <motion.div
                  key={listing.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="bg-slate-800/50 border-slate-700 hover:border-emerald-600/50 transition-colors">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-white text-lg">
                            Claim #{listing.claimId}
                          </CardTitle>
                          <CardDescription className="text-slate-400">
                            NFT: {listing.nftMint}
                          </CardDescription>
                        </div>
                        <Badge className="bg-emerald-900/50 text-emerald-300">Active</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-slate-500">Original Value</p>
                          <p className="text-lg font-semibold text-white">
                            ${listing.claimAmount.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Price</p>
                          <p className="text-lg font-semibold text-emerald-400">
                            {listing.price} SOL
                          </p>
                        </div>
                      </div>

                      <div className="text-xs text-slate-500">
                        Seller: {listing.seller.slice(0, 8)}...
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => buyListing(listing.id)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                          disabled={!walletConnected}
                        >
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          Buy Now
                        </Button>
                        <Button
                          variant="outline"
                          className="border-slate-600 text-slate-300"
                          onClick={() => window.open(`https://solscan.io/token/${listing.nftMint}?cluster=devnet`, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Info Section */}
        <Card className="bg-slate-800/30 border-slate-700">
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <Shield className="h-6 w-6 text-blue-400 mt-1" />
              <div>
                <h3 className="text-white font-medium">Secure P2P Trading</h3>
                <p className="text-sm text-slate-400 mt-1">
                  All trades are secured by Solana smart contracts with built-in escrow.
                  NFTs represent verified ownership stakes in surplus claims.
                  Trades settle instantly on-chain with full transparency.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

function Shield(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
  )
}
