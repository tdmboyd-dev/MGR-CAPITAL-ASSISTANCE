# MGR BEAST Evidence Scorecard

Updated: 2026-09-30

## Denominator
Nine evidence gates per capability:
1. requirements known
2. dependencies mapped
3. required research complete
4. architecture/spec defined
5. implementation exists
6. intended integration exists
7. failure paths exercised
8. required tests executed
9. acceptance criteria verified

Current % = evidenced gates / 9. This is evidence maturity, not subjective quality.

| Capability | Gates | % | Main missing evidence |
|---|---:|---:|---|
| Auth/RBAC | 5/9 | 56% | Current-head API/security tests + acceptance |
| Case lifecycle | 5/9 | 56% | State/ownership/E2E suite |
| Collaboration WebSocket | 5/9 | 56% | Replay/cross-case/browser attack tests |
| Generic payments | 5/9 | 56% | Sandbox provider tests + reconciliation |
| Nickel | 3/9 | 33% | Research/spec/rebuild/test/verify |
| Skip trace | 5/9 | 56% | Current Tracerfy contract + live sandbox |
| OpenSign | 3/9 | 33% | Research/spec/rebuild/test/verify |
| Legal audit | 4/9 | 44% | Primary-source rule validation + testing |
| RON identity/KBA | 2/9 | 22% | Research/provider/spec/build/test/verify |
| Trust automation | 4/9 | 44% | Legal authority + workflow tests |
| Blockchain proof | 2/9 | 22% | Decide real implementation vs removal |
| Storage/vault | 4/9 | 44% | Provider integrity/E2E |
| Email/inbox/hosting | 4/9 | 44% | Current provider contract/E2E |
| Lead generation/scraping | 4/9 | 44% | TOS/data-quality/current-site validation |
| Bots/autopilot | 4/9 | 44% | Action authority/idempotency/adversarial tests |
| Next frontend | 6/9 | 67% | Current-head build/browser acceptance |
| Legacy Vite | 4/9 | 44% | Current-head build + retirement decision |
| Mobile | 3/9 | 33% | Build/device/E2E |
| Docker/Nginx deploy | 5/9 | 56% | Current runtime/container proof |
| CI evidence system | 4/9 | 44% | Successful current-head run |
| Credential hygiene | 5/9 | 56% | Rotate exposed credential; history decision |
| Backup/restore | 3/9 | 33% | Executed restore drill |
| State/county legal rules | 3/9 | 33% | Primary-source provenance + current-law verification |

## Whole-repo evidence maturity
Numerator: 93 evidenced capability gates
Denominator: 207 total gates (23 capabilities × 9)
Current evidence maturity: **44.9%**

This replaces unsupported historical “98–100%” claims.
