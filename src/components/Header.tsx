import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../lib/theme';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  return (
    <View style={styles.wrap}>
      <Image source={require('../../assets/images/icon.png')} style={styles.logoImage} />
      <View>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoImage: { width: 34, height: 34 },
  title: { color: '#ffffff', fontSize: 17, fontWeight: '800' },
  subtitle: { color: colors.brandLight, fontSize: 11, fontWeight: '500', marginTop: -1 },
});
