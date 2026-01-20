# Ingestion Module — MGR Capital Assistance

The Ingestion Module collects surplus-related data from all 50 states.

## 1. Data Sources

- County tax sale websites.
- Court surplus lists.
- Auction results.
- Sheriff sale results.
- Public notices.
- State unclaimed funds (when relevant).

## 2. Data Extraction

AI extracts:
- Owner name.
- Address.
- Sale price.
- Minimum bid.
- Surplus amount.
- Case number.
- Redemption period.
- Filing deadline.

## 3. Case Creation

System creates:
- Internal case ID.
- Assigned employee (if auto-assignment enabled).
- Hidden surplus amount.
- Hidden county/state.
- Visible client info.

## 4. Auto-Assignment

Based on:
- Employee availability.
- Performance.
- Territory.
- Random rotation.

## 5. Founder Controls

Founder can:
- Enable/disable states.
- Enable/disable counties.
- Adjust ingestion frequency.
- Override assignments.