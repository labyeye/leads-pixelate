import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from './Icon';
import UserAvatar from './UserAvatar';
import { Hand, User } from 'lucide-react-native';
import PaceBadge from './PaceBadge';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  name?: string;
  avatar?: string;
  title: string;
  badge?: boolean;
  onMenu?: () => void;
  onSearch?: () => void;
  onBell?: () => void;
  onAvatar?: () => void;
}

/** Shared top bar: menu · search · bell(dot) · avatar, then greeting + page title. */
export default function AppHeader({
  name,
  avatar,
  title,
  badge,
  onMenu,
  onSearch,
  onBell,
  onAvatar,
}: Props) {
  const { user } = useAuth();
  const isStaff = !['admin', 'super_admin'].includes(user?.role);
  const h = new Date().getHours();
  const greeting =
    h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  const first = (name || 'User').split(' ')[0];
  return (
    <View style={s.wrap}>
      <View style={s.row}>
        <TouchableOpacity onPress={onMenu} hitSlop={10}>
          <Icon name="menu" size={26} color="#000" />
        </TouchableOpacity>
        <View style={s.right}>
          <TouchableOpacity onPress={onSearch} hitSlop={10}>
            <Icon name="search-outline" size={24} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onBell} hitSlop={10}>
            <Icon name="notifications-outline" size={24} color="#000" />
            {badge && <View style={s.dot} />}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onAvatar}
            activeOpacity={0.8}
            style={s.avatar}
          >
            <UserAvatar
              name={name}
              avatar={avatar}
              size={38}
              index={0}
              style={{ borderRadius: 19 }}
            />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={s.greet}>
        {greeting}, {first} <Hand size={14} color="#475569" style={{ marginLeft: 4 }} />
      </Text>
      <Text style={s.title}>{title}</Text>
      {isStaff && <PaceBadge />}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  dot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#2563eb',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  avatar: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden' },
  greet: { marginTop: 14, fontSize: 13, color: '#475569', fontWeight: '500' },
  title: { fontSize: 28, fontWeight: '500', color: '#000', marginTop: 2 },
});
