import { Alert } from 'react-native';

// One place so every error/validation popup (300+ call sites) reads the same:
// plain message, never blank, dismissed with "Got it".
const IS_ERROR =
  /^(error|failed|validation|missing|required|invalid|upload failed|oops)/i;
const orig = Alert.alert.bind(Alert);

Alert.alert = (title, message, buttons, options) =>
  IS_ERROR.test(title)
    ? orig(
        title,
        message || 'Something went wrong. Please try again.',
        buttons ?? [{ text: 'Got it' }],
        options,
      )
    : orig(title, message, buttons, options);
