import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface HeaderProps {
  icon: string;
  title: string;
  subtitle?: string;
}

export default function Header({ icon, title, subtitle }: HeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.badge}>
        <Text style={styles.badgeIcon}>{icon}</Text>
      </View>
      <View>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIcon: { fontSize: 18 },
  title: { color: '#ffffff', fontSize: 17, fontWeight: '800' },
  subtitle: { color: '#bbf7d0', fontSize: 11, fontWeight: '500', marginTop: -1 },
});
