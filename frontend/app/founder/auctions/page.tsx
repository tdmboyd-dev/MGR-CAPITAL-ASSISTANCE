'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import useWebSocket from 'react-use-websocket'
import {
  Gavel,
  DollarSign,
  Clock,
  TrendingUp,
  Users,
  Wallet,
  Plus,
  ArrowUp,
  ArrowDown,
  Zap,
  BarChart3,
  Timer,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Coins,
  PieChart
} from 'lucide-react'

interface Bid {
  id: string
  bidderAddress: string
  bidderName?: string
  amount: number
  fractionCount: number
  timestamp: Date
  status: 'pending' | 'confirmed' | 'outbid' | 'won'
}

interface Auction {
  id: string
  claimId: string
  nftMintAddress: string
  title: string
  description: string
  surplusAmount: number
  minimumBid: number
  currentBid: number
  currentBidder?: string
  startTime: Date
  endTime: Date
  status: 'upcoming' | 'active' | 'ended' | 'cancelled'
  fractions: number
  fractionsRemaining: number
  pricePerFraction: number
  bids: Bid[]
  propertyAddress?: string
  state: string
  imageUrl?: string
}

const DEMO_AUCTIONS: Auction[] = [
  {
    id: 'auction_demo_1',
    claimId: 'CLAIM-001',
    nftMintAddress: 'SOLANA_MINT_ABC123',
    title: 'Texas Property Surplus - Dallas County',
    description: 'Premium surplus claim from tax sale property in Dallas County. Verified ownership chain, ready for collection.',
    surplusAmount: 45000,
    minimumBid: 5000,
    currentBid: 12500,
    currentBidder: 'wallet_xyz123',
    startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    status: 'active',
    fractions: 100,
    fractionsRemaining: 65,
    pricePerFraction: 125,
    bids: [
      { id: 'bid_1', bidderAddress: 'wallet_xyz123', bidderName: 'Alice', amount: 12500, fractionCount: 10, timestamp: new Date(), status: 'confirmed' },
      { id: 'bid_2', bidderAddress: 'wallet_abc456', bidderName: 'Bob', amount: 10000, fractionCount: 8, timestamp: new Date(Date.now() - 3600000), status: 'outbid' },
    ],
    propertyAddress: '1234 Oak Lane, Dallas, TX 75201',
    state: 'TX'
  },
  {
    id: 'auction_demo_2',
    claimId: 'CLAIM-002',
    nftMintAddress: 'SOLANA_MINT_DEF456',
    title: 'Florida Surplus - Miami-Dade',
    description: 'High-value surplus claim with confirmed heir documentation. Ready for immediate payout.',
    surplusAmount: 78000,
    minimumBid: 10000,
    currentBid: 0,
    startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
    status: 'upcoming',
    fractions: 100,
    fractionsRemaining: 100,
    pricePerFraction: 100,
    bids: [],
    propertyAddress: '567 Beach Blvd, Miami, FL 33139',
    state: 'FL'
  },
  {
    id: 'auction_demo_3',
    claimId: 'CLAIM-003',
    nftMintAddress: 'SOLANA_MINT_GHI789',
    title: 'California Surplus - Los Angeles',
    description: 'Premium LA County surplus with verified documentation and clear title.',
    surplusAmount: 125000,
    minimumBid: 15000,
    currentBid: 32000,
    currentBidder: 'wallet_def789',
    startTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    status: 'ended',
    fractions: 100,
    fractionsRemaining: 0,
    pricePerFraction: 320,
    bids: [
      { id: 'bid_3', bidderAddress: 'wallet_def789', bidderName: 'Charlie', amount: 32000, fractionCount: 100, timestamp: new Date(), status: 'won' },
    ],
    propertyAddress: '890 Sunset Blvd, Los Angeles, CA 90028',
    state: 'CA'
  }
]

export default function AuctionsPage() {
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null)
  const [bidAmount, setBidAmount] = useState('')
  const [fractionsToBuy, setFractionsToBuy] = useState(1)
  const [showNewAuctionDialog, setShowNewAuctionDialog] = useState(false)
  const [walletConnected, setWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Fetch auctions
  const { data: auctions = DEMO_AUCTIONS, isLoading, refetch } = useQuery({
    queryKey: ['auctions', statusFilter],
    queryFn: async () => {
      // Return demo data
      return DEMO_AUCTIONS
    }
  })

  // WebSocket for real-time updates
  const { lastMessage } = useWebSocket('ws://localhost:4001/auctions', {
    onMessage: (msg) => {
      const data = JSON.parse(msg.data)
      if (data.type === 'bid:placed' || data.type === 'auction:extended') {
        refetch()
        toast.info('Auction updated!')
      }
    },
    shouldReconnect: () => true,
    reconnectInterval: 3000,
  })

  // Place bid mutation
  const bidMutation = useMutation({
    mutationFn: async ({ auctionId, amount }: { auctionId: string; amount: number }) => {
      return api.post(`/auctions/${auctionId}/bid`, {
        bidderAddress: walletAddress,
        amount,
        fractionCount: fractionsToBuy,
        bidderName: 'Demo User'
      })
    },
    onSuccess: () => {
      toast.success('Bid placed successfully!')
      setBidAmount('')
      refetch()
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to place bid')
    }
  })

  // Buy fractions mutation
  const buyFractionsMutation = useMutation({
    mutationFn: async ({ auctionId, count }: { auctionId: string; count: number }) => {
      return api.post(`/auctions/${auctionId}/buy-fractions`, {
        buyerAddress: walletAddress,
        fractionCount: count,
        buyerName: 'Demo User'
      })
    },
    onSuccess: () => {
      toast.success('Fractions purchased!')
      refetch()
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to purchase')
    }
  })

  const connectWallet = () => {
    // Mock wallet connection
    setWalletAddress('7xKX...9bR4')
    setWalletConnected(true)
    toast.success('Wallet connected!')
  }

  const formatTimeRemaining = (endTime: Date) => {
    const now = new Date()
    const diff = new Date(endTime).getTime() - now.getTime()

    if (diff <= 0) return 'Ended'

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const getStatusBadge = (status: Auction['status']) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500 animate-pulse">Live</Badge>
      case 'upcoming':
        return <Badge variant="secondary">Upcoming</Badge>
      case 'ended':
        return <Badge variant="outline">Ended</Badge>
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>
    }
  }

  const filteredAuctions = statusFilter === 'all'
    ? auctions
    : auctions.filter(a => a.status === statusFilter)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 dark:from-slate-950 dark:via-purple-950 dark:to-pink-950 p-8"
    >
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 bg-clip-text text-transparent flex items-center gap-3">
              <Gavel className="h-10 w-10 text-purple-600" />
              Blockchain Surplus Auctions
            </h1>
            <p className="text-muted-foreground mt-2">
              Buy and sell fractional surplus claims as NFTs on Solana
            </p>
          </div>

          <div className="flex gap-3">
            {walletConnected ? (
              <Button variant="outline" className="font-mono">
                <Wallet className="h-4 w-4 mr-2" />
                {walletAddress}
              </Button>
            ) : (
              <Button
                className="bg-gradient-to-r from-purple-600 to-pink-600"
                onClick={connectWallet}
              >
                <Wallet className="h-4 w-4 mr-2" />
                Connect Wallet
              </Button>
            )}

            <Dialog open={showNewAuctionDialog} onOpenChange={setShowNewAuctionDialog}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-purple-600 to-pink-600">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Auction
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Gavel className="h-5 w-5 text-purple-600" />
                    Create New Auction
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <p className="text-muted-foreground text-sm">
                    Create an auction to sell fractional ownership of a surplus claim NFT.
                  </p>
                  <Button className="w-full" disabled>
                    Coming Soon
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-none shadow-xl bg-gradient-to-br from-purple-500/10 to-purple-600/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Auctions</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {auctions.filter(a => a.status === 'active').length}
                    </p>
                  </div>
                  <Gavel className="h-10 w-10 text-purple-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-none shadow-xl bg-gradient-to-br from-green-500/10 to-green-600/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Value Locked</p>
                    <p className="text-3xl font-bold text-green-600">
                      ${auctions.reduce((sum, a) => sum + a.currentBid, 0).toLocaleString()}
                    </p>
                  </div>
                  <DollarSign className="h-10 w-10 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-none shadow-xl bg-gradient-to-br from-blue-500/10 to-blue-600/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Bids</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {auctions.reduce((sum, a) => sum + a.bids.length, 0)}
                    </p>
                  </div>
                  <TrendingUp className="h-10 w-10 text-blue-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="border-none shadow-xl bg-gradient-to-br from-pink-500/10 to-pink-600/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Surplus Available</p>
                    <p className="text-3xl font-bold text-pink-600">
                      ${auctions.reduce((sum, a) => sum + a.surplusAmount, 0).toLocaleString()}
                    </p>
                  </div>
                  <Coins className="h-10 w-10 text-pink-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Auctions</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="ended">Ended</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Auction Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredAuctions.map((auction, index) => (
              <motion.div
                key={auction.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card
                  className={`border-none shadow-2xl backdrop-blur-xl cursor-pointer transition-all hover:scale-[1.02] ${
                    selectedAuction?.id === auction.id
                      ? 'ring-2 ring-purple-500 bg-gradient-to-br from-purple-500/10 to-pink-500/10'
                      : 'bg-white/80 dark:bg-slate-900/80'
                  }`}
                  onClick={() => setSelectedAuction(auction)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{auction.title}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {auction.propertyAddress}
                        </p>
                      </div>
                      {getStatusBadge(auction.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Surplus Value</p>
                        <p className="text-xl font-bold text-green-600">
                          ${auction.surplusAmount.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Current Bid</p>
                        <p className="text-xl font-bold text-purple-600">
                          ${auction.currentBid.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {auction.status === 'active' && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Fractions Sold</span>
                          <span className="font-medium">
                            {auction.fractions - auction.fractionsRemaining}/{auction.fractions}
                          </span>
                        </div>
                        <Progress
                          value={((auction.fractions - auction.fractionsRemaining) / auction.fractions) * 100}
                          className="h-2"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2 text-sm">
                        <Timer className="h-4 w-4 text-orange-500" />
                        <span>
                          {auction.status === 'upcoming'
                            ? `Starts ${formatTimeRemaining(auction.startTime)}`
                            : formatTimeRemaining(auction.endTime)
                          }
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{auction.bids.length} bids</span>
                      </div>
                    </div>

                    {auction.status === 'active' && walletConnected && (
                      <Button
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedAuction(auction)
                        }}
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Place Bid
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Selected Auction Detail Panel */}
        <AnimatePresence>
          {selectedAuction && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              <Card className="border-none shadow-2xl backdrop-blur-xl bg-white/90 dark:bg-slate-900/90">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl flex items-center gap-3">
                        {selectedAuction.title}
                        {getStatusBadge(selectedAuction.status)}
                      </CardTitle>
                      <p className="text-muted-foreground mt-2">{selectedAuction.description}</p>
                    </div>
                    <Button variant="ghost" onClick={() => setSelectedAuction(null)}>
                      <XCircle className="h-5 w-5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="details">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="details">Details</TabsTrigger>
                      <TabsTrigger value="bids">Bid History</TabsTrigger>
                      <TabsTrigger value="fractions">Buy Fractions</TabsTrigger>
                    </TabsList>

                    <TabsContent value="details" className="space-y-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-4">
                        <div className="text-center p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/20">
                          <p className="text-sm text-muted-foreground">Surplus Value</p>
                          <p className="text-2xl font-bold text-green-600">
                            ${selectedAuction.surplusAmount.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-center p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/20">
                          <p className="text-sm text-muted-foreground">Current Bid</p>
                          <p className="text-2xl font-bold text-purple-600">
                            ${selectedAuction.currentBid.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-center p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/20">
                          <p className="text-sm text-muted-foreground">Minimum Bid</p>
                          <p className="text-2xl font-bold text-blue-600">
                            ${selectedAuction.minimumBid.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-center p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-red-500/20">
                          <p className="text-sm text-muted-foreground">Price/Fraction</p>
                          <p className="text-2xl font-bold text-orange-600">
                            ${selectedAuction.pricePerFraction.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <h4 className="font-semibold">Property Details</h4>
                          <div className="space-y-2 text-sm">
                            <p><span className="text-muted-foreground">Address:</span> {selectedAuction.propertyAddress}</p>
                            <p><span className="text-muted-foreground">State:</span> {selectedAuction.state}</p>
                            <p><span className="text-muted-foreground">Claim ID:</span> {selectedAuction.claimId}</p>
                            <p className="font-mono text-xs">
                              <span className="text-muted-foreground">NFT:</span> {selectedAuction.nftMintAddress}
                            </p>
                          </div>
                        </div>

                        {selectedAuction.status === 'active' && walletConnected && (
                          <div className="space-y-4">
                            <h4 className="font-semibold">Place Your Bid</h4>
                            <div>
                              <Label>Bid Amount ($)</Label>
                              <Input
                                type="number"
                                value={bidAmount}
                                onChange={(e) => setBidAmount(e.target.value)}
                                placeholder={`Min: $${selectedAuction.currentBid > 0 ? selectedAuction.currentBid + 100 : selectedAuction.minimumBid}`}
                              />
                            </div>
                            <Button
                              className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                              onClick={() => bidMutation.mutate({
                                auctionId: selectedAuction.id,
                                amount: Number(bidAmount)
                              })}
                              disabled={bidMutation.isPending || !bidAmount}
                            >
                              {bidMutation.isPending ? (
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Gavel className="h-4 w-4 mr-2" />
                              )}
                              Place Bid
                            </Button>
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="bids">
                      <div className="space-y-3 mt-4">
                        {selectedAuction.bids.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">No bids yet</p>
                        ) : (
                          selectedAuction.bids.map((bid, index) => (
                            <motion.div
                              key={bid.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className={`p-4 rounded-xl flex items-center justify-between ${
                                bid.status === 'won'
                                  ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500'
                                  : bid.status === 'outbid'
                                  ? 'bg-slate-100 dark:bg-slate-800 opacity-60'
                                  : 'bg-slate-50 dark:bg-slate-800'
                              }`}
                            >
                              <div>
                                <p className="font-medium">{bid.bidderName || bid.bidderAddress}</p>
                                <p className="text-sm text-muted-foreground">
                                  {new Date(bid.timestamp).toLocaleString()}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xl font-bold">${bid.amount.toLocaleString()}</p>
                                <Badge variant={bid.status === 'won' ? 'default' : 'secondary'}>
                                  {bid.status === 'won' && <CheckCircle className="h-3 w-3 mr-1" />}
                                  {bid.status}
                                </Badge>
                              </div>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="fractions">
                      <div className="space-y-6 mt-4">
                        <div className="text-center p-6 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10">
                          <PieChart className="h-12 w-12 mx-auto text-purple-600 mb-3" />
                          <p className="text-lg font-semibold">Fractional Ownership</p>
                          <p className="text-muted-foreground">
                            Own a piece of this ${selectedAuction.surplusAmount.toLocaleString()} surplus claim
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Available Fractions</p>
                            <p className="text-3xl font-bold text-purple-600">
                              {selectedAuction.fractionsRemaining}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Price per Fraction</p>
                            <p className="text-3xl font-bold text-green-600">
                              ${selectedAuction.pricePerFraction.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {walletConnected && selectedAuction.fractionsRemaining > 0 && (
                          <div className="space-y-4">
                            <div>
                              <Label>Number of Fractions</Label>
                              <Input
                                type="number"
                                min={1}
                                max={selectedAuction.fractionsRemaining}
                                value={fractionsToBuy}
                                onChange={(e) => setFractionsToBuy(Number(e.target.value))}
                              />
                              <p className="text-sm text-muted-foreground mt-1">
                                Total: ${(fractionsToBuy * selectedAuction.pricePerFraction).toFixed(2)}
                                ({((fractionsToBuy / selectedAuction.fractions) * 100).toFixed(1)}% ownership)
                              </p>
                            </div>
                            <Button
                              className="w-full bg-gradient-to-r from-green-600 to-emerald-600"
                              onClick={() => buyFractionsMutation.mutate({
                                auctionId: selectedAuction.id,
                                count: fractionsToBuy
                              })}
                              disabled={buyFractionsMutation.isPending}
                            >
                              {buyFractionsMutation.isPending ? (
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Coins className="h-4 w-4 mr-2" />
                              )}
                              Buy {fractionsToBuy} Fraction{fractionsToBuy > 1 ? 's' : ''}
                            </Button>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
