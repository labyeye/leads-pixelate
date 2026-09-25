import * as React from 'react';
// eslint-disable-next-line no-restricted-imports
import * as RN from 'react-native';

const FONT_BY_WEIGHT: Record<string, string> = {
  '100': 'DMSans-Regular',
  '200': 'DMSans-Regular',
  '300': 'DMSans-Regular',
  normal: 'DMSans-Regular',
  '400': 'DMSans-Regular',
  '500': 'DMSans-Medium',
  '600': 'DMSans-SemiBold',
  bold: 'DMSans-SemiBold',
  '700': 'DMSans-SemiBold',
  '800': 'DMSans-SemiBold',
  '900': 'DMSans-SemiBold',
};

function resolveFontFamily(flatStyle: any): string {
  const weight = flatStyle?.fontWeight != null ? String(flatStyle.fontWeight) : 'normal';
  return FONT_BY_WEIGHT[weight] || 'DMSans-Regular';
}

function withDMSans<P extends {style?: any}>(Component: React.ComponentType<P>) {
  return React.forwardRef<any, P>((props: any, ref) => {
    const flatStyle = RN.StyleSheet.flatten(props.style) || {};
    const fontFamily = flatStyle.fontFamily || resolveFontFamily(flatStyle);
    const {fontWeight, ...rest} = flatStyle;
    return <Component {...props} ref={ref} style={[rest, {fontFamily}]} />;
  });
}

export * from 'react-native';
export const Text = withDMSans(RN.Text) as unknown as typeof RN.Text;
export const TextInput = withDMSans(RN.TextInput) as unknown as typeof RN.TextInput;
// react-native's `PushNotificationIOS` getter eagerly constructs a
// NativeEventEmitter around a native module this app doesn't link, which
// throws the moment anything reads it (e.g. Fast Refresh's export scan).
// Explicitly shadowing it here keeps Babel's `export *` from ever defining
// a passthrough getter for it, so the real getter is never touched.
export const PushNotificationIOS = undefined as any;
export default RN;
