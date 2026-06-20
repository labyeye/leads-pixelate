import React, {useEffect} from 'react';
import {View, StyleSheet, ActivityIndicator, Image, StatusBar, Linking} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AuthProvider, useAuth} from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import LoginScreen from './src/screens/LoginScreen';
import {
  createNotificationChannels,
  requestNotificationPermission,
  setupForegroundNotificationHandler,
  getInitialNotification,
  clearAllNotifications,
} from './src/services/notificationService';
import {navigateToLead} from './src/navigation/navigationRef';
import {useLeadPolling} from './src/hooks/useLeadPolling';
import storage from './src/utils/storage';

const LogoWithName = require('./src/assets/images/NestLeads_Logo_Name.png');

function NotificationInit() {
  const {user} = useAuth();

  useEffect(() => {
    (async () => {
      await createNotificationChannels();
      await requestNotificationPermission();

      // Handle notification that launched the app from killed state
      const initial = await getInitialNotification();
      if (initial?.notification?.data?.leadId) {
        // Small delay to let navigation mount
        setTimeout(() => {
          navigateToLead(initial.notification.data!.leadId as string);
        }, 800);
      }

      // Handle pending call action from background notification
      const pendingLeadId = await storage.getItem('pending_lead_action');
      if (pendingLeadId) {
        await storage.removeItem('pending_lead_action');
        setTimeout(() => navigateToLead(pendingLeadId), 800);
      }
    })();
  }, []);

  // Foreground notification press handler
  useEffect(() => {
    const unsub = setupForegroundNotificationHandler((leadId) => {
      navigateToLead(leadId);
    });
    return () => unsub();
  }, []);

  // Clear badge when user opens the app
  useEffect(() => {
    if (user) {
      clearAllNotifications();
    }
  }, [user]);

  return null;
}

function RootNavigator() {
  const {user, isLoading} = useAuth();

  // Poll for new leads only when logged in
  useLeadPolling(!!user);

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <Image
          source={LogoWithName}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <ActivityIndicator color="#024BAB" size="large" style={{marginTop: 32}} />
      </View>
    );
  }

  if (!user) return <LoginScreen />;
  return <AppNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationInit />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  splashLogo: {width: 220, height: 80},
});
