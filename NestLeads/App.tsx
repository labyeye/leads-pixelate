import React, { useEffect, useState } from 'react';
import { setUsageIdentity } from './src/utils/usageTracker';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Image,
  StatusBar,
  Linking,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import AuthNavigator from './src/navigation/AuthNavigator';
import AnimatedSplashScreen from './src/screens/AnimatedSplashScreen';
import {
  createNotificationChannels,
  requestNotificationPermission,
  setupForegroundNotificationHandler,
  getInitialNotification,
  clearAllNotifications,
} from './src/services/notificationService';
import {
  navigateToLead,
  navigateFromNotification,
} from './src/navigation/navigationRef';
import { setupPushNotifications } from './src/services/pushService';
import { useLeadPolling } from './src/hooks/useLeadPolling';
import storage from './src/utils/storage';

const LogoWithName = require('./src/assets/images/NestLeadLogo.png');

function NotificationInit() {
  const { user } = useAuth();
  setUsageIdentity(user);

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
    const unsub = setupForegroundNotificationHandler(data => {
      if (data.leadId) navigateToLead(String(data.leadId));
      else navigateFromNotification(data);
    });
    return () => unsub();
  }, []);

  // Server push (Firebase): register this phone once signed in; a tap opens what the notification is about.
  useEffect(() => {
    if (!user) return;
    let cleanup = () => {};
    let cancelled = false;
    setupPushNotifications(data => navigateFromNotification(data)).then(fn =>
      cancelled ? fn() : (cleanup = fn),
    );
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [user?._id]);

  // Clear badge when user opens the app
  useEffect(() => {
    if (user) {
      clearAllNotifications();
    }
  }, [user]);

  return null;
}

function RootNavigator() {
  const { user, isLoading } = useAuth();

  // Poll for new leads only when logged in
  useLeadPolling(!!user, user?._id);

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <Image
          source={LogoWithName}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <ActivityIndicator
          color="#024BAB"
          size="large"
          style={{ marginTop: 32 }}
        />
      </View>
    );
  }

  if (!user) return <AuthNavigator />;
  return <AppNavigator />;
}

export default function App() {
  const [splashDone, setSplashDone] = useState(false);

  if (!splashDone) {
    return (
      <>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <AnimatedSplashScreen onDone={() => setSplashDone(true)} />
      </>
    );
  }

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
  splashLogo: { width: 220, height: 80 },
});
