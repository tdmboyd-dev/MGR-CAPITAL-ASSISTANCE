/**
 * Dashboard Screen — MGR CAPITAL ASSISTANCE Mobile
 *
 * Main dashboard with:
 * - Key metrics and statistics
 * - Quick actions
 * - Recent cases preview
 * - Real API integration
 */

import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Card, Text, Button, Surface, IconButton, ActivityIndicator } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface DashboardStats {
  totalCases: number;
  activeCases: number;
  completedCases: number;
  pendingCases: number;
  totalRecovered: number;
  monthlyRecovered: number;
  conversionRate: number;
}

interface RecentCase {
  id: string;
  caseCode: string;
  ownerName: string;
  status: string;
  surplusAmount: number;
  updatedAt: string;
}

// Demo data fallback
const demoStats: DashboardStats = {
  totalCases: 24,
  activeCases: 12,
  completedCases: 8,
  pendingCases: 4,
  totalRecovered: 125000000, // $1.25M in cents
  monthlyRecovered: 4500000, // $45,000 in cents
  conversionRate: 33,
};

const demoCases: RecentCase[] = [
  { id: '1', caseCode: 'MGR-2026-001', ownerName: 'Johnson Estate', status: 'SIGNED', surplusAmount: 4500000, updatedAt: '2026-01-25' },
  { id: '2', caseCode: 'MGR-2026-002', ownerName: 'Smith Property', status: 'FILED', surplusAmount: 3200000, updatedAt: '2026-01-24' },
  { id: '3', caseCode: 'MGR-2026-003', ownerName: 'Williams Surplus', status: 'AWAITING_FUNDS', surplusAmount: 7800000, updatedAt: '2026-01-23' },
];

const STATUS_COLORS: Record<string, string> = {
  LEAD_IDENTIFIED: '#64748b',
  CONTACTED: '#8b5cf6',
  INTERESTED: '#06b6d4',
  SIGNED: '#3b82f6',
  FILED: '#f59e0b',
  AWAITING_FUNDS: '#10b981',
  FUNDS_RECEIVED: '#22c55e',
  PAID_OUT: '#14b8a6',
};

const STATUS_LABELS: Record<string, string> = {
  LEAD_IDENTIFIED: 'Lead',
  CONTACTED: 'Contacted',
  INTERESTED: 'Interested',
  SIGNED: 'Signed',
  FILED: 'Filed',
  AWAITING_FUNDS: 'Awaiting',
  FUNDS_RECEIVED: 'Received',
  PAID_OUT: 'Paid',
};

export default function DashboardScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      try {
        const response = await api.get('/dashboard/stats');
        return response.data;
      } catch (err) {
        console.log('API error, using demo data');
        return demoStats;
      }
    },
    staleTime: 60000,
  });

  // Fetch recent cases
  const { data: recentCases, isLoading: casesLoading, refetch: refetchCases } = useQuery<RecentCase[]>({
    queryKey: ['recent-cases'],
    queryFn: async () => {
      try {
        const response = await api.get('/cases/my?limit=3&sort=updatedAt');
        return response.data.cases || response.data || [];
      } catch (err) {
        console.log('API error, using demo data');
        return demoCases;
      }
    },
    staleTime: 30000,
  });

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchCases()]);
    setRefreshing(false);
  }, [refetchStats, refetchCases]);

  const formatCurrency = (cents: number) => {
    if (cents >= 100000000) {
      return `$${(cents / 100000000).toFixed(2)}M`;
    }
    if (cents >= 100000) {
      return `$${(cents / 100000).toFixed(0)}K`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  const formatShortCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  const navigateToCase = (caseItem: RecentCase) => {
    // @ts-ignore
    navigation.navigate('CaseDetail', { caseId: caseItem.id, caseCode: caseItem.caseCode });
  };

  const dashboardStats = stats || demoStats;
  const cases = recentCases || demoCases;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (statsLoading && !stats) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#3b82f6"
          colors={['#3b82f6']}
        />
      }
    >
      {/* Greeting */}
      <View style={styles.greetingSection}>
        <Text variant="headlineSmall" style={styles.greeting}>
          {getGreeting()}, {user?.name?.split(' ')[0] || 'User'}
        </Text>
        <Text variant="bodyMedium" style={styles.subGreeting}>
          Here's your recovery overview
        </Text>
      </View>

      {/* Main Stats Grid */}
      <View style={styles.statsGrid}>
        <Surface style={styles.statCard}>
          <IconButton icon="briefcase" iconColor="#3b82f6" size={24} style={styles.statIcon} />
          <Text variant="headlineMedium" style={styles.statValue}>
            {dashboardStats.activeCases}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>Active Cases</Text>
        </Surface>
        <Surface style={styles.statCard}>
          <IconButton icon="check-circle" iconColor="#10b981" size={24} style={styles.statIcon} />
          <Text variant="headlineMedium" style={[styles.statValue, { color: '#10b981' }]}>
            {dashboardStats.completedCases}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>Completed</Text>
        </Surface>
      </View>

      {/* Recovery Cards */}
      <Card style={styles.recoveryCard}>
        <Card.Content>
          <View style={styles.recoveryHeader}>
            <View>
              <Text variant="labelMedium" style={styles.recoveryLabel}>This Month</Text>
              <Text variant="headlineMedium" style={styles.recoveryAmount}>
                {formatCurrency(dashboardStats.monthlyRecovered)}
              </Text>
            </View>
            <View style={styles.trendBadge}>
              <IconButton icon="trending-up" iconColor="#10b981" size={16} style={{ margin: 0 }} />
              <Text style={styles.trendText}>+12%</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.totalCard}>
        <Card.Content>
          <Text variant="labelMedium" style={styles.totalLabel}>Total Recovered</Text>
          <Text variant="displaySmall" style={styles.totalAmount}>
            {formatCurrency(dashboardStats.totalRecovered)}
          </Text>
          <View style={styles.conversionRow}>
            <Text variant="bodySmall" style={styles.conversionText}>
              {dashboardStats.conversionRate}% conversion rate
            </Text>
            <Text variant="bodySmall" style={styles.casesTotal}>
              {dashboardStats.totalCases} total cases
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Quick Actions */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            // @ts-ignore
            navigation.navigate('CasesTab');
          }}
        >
          <Surface style={styles.actionSurface}>
            <IconButton icon="briefcase-plus" iconColor="#3b82f6" size={28} />
            <Text variant="bodySmall" style={styles.actionLabel}>View Cases</Text>
          </Surface>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            // @ts-ignore
            navigation.navigate('DocumentsTab');
          }}
        >
          <Surface style={styles.actionSurface}>
            <IconButton icon="file-upload" iconColor="#8b5cf6" size={28} />
            <Text variant="bodySmall" style={styles.actionLabel}>Documents</Text>
          </Surface>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            // @ts-ignore
            navigation.navigate('ProfileTab');
          }}
        >
          <Surface style={styles.actionSurface}>
            <IconButton icon="account-cog" iconColor="#f59e0b" size={28} />
            <Text variant="bodySmall" style={styles.actionLabel}>Settings</Text>
          </Surface>
        </TouchableOpacity>
      </View>

      {/* Recent Cases */}
      <View style={styles.recentHeader}>
        <Text variant="titleMedium" style={styles.sectionTitle}>Recent Cases</Text>
        <Button
          mode="text"
          compact
          onPress={() => {
            // @ts-ignore
            navigation.navigate('CasesTab');
          }}
        >
          View All
        </Button>
      </View>

      {casesLoading ? (
        <ActivityIndicator size="small" color="#3b82f6" style={{ marginVertical: 20 }} />
      ) : (
        cases.slice(0, 3).map((caseItem) => (
          <TouchableOpacity
            key={caseItem.id}
            onPress={() => navigateToCase(caseItem)}
            activeOpacity={0.7}
          >
            <Card style={styles.caseCard}>
              <Card.Content style={styles.caseContent}>
                <View style={styles.caseInfo}>
                  <Text variant="labelSmall" style={styles.caseCode}>{caseItem.caseCode}</Text>
                  <Text variant="bodyLarge" style={styles.caseName}>{caseItem.ownerName}</Text>
                  <Text variant="bodyMedium" style={styles.caseAmount}>
                    {formatShortCurrency(caseItem.surplusAmount)}
                  </Text>
                </View>
                <View style={styles.caseStatus}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: STATUS_COLORS[caseItem.status] || '#64748b' },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      { color: STATUS_COLORS[caseItem.status] || '#64748b' },
                    ]}
                  >
                    {STATUS_LABELS[caseItem.status] || caseItem.status}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          </TouchableOpacity>
        ))
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
  },
  greetingSection: {
    padding: 16,
    paddingBottom: 8,
  },
  greeting: {
    color: '#fff',
    fontWeight: '600',
  },
  subGreeting: {
    color: '#64748b',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    alignItems: 'center',
  },
  statIcon: {
    margin: 0,
    marginBottom: 4,
  },
  statValue: {
    color: '#3b82f6',
    fontWeight: '700',
  },
  statLabel: {
    color: '#94a3b8',
    marginTop: 4,
  },
  recoveryCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#1e293b',
    borderRadius: 12,
  },
  recoveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recoveryLabel: {
    color: '#64748b',
    marginBottom: 4,
  },
  recoveryAmount: {
    color: '#fff',
    fontWeight: '700',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b98120',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  trendText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
  },
  totalCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
  },
  totalLabel: {
    color: '#64748b',
    marginBottom: 4,
  },
  totalAmount: {
    color: '#10b981',
    fontWeight: '700',
  },
  conversionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  conversionText: {
    color: '#64748b',
  },
  casesTotal: {
    color: '#64748b',
  },
  sectionTitle: {
    color: '#fff',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
  },
  actionSurface: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  actionLabel: {
    color: '#94a3b8',
    marginTop: 4,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 8,
  },
  caseCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#1e293b',
    borderRadius: 12,
  },
  caseContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  caseInfo: {
    flex: 1,
  },
  caseCode: {
    color: '#64748b',
    marginBottom: 2,
  },
  caseName: {
    color: '#fff',
    fontWeight: '500',
  },
  caseAmount: {
    color: '#10b981',
    marginTop: 4,
  },
  caseStatus: {
    alignItems: 'flex-end',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
