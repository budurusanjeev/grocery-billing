import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../lib/theme';

interface HeaderProps {
  icon: string;
  title: string;
  subtitle?: string;
  // Swaps the emoji badge for the real app icon -- used only for the
  // "Groci" home screen, since every other screen's icon is a functional
  // per-screen indicator (Catalog, Scan, etc.), not a brand mark.
  logo?: boolean;
}

export default function Header({ icon, title, subtitle, logo }: HeaderProps) {
  return (
    <View style={styles.wrap}>
      {logo ? (
        <Image source={require('../../assets/images/icon.png')} style={styles.logoImage} />
      ) : (
        <View style={styles.badge}>
          <Text style={styles.badgeIcon}>{icon}</Text>
        </View>
      )}
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
  logoImage: { width: 34, height: 34 },
  title: { color: '#ffffff', fontSize: 17, fontWeight: '800' },
  subtitle: { color: colors.brandLight, fontSize: 11, fontWeight: '500', marginTop: -1 },
});
