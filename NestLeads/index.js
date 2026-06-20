/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

// Must be registered before AppRegistry for background/killed state notifications
import {setupBackgroundNotificationHandler} from './src/services/notificationService';
setupBackgroundNotificationHandler();

AppRegistry.registerComponent(appName, () => App);
