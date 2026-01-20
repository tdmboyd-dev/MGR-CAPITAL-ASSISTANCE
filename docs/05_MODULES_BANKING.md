# Banking & Payout Module — MGR Capital Assistance

The Banking Module handles all money flow, fee splits, commissions, and payouts.

## 1. Internal Ledger

Tracks:
- Incoming funds.
- Founder share.
- Employee commissions.
- Client payouts.
- Overrides.
- Audit logs.

## 2. Fee Splitting

Founder sets:
- Fee percent (e.g., 30% of surplus).
- Employee displayed rate.
- Employee actual rate.
- Override rates.

## 3. Payout Flow

1. Funds received (escrow or attorney trust).
2. Ledger logs amount.
3. System calculates:
   - Founder share.
   - Employee commission.
   - Overrides.
4. System triggers:
   - Employee direct deposit.
   - Client payout.
5. Case locked.

## 4. Direct Deposit

Employees enter:
- Routing number.
- Account number.

System handles:
- ACH payouts.
- Logs.
- Notifications.

## 5. Founder Visibility

Founder sees:
- Real surplus.
- Real fee.
- Real payouts.
- Real overrides.