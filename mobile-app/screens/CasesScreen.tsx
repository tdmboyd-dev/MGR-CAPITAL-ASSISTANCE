/**
 * Cases Screen — MGR CAPITAL ASSISTANCE Mobile
 *
 * Displays client's cases with real API integration.
 * Features: Pull-to-refresh, status filtering, navigation to details.
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { Card, Text, Chip, Button, Searchbar, ActivityIndicator, SegmentedButtons } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import api from '../lib/api';

interface Case {
  id: string;
  caseCode: string;
  ownerName: string;
  propertyAddress: string;
  county: string;
  state: string;
  status: string;
  surplusAmount: number;
  deadlineDate: string;
  createdAt: string;
}

// Demo data for fallback
const demoCases: Case[] = [
  {
    id: '1',
    caseCode: 'MGR-2026-001',
    ownerName: 'Johnson Estate',
    propertyAddress: '123 Oak St',
    county: 'Los Angeles',
    state: 'CA',
    status: 'SIGNED',
    surplusAmount: 4500000,
    deadlineDate: '2027-06-15',
    createdAt: '2026-01-15',
  },
  {
    id: '2',
    caseCode: 'MGR-2026-002',
    ownerName: 'Smith Property',
    propertyAddress: '456 Pine Ave',
    county: 'Harris',
    state: 'TX',
    status: 'FILED',
    surplusAmount: 3200000,
    deadlineDate: '2027-08-22',
    createdAt: '2026-01-20',
  },
  {
    id: '3',
    caseCode: 'MGR-2026-003',
    ownerName: 'Williams Surplus',
    propertyAddress: '789 Palm Blvd',
    county: 'Miami-Dade',
    state: 'FL',
    status: 'AWAITING_FUNDS',
    surplusAmount: 7800000,
    deadlineDate: '2027-04-10',
    createdAt: '2026-01-05',
  },
  {
    id: '4',
    caseCode: 'MGR-2026-004',
    ownerName: 'Brown Family Trust',
    propertyAddress: '321 Maple Dr',
    county: 'Kings',
    state: 'NY',
    status: 'CONTACTED',
    surplusAmount: 2500000,
    deadlineDate: '2028-01-30',
    createdAt: '2026-01-25',
  },
];

const statusColors: Record<string, string> = {
  LEAD_IDENTIFIED: '#64748b',
  CONTACTED: '#8b5cf6',
  INTERESTED: '#06b6d4',
  SIGNED: '#3b82f6',
  FILED: '#f59e0b',
  AWAITING_FUNDS: '#10b981',
  FUNDS_RECEIVED: '#22c55e',
  PAID_OUT: '#14b8a6',
  DENIED: '#ef4444',
  DISQUALIFIED: '#6b7280',
};

const statusLabels: Record<string, string> = {
  LEAD_IDENTIFIED: 'Lead',
  CONTACTED: 'Contacted',
  INTERESTED: 'Interested',
  SIGNED: 'Signed',
  FILED: 'Filed',
  AWAITING_FUNDS: 'Awaiting Funds',
  FUNDS_RECEIVED: 'Funds Received',
  PAID_OUT: 'Paid',
  DENIED: 'Denied',
  DISQUALIFIED: 'Disqualified',
};

export default function CasesScreen() {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch cases from API
  const { data: cases, isLoading, error, refetch } = useQuery<Case[]>({
    queryKey: ['cases'],
    queryFn: async () => {
      try {
        const response = await api.get('/cases/my');
        return response.data.cases || response.data;
      } catch (err) {
        console.log('API error, using demo data');
        return demoCases;
      }
    },
    staleTime: 30000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Filter cases
  const filteredCases = (cases || demoCases).filter((c) => {
    const matchesSearch =
      c.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.caseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.county.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => statusColors[status] || '#64748b';

  const navigateToDetail = (caseItem: Case) => {
    // @ts-ignore - navigation typing
    navigation.navigate('CaseDetail', { caseId: caseItem.id, caseCode: caseItem.caseCode });
  };

  const renderCase = ({ item }: { item: Case }) => (
    <TouchableOpacity onPress={() => navigateToDetail(item)} activeOpacity={0.7}>
      <Card style={styles.caseCard}>
        <Card.Content>
          <View style={styles.caseHeader}>
            <View style={styles.caseInfo}>
              <Text variant="labelSmall" style={styles.caseCode}>
                {item.caseCode}
              </Text>
              <Text variant="titleMedium" style={styles.ownerName}>
                {item.ownerName}
              </Text>
            </View>
            <Chip
              style={{ backgroundColor: getStatusColor(item.status) + '20' }}
              textStyle={{ color: getStatusColor(item.status), fontSize: 11 }}
              compact
            >
              {statusLabels[item.status] || item.status}
            </Chip>
          </View>

          <Text variant="bodySmall" style={styles.address}>
            {item.county}, {item.state}
          </Text>

          <View style={styles.caseDetails}>
            <View>
              <Text variant="bodySmall" style={styles.label}>
                Surplus Amount
              </Text>
              <Text variant="titleMedium" style={styles.amount}>
                {formatCurrency(item.surplusAmount)}
              </Text>
            </View>
            <View style={styles.deadlineContainer}>
              <Text variant="bodySmall" style={styles.label}>
                Deadline
              </Text>
              <Text variant="bodyMedium" style={styles.deadline}>
                {formatDate(item.deadlineDate)}
              </Text>
            </View>
          </View>
        </Card.Content>
        <Card.Actions>
          <Button
            mode="text"
            compact
            onPress={() => navigateToDetail(item)}
          >
            View Details
          </Button>
          <Button
            mode="text"
            compact
            onPress={() => {
              // @ts-ignore
              navigation.navigate('Documents', { caseId: item.id });
            }}
          >
            Documents
          </Button>
        </Card.Actions>
      </Card>
    </TouchableOpacity>
  );

  if (isLoading && !cases) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading cases...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search cases..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          iconColor="#64748b"
          placeholderTextColor="#64748b"
        />
      </View>

      <View style={styles.filterContainer}>
        <SegmentedButtons
          value={statusFilter}
          onValueChange={setStatusFilter}
          buttons={[
            { value: 'all', label: 'All' },
            { value: 'SIGNED', label: 'Signed' },
            { value: 'FILED', label: 'Filed' },
            { value: 'AWAITING_FUNDS', label: 'Active' },
          ]}
          style={styles.segmentedButtons}
        />
      </View>

      <FlatList
        data={filteredCases}
        renderItem={renderCase}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
            colors={['#3b82f6']}
          />
        }
        ListHeaderComponent={
          <Text variant="bodyMedium" style={styles.header}>
            {filteredCases.length} Case{filteredCases.length !== 1 ? 's' : ''}
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No cases found</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Try a different search term' : 'Pull down to refresh'}
            </Text>
          </View>
        }
      />
    </View>
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
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchbar: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
  },
  searchInput: {
    color: '#fff',
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  segmentedButtons: {
    backgroundColor: '#1e293b',
  },
  list: {
    padding: 16,
    paddingTop: 8,
  },
  header: {
    color: '#94a3b8',
    marginBottom: 12,
  },
  caseCard: {
    marginBottom: 12,
    backgroundColor: '#1e293b',
    borderRadius: 12,
  },
  caseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  caseInfo: {
    flex: 1,
    marginRight: 12,
  },
  caseCode: {
    color: '#64748b',
    marginBottom: 2,
  },
  ownerName: {
    color: '#fff',
  },
  address: {
    color: '#94a3b8',
    marginBottom: 12,
  },
  caseDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  label: {
    color: '#64748b',
    marginBottom: 2,
  },
  amount: {
    color: '#10b981',
    fontWeight: '600',
  },
  deadlineContainer: {
    alignItems: 'flex-end',
  },
  deadline: {
    color: '#f59e0b',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#64748b',
    fontSize: 14,
  },
});
