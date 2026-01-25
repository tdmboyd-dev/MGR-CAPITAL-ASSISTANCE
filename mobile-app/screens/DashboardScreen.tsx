/**
 * Dashboard Screen - STUB
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Text, Button, Surface } from 'react-native-paper';

export default function DashboardScreen({ navigation }: any) {
  // Stub data
  const stats = {
    activeCases: 12,
    pendingClaims: 8,
    recoveredThisMonth: 45000,
    totalRecovered: 1250000,
  };

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineSmall" style={styles.greeting}>
        Welcome back!
      </Text>

      <View style={styles.statsGrid}>
        <Surface style={styles.statCard}>
          <Text variant="displaySmall" style={styles.statValue}>
            {stats.activeCases}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            Active Cases
          </Text>
        </Surface>

        <Surface style={styles.statCard}>
          <Text variant="displaySmall" style={styles.statValue}>
            {stats.pendingClaims}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            Pending Claims
          </Text>
        </Surface>
      </View>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.cardTitle}>
            This Month
          </Text>
          <Text variant="displaySmall" style={styles.amount}>
            ${stats.recoveredThisMonth.toLocaleString()}
          </Text>
          <Text variant="bodySmall" style={styles.cardLabel}>
            Recovered
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Total Recovered
          </Text>
          <Text variant="displaySmall" style={[styles.amount, { color: '#10b981' }]}>
            ${stats.totalRecovered.toLocaleString()}
          </Text>
        </Card.Content>
      </Card>

      <View style={styles.actions}>
        <Button
          mode="contained"
          onPress={() => navigation.navigate('Cases')}
          style={styles.actionButton}
        >
          View Cases
        </Button>
        <Button
          mode="outlined"
          onPress={() => {}}
          style={styles.actionButton}
        >
          Quick Actions
        </Button>
      </View>

      <Text variant="bodySmall" style={styles.footer}>
        Mobile App - Stub Implementation
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  greeting: {
    color: '#fff',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    alignItems: 'center',
  },
  statValue: {
    color: '#3b82f6',
  },
  statLabel: {
    color: '#94a3b8',
    marginTop: 4,
  },
  card: {
    marginBottom: 12,
    backgroundColor: '#1e293b',
  },
  cardTitle: {
    color: '#94a3b8',
    marginBottom: 8,
  },
  amount: {
    color: '#fff',
  },
  cardLabel: {
    color: '#64748b',
    marginTop: 4,
  },
  actions: {
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    marginBottom: 8,
  },
  footer: {
    color: '#475569',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
});
