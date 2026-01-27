/**
 * Login Screen — MGR CAPITAL ASSISTANCE Mobile
 *
 * Authentication screen with:
 * - Email/password login
 * - Password visibility toggle
 * - Remember me option (via SecureStore)
 * - Loading states and error handling
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  Surface,
  IconButton,
  HelperText,
} from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = async () => {
    Keyboard.dismiss();

    // Validate inputs
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(email.trim(), password);
      // Navigation happens automatically via AppNavigator
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          {/* Logo/Branding */}
          <View style={styles.brandingContainer}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>MGR</Text>
            </View>
            <Text variant="headlineMedium" style={styles.title}>
              MGR Capital
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              Surplus Recovery Platform
            </Text>
          </View>

          {/* Login Form */}
          <Surface style={styles.card}>
            <Text variant="titleLarge" style={styles.cardTitle}>
              Welcome Back
            </Text>
            <Text variant="bodyMedium" style={styles.cardSubtitle}>
              Sign in to access your account
            </Text>

            <TextInput
              label="Email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (error) setError('');
              }}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              style={styles.input}
              outlineColor="#334155"
              activeOutlineColor="#3b82f6"
              textColor="#fff"
              left={<TextInput.Icon icon="email" color="#64748b" />}
              disabled={loading}
            />

            <TextInput
              label="Password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (error) setError('');
              }}
              mode="outlined"
              secureTextEntry={!showPassword}
              autoComplete="password"
              textContentType="password"
              style={styles.input}
              outlineColor="#334155"
              activeOutlineColor="#3b82f6"
              textColor="#fff"
              left={<TextInput.Icon icon="lock" color="#64748b" />}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  color="#64748b"
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
              disabled={loading}
              onSubmitEditing={handleLogin}
            />

            {error ? (
              <HelperText type="error" visible={!!error} style={styles.error}>
                {error}
              </HelperText>
            ) : null}

            <TouchableOpacity
              onPress={() => {}}
              style={styles.forgotPassword}
              disabled={loading}
            >
              <Text variant="bodySmall" style={styles.forgotPasswordText}>
                Forgot password?
              </Text>
            </TouchableOpacity>

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={styles.button}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialButtons}>
              <Button
                mode="outlined"
                icon="google"
                style={styles.socialButton}
                contentStyle={styles.socialButtonContent}
                textColor="#fff"
                disabled={loading}
              >
                Google
              </Button>
              <Button
                mode="outlined"
                icon="apple"
                style={styles.socialButton}
                contentStyle={styles.socialButtonContent}
                textColor="#fff"
                disabled={loading}
              >
                Apple
              </Button>
            </View>
          </Surface>

          {/* Footer */}
          <View style={styles.footer}>
            <Text variant="bodySmall" style={styles.footerText}>
              Don't have an account?{' '}
              <Text style={styles.footerLink}>Contact us</Text>
            </Text>
            <Text variant="bodySmall" style={styles.version}>
              v1.0.0 - Secure - Private - Sovereign
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  brandingContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  logoText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  title: {
    color: '#fff',
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: '#64748b',
  },
  card: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#1e293b',
  },
  cardTitle: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  cardSubtitle: {
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#0f172a',
  },
  error: {
    color: '#ef4444',
    marginTop: -8,
    marginBottom: 8,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    marginTop: -8,
  },
  forgotPasswordText: {
    color: '#3b82f6',
  },
  button: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
  },
  buttonContent: {
    height: 48,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155',
  },
  dividerText: {
    color: '#64748b',
    paddingHorizontal: 16,
    fontSize: 12,
  },
  socialButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  socialButton: {
    flex: 1,
    borderColor: '#334155',
    borderRadius: 12,
  },
  socialButtonContent: {
    height: 44,
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    color: '#64748b',
  },
  footerLink: {
    color: '#3b82f6',
  },
  version: {
    color: '#475569',
    marginTop: 12,
  },
});
