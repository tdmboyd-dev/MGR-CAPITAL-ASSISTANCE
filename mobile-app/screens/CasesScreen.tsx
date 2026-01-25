/**
 * Cases Screen - STUB
 */

import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Card, Text, Chip, Button } from 'react-native-paper';

const demoCases = [
  { id: '1', title: 'Johnson Estate', amount: 45000, status: 'active', state: 'CA' },
  { id: '2', title: 'Smith Property', amount: 32000, status: 'pending', state: 'TX' },
  { id: '3', title: 'Williams Surplus', amount: 78000, status: 'active', state: 'FL' },
  { id: '4', title: 'Brown Family Trust', amount: 25000, status: 'filed', state: 'NY' },
];

export default function CasesScreen() {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'pending': return '#f59e0b';
      case 'filed': return '#3b82f6';
      default: return '#64748b';
    }
  };

  const renderCase = ({ item }: { item: typeof demoCases[0] }) => (
    <Card style={styles.caseCard}>
      <Card.Content>
        <View style={styles.caseHeader}>
          <Text variant="titleMedium" style={styles.caseTitle}>
            {item.title}
          </Text>
          <Chip
            style={{ backgroundColor: getStatusColor(item.status) + '20' }}
            textStyle={{ color: getStatusColor(item.status), fontSize: 12 }}
          >
            {item.status}
          </Chip>
        </View>

        <View style={styles.caseDetails}>
          <View>
            <Text variant="bodySmall" style={styles.label}>Amount</Text>
            <Text variant="titleMedium" style={styles.amount}>
              ${item.amount.toLocaleString()}
            </Text>
          </View>
          <View>
            <Text variant="bodySmall" style={styles.label}>State</Text>
            <Text variant="titleMedium" style={styles.state}>{item.state}</Text>
          </View>
        </View>
      </Card.Content>
      <Card.Actions>
        <Button mode="text">View Details</Button>
        <Button mode="text">Documents</Button>
      </Card.Actions>
    </Card>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={demoCases}
        renderItem={renderCase}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text variant="bodyMedium" style={styles.header}>
            {demoCases.length} Cases
          </Text>
        }
        ListFooterComponent={
          <Text variant="bodySmall" style={styles.footer}>
            Pull to refresh • Stub data shown
          </Text>
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
  list: {
    padding: 16,
  },
  header: {
    color: '#94a3b8',
    marginBottom: 12,
  },
  caseCard: {
    marginBottom: 12,
    backgroundColor: '#1e293b',
  },
  caseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  caseTitle: {
    color: '#fff',
    flex: 1,
  },
  caseDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: '#64748b',
    marginBottom: 4,
  },
  amount: {
    color: '#10b981',
  },
  state: {
    color: '#fff',
  },
  footer: {
    color: '#475569',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
});
