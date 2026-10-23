import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import { withSlideUp } from '../components/motion';
import IntroOnboardingScreen from '../screens/IntroOnboardingScreen';

const ForgotPasswordAnim = withSlideUp(ForgotPasswordScreen);

export type AuthStackParamList = {
  IntroOnboarding: undefined;
  Login: undefined;
  ForgotPassword: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

// Mounted instead of AppNavigator (never alongside it), so it owns its own
// NavigationContainer rather than nesting inside AppNavigator's.
export default function AuthNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="IntroOnboarding" component={IntroOnboardingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordAnim} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
