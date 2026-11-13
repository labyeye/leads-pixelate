/**
 * @format
 */

import { AppRegistry } from 'react-native';
import './src/utils/errorAlert';
import App from './App';
import { name as appName } from './app.json';

// Must be registered before AppRegistry for background/killed state notifications
import { setupBackgroundNotificationHandler } from './src/services/notificationService';
setupBackgroundNotificationHandler();

// Android needs a background handler registered before the app component; the system tray shows the push itself.
try {
  const m = require('@react-native-firebase/messaging');
  m.setBackgroundMessageHandler(m.getMessaging(), async () => {});
} catch {}

AppRegistry.registerComponent(appName, () => App);
