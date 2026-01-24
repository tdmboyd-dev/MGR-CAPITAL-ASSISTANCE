"use client";

/**
 * Payout Button — MGR CAPITAL ASSISTANCE
 * Phase 21: Blockchain Payout UI
 *
 * Allows founders to execute ETH payouts for cases.
 * Includes wallet connection and transaction confirmation.
 */

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Wallet, Loader2, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface PayoutButtonProps {
  caseId: string;
  amountCents: number;
  recipientName?: string;
  disabled?: boolean;
}

export function PayoutButton({
  caseId,
  amountCents,
  recipientName,
  disabled = false,
}: PayoutButtonProps) {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);

  // Check if blockchain is enabled
  const { data: statusData } = useQuery({
    queryKey: ["blockchain-status"],
    queryFn: async () => {
      const { data } = await api.get("/blockchain/status");
      return data;
    },
  });

  // Get current gas price
  const { data: gasPriceData } = useQuery({
    queryKey: ["blockchain-gas-price"],
    queryFn: async () => {
      const { data } = await api.get("/blockchain/gas-price");
      return data;
    },
    enabled: open && statusData?.enabled,
  });

  // Payout mutation
  const payoutMutation = useMutation({
    mutationFn: async (data: { recipientAddress: string; amountCents: number }) => {
      const response = await api.post(`/blockchain/payout/${caseId}`, data);
      return response.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        setTxHash(data.txHash);
        toast.success("Payout executed successfully!", {
          description: `TX: ${data.txHash.slice(0, 10)}...${data.txHash.slice(-8)}`,
        });
      } else {
        toast.error("Payout failed", {
          description: data.error,
        });
      }
    },
    onError: (error: any) => {
      toast.error("Payout failed", {
        description: error.response?.data?.error || "Unknown error",
      });
    },
  });

  const handlePayout = () => {
    if (!address) {
      toast.error("Please enter a recipient address");
      return;
    }

    // Basic Ethereum address validation
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      toast.error("Invalid Ethereum address format");
      return;
    }

    payoutMutation.mutate({
      recipientAddress: address,
      amountCents,
    });
  };

  const handleClose = () => {
    setOpen(false);
    setAddress("");
    setTxHash(null);
    payoutMutation.reset();
  };

  const isBlockchainEnabled = statusData?.enabled ?? false;

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        disabled={disabled || !isBlockchainEnabled}
        variant="outline"
        className="gap-2"
        data-cy="payout-button"
      >
        <Wallet className="h-4 w-4" />
        {isBlockchainEnabled ? "Payout" : "Blockchain Disabled"}
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Blockchain Payout
            </DialogTitle>
            <DialogDescription>
              Send {formatCurrency(amountCents / 100)} to {recipientName || "recipient"} via
              Ethereum
            </DialogDescription>
          </DialogHeader>

          {txHash ? (
            // Success state
            <div className="py-6 text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <div>
                <p className="font-semibold text-lg">Payout Successful!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Transaction has been submitted to the network.
                </p>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Transaction Hash</p>
                <code className="text-xs break-all">{txHash}</code>
              </div>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() =>
                  window.open(`https://sepolia.etherscan.io/tx/${txHash}`, "_blank")
                }
              >
                <ExternalLink className="h-4 w-4" />
                View on Etherscan
              </Button>
            </div>
          ) : (
            // Input state
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <div className="text-2xl font-bold">{formatCurrency(amountCents / 100)}</div>
                <p className="text-xs text-muted-foreground">
                  Converted to ETH at current rate
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Recipient Address</Label>
                <Input
                  id="address"
                  placeholder="0x..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  data-cy="address-input"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the Ethereum wallet address
                </p>
              </div>

              {gasPriceData && (
                <div className="bg-muted rounded-lg p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gas Price</span>
                    <span>{gasPriceData.gasPrice}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">Network</span>
                    <span>Sepolia (Testnet)</span>
                  </div>
                </div>
              )}

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                  This action cannot be undone. Please verify the recipient address before
                  confirming.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            {txHash ? (
              <Button onClick={handleClose}>Close</Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handlePayout}
                  disabled={payoutMutation.isPending || !address}
                  data-cy="confirm-payout"
                >
                  {payoutMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Confirm Payout"
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
