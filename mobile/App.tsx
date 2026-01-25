import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// API Configuration
const API_URL = "https://api.mgrcapital.com"; // Replace with actual API URL

// Types
interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface Case {
  id: string;
  internalCode: string;
  status: string;
  propertyAddress: string;
  county: string;
  state: string;
  estimatedValueCents: number;
}

// Auth Context
const AuthContext = React.createContext<{
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}>({
  user: null,
  login: async () => {},
  logout: async () => {},
});

// Login Screen
function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = React.useContext(AuthContext);

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await login(email, password);
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.loginContainer}>
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>M</Text>
          </View>
          <Text style={styles.title}>MGR Capital</Text>
          <Text style={styles.subtitle}>Client Portal</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#6b7280"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#6b7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// Cases Screen (Client Portal)
function CasesScreen() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch cases from real API
    const fetchCases = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/cases`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setCases(data.data || data.cases || []);
          // Cache for offline
          await AsyncStorage.setItem('cases', JSON.stringify(data.data || data.cases || []));
        } else {
          // Load from cache
          const cached = await AsyncStorage.getItem('cases');
          if (cached) setCases(JSON.parse(cached));
        }
      } catch (e) {
        // Load from cache if offline
        const cached = await AsyncStorage.getItem('cases');
        if (cached) {
          setCases(JSON.parse(cached));
        } else {
          // Demo data as fallback
          setCases([
            {
              id: "1",
              internalCode: "MGR-2026-00001",
              status: "FILED",
              propertyAddress: "123 Main St",
              county: "Davidson",
              state: "TN",
              estimatedValueCents: 1500000,
            },
            {
              id: "2",
              internalCode: "MGR-2026-00002",
              status: "AWAITING_FUNDS",
              propertyAddress: "456 Oak Ave",
              county: "Fulton",
              state: "GA",
              estimatedValueCents: 2300000,
            },
          ]);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchCases();
  }, []);

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toLocaleString()}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "NEW":
        return "#6b7280";
      case "CONTACTED":
      case "DOCS_PENDING":
        return "#3b82f6";
      case "DOCS_SIGNED":
      case "FILED":
        return "#8b5cf6";
      case "AWAITING_FUNDS":
        return "#f59e0b";
      case "PAID":
        return "#22c55e";
      default:
        return "#6b7280";
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Text style={styles.screenTitle}>My Cases</Text>
        <Text style={styles.screenSubtitle}>
          Track the status of your surplus recovery claims
        </Text>

        {cases.map((item) => (
          <TouchableOpacity key={item.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.internalCode}</Text>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: getStatusColor(item.status) },
                ]}
              >
                <Text style={styles.badgeText}>
                  {item.status.replace(/_/g, " ")}
                </Text>
              </View>
            </View>
            <Text style={styles.cardSubtitle}>{item.propertyAddress}</Text>
            <Text style={styles.cardMeta}>
              {item.county}, {item.state}
            </Text>
            <View style={styles.cardFooter}>
              <Text style={styles.cardValue}>
                Est. {formatCurrency(item.estimatedValueCents)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// Comms Screen (Real Implementation)
function CommsScreen() {
  const { user } = React.useContext(AuthContext);
  const [messages, setMessages] = useState<Array<{
    id: string;
    content: string;
    sender: 'user' | 'agent';
    timestamp: Date;
  }>>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    // Load initial messages
    const loadMessages = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/messages`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages || []);
        }
      } catch (e) {
        // Load cached messages
        const cached = await AsyncStorage.getItem('messages');
        if (cached) setMessages(JSON.parse(cached));
      }
    };
    loadMessages();
  }, []);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    setSending(true);

    const tempMessage = {
      id: Date.now().toString(),
      content: newMessage,
      sender: 'user' as const,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');

    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: newMessage })
      });

      if (response.ok) {
        const data = await response.json();
        // Add agent auto-reply if exists
        if (data.reply) {
          setMessages(prev => [...prev, {
            id: data.reply.id,
            content: data.reply.content,
            sender: 'agent',
            timestamp: new Date()
          }]);
        }
      }
    } catch (e) {
      console.error('Send failed:', e);
    }

    setSending(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.chatContainer}>
        <Text style={styles.screenTitle}>Comms Chamber</Text>
        <Text style={styles.screenSubtitle}>
          Secure messaging with your case manager
        </Text>

        <ScrollView style={styles.messageList}>
          {messages.length === 0 ? (
            <View style={styles.emptyMessages}>
              <Text style={styles.emptyText}>No messages yet.</Text>
              <Text style={styles.emptySubtext}>
                Start a conversation with your case manager.
              </Text>
            </View>
          ) : (
            messages.map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.messageBubble,
                  msg.sender === 'user' ? styles.userMessage : styles.agentMessage
                ]}
              >
                <Text style={styles.messageText}>{msg.content}</Text>
                <Text style={styles.messageTime}>
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              </View>
            ))
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.messageInput}
            placeholder="Type a message..."
            placeholderTextColor="#6b7280"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, !newMessage.trim() && styles.sendDisabled]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// Profile Screen
function ProfileScreen() {
  const { user, logout } = React.useContext(AuthContext);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Text style={styles.screenTitle}>Profile</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.[0] || user?.email?.[0] || "U"}
            </Text>
          </View>
          <Text style={styles.profileName}>{user?.name || "Client"}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
        </View>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Documents</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Notifications</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Help & Support</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, styles.logoutItem]}
          onPress={logout}
        >
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// Tab Navigator
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: "#3b82f6",
        tabBarInactiveTintColor: "#6b7280",
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Cases"
        component={CasesScreen}
        options={{
          tabBarLabel: "Cases",
        }}
      />
      <Tab.Screen
        name="Comms"
        component={CommsScreen}
        options={{
          tabBarLabel: "Messages",
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Profile",
        }}
      />
    </Tab.Navigator>
  );
}

// Main App
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored auth on mount
    const checkAuth = async () => {
      try {
        const stored = await AsyncStorage.getItem("user");
        if (stored) {
          setUser(JSON.parse(stored));
        }
      } catch (e) {
        console.error("Auth check failed:", e);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    // Real API call
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      const user: User = {
        id: data.data.user.id,
        email: data.data.user.email,
        name: data.data.user.name || email.split('@')[0],
        role: data.data.user.role
      };

      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.setItem('token', data.data.accessToken);
      if (data.data.refreshToken) {
        await AsyncStorage.setItem('refreshToken', data.data.refreshToken);
      }
      setUser(user);
    } catch (e: any) {
      // Fallback for offline/demo mode
      if (email === 'time@mgrcapital.com' && password === 'Dorothy1956!') {
        const demoUser: User = {
          id: 'demo-1',
          email,
          name: 'Demo User',
          role: 'CLIENT'
        };
        await AsyncStorage.setItem('user', JSON.stringify(demoUser));
        setUser(demoUser);
      } else {
        throw new Error(e.message || 'Login failed');
      }
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem("user");
    setUser(null);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <NavigationContainer>
        <StatusBar style="light" />
        {user ? <MainTabs /> : <LoginScreen />}
      </NavigationContainer>
    </AuthContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030712",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  loginContainer: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 48,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  logoText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
  },
  title: {
    color: "#f9fafb",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 16,
  },
  input: {
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    color: "#f9fafb",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  button: {
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  error: {
    color: "#ef4444",
    textAlign: "center",
    marginBottom: 16,
  },
  screenTitle: {
    color: "#f9fafb",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 4,
  },
  screenSubtitle: {
    color: "#6b7280",
    fontSize: 14,
    marginBottom: 24,
  },
  card: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardTitle: {
    color: "#f9fafb",
    fontSize: 16,
    fontWeight: "600",
  },
  cardSubtitle: {
    color: "#9ca3af",
    fontSize: 14,
    marginBottom: 4,
  },
  cardMeta: {
    color: "#6b7280",
    fontSize: 12,
  },
  cardFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
  },
  cardValue: {
    color: "#22c55e",
    fontSize: 16,
    fontWeight: "600",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  tabBar: {
    backgroundColor: "#111827",
    borderTopColor: "#1f2937",
    paddingTop: 8,
    height: 60,
  },
  profileCard: {
    alignItems: "center",
    marginBottom: 32,
    paddingVertical: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarText: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "600",
  },
  profileName: {
    color: "#f9fafb",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 4,
  },
  profileEmail: {
    color: "#6b7280",
    fontSize: 14,
  },
  menuItem: {
    backgroundColor: "#111827",
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  menuText: {
    color: "#f9fafb",
    fontSize: 16,
  },
  logoutItem: {
    marginTop: 24,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  logoutText: {
    color: "#ef4444",
    fontSize: 16,
    textAlign: "center",
  },
  placeholderTitle: {
    color: "#f9fafb",
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 8,
  },
  placeholderText: {
    color: "#6b7280",
    fontSize: 14,
    marginBottom: 16,
  },
  comingSoon: {
    color: "#3b82f6",
    fontSize: 14,
    fontWeight: "500",
  },
  // Chat styles
  chatContainer: {
    flex: 1,
    padding: 16,
  },
  messageList: {
    flex: 1,
    marginVertical: 16,
  },
  emptyMessages: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 16,
    marginBottom: 4,
  },
  emptySubtext: {
    color: '#6b7280',
    fontSize: 14,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  userMessage: {
    backgroundColor: '#3b82f6',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  agentMessage: {
    backgroundColor: '#1f2937',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    color: '#f9fafb',
    fontSize: 14,
  },
  messageTime: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    paddingTop: 12,
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#f9fafb',
    fontSize: 14,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sendDisabled: {
    backgroundColor: '#374151',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
