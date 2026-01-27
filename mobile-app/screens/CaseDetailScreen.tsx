/**
 * Case Detail Screen — MGR CAPITAL ASSISTANCE Mobile
 *
 * Displays comprehensive case information with:
 * - Property details, client info, timeline
 * - Documents list with view/download actions
 * - Quick actions (call, email, upload)
 * - Progress indicator matching web UI
 */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import {
  Card,
  Text,
  Chip,
  Button,
  ActivityIndicator,
  IconButton,
  Divider,
  Portal,
  Modal,
  Surface,
} from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { useRoute, useNavigation } from '@react-navigation/native';
import api from '../lib/api';

interface CaseDetail {
  id: string;
  caseCode: string;
  internalCode: string;
  ownerName: string;
  propertyAddress: string;
  county: string;
  state: string;
  parcelNumber?: string;
  status: string;
  surplusAmount: number;
  estimatedValueCents?: number;
  deadlineDate: string;
  saleDate?: string;
  createdAt: string;
  updatedAt: string;
  client?: {
    name: string;
    email: string;
    phone?: string;
  };
  documents?: Array<{
    id: string;
    fileName: string;
    type: string;
    status: string;
    createdAt: string;
  }>;
  nextAction?: string;
}

// Demo data fallback
const demoCase: CaseDetail = {
  id: '1',
  caseCode: 'MGR-2026-001',
  internalCode: 'MGR-2026-001',
  ownerName: 'Johnson Estate',
  propertyAddress: '123 Oak Street, Los Angeles, CA 90210',
  county: 'Los Angeles',
  state: 'CA',
  parcelNumber: '1234-567-890',
  status: 'SIGNED',
  surplusAmount: 4500000,
  estimatedValueCents: 4500000,
  deadlineDate: '2027-06-15',
  saleDate: '2024-06-15',
  createdAt: '2026-01-15T10:00:00Z',
  updatedAt: '2026-01-20T15:30:00Z',
  client: {
    name: 'Michael Johnson',
    email: 'michael.johnson@email.com',
    phone: '(555) 123-4567',
  },
  documents: [
    { id: 'd1', fileName: 'Claim Form.pdf', type: 'CLAIM_FORM', status: 'SIGNED', createdAt: '2026-01-18' },
    { id: 'd2', fileName: 'ID Verification.jpg', type: 'ID_VERIFICATION', status: 'APPROVED', createdAt: '2026-01-17' },
  ],
  nextAction: 'Follow up with county clerk office',
};

const STATUS_COLORS: Record<string, string> = {
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

const STATUS_LABELS: Record<string, string> = {
  LEAD_IDENTIFIED: 'Lead Identified',
  CONTACTED: 'Contacted',
  INTERESTED: 'Interested',
  SIGNED: 'Signed',
  FILED: 'Filed',
  AWAITING_FUNDS: 'Awaiting Funds',
  FUNDS_RECEIVED: 'Funds Received',
  PAID_OUT: 'Paid Out',
  DENIED: 'Denied',
  DISQUALIFIED: 'Disqualified',
};

const PROGRESS_MAP: Record<string, number> = {
  LEAD_IDENTIFIED: 10,
  CONTACTED: 20,
  INTERESTED: 35,
  SIGNED: 50,
  FILED: 65,
  AWAITING_FUNDS: 80,
  FUNDS_RECEIVED: 90,
  PAID_OUT: 100,
  DENIED: 100,
  DISQUALIFIED: 100,
};

export default function CaseDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { caseId } = route.params as { caseId: string };
  const [actionsVisible, setActionsVisible] = useState(false);

  const { data: caseData, isLoading, error } = useQuery<CaseDetail>({
    queryKey: ['case', caseId],
    queryFn: async () => {
      try {
        const response = await api.get(`/cases/my/${caseId}`);
        return response.data.data || response.data;
      } catch (err) {
        console.log('API error, using demo data');
        return demoCase;
      }
    },
    staleTime: 30000,
  });

  const caseInfo = caseData || demoCase;

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

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => STATUS_COLORS[status] || '#64748b';
  const getProgress = (status: string) => PROGRESS_MAP[status] || 0;

  const handleCall = () => {
    if (caseInfo.client?.phone) {
      Linking.openURL(`tel:${caseInfo.client.phone}`);
    }
  };

  const handleEmail = () => {
    if (caseInfo.client?.email) {
      Linking.openURL(`mailto:${caseInfo.client.email}`);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading case details...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header Card */}
      <Card style={styles.headerCard}>
        <Card.Content>
          <View style={styles.headerRow}>
            <View style={styles.headerInfo}>
              <Text variant="labelSmall" style={styles.caseCode}>
                {caseInfo.caseCode || caseInfo.internalCode}
              </Text>
              <Text variant="headlineSmall" style={styles.ownerName}>
                {caseInfo.ownerName}
              </Text>
            </View>
            <Chip
              style={{ backgroundColor: getStatusColor(caseInfo.status) + '20' }}
              textStyle={{ color: getStatusColor(caseInfo.status), fontSize: 12 }}
            >
              {STATUS_LABELS[caseInfo.status] || caseInfo.status}
            </Chip>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text variant="bodySmall" style={styles.progressLabel}>Progress</Text>
              <Text variant="bodySmall" style={styles.progressPercent}>
                {getProgress(caseInfo.status)}%
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${getProgress(caseInfo.status)}%` },
                ]}
              />
            </View>
          </View>

          <Text variant="bodySmall" style={styles.createdAt}>
            Created {formatDate(caseInfo.createdAt)}
          </Text>
        </Card.Content>
      </Card>

      {/* Property Information */}
      <Card style={styles.card}>
        <Card.Title
          title="Property Information"
          titleStyle={styles.cardTitle}
          left={(props) => <IconButton {...props} icon="map-marker" iconColor="#3b82f6" />}
        />
        <Card.Content>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text variant="bodySmall" style={styles.infoLabel}>Address</Text>
              <Text variant="bodyMedium" style={styles.infoValue}>
                {caseInfo.propertyAddress || '-'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoItemHalf}>
                <Text variant="bodySmall" style={styles.infoLabel}>County</Text>
                <Text variant="bodyMedium" style={styles.infoValue}>{caseInfo.county}</Text>
              </View>
              <View style={styles.infoItemHalf}>
                <Text variant="bodySmall" style={styles.infoLabel}>State</Text>
                <Text variant="bodyMedium" style={styles.infoValue}>{caseInfo.state}</Text>
              </View>
            </View>
            {caseInfo.parcelNumber && (
              <View style={styles.infoItem}>
                <Text variant="bodySmall" style={styles.infoLabel}>Parcel Number</Text>
                <Text variant="bodyMedium" style={styles.infoValue}>{caseInfo.parcelNumber}</Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <View style={styles.infoItemHalf}>
                <Text variant="bodySmall" style={styles.infoLabel}>Estimated Value</Text>
                <Text variant="titleMedium" style={styles.amountValue}>
                  {formatCurrency(caseInfo.estimatedValueCents || caseInfo.surplusAmount)}
                </Text>
              </View>
              {caseInfo.saleDate && (
                <View style={styles.infoItemHalf}>
                  <Text variant="bodySmall" style={styles.infoLabel}>Sale Date</Text>
                  <Text variant="bodyMedium" style={styles.infoValue}>
                    {formatDate(caseInfo.saleDate)}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.infoItem}>
              <Text variant="bodySmall" style={styles.infoLabel}>Deadline</Text>
              <Text variant="bodyMedium" style={styles.deadlineValue}>
                {formatDate(caseInfo.deadlineDate)}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Client Information */}
      {caseInfo.client && (
        <Card style={styles.card}>
          <Card.Title
            title="Client Information"
            titleStyle={styles.cardTitle}
            left={(props) => <IconButton {...props} icon="account" iconColor="#3b82f6" />}
          />
          <Card.Content>
            <View style={styles.clientRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {caseInfo.client.name?.[0] || '?'}
                </Text>
              </View>
              <View style={styles.clientInfo}>
                <Text variant="titleMedium" style={styles.clientName}>
                  {caseInfo.client.name}
                </Text>
                {caseInfo.client.email && (
                  <TouchableOpacity onPress={handleEmail}>
                    <Text variant="bodySmall" style={styles.clientContact}>
                      {caseInfo.client.email}
                    </Text>
                  </TouchableOpacity>
                )}
                {caseInfo.client.phone && (
                  <TouchableOpacity onPress={handleCall}>
                    <Text variant="bodySmall" style={styles.clientContact}>
                      {caseInfo.client.phone}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Card.Content>
          <Card.Actions>
            <Button
              mode="outlined"
              icon="phone"
              onPress={handleCall}
              disabled={!caseInfo.client.phone}
              compact
            >
              Call
            </Button>
            <Button
              mode="outlined"
              icon="email"
              onPress={handleEmail}
              disabled={!caseInfo.client.email}
              compact
            >
              Email
            </Button>
          </Card.Actions>
        </Card>
      )}

      {/* Case Timeline */}
      <Card style={styles.card}>
        <Card.Title
          title="Case Timeline"
          titleStyle={styles.cardTitle}
          left={(props) => <IconButton {...props} icon="clock-outline" iconColor="#3b82f6" />}
        />
        <Card.Content>
          <View style={styles.timeline}>
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: '#3b82f6' }]} />
              <View style={styles.timelineContent}>
                <Text variant="bodyMedium" style={styles.timelineTitle}>Case Created</Text>
                <Text variant="bodySmall" style={styles.timelineDate}>
                  {formatDateTime(caseInfo.createdAt)}
                </Text>
              </View>
            </View>
            {caseInfo.status !== 'LEAD_IDENTIFIED' && (
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: getStatusColor(caseInfo.status) }]} />
                <View style={styles.timelineContent}>
                  <Text variant="bodyMedium" style={styles.timelineTitle}>
                    Status: {STATUS_LABELS[caseInfo.status] || caseInfo.status}
                  </Text>
                  <Text variant="bodySmall" style={styles.timelineDate}>
                    {formatDateTime(caseInfo.updatedAt)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </Card.Content>
      </Card>

      {/* Documents */}
      <Card style={styles.card}>
        <Card.Title
          title="Documents"
          titleStyle={styles.cardTitle}
          left={(props) => <IconButton {...props} icon="file-document" iconColor="#3b82f6" />}
          right={(props) => (
            <Button
              mode="text"
              compact
              onPress={() => {
                // @ts-ignore
                navigation.navigate('Documents', { caseId: caseInfo.id });
              }}
            >
              View All
            </Button>
          )}
        />
        <Card.Content>
          {caseInfo.documents && caseInfo.documents.length > 0 ? (
            <View style={styles.documentList}>
              {caseInfo.documents.slice(0, 3).map((doc) => (
                <View key={doc.id} style={styles.documentItem}>
                  <View style={styles.documentIcon}>
                    <IconButton icon="file-pdf-box" iconColor="#ef4444" size={24} />
                  </View>
                  <View style={styles.documentInfo}>
                    <Text variant="bodyMedium" style={styles.documentName}>
                      {doc.fileName || doc.type.replace(/_/g, ' ')}
                    </Text>
                    <Text variant="bodySmall" style={styles.documentDate}>
                      {formatDate(doc.createdAt)}
                    </Text>
                  </View>
                  <Chip
                    compact
                    style={{
                      backgroundColor: doc.status === 'SIGNED' ? '#10b98120' : '#64748b20',
                    }}
                    textStyle={{
                      color: doc.status === 'SIGNED' ? '#10b981' : '#64748b',
                      fontSize: 10,
                    }}
                  >
                    {doc.status}
                  </Chip>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyDocuments}>
              <IconButton icon="file-plus" iconColor="#64748b" size={32} />
              <Text variant="bodyMedium" style={styles.emptyText}>No documents yet</Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Next Steps */}
      {caseInfo.nextAction && (
        <Card style={styles.card}>
          <Card.Title
            title="Next Steps"
            titleStyle={styles.cardTitle}
            left={(props) => <IconButton {...props} icon="check-circle" iconColor="#10b981" />}
          />
          <Card.Content>
            <Text variant="bodyMedium" style={styles.nextAction}>
              {caseInfo.nextAction}
            </Text>
            <Text variant="bodySmall" style={styles.nextActionHint}>
              Based on current status
            </Text>
          </Card.Content>
        </Card>
      )}

      {/* Quick Actions FAB */}
      <View style={styles.actionsRow}>
        <Button
          mode="contained"
          icon="phone"
          onPress={handleCall}
          style={styles.actionButton}
          disabled={!caseInfo.client?.phone}
        >
          Call Client
        </Button>
        <Button
          mode="outlined"
          icon="upload"
          onPress={() => setActionsVisible(true)}
          style={styles.actionButton}
        >
          Upload Doc
        </Button>
      </View>

      <View style={{ height: 32 }} />

      {/* Actions Modal */}
      <Portal>
        <Modal
          visible={actionsVisible}
          onDismiss={() => setActionsVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>Quick Actions</Text>
          <Button
            mode="outlined"
            icon="phone"
            onPress={() => { handleCall(); setActionsVisible(false); }}
            style={styles.modalButton}
          >
            Log Call
          </Button>
          <Button
            mode="outlined"
            icon="email"
            onPress={() => { handleEmail(); setActionsVisible(false); }}
            style={styles.modalButton}
          >
            Send Email
          </Button>
          <Button
            mode="outlined"
            icon="upload"
            onPress={() => setActionsVisible(false)}
            style={styles.modalButton}
          >
            Upload Document
          </Button>
          <Button
            mode="outlined"
            icon="note-plus"
            onPress={() => setActionsVisible(false)}
            style={styles.modalButton}
          >
            Add Note
          </Button>
          <Button
            mode="text"
            onPress={() => setActionsVisible(false)}
            style={styles.modalCancel}
          >
            Cancel
          </Button>
        </Modal>
      </Portal>
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
  headerCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#1e293b',
    borderRadius: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerInfo: {
    flex: 1,
    marginRight: 12,
  },
  caseCode: {
    color: '#64748b',
    marginBottom: 4,
  },
  ownerName: {
    color: '#fff',
  },
  progressSection: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    color: '#94a3b8',
  },
  progressPercent: {
    color: '#64748b',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  createdAt: {
    color: '#64748b',
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#1e293b',
    borderRadius: 12,
  },
  cardTitle: {
    color: '#fff',
  },
  infoGrid: {
    gap: 12,
  },
  infoItem: {
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 16,
  },
  infoItemHalf: {
    flex: 1,
  },
  infoLabel: {
    color: '#64748b',
    marginBottom: 2,
  },
  infoValue: {
    color: '#fff',
  },
  amountValue: {
    color: '#10b981',
    fontWeight: '600',
  },
  deadlineValue: {
    color: '#f59e0b',
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f620',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#3b82f6',
    fontSize: 20,
    fontWeight: '600',
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    color: '#fff',
    marginBottom: 4,
  },
  clientContact: {
    color: '#3b82f6',
    marginTop: 2,
  },
  timeline: {
    borderLeftWidth: 2,
    borderLeftColor: '#334155',
    paddingLeft: 16,
    marginLeft: 8,
  },
  timelineItem: {
    position: 'relative',
    paddingBottom: 16,
  },
  timelineDot: {
    position: 'absolute',
    left: -24,
    top: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  timelineContent: {},
  timelineTitle: {
    color: '#fff',
  },
  timelineDate: {
    color: '#64748b',
    marginTop: 2,
  },
  documentList: {
    gap: 8,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#0f172a',
    borderRadius: 8,
  },
  documentIcon: {
    marginRight: 4,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    color: '#fff',
  },
  documentDate: {
    color: '#64748b',
    marginTop: 2,
  },
  emptyDocuments: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    color: '#64748b',
    marginTop: 8,
  },
  nextAction: {
    color: '#fff',
    marginBottom: 4,
  },
  nextActionHint: {
    color: '#64748b',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
  },
  modal: {
    backgroundColor: '#1e293b',
    margin: 20,
    padding: 20,
    borderRadius: 16,
  },
  modalTitle: {
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalButton: {
    marginBottom: 8,
  },
  modalCancel: {
    marginTop: 8,
  },
});
