import * as React from 'react';
// eslint-disable-next-line no-restricted-imports
import * as RN from 'react-native';
import {getFontScale, subscribeFontScale} from '../theme/fontScale';

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

// No JSX here on purpose: a JSX-bearing file gets treated by Metro's Fast
// Refresh transform as a component-boundary module, which eagerly reads
// every re-exported key (including this file's `export * from 'react-native'`)
// at load time to compute refresh signatures. That touches core RN lazy
// getters (DevSettings, AppState, Keyboard, Modal, PushNotificationIOS, ...)
// before their native modules are ready, crashing with
// `new NativeEventEmitter() requires a non-null argument`. Plain
// React.createElement keeps this file out of that instrumentation.
function withDMSans<P extends {style?: any}>(Component: React.ComponentType<P>) {
  return React.forwardRef<any, P>((props: any, ref) => {
    const scale = React.useSyncExternalStore(subscribeFontScale, getFontScale);
    const flatStyle = RN.StyleSheet.flatten(props.style) || {};
    const fontFamily = flatStyle.fontFamily || resolveFontFamily(flatStyle);
    const {fontWeight, fontSize, ...rest} = flatStyle;
    const scaledFontSize = fontSize != null ? fontSize * scale : undefined;
    return React.createElement(Component, {
      ...props,
      ref,
      style: [rest, {fontFamily}, scaledFontSize != null && {fontSize: scaledFontSize}],
    });
  });
}

// Drop-in TouchableOpacity with a spring scale + opacity press effect, so every
// button in the app gets animated feedback without touching call sites.
// Built lazily (first render) and with createElement only — see note above.
let AnimatedPressable: any;
const TouchableOpacity = React.forwardRef<any, any>((props, ref) => {
  const {activeOpacity = 0.7, disabled, style, onPressIn, onPressOut, children, ...rest} = props;
  const press = React.useRef(new RN.Animated.Value(0)).current;
  if (!AnimatedPressable) {
    AnimatedPressable = RN.Animated.createAnimatedComponent(RN.Pressable);
  }
  const to = (toValue: number) =>
    RN.Animated.spring(press, {toValue, friction: 7, tension: 220, useNativeDriver: true}).start();
  const animStyle = React.useMemo(
    () => ({
      opacity: press.interpolate({inputRange: [0, 1], outputRange: [1, activeOpacity]}),
      transform: [{scale: press.interpolate({inputRange: [0, 1], outputRange: [1, 0.96]})}],
    }),
    [press, activeOpacity],
  );
  return React.createElement(
    AnimatedPressable,
    {
      ...rest,
      ref,
      disabled,
      style: [style, animStyle],
      onPressIn: (e: any) => {
        if (!disabled) to(1);
        onPressIn?.(e);
      },
      onPressOut: (e: any) => {
        to(0);
        onPressOut?.(e);
      },
    },
    children,
  );
});
TouchableOpacity.displayName = 'TouchableOpacity';

// Transparent bottom-sheet modals: the native "slide" animation drags the
// dimmed backdrop up with the sheet. Instead keep the native modal static and
// fade + spring the content in/out, staying mounted until the exit finishes.
const NativeModal: any = RN.Modal;
const Modal = React.forwardRef<any, any>((props, ref) => {
  const {visible, transparent, animationType, children, ...rest} = props;
  const animated = !!transparent && (animationType === 'slide' || animationType === 'fade');
  const [mounted, setMounted] = React.useState(!!visible);
  const t = React.useRef(new RN.Animated.Value(visible ? 1 : 0)).current;

  React.useEffect(() => {
    if (!animated) {
      return;
    }
    if (visible) {
      setMounted(true);
      RN.Animated.spring(t, {toValue: 1, friction: 10, tension: 45, useNativeDriver: true}).start();
    } else {
      RN.Animated.timing(t, {toValue: 0, duration: 260, useNativeDriver: true}).start(({finished}) => {
        if (finished) {
          setMounted(false);
        }
      });
    }
  }, [visible, animated, t]);

  if (!animated) {
    return React.createElement(NativeModal, {...props, ref});
  }
  const style = {
    flex: 1,
    opacity: t.interpolate({inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp'}),
    transform: [
      {
        translateY:
          animationType === 'slide'
            ? t.interpolate({inputRange: [0, 1], outputRange: [60, 0]})
            : 0,
      },
    ],
  };
  return React.createElement(
    NativeModal,
    {...rest, ref, transparent: true, animationType: 'none', visible: !!visible || mounted},
    React.createElement(RN.Animated.View, {style}, children),
  );
});
Modal.displayName = 'Modal';

export * from 'react-native';
export {TouchableOpacity, Modal};
export const Text = withDMSans(RN.Text) as unknown as typeof RN.Text;
export const TextInput = withDMSans(RN.TextInput) as unknown as typeof RN.TextInput;
// Belt-and-suspenders: react-native's `PushNotificationIOS` getter eagerly
// constructs a NativeEventEmitter around a native module this app doesn't
// link. Shadowing it keeps Babel's `export *` codegen from ever defining a
// passthrough getter for it, so the real getter is never touched even if
// something else enumerates this module's exports.
export const PushNotificationIOS = undefined as any;
export default RN;
