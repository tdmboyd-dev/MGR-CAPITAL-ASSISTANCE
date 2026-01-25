/**
 * MGR Capital Mobile App
 *
 * STUB IMPLEMENTATION
 * This is a basic scaffold for the React Native mobile app.
 * Requires: npx create-expo-app to fully set up.
 */

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider, MD3DarkTheme } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Screens (stubs)
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import CasesScreen from './screens/CasesScreen';

// Context
import { AuthProvider } from './contexts/AuthContext';

const Stack = createNativeStackNavigator();
const queryClient = new QueryClient();

const theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#3b82f6',
    secondary: '#10b981',
  },
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SafeAreaProvider>
          <PaperProvider theme={theme}>
            <NavigationContainer>
              <Stack.Navigator
                initialRouteName="Login"
                screenOptions={{
                  headerStyle: { backgroundColor: '#0f172a' },
                  headerTintColor: '#fff',
                }}
              >
                <Stack.Screen
                  name="Login"
                  component={LoginScreen}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="Dashboard"
                  component={DashboardScreen}
                  options={{ title: 'MGR Capital' }}
                />
                <Stack.Screen
                  name="Cases"
                  component={CasesScreen}
                  options={{ title: 'Cases' }}
                />
              </Stack.Navigator>
            </NavigationContainer>
            <StatusBar style="light" />
          </PaperProvider>
        </SafeAreaProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
