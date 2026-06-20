import React from 'react';
import {View, Text, Image, StyleSheet} from 'react-native';

const PRIMARY = '#024BAB';
const SECONDARY = '#FF751F';

interface Props {
  name?: string;
  avatar?: string;
  size?: number;
  index?: number; // for alternating colors when no photo
  style?: any;
  textStyle?: any;
}

export default function UserAvatar({name, avatar, size = 38, index = 0, style, textStyle}: Props) {
  const initial = (name || 'U')[0].toUpperCase();
  const bg = index % 2 === 0 ? PRIMARY : SECONDARY;
  const fontSize = Math.round(size * 0.38);

  if (avatar) {
    return (
      <Image
        source={{uri: avatar}}
        style={[styles.img, {width: size, height: size, borderRadius: 0}, style]}
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={[styles.initials, {width: size, height: size, backgroundColor: bg}, style]}>
      <Text style={[styles.initialsText, {fontSize}, textStyle]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  img: {
    borderWidth: 2,
    borderColor: '#000',
    overflow: 'hidden',
  },
  initials: {
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontWeight: '900',
    color: '#fff',
  },
});
