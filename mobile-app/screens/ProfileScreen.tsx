/**
 * Profile Screen — MGR CAPITAL ASSISTANCE Mobile
 *
 * User profile management with:
 * - Account information display
 * - Settings options
 * - Logout functionality
 * - App version info
 */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import {
  Card,
  Text,
  Button,
  List,
  Switch,
  Divider,
  Avatar,
  IconButton,
  Portal,
  Dialog,
  Surface,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  FOUNDER: 'Founder',
  ADMIN: 'Administrator',
  EMPLOYEE: 'Employee',
  CLIENT: 'Client',
};

const ROLE_COLORS: Record<string, string> = {
  FOUNDER: '#f59e0b',
  ADMIN: '#8b5cf6',
  EMPLOYEE: '#3b82f6',
  CLIENT: '#10b981',
};

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);

  // Use auth context user or demo data
  const profile: UserProfile = user || {
    id: '1',
    name: 'Demo User',
    email: 'demo@mgrcapital.com',
    role: 'EMPLOYEE',
    phone: '(555) 123-4567',
    createdAt: '2026-01-01',
  };

  const handleLogout = async () => {
    setLogoutDialogVisible(false);
    try {
      await logout();
      // @ts-ignore
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  const handleSupport = () => {
    Linking.openURL('mailto:support@mgrcapital.com');
  };

  const handlePrivacy = () => {
    Linking.openURL('https://mgrcapital.com/privacy');
  };

  const handleTerms = () => {
    Linking.openURL('https://mgrcapital.com/terms');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <Card style={styles.profileCard}>
        <Card.Content style={styles.profileContent}>
          <View style={styles.avatarContainer}>
            <Avatar.Text
              size={80}
              label={getInitials(profile.name)}
              style={[
                styles.avatar,
                { backgroundColor: ROLE_COLORS[profile.role] || '#3b82f6' },
              ]}
            />
            <IconButton
              icon="pencil"
              size={20}
              iconColor="#fff"
              style={styles.editButton}
              onPress={() => Alert.alert('Edit Profile', 'Coming soon!')}
            />
          </View>
          <Text variant="headlineSmall" style={styles.profileName}>
            {profile.name}
          </Text>
          <Text variant="bodyMedium" style={styles.profileEmail}>
            {profile.email}
          </Text>
          <View style={styles.roleChip}>
            <Text
              style={[
                styles.roleText,
                { color: ROLE_COLORS[profile.role] || '#3b82f6' },
              ]}
            >
              {ROLE_LABELS[profile.role] || profile.role}
            </Text>
          </View>
          <Text variant="bodySmall" style={styles.memberSince}>
            Member since {formatDate(profile.createdAt)}
          </Text>
        </Card.Content>
      </Card>

      {/* Account Settings */}
      <Card style={styles.card}>
        <Card.Title
          title="Account"
          titleStyle={styles.cardTitle}
          left={(props) => <IconButton {...props} icon="account-cog" iconColor="#3b82f6" />}
        />
        <Card.Content>
          <List.Item
            title="Edit Profile"
            description="Update your name and contact info"
            left={(props) => <List.Icon {...props} icon="account-edit" color="#64748b" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" color="#64748b" />}
            titleStyle={styles.listTitle}
            descriptionStyle={styles.listDescription}
            onPress={() => Alert.alert('Edit Profile', 'Coming soon!')}
          />
          <Divider style={styles.divider} />
          <List.Item
            title="Change Password"
            description="Update your account password"
            left={(props) => <List.Icon {...props} icon="lock-reset" color="#64748b" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" color="#64748b" />}
            titleStyle={styles.listTitle}
            descriptionStyle={styles.listDescription}
            onPress={() => Alert.alert('Change Password', 'Coming soon!')}
          />
          <Divider style={styles.divider} />
          <List.Item
            title="Payment Methods"
            description="Manage your payout preferences"
            left={(props) => <List.Icon {...props} icon="credit-card" color="#64748b" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" color="#64748b" />}
            titleStyle={styles.listTitle}
            descriptionStyle={styles.listDescription}
            onPress={() => Alert.alert('Payment Methods', 'Coming soon!')}
          />
        </Card.Content>
      </Card>

      {/* Preferences */}
      <Card style={styles.card}>
        <Card.Title
          title="Preferences"
          titleStyle={styles.cardTitle}
          left={(props) => <IconButton {...props} icon="cog" iconColor="#3b82f6" />}
        />
        <Card.Content>
          <List.Item
            title="Push Notifications"
            description="Receive case updates and alerts"
            left={(props) => <List.Icon {...props} icon="bell" color="#64748b" />}
            right={() => (
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                color="#3b82f6"
              />
            )}
            titleStyle={styles.listTitle}
            descriptionStyle={styles.listDescription}
          />
          <Divider style={styles.divider} />
          <List.Item
            title="Biometric Login"
            description="Use Face ID or fingerprint"
            left={(props) => <List.Icon {...props} icon="fingerprint" color="#64748b" />}
            right={() => (
              <Switch
                value={biometricsEnabled}
                onValueChange={setBiometricsEnabled}
                color="#3b82f6"
              />
            )}
            titleStyle={styles.listTitle}
            descriptionStyle={styles.listDescription}
          />
        </Card.Content>
      </Card>

      {/* Support */}
      <Card style={styles.card}>
        <Card.Title
          title="Support"
          titleStyle={styles.cardTitle}
          left={(props) => <IconButton {...props} icon="help-circle" iconColor="#3b82f6" />}
        />
        <Card.Content>
          <List.Item
            title="Help Center"
            description="FAQs and guides"
            left={(props) => <List.Icon {...props} icon="book-open-variant" color="#64748b" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" color="#64748b" />}
            titleStyle={styles.listTitle}
            descriptionStyle={styles.listDescription}
            onPress={() => Alert.alert('Help Center', 'Coming soon!')}
          />
          <Divider style={styles.divider} />
          <List.Item
            title="Contact Support"
            description="Get help from our team"
            left={(props) => <List.Icon {...props} icon="email" color="#64748b" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" color="#64748b" />}
            titleStyle={styles.listTitle}
            descriptionStyle={styles.listDescription}
            onPress={handleSupport}
          />
        </Card.Content>
      </Card>

      {/* Legal */}
      <Card style={styles.card}>
        <Card.Title
          title="Legal"
          titleStyle={styles.cardTitle}
          left={(props) => <IconButton {...props} icon="shield-check" iconColor="#3b82f6" />}
        />
        <Card.Content>
          <List.Item
            title="Privacy Policy"
            left={(props) => <List.Icon {...props} icon="file-document" color="#64748b" />}
            right={(props) => <List.Icon {...props} icon="open-in-new" color="#64748b" />}
            titleStyle={styles.listTitle}
            onPress={handlePrivacy}
          />
          <Divider style={styles.divider} />
          <List.Item
            title="Terms of Service"
            left={(props) => <List.Icon {...props} icon="file-document-outline" color="#64748b" />}
            right={(props) => <List.Icon {...props} icon="open-in-new" color="#64748b" />}
            titleStyle={styles.listTitle}
            onPress={handleTerms}
          />
        </Card.Content>
      </Card>

      {/* Logout Button */}
      <Button
        mode="outlined"
        icon="logout"
        onPress={() => setLogoutDialogVisible(true)}
        style={styles.logoutButton}
        textColor="#ef4444"
      >
        Sign Out
      </Button>

      {/* App Version */}
      <View style={styles.versionContainer}>
        <Text variant="bodySmall" style={styles.versionText}>
          MGR Capital Mobile v1.0.0
        </Text>
        <Text variant="bodySmall" style={styles.versionText}>
          Build 2026.01.26
        </Text>
      </View>

      {/* Logout Confirmation Dialog */}
      <Portal>
        <Dialog
          visible={logoutDialogVisible}
          onDismiss={() => setLogoutDialogVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Icon icon="logout" color="#ef4444" />
          <Dialog.Title style={styles.dialogTitle}>Sign Out?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogContent}>
              Are you sure you want to sign out? You'll need to log in again to access your account.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setLogoutDialogVisible(false)}>Cancel</Button>
            <Button textColor="#ef4444" onPress={handleLogout}>
              Sign Out
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  profileCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#1e293b',
    borderRadius: 16,
  },
  profileContent: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {},
  editButton: {
    position: 'absolute',
    right: -8,
    bottom: -8,
    backgroundColor: '#3b82f6',
  },
  profileName: {
    color: '#fff',
    marginBottom: 4,
  },
  profileEmail: {
    color: '#94a3b8',
    marginBottom: 12,
  },
  roleChip: {
    backgroundColor: '#3b82f620',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  memberSince: {
    color: '#64748b',
    marginTop: 4,
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
  listTitle: {
    color: '#fff',
  },
  listDescription: {
    color: '#64748b',
  },
  divider: {
    backgroundColor: '#334155',
  },
  logoutButton: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderColor: '#ef4444',
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingBottom: 48,
  },
  versionText: {
    color: '#475569',
  },
  dialog: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
  },
  dialogTitle: {
    color: '#fff',
    textAlign: 'center',
  },
  dialogContent: {
    color: '#94a3b8',
    textAlign: 'center',
  },
});
