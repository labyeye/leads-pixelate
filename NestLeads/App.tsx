import React, {useEffect, useState} from 'react';
import {View, StyleSheet, ActivityIndicator, Image, StatusBar, Linking} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AuthProvider, useAuth} from './src/contexts/AuthContext';
import {ThemeProvider, useTheme} from './src/contexts/ThemeContext';
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
  const {colors} = useTheme();

  // Poll for new leads only when logged in
  useLeadPolling(!!user);

  if (isLoading) {
    return (
      <View style={[styles.splash, {backgroundColor: colors.background}]}>
        <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.background} />
        <Image
          source={LogoWithName}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <ActivityIndicator color={colors.primary} size="large" style={{marginTop: 32}} />
      </View>
    );
  }

  if (!user) return <AuthNavigator />;
  return <AppNavigator />;
}

function AppRoot() {
  const [splashDone, setSplashDone] = useState(false);
  const {colors} = useTheme();

  if (!splashDone) {
    return (
      <GestureHandlerRootView style={{flex: 1}}>
        <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.background} />
        <AnimatedSplashScreen onDone={() => setSplashDone(true)} />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <AuthProvider>
          <NotificationInit />
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppRoot />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  splashLogo: {width: 220, height: 80},
});
