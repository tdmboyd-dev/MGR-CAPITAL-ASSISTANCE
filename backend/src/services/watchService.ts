// ============================================
// WATCH SERVICE — MGR CAPITAL ASSISTANCE
// OPS LAYER: Internal system monitoring
// FOUNDER ONLY — Never expose to employees/clients
// ============================================

import { PrismaClient, WatchAlertType, WatchAlertSeverity, CaseStatus } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================
// THRESHOLDS AND CONFIGURATION
// ============================================

const WATCH_THRESHOLDS = {
  // Payout anomalies
  LARGE_PAYOUT_CENTS: 10000000,      // $100,000 - flag large payouts
  PAYOUT_VARIANCE_PERCENT: 20,        // Flag if payout differs >20% from expected
  RAPID_PAYOUTS_WINDOW_HOURS: 24,     // Check for multiple payouts in window
  RAPID_PAYOUTS_COUNT: 5,             // Max payouts before flag

  // Employee anomalies
  LOW_CONVERSION_RATE: 10,            // Below 10% conversion = flag
  HIGH_REJECTION_RATE: 30,            // Above 30% rejection = flag
  INACTIVE_DAYS: 7,                   // No activity in 7 days = flag

  // Ingestion anomalies
  HIGH_ERROR_RATE: 20,                // Above 20% error rate = flag
  UNUSUAL_VALUE_MULTIPLIER: 10,       // Flag if value is 10x average

  // Jurisdiction anomalies
  RULE_CHANGES_HIGH: 3,               // More than 3 changes in 30 days = volatile
  DEADLINE_CHANGES_CRITICAL: 2,       // Multiple deadline changes = critical

  // Case anomalies
  STALE_CASE_DAYS: {
    NEW: 7,
    CONTACTED: 14,
    DOCS_PENDING: 21,
    DOCS_SIGNED: 14,
    FILED: 60,
    AWAITING_FUNDS: 30
  }
};

// ============================================
// SOURCE HEALTH SCORING CONFIGURATION
// ============================================

const SOURCE_HEALTH_CONFIG = {
  // Health score weights (out of 100)
  FETCH_SUCCESS_WEIGHT: 40,      // Percentage of successful fetches
  RESPONSE_TIME_WEIGHT: 20,      // Average response time
  CONTENT_FRESHNESS_WEIGHT: 20,  // How recently content was updated
  CHANGE_FREQUENCY_WEIGHT: 20,   // Normal vs erratic change patterns

  // Thresholds
  GOOD_RESPONSE_TIME_MS: 5000,   // Under 5s is good
  BAD_RESPONSE_TIME_MS: 30000,   // Over 30s is bad
  STALE_THRESHOLD_HOURS: 168,    // 7 days without successful fetch = stale
  FAILING_THRESHOLD: 3,          // 3 consecutive failures = failing
  VOLATILE_CHANGE_COUNT: 5,      // 5+ changes in 7 days = volatile
};

// ============================================
// WATCH SERVICE CLASS
// ============================================

class WatchService {
  /**
   * Detect rule changes from recently scraped items
   * Creates alerts when state/county rules appear to have changed
   */
  async detectRuleChangesFromScrapedItems(): Promise<{
    alertsCreated: number;
    itemsProcessed: number;
  }> {
    // Get actionable scraped items (content changed)
    const actionableItems = await prisma.scrapedItem.findMany({
      where: {
        reviewStatus: "ACTIONABLE",
        sourceType: { in: ["SURPLUS_RULES", "STATE_STATUTE", "COURT_NOTICE"] }
      },
      orderBy: { fetchedAt: "desc" },
      take: 100
    });

    let alertsCreated = 0;

    for (const item of actionableItems) {
      // Check if alert already exists for this item
      const existingAlert = await prisma.watchAlert.findFirst({
        where: {
          scrapedItemId: item.id,
          type: "RULE_CHANGE_DETECTED"
        }
      });

      if (existingAlert) continue;

      // Create alert
      await prisma.watchAlert.create({
        data: {
          type: "RULE_CHANGE_DETECTED",
          severity: "HIGH",
          title: `Rule Change Detected: ${item.state || "Unknown State"}`,
          message: `A potential rule change was detected from ${item.sourceName || item.sourceUrl}. ` +
                   `This may affect claim procedures or deadlines for ${item.state}${item.county ? ` - ${item.county}` : ""}.`,
          details: {
            sourceType: item.sourceType,
            sourceUrl: item.sourceUrl,
            fetchedAt: item.fetchedAt.toISOString()
          },
          state: item.state,
          county: item.county,
          scrapedItemId: item.id
        }
      });

      alertsCreated++;

      // Update jurisdiction volatility
      if (item.state) {
        await this.incrementJurisdictionVolatility(item.state, item.county ?? undefined);
      }
    }

    return { alertsCreated, itemsProcessed: actionableItems.length };
  }

  /**
   * Detect new document patterns
   * Monitors for unusual document types or rejection patterns
   */
  async detectNewDocumentPatterns(): Promise<{
    alertsCreated: number;
    patternsFound: string[];
  }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let alertsCreated = 0;
    const patternsFound: string[] = [];

    // Check for high rejection rates by state
    const rejectionsByState = await prisma.document.groupBy({
      by: ["status"],
      where: {
        status: "REJECTED",
        rejectedAt: { gte: thirtyDaysAgo }
      },
      _count: true
    });

    // Get total documents in same period
    const totalDocs = await prisma.document.count({
      where: { createdAt: { gte: thirtyDaysAgo } }
    });

    const rejectedCount = rejectionsByState.reduce((sum, r) => sum + r._count, 0);
    const rejectionRate = totalDocs > 0 ? (rejectedCount / totalDocs) * 100 : 0;

    if (rejectionRate > 15) {
      patternsFound.push(`High document rejection rate: ${rejectionRate.toFixed(1)}%`);

      const existingAlert = await prisma.watchAlert.findFirst({
        where: {
          type: "NEW_DOCUMENT_PATTERN",
          createdAt: { gte: thirtyDaysAgo },
          isResolved: false
        }
      });

      if (!existingAlert) {
        await prisma.watchAlert.create({
          data: {
            type: "NEW_DOCUMENT_PATTERN",
            severity: rejectionRate > 25 ? "HIGH" : "MEDIUM",
            title: "Elevated Document Rejection Rate",
            message: `Document rejection rate is ${rejectionRate.toFixed(1)}% over the last 30 days. ` +
                     `This may indicate document quality issues or changing county requirements.`,
            details: {
              rejectionRate,
              rejectedCount,
              totalDocuments: totalDocs,
              periodDays: 30
            }
          }
        });
        alertsCreated++;
      }
    }

    return { alertsCreated, patternsFound };
  }

  /**
   * Detect deadline pattern changes
   * Monitors for cases missing deadlines or unusual deadline patterns
   */
  async detectDeadlinePatternChanges(): Promise<{
    alertsCreated: number;
    missedDeadlines: number;
    upcomingUrgent: number;
  }> {
    const now = new Date();
    let alertsCreated = 0;

    // Find missed deadlines
    const missedDeadlines = await prisma.deadline.findMany({
      where: {
        dueDate: { lt: now },
        completedAt: null
      },
      include: {
        case: {
          select: {
            id: true,
            internalCode: true,
            state: true,
            county: true,
            status: true
          }
        }
      }
    });

    // Create alerts for critical missed deadlines
    for (const deadline of missedDeadlines) {
      const daysMissed = Math.floor((now.getTime() - deadline.dueDate.getTime()) / (24 * 60 * 60 * 1000));

      if (daysMissed >= 7) {
        const existingAlert = await prisma.watchAlert.findFirst({
          where: {
            type: "DEADLINE_PATTERN_CHANGE",
            relatedCaseId: deadline.caseId,
            isResolved: false
          }
        });

        if (!existingAlert) {
          await prisma.watchAlert.create({
            data: {
              type: "DEADLINE_PATTERN_CHANGE",
              severity: daysMissed >= 30 ? "CRITICAL" : "HIGH",
              title: `Missed Deadline: ${deadline.case.internalCode}`,
              message: `Case ${deadline.case.internalCode} missed deadline "${deadline.title}" ` +
                       `by ${daysMissed} days. State: ${deadline.case.state}, Status: ${deadline.case.status}.`,
              details: {
                deadlineId: deadline.id,
                deadlineTitle: deadline.title,
                dueDate: deadline.dueDate.toISOString(),
                daysMissed,
                caseStatus: deadline.case.status
              },
              state: deadline.case.state,
              county: deadline.case.county,
              relatedCaseId: deadline.caseId
            }
          });
          alertsCreated++;
        }
      }
    }

    // Find upcoming urgent deadlines (within 7 days)
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const urgentDeadlines = await prisma.deadline.count({
      where: {
        dueDate: { gte: now, lte: sevenDaysFromNow },
        completedAt: null
      }
    });

    return {
      alertsCreated,
      missedDeadlines: missedDeadlines.length,
      upcomingUrgent: urgentDeadlines
    };
  }

  /**
   * Detect high-risk ingestion patterns
   * Monitors for unusual data patterns in ingested records
   */
  async detectHighRiskIngestionPatterns(): Promise<{
    alertsCreated: number;
    risksFound: string[];
  }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let alertsCreated = 0;
    const risksFound: string[] = [];

    // Check error rates by batch
    const recentBatches = await prisma.ingestionBatch.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: {
        id: true,
        totalRecords: true,
        createdCases: true,
        status: true,
        source: {
          select: { name: true, state: true }
        }
      }
    });

    for (const batch of recentBatches) {
      if (batch.totalRecords > 0) {
        const errorRate = ((batch.totalRecords - batch.createdCases) / batch.totalRecords) * 100;

        if (errorRate > WATCH_THRESHOLDS.HIGH_ERROR_RATE) {
          risksFound.push(`High error rate in batch from ${batch.source.name}: ${errorRate.toFixed(1)}%`);

          const existingAlert = await prisma.watchAlert.findFirst({
            where: {
              type: "HIGH_RISK_INGESTION",
              details: { path: ["batchId"], equals: batch.id },
              isResolved: false
            }
          });

          if (!existingAlert) {
            await prisma.watchAlert.create({
              data: {
                type: "HIGH_RISK_INGESTION",
                severity: errorRate > 50 ? "HIGH" : "MEDIUM",
                title: `High Ingestion Error Rate: ${batch.source.name}`,
                message: `Ingestion batch from ${batch.source.name} has ${errorRate.toFixed(1)}% error rate. ` +
                         `${batch.totalRecords - batch.createdCases} of ${batch.totalRecords} records failed.`,
                details: {
                  batchId: batch.id,
                  sourceName: batch.source.name,
                  state: batch.source.state,
                  errorRate,
                  totalRecords: batch.totalRecords,
                  failedRecords: batch.totalRecords - batch.createdCases
                },
                state: batch.source.state
              }
            });
            alertsCreated++;
          }
        }
      }
    }

    // Check for unusually high-value records
    const avgSurplus = await prisma.ingestionRecord.aggregate({
      where: { surplusAmount: { not: null } },
      _avg: { surplusAmount: true }
    });

    const avgValue = avgSurplus._avg.surplusAmount || 0;
    const threshold = avgValue * WATCH_THRESHOLDS.UNUSUAL_VALUE_MULTIPLIER;

    const unusualRecords = await prisma.ingestionRecord.count({
      where: {
        surplusAmount: { gte: Math.floor(threshold) },
        createdAt: { gte: thirtyDaysAgo }
      }
    });

    if (unusualRecords > 0) {
      risksFound.push(`${unusualRecords} unusually high-value records detected (>${threshold / 100} threshold)`);
    }

    return { alertsCreated, risksFound };
  }

  /**
   * Detect payout anomalies
   * Monitors for unusual payout patterns
   */
  async detectPayoutAnomalies(): Promise<{
    alertsCreated: number;
    anomaliesFound: string[];
  }> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let alertsCreated = 0;
    const anomaliesFound: string[] = [];

    // Check for large payouts
    const largePayouts = await prisma.ledgerEntry.findMany({
      where: {
        type: { in: ["CLIENT_PAYOUT", "EMPLOYEE_COMMISSION"] },
        amountCents: { gte: WATCH_THRESHOLDS.LARGE_PAYOUT_CENTS },
        createdAt: { gte: twentyFourHoursAgo }
      },
      include: {
        case: { select: { internalCode: true, state: true } },
        user: { select: { name: true, email: true } }
      }
    });

    for (const payout of largePayouts) {
      const existingAlert = await prisma.watchAlert.findFirst({
        where: {
          type: "PAYOUT_ANOMALY",
          details: { path: ["ledgerEntryId"], equals: payout.id },
          isResolved: false
        }
      });

      if (!existingAlert) {
        anomaliesFound.push(`Large ${payout.type}: $${(payout.amountCents / 100).toLocaleString()}`);

        await prisma.watchAlert.create({
          data: {
            type: "PAYOUT_ANOMALY",
            severity: payout.amountCents >= WATCH_THRESHOLDS.LARGE_PAYOUT_CENTS * 5 ? "HIGH" : "MEDIUM",
            title: `Large Payout: $${(payout.amountCents / 100).toLocaleString()}`,
            message: `A ${payout.type.toLowerCase().replace("_", " ")} of $${(payout.amountCents / 100).toLocaleString()} ` +
                     `was processed for case ${payout.case?.internalCode || "Unknown"}.`,
            details: {
              ledgerEntryId: payout.id,
              type: payout.type,
              amountCents: payout.amountCents,
              caseCode: payout.case?.internalCode,
              recipientName: payout.user?.name,
              recipientEmail: payout.user?.email
            },
            state: payout.case?.state,
            relatedCaseId: payout.caseId,
            relatedUserId: payout.userId
          }
        });
        alertsCreated++;
      }
    }

    // Check for rapid payouts to same user
    const rapidPayouts = await prisma.$queryRaw`
      SELECT "userId", COUNT(*) as count
      FROM "LedgerEntry"
      WHERE "type" IN ('EMPLOYEE_COMMISSION', 'OVERRIDE')
        AND "createdAt" >= ${twentyFourHoursAgo}
        AND "userId" IS NOT NULL
      GROUP BY "userId"
      HAVING COUNT(*) >= ${WATCH_THRESHOLDS.RAPID_PAYOUTS_COUNT}
    ` as { userId: string; count: bigint }[];

    for (const rapid of rapidPayouts) {
      anomaliesFound.push(`Rapid payouts: ${rapid.count} payouts to user in 24h`);
    }

    return { alertsCreated, anomaliesFound };
  }

  /**
   * Detect employee anomalies
   * Monitors for unusual employee behavior patterns
   */
  async detectEmployeeAnomalies(): Promise<{
    alertsCreated: number;
    flaggedEmployees: string[];
  }> {
    let alertsCreated = 0;
    const flaggedEmployees: string[] = [];

    // Get all active employees with their case stats
    const employees = await prisma.user.findMany({
      where: { role: "EMPLOYEE", isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        employeeTier: true,
        assignedCases: {
          select: {
            id: true,
            status: true,
            createdAt: true
          }
        }
      }
    });

    for (const employee of employees) {
      const totalCases = employee.assignedCases.length;
      if (totalCases < 5) continue; // Not enough data

      const paidCases = employee.assignedCases.filter(c => c.status === "PAID").length;
      const rejectedCases = employee.assignedCases.filter(c => c.status === "REJECTED").length;

      const conversionRate = (paidCases / totalCases) * 100;
      const rejectionRate = (rejectedCases / totalCases) * 100;

      const flags: string[] = [];

      if (conversionRate < WATCH_THRESHOLDS.LOW_CONVERSION_RATE) {
        flags.push(`Low conversion: ${conversionRate.toFixed(1)}%`);
      }

      if (rejectionRate > WATCH_THRESHOLDS.HIGH_REJECTION_RATE) {
        flags.push(`High rejection: ${rejectionRate.toFixed(1)}%`);
      }

      if (flags.length > 0) {
        flaggedEmployees.push(`${employee.name}: ${flags.join(", ")}`);

        const existingAlert = await prisma.watchAlert.findFirst({
          where: {
            type: "EMPLOYEE_ANOMALY",
            relatedUserId: employee.id,
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            isResolved: false
          }
        });

        if (!existingAlert) {
          await prisma.watchAlert.create({
            data: {
              type: "EMPLOYEE_ANOMALY",
              severity: flags.length > 1 ? "HIGH" : "MEDIUM",
              title: `Employee Performance Concern: ${employee.name}`,
              message: `Employee ${employee.name} has concerning metrics: ${flags.join("; ")}. ` +
                       `Total cases: ${totalCases}, Paid: ${paidCases}, Rejected: ${rejectedCases}.`,
              details: {
                employeeId: employee.id,
                employeeName: employee.name,
                employeeTier: employee.employeeTier,
                totalCases,
                paidCases,
                rejectedCases,
                conversionRate,
                rejectionRate,
                flags
              },
              relatedUserId: employee.id
            }
          });
          alertsCreated++;
        }
      }
    }

    return { alertsCreated, flaggedEmployees };
  }

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  /**
   * Increment jurisdiction volatility score
   */
  private async incrementJurisdictionVolatility(state: string, county?: string): Promise<void> {
    const existing = await prisma.jurisdictionMetrics.findUnique({
      where: {
        state_county: {
          state,
          county: county || ""
        }
      }
    });

    if (existing) {
      await prisma.jurisdictionMetrics.update({
        where: { id: existing.id },
        data: {
          ruleChangesLast30Days: existing.ruleChangesLast30Days + 1,
          volatilityScore: Math.min(100, existing.volatilityScore + 10)
        }
      });
    } else {
      await prisma.jurisdictionMetrics.create({
        data: {
          state,
          county: county || "",
          ruleChangesLast30Days: 1,
          volatilityScore: 10
        }
      });
    }
  }

  // ============================================
  // ALERT MANAGEMENT
  // ============================================

  /**
   * Get alerts with filters
   */
  async getAlerts(filters: {
    type?: WatchAlertType;
    severity?: WatchAlertSeverity;
    state?: string;
    isResolved?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{
    alerts: any[];
    total: number;
  }> {
    const where: any = {};
    if (filters.type) where.type = filters.type;
    if (filters.severity) where.severity = filters.severity;
    if (filters.state) where.state = filters.state;
    if (filters.isResolved !== undefined) where.isResolved = filters.isResolved;

    const [alerts, total] = await Promise.all([
      prisma.watchAlert.findMany({
        where,
        include: { scrapedItem: true },
        orderBy: [
          { severity: "desc" },
          { createdAt: "desc" }
        ],
        take: filters.limit || 50,
        skip: filters.offset || 0
      }),
      prisma.watchAlert.count({ where })
    ]);

    return { alerts, total };
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(
    id: string,
    resolvedById: string,
    resolution?: string
  ): Promise<any> {
    return prisma.watchAlert.update({
      where: { id },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedById,
        resolution
      }
    });
  }

  /**
   * Get single alert by ID
   */
  async getAlert(id: string): Promise<any> {
    return prisma.watchAlert.findUnique({
      where: { id },
      include: { scrapedItem: true }
    });
  }

  /**
   * Get alert summary (counts by severity and type)
   */
  async getAlertSummary(): Promise<{
    total: number;
    unresolved: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    byType: { type: string; count: number }[];
  }> {
    const [
      total,
      unresolved,
      bySeverity,
      byType
    ] = await Promise.all([
      prisma.watchAlert.count(),
      prisma.watchAlert.count({ where: { isResolved: false } }),
      prisma.watchAlert.groupBy({
        by: ["severity"],
        where: { isResolved: false },
        _count: true
      }),
      prisma.watchAlert.groupBy({
        by: ["type"],
        where: { isResolved: false },
        _count: true
      })
    ]);

    const severityCounts = bySeverity.reduce((acc, b) => {
      acc[b.severity.toLowerCase()] = b._count;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      unresolved,
      critical: severityCounts.critical || 0,
      high: severityCounts.high || 0,
      medium: severityCounts.medium || 0,
      low: severityCounts.low || 0,
      byType: byType.map(b => ({ type: b.type, count: b._count }))
    };
  }

  /**
   * Get alert statistics
   */
  async getAlertStats(): Promise<{
    total: number;
    unresolved: number;
    bySeverity: { severity: string; count: number }[];
    byType: { type: string; count: number }[];
    last24Hours: number;
    last7Days: number;
  }> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      total,
      unresolved,
      bySeverity,
      byType,
      last24Hours,
      last7Days
    ] = await Promise.all([
      prisma.watchAlert.count(),
      prisma.watchAlert.count({ where: { isResolved: false } }),
      prisma.watchAlert.groupBy({
        by: ["severity"],
        _count: true
      }),
      prisma.watchAlert.groupBy({
        by: ["type"],
        _count: true
      }),
      prisma.watchAlert.count({
        where: { createdAt: { gte: twentyFourHoursAgo } }
      }),
      prisma.watchAlert.count({
        where: { createdAt: { gte: sevenDaysAgo } }
      })
    ]);

    return {
      total,
      unresolved,
      bySeverity: bySeverity.map(b => ({ severity: b.severity, count: b._count })),
      byType: byType.map(b => ({ type: b.type, count: b._count })),
      last24Hours,
      last7Days
    };
  }

  // ============================================
  // WATCH TARGET MONITORING
  // ============================================

  /**
   * Monitor all WatchTargets and detect issues
   * Creates alerts for failing, stale, or volatile sources
   */
  async monitorWatchTargets(): Promise<{
    monitored: number;
    healthy: number;
    failing: number;
    stale: number;
    volatile: number;
    alertsCreated: number;
  }> {
    const watchTargets = await prisma.watchTarget.findMany({
      where: { isActive: true },
    });

    let healthy = 0;
    let failing = 0;
    let stale = 0;
    let volatile = 0;
    let alertsCreated = 0;

    for (const target of watchTargets) {
      const health = await this.calculateSourceHealth(target.id);

      if (health.status === "HEALTHY") {
        healthy++;
      } else if (health.status === "FAILING") {
        failing++;
        alertsCreated += await this.createSourceAlert(target, health, "SOURCE_FAILING");
      } else if (health.status === "STALE") {
        stale++;
        alertsCreated += await this.createSourceAlert(target, health, "SOURCE_STALE");
      } else if (health.status === "VOLATILE") {
        volatile++;
        alertsCreated += await this.createSourceAlert(target, health, "SOURCE_VOLATILE");
      }
    }

    return {
      monitored: watchTargets.length,
      healthy,
      failing,
      stale,
      volatile,
      alertsCreated,
    };
  }

  /**
   * Calculate health score for a WatchTarget
   */
  async calculateSourceHealth(watchTargetId: string): Promise<{
    score: number;
    status: "HEALTHY" | "FAILING" | "STALE" | "VOLATILE" | "UNKNOWN";
    metrics: {
      fetchSuccessRate: number;
      avgResponseTimeMs: number;
      lastFetchedHoursAgo: number;
      changesLast7Days: number;
      consecutiveFailures: number;
    };
  }> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get recent scraped items for this target
    const recentItems = await prisma.scrapedItem.findMany({
      where: {
        watchTargetId,
        fetchedAt: { gte: sevenDaysAgo },
      },
      orderBy: { fetchedAt: "desc" },
      take: 50,
    });

    if (recentItems.length === 0) {
      // Check if target was ever fetched
      const anyItem = await prisma.scrapedItem.findFirst({
        where: { watchTargetId },
        orderBy: { fetchedAt: "desc" },
      });

      if (!anyItem) {
        return {
          score: 0,
          status: "UNKNOWN",
          metrics: {
            fetchSuccessRate: 0,
            avgResponseTimeMs: 0,
            lastFetchedHoursAgo: -1,
            changesLast7Days: 0,
            consecutiveFailures: 0,
          },
        };
      }

      const hoursAgo = (Date.now() - anyItem.fetchedAt.getTime()) / (1000 * 60 * 60);

      return {
        score: hoursAgo > SOURCE_HEALTH_CONFIG.STALE_THRESHOLD_HOURS ? 20 : 50,
        status: hoursAgo > SOURCE_HEALTH_CONFIG.STALE_THRESHOLD_HOURS ? "STALE" : "UNKNOWN",
        metrics: {
          fetchSuccessRate: 100,
          avgResponseTimeMs: 0,
          lastFetchedHoursAgo: hoursAgo,
          changesLast7Days: 0,
          consecutiveFailures: 0,
        },
      };
    }

    // Calculate metrics
    const successfulFetches = recentItems.filter(item => item.rawContent && item.rawContent.length > 0);
    const fetchSuccessRate = (successfulFetches.length / recentItems.length) * 100;

    // Count unique content hashes to detect changes
    const uniqueHashes = new Set(recentItems.map(item => item.contentHash));
    const changesLast7Days = uniqueHashes.size - 1; // Subtract 1 as we count changes, not versions

    // Calculate hours since last fetch
    const lastFetchedHoursAgo = (Date.now() - recentItems[0].fetchedAt.getTime()) / (1000 * 60 * 60);

    // Count consecutive failures (simplified - assume failure if no content)
    let consecutiveFailures = 0;
    for (const item of recentItems) {
      if (!item.rawContent || item.rawContent.length === 0) {
        consecutiveFailures++;
      } else {
        break;
      }
    }

    // Calculate score components
    const successScore = (fetchSuccessRate / 100) * SOURCE_HEALTH_CONFIG.FETCH_SUCCESS_WEIGHT;

    const freshnessScore = lastFetchedHoursAgo < 24
      ? SOURCE_HEALTH_CONFIG.CONTENT_FRESHNESS_WEIGHT
      : lastFetchedHoursAgo < SOURCE_HEALTH_CONFIG.STALE_THRESHOLD_HOURS
        ? SOURCE_HEALTH_CONFIG.CONTENT_FRESHNESS_WEIGHT * 0.5
        : 0;

    const volatilityScore = changesLast7Days <= SOURCE_HEALTH_CONFIG.VOLATILE_CHANGE_COUNT
      ? SOURCE_HEALTH_CONFIG.CHANGE_FREQUENCY_WEIGHT
      : SOURCE_HEALTH_CONFIG.CHANGE_FREQUENCY_WEIGHT * 0.3;

    // Response time score (placeholder as we don't track response time yet)
    const responseTimeScore = SOURCE_HEALTH_CONFIG.RESPONSE_TIME_WEIGHT;

    const totalScore = Math.round(successScore + freshnessScore + volatilityScore + responseTimeScore);

    // Determine status
    let status: "HEALTHY" | "FAILING" | "STALE" | "VOLATILE" | "UNKNOWN";

    if (consecutiveFailures >= SOURCE_HEALTH_CONFIG.FAILING_THRESHOLD) {
      status = "FAILING";
    } else if (lastFetchedHoursAgo > SOURCE_HEALTH_CONFIG.STALE_THRESHOLD_HOURS) {
      status = "STALE";
    } else if (changesLast7Days > SOURCE_HEALTH_CONFIG.VOLATILE_CHANGE_COUNT) {
      status = "VOLATILE";
    } else if (totalScore >= 70) {
      status = "HEALTHY";
    } else {
      status = "UNKNOWN";
    }

    return {
      score: totalScore,
      status,
      metrics: {
        fetchSuccessRate,
        avgResponseTimeMs: 0, // Placeholder
        lastFetchedHoursAgo,
        changesLast7Days,
        consecutiveFailures,
      },
    };
  }

  /**
   * Create alert for source health issue
   */
  private async createSourceAlert(
    target: { id: string; name: string; url: string; state: string | null; county: string | null },
    health: { score: number; status: string; metrics: Record<string, number> },
    alertType: "SOURCE_FAILING" | "SOURCE_STALE" | "SOURCE_VOLATILE"
  ): Promise<number> {
    // Check for existing unresolved alert
    const existingAlert = await prisma.watchAlert.findFirst({
      where: {
        type: alertType as WatchAlertType,
        details: { path: ["watchTargetId"], equals: target.id },
        isResolved: false,
      },
    });

    if (existingAlert) {
      return 0;
    }

    const severityMap: Record<string, WatchAlertSeverity> = {
      SOURCE_FAILING: "HIGH",
      SOURCE_STALE: "MEDIUM",
      SOURCE_VOLATILE: "MEDIUM",
    };

    const titleMap: Record<string, string> = {
      SOURCE_FAILING: `Source Failing: ${target.name}`,
      SOURCE_STALE: `Source Stale: ${target.name}`,
      SOURCE_VOLATILE: `Source Volatile: ${target.name}`,
    };

    const messageMap: Record<string, string> = {
      SOURCE_FAILING: `The watch target "${target.name}" has had ${health.metrics.consecutiveFailures} consecutive fetch failures. URL: ${target.url}`,
      SOURCE_STALE: `The watch target "${target.name}" has not been successfully fetched in ${Math.round(health.metrics.lastFetchedHoursAgo)} hours. URL: ${target.url}`,
      SOURCE_VOLATILE: `The watch target "${target.name}" has changed ${health.metrics.changesLast7Days} times in the last 7 days, indicating potential instability. URL: ${target.url}`,
    };

    await prisma.watchAlert.create({
      data: {
        type: alertType as WatchAlertType,
        severity: severityMap[alertType],
        title: titleMap[alertType],
        message: messageMap[alertType],
        details: {
          healthScore: health.score,
          healthStatus: health.status,
          metrics: health.metrics,
          targetUrl: target.url,
        },
        state: target.state,
        county: target.county,
      },
    });

    return 1;
  }

  /**
   * Get all WatchTargets with their health status
   */
  async getWatchTargetHealthReport(): Promise<{
    targets: Array<{
      id: string;
      name: string;
      url: string;
      state: string | null;
      county: string | null;
      isActive: boolean;
      healthScore: number;
      healthStatus: string;
      lastScrapedAt: Date | null;
      lastSuccessAt: Date | null;
    }>;
    summary: {
      total: number;
      healthy: number;
      failing: number;
      stale: number;
      volatile: number;
      unknown: number;
    };
  }> {
    const watchTargets = await prisma.watchTarget.findMany({
      orderBy: { createdAt: "asc" },
    });

    const targets = await Promise.all(
      watchTargets.map(async (target) => {
        const health = await this.calculateSourceHealth(target.id);
        return {
          id: target.id,
          name: target.name,
          url: target.url,
          state: target.state,
          county: target.county,
          isActive: target.isActive,
          healthScore: health.score,
          healthStatus: health.status,
          lastScrapedAt: target.lastScrapedAt,
          lastSuccessAt: target.lastSuccessAt,
        };
      })
    );

    const summary = {
      total: targets.length,
      healthy: targets.filter((t) => t.healthStatus === "HEALTHY").length,
      failing: targets.filter((t) => t.healthStatus === "FAILING").length,
      stale: targets.filter((t) => t.healthStatus === "STALE").length,
      volatile: targets.filter((t) => t.healthStatus === "VOLATILE").length,
      unknown: targets.filter((t) => t.healthStatus === "UNKNOWN").length,
    };

    return { targets, summary };
  }

  /**
   * Create or update WatchTarget
   */
  async upsertWatchTarget(data: {
    id?: string;
    name: string;
    watchType: string;
    url: string;
    state?: string;
    county?: string;
    enabled?: boolean;
    checkIntervalMinutes?: number;
  }): Promise<unknown> {
    if (data.id) {
      return prisma.watchTarget.update({
        where: { id: data.id },
        data: {
          name: data.name,
          type: data.watchType,
          url: data.url,
          state: data.state,
          county: data.county,
          isActive: data.enabled ?? true,
          config: { checkIntervalMinutes: data.checkIntervalMinutes ?? 360 },
        },
      });
    }

    return prisma.watchTarget.create({
      data: {
        name: data.name,
        type: data.watchType,
        url: data.url,
        state: data.state,
        county: data.county,
        isActive: data.enabled ?? true,
        config: { checkIntervalMinutes: data.checkIntervalMinutes ?? 360 },
      },
    });
  }

  /**
   * Delete WatchTarget
   */
  async deleteWatchTarget(id: string): Promise<void> {
    await prisma.watchTarget.delete({
      where: { id },
    });
  }

  /**
   * Get WatchTarget by ID
   */
  async getWatchTarget(id: string): Promise<unknown> {
    return prisma.watchTarget.findUnique({
      where: { id },
    });
  }

  /**
   * Run all watch checks
   * Called on schedule or manually by Founder
   */
  async runFullWatch(): Promise<{
    success: boolean;
    summary: {
      ruleChanges: { alertsCreated: number };
      documentPatterns: { alertsCreated: number };
      deadlines: { alertsCreated: number; missed: number; urgent: number };
      ingestion: { alertsCreated: number };
      payouts: { alertsCreated: number };
      employees: { alertsCreated: number };
      watchTargets: { monitored: number; healthy: number; failing: number; stale: number; alertsCreated: number };
    };
  }> {
    const ruleResult = await this.detectRuleChangesFromScrapedItems();
    const docResult = await this.detectNewDocumentPatterns();
    const deadlineResult = await this.detectDeadlinePatternChanges();
    const ingestionResult = await this.detectHighRiskIngestionPatterns();
    const payoutResult = await this.detectPayoutAnomalies();
    const employeeResult = await this.detectEmployeeAnomalies();
    const watchTargetResult = await this.monitorWatchTargets();

    // Create OpsInsight for watch cycle completion
    await prisma.opsInsight.create({
      data: {
        category: "WATCH_CYCLE",
        priority: watchTargetResult.failing > 0 ? "HIGH" : "LOW",
        title: "Watch Cycle Complete",
        summary: `Watch cycle completed. ${ruleResult.alertsCreated + docResult.alertsCreated + deadlineResult.alertsCreated + ingestionResult.alertsCreated + payoutResult.alertsCreated + employeeResult.alertsCreated + watchTargetResult.alertsCreated} total alerts created. ${watchTargetResult.healthy}/${watchTargetResult.monitored} sources healthy.`,
        details: {
          ruleChanges: ruleResult,
          documentPatterns: docResult,
          deadlines: deadlineResult,
          ingestion: ingestionResult,
          payouts: payoutResult,
          employees: employeeResult,
          watchTargets: watchTargetResult,
        },
        status: watchTargetResult.failing > 0 ? "NEW" : "ACKNOWLEDGED",
      },
    });

    return {
      success: true,
      summary: {
        ruleChanges: { alertsCreated: ruleResult.alertsCreated },
        documentPatterns: { alertsCreated: docResult.alertsCreated },
        deadlines: {
          alertsCreated: deadlineResult.alertsCreated,
          missed: deadlineResult.missedDeadlines,
          urgent: deadlineResult.upcomingUrgent
        },
        ingestion: { alertsCreated: ingestionResult.alertsCreated },
        payouts: { alertsCreated: payoutResult.alertsCreated },
        employees: { alertsCreated: employeeResult.alertsCreated },
        watchTargets: {
          monitored: watchTargetResult.monitored,
          healthy: watchTargetResult.healthy,
          failing: watchTargetResult.failing,
          stale: watchTargetResult.stale,
          alertsCreated: watchTargetResult.alertsCreated
        }
      }
    };
  }
}

export const watchService = new WatchService();
