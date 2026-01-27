/**
 * Documents Screen — MGR CAPITAL ASSISTANCE Mobile
 *
 * Document management with:
 * - List of case documents
 * - View/download functionality
 * - Upload capability
 * - Status indicators
 */

import React, { useState } from 'react';
import { View, StyleSheet, FlatList, Alert, TouchableOpacity } from 'react-native';
import {
  Card,
  Text,
  Chip,
  Button,
  ActivityIndicator,
  IconButton,
  FAB,
  Portal,
  Modal,
  Searchbar,
} from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { useRoute, useNavigation } from '@react-navigation/native';
import api from '../lib/api';

interface Document {
  id: string;
  fileName: string;
  type: string;
  status: string;
  fileSize?: number;
  mimeType?: string;
  createdAt: string;
  uploadedBy?: string;
}

// Demo documents
const demoDocuments: Document[] = [
  {
    id: '1',
    fileName: 'Claim_Form_Signed.pdf',
    type: 'CLAIM_FORM',
    status: 'SIGNED',
    fileSize: 245000,
    mimeType: 'application/pdf',
    createdAt: '2026-01-20',
    uploadedBy: 'Client',
  },
  {
    id: '2',
    fileName: 'ID_Verification.jpg',
    type: 'ID_VERIFICATION',
    status: 'APPROVED',
    fileSize: 1200000,
    mimeType: 'image/jpeg',
    createdAt: '2026-01-18',
    uploadedBy: 'Client',
  },
  {
    id: '3',
    fileName: 'Property_Deed.pdf',
    type: 'PROPERTY_DEED',
    status: 'PENDING_REVIEW',
    fileSize: 520000,
    mimeType: 'application/pdf',
    createdAt: '2026-01-17',
    uploadedBy: 'Employee',
  },
  {
    id: '4',
    fileName: 'Court_Filing.pdf',
    type: 'COURT_FILING',
    status: 'FILED',
    fileSize: 890000,
    mimeType: 'application/pdf',
    createdAt: '2026-01-15',
    uploadedBy: 'System',
  },
];

const TYPE_LABELS: Record<string, string> = {
  CLAIM_FORM: 'Claim Form',
  ID_VERIFICATION: 'ID Verification',
  PROPERTY_DEED: 'Property Deed',
  COURT_FILING: 'Court Filing',
  SIGNED_CONTRACT: 'Signed Contract',
  POWER_OF_ATTORNEY: 'Power of Attorney',
  TAX_DOCUMENT: 'Tax Document',
  OTHER: 'Other',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: '#f59e0b20', text: '#f59e0b' },
  PENDING_REVIEW: { bg: '#f59e0b20', text: '#f59e0b' },
  APPROVED: { bg: '#10b98120', text: '#10b981' },
  SIGNED: { bg: '#10b98120', text: '#10b981' },
  FILED: { bg: '#3b82f620', text: '#3b82f6' },
  REJECTED: { bg: '#ef444420', text: '#ef4444' },
};

const TYPE_ICONS: Record<string, string> = {
  CLAIM_FORM: 'file-document-edit',
  ID_VERIFICATION: 'card-account-details',
  PROPERTY_DEED: 'home-city',
  COURT_FILING: 'gavel',
  SIGNED_CONTRACT: 'file-sign',
  POWER_OF_ATTORNEY: 'account-key',
  TAX_DOCUMENT: 'file-percent',
  OTHER: 'file',
};

export default function DocumentsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { caseId } = (route.params as { caseId?: string }) || {};
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadModalVisible, setUploadModalVisible] = useState(false);

  const { data: documents, isLoading, refetch } = useQuery<Document[]>({
    queryKey: ['documents', caseId],
    queryFn: async () => {
      try {
        const endpoint = caseId ? `/documents/case/${caseId}` : '/documents/my';
        const response = await api.get(endpoint);
        return response.data.documents || response.data || [];
      } catch (err) {
        console.log('API error, using demo data');
        return demoDocuments;
      }
    },
    staleTime: 30000,
  });

  const filteredDocuments = (documents || demoDocuments).filter((doc) =>
    doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    TYPE_LABELS[doc.type]?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusStyle = (status: string) => {
    return STATUS_COLORS[status] || { bg: '#64748b20', text: '#64748b' };
  };

  const getTypeIcon = (type: string) => {
    return TYPE_ICONS[type] || 'file';
  };

  const handleView = (doc: Document) => {
    Alert.alert('View Document', `Opening ${doc.fileName}...`);
    // In production: Linking.openURL or in-app PDF viewer
  };

  const handleDownload = (doc: Document) => {
    Alert.alert('Download', `Downloading ${doc.fileName}...`);
    // In production: Download and save to device
  };

  const handleUpload = (type: string) => {
    setUploadModalVisible(false);
    Alert.alert('Upload', `Opening document picker for ${TYPE_LABELS[type] || type}...`);
    // In production: DocumentPicker.pick()
  };

  const renderDocument = ({ item }: { item: Document }) => {
    const statusStyle = getStatusStyle(item.status);

    return (
      <Card style={styles.documentCard}>
        <TouchableOpacity onPress={() => handleView(item)} activeOpacity={0.7}>
          <Card.Content style={styles.documentContent}>
            <View style={styles.documentHeader}>
              <View style={styles.iconContainer}>
                <IconButton
                  icon={getTypeIcon(item.type)}
                  iconColor="#3b82f6"
                  size={28}
                  style={styles.documentIcon}
                />
              </View>
              <View style={styles.documentInfo}>
                <Text variant="bodyLarge" style={styles.fileName} numberOfLines={1}>
                  {item.fileName}
                </Text>
                <Text variant="bodySmall" style={styles.documentType}>
                  {TYPE_LABELS[item.type] || item.type}
                </Text>
                <View style={styles.documentMeta}>
                  {item.fileSize && (
                    <Text variant="bodySmall" style={styles.metaText}>
                      {formatFileSize(item.fileSize)}
                    </Text>
                  )}
                  <Text variant="bodySmall" style={styles.metaText}>
                    {formatDate(item.createdAt)}
                  </Text>
                </View>
              </View>
              <Chip
                compact
                style={{ backgroundColor: statusStyle.bg }}
                textStyle={{ color: statusStyle.text, fontSize: 10 }}
              >
                {item.status.replace(/_/g, ' ')}
              </Chip>
            </View>
          </Card.Content>
        </TouchableOpacity>
        <Card.Actions style={styles.documentActions}>
          <Button
            mode="text"
            icon="eye"
            compact
            onPress={() => handleView(item)}
          >
            View
          </Button>
          <Button
            mode="text"
            icon="download"
            compact
            onPress={() => handleDownload(item)}
          >
            Download
          </Button>
        </Card.Actions>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading documents...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search documents..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          iconColor="#64748b"
          placeholderTextColor="#64748b"
        />
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text variant="headlineSmall" style={styles.statValue}>
            {filteredDocuments.length}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text variant="headlineSmall" style={[styles.statValue, { color: '#10b981' }]}>
            {filteredDocuments.filter((d) => d.status === 'SIGNED' || d.status === 'APPROVED').length}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statItem}>
          <Text variant="headlineSmall" style={[styles.statValue, { color: '#f59e0b' }]}>
            {filteredDocuments.filter((d) => d.status.includes('PENDING')).length}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      {/* Document List */}
      <FlatList
        data={filteredDocuments}
        renderItem={renderDocument}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconButton icon="file-document-outline" size={48} iconColor="#64748b" />
            <Text style={styles.emptyText}>No documents found</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Try a different search' : 'Upload your first document'}
            </Text>
          </View>
        }
      />

      {/* Upload FAB */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => setUploadModalVisible(true)}
        color="#fff"
      />

      {/* Upload Modal */}
      <Portal>
        <Modal
          visible={uploadModalVisible}
          onDismiss={() => setUploadModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>Upload Document</Text>
          <Text variant="bodyMedium" style={styles.modalSubtitle}>
            Select document type
          </Text>

          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={styles.uploadOption}
              onPress={() => handleUpload(key)}
            >
              <IconButton
                icon={TYPE_ICONS[key] || 'file'}
                iconColor="#3b82f6"
                size={24}
              />
              <Text variant="bodyLarge" style={styles.uploadOptionText}>
                {label}
              </Text>
              <IconButton icon="chevron-right" iconColor="#64748b" size={20} />
            </TouchableOpacity>
          ))}

          <Button
            mode="text"
            onPress={() => setUploadModalVisible(false)}
            style={styles.modalCancel}
          >
            Cancel
          </Button>
        </Modal>
      </Portal>
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
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  statItem: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontWeight: '600',
  },
  statLabel: {
    color: '#64748b',
    marginTop: 2,
  },
  list: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 100,
  },
  documentCard: {
    marginBottom: 12,
    backgroundColor: '#1e293b',
    borderRadius: 12,
  },
  documentContent: {
    paddingBottom: 0,
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    marginRight: 8,
  },
  documentIcon: {
    margin: 0,
    backgroundColor: '#3b82f610',
  },
  documentInfo: {
    flex: 1,
  },
  fileName: {
    color: '#fff',
    fontWeight: '500',
  },
  documentType: {
    color: '#64748b',
    marginTop: 2,
  },
  documentMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  metaText: {
    color: '#475569',
  },
  documentActions: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 8,
  },
  emptySubtext: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#3b82f6',
  },
  modal: {
    backgroundColor: '#1e293b',
    margin: 20,
    padding: 20,
    borderRadius: 16,
    maxHeight: '80%',
  },
  modalTitle: {
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
  },
  uploadOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  uploadOptionText: {
    flex: 1,
    color: '#fff',
  },
  modalCancel: {
    marginTop: 16,
  },
});
