'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Coins, Link2, Loader2, ExternalLink, CheckCircle, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'

export default function NFTMintingDashboard() {
  const [claimId, setClaimId] = useState('')
  const [amount, setAmount] = useState('')
  const [state, setState] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [ownerAddress, setOwnerAddress] = useState('')
  const [minted, setMinted] = useState<{ mintAddress: string; metadataUri: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const { data: nfts, refetch: refetchNFTs } = useQuery({
    queryKey: ['minted-nfts'],
    queryFn: async () => {
      const res = await fetch('/api/nft/list', { credentials: 'include' })
      if (!res.ok) return { data: [] }
      return res.json()
    },
  })

  const mint = async () => {
    if (!claimId || !amount || !state || !propertyId) {
      toast.error('Please fill all required fields')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/nft/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          claimId,
          amount: parseFloat(amount),
          state,
          propertyId,
          ownerAddress: ownerAddress || 'self',
        }),
      })

      if (!res.ok) throw new Error('Minting failed')

      const data = await res.json()
      setMinted(data.data)
      toast.success('NFT minted successfully!')
      refetchNFTs()
    } catch (err) {
      toast.error('Failed to mint NFT')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8 p-8"
    >
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          Surplus Claim NFT Minting
        </h1>
        <p className="text-muted-foreground mt-1">
          Mint surplus claims as NFTs for fractional ownership and blockchain verification
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-lg bg-gradient-to-br from-purple-50 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/20 rounded-full">
                <Coins className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Minted</p>
                <p className="text-3xl font-bold text-purple-600">{nfts?.data?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/20 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Verified on Chain</p>
                <p className="text-3xl font-bold text-green-600">{nfts?.data?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-full">
                <Link2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-3xl font-bold text-blue-600">
                  ${(nfts?.data?.reduce((sum: number, n: any) => sum + (n.amount || 0), 0) || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mint Form */}
      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle>Mint New Claim NFT</CardTitle>
          <CardDescription>
            Create a blockchain-verified NFT representing ownership of surplus funds
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="claimId">Claim ID / Case ID *</Label>
              <Input
                id="claimId"
                value={claimId}
                onChange={(e) => setClaimId(e.target.value)}
                placeholder="case_abc123"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="amount">Estimated Amount *</Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="25000"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="state">State *</Label>
              <Input
                id="state"
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase())}
                placeholder="FL"
                maxLength={2}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="propertyId">Property ID / Parcel *</Label>
              <Input
                id="propertyId"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                placeholder="12-34-56-789"
                className="mt-1"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="ownerAddress">Owner Wallet Address (optional)</Label>
              <Input
                id="ownerAddress"
                value={ownerAddress}
                onChange={(e) => setOwnerAddress(e.target.value)}
                placeholder="Leave blank to assign to platform wallet"
                className="mt-1"
              />
            </div>
          </div>

          <Button onClick={mint} disabled={loading} size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Minting...
              </>
            ) : (
              <>
                <Coins className="mr-2 h-4 w-4" />
                Mint NFT
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Success Message */}
      <AnimatePresence>
        {minted && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="border-green-300 bg-green-50 dark:bg-green-900/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="h-5 w-5" />
                  NFT Minted Successfully!
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Mint Address</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="bg-muted px-2 py-1 rounded text-sm flex-1 truncate">
                      {minted.mintAddress}
                    </code>
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(minted.mintAddress)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Metadata URI</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="bg-muted px-2 py-1 rounded text-sm flex-1 truncate">
                      {minted.metadataUri}
                    </code>
                    <Button size="sm" variant="ghost" asChild>
                      <a href={minted.metadataUri} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minted NFTs List */}
      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle>Minted Claim NFTs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(nfts?.data || []).map((nft: any, i: number) => (
              <motion.div
                key={nft.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 border rounded-lg flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Coins className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium">Claim #{nft.caseId?.slice(0, 8)}</p>
                    <p className="text-sm text-muted-foreground">
                      Minted {new Date(nft.mintedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">${(nft.amount || 0).toLocaleString()}</p>
                  <Badge variant="outline" className="mt-1">
                    {nft.mintAddress?.slice(0, 12)}...
                  </Badge>
                </div>
              </motion.div>
            ))}
            {(!nfts?.data || nfts.data.length === 0) && (
              <p className="text-center text-muted-foreground py-8">No NFTs minted yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
