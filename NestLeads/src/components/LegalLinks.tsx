// "By continuing you agree to the Terms of Service and Privacy Policy" with tappable links (open in the browser).
// Shown on the login screen; the sign-in request carries acceptTerms so acceptance is stored once per account.
import React from 'react';
import { Linking, Text, TextStyle } from 'react-native';

const SITE = 'https://www.pixelatenest.com/legal';
const PRIMARY = '#024BAB';

export default function LegalLinks({
  prefix = 'By continuing you agree to the',
  style,
}: {
  prefix?: string;
  style?: TextStyle;
}) {
  const link: TextStyle = {
    color: PRIMARY,
    fontWeight: '400',
    textDecorationLine: 'underline',
  };
  return (
    <Text
      style={[
        { fontSize: 12, color: '#64748b', textAlign: 'center', lineHeight: 18 },
        style,
      ]}
    >
      {prefix}{' '}
      <Text
        style={link}
        onPress={() => Linking.openURL(`${SITE}/terms-of-service.html`)}
      >
        Terms of Service
      </Text>{' '}
      and{' '}
      <Text
        style={link}
        onPress={() => Linking.openURL(`${SITE}/privacy-policy.html`)}
      >
        Privacy Policy
      </Text>
      .
    </Text>
  );
}
