import React from 'react';
import {Image, StyleProp, ImageStyle} from 'react-native';

const whatsappLogo = require('../assets/images/logos/whatsapp.png');

interface Props {
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export default function WhatsAppLogo({size = 16, style}: Props) {
  return (
    <Image
      source={whatsappLogo}
      style={[{width: size, height: size}, style]}
      resizeMode="contain"
    />
  );
}
