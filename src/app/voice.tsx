import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { loadItems, type Item } from '../lib/db';
import { matchItem } from '../lib/matcher';
import { cardShadow, colors, radius, spacing } from '../lib/theme';
import { formatMoney, showMessage } from '../lib/ui';
import { parseTranscript } from '../lib/voiceParser';
import { useBill } from '../state/bill';

const LANGUAGES = [
  { code: 'te-IN', label: 'తెలుగు' },
  { code: 'en-IN', label: 'English' },
  { code: 'hi-IN', label: 'हिंदी' },
];

export default function VoiceScreen() {
  const router = useRouter();
  const { lines, total, addLine } = useBill();
  const [items, setItems] = useState<Item[]>([]);
  const [lang, setLang] = useState('te-IN');
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [unmatched, setUnmatched] = useState<string[]>([]);
  // items in state may be stale inside event handlers; keep a ref in sync.
  const itemsRef = useRef<Item[]>([]);

  useEffect(() => {
    loadItems().then((loaded) => {
      setItems(loaded);
      itemsRef.current = loaded;
    });
  }, []);

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript ?? '';
    setInterim(transcript);
    if (event.isFinal && transcript.trim()) {
      handleFinalTranscript(transcript);
      setInterim('');
    }
  });

  useSpeechRecognitionEvent('end', () => setListening(false));

  useSpeechRecognitionEvent('error', (event) => {
    setListening(false);
    // "no-speech" just means silence; not worth an error popup.
    if (event.error !== 'no-speech') {
      showMessage('Voice error', event.message || event.error);
    }
  });

  const handleFinalTranscript = (transcript: string) => {
    const entries = parseTranscript(transcript);
    const misses: string[] = [];
    for (const entry of entries) {
      const item = matchItem(entry.query, itemsRef.current);
      if (item) {
        addLine(item, entry.qty);
      } else {
        misses.push(entry.query);
      }
    }
    if (misses.length > 0) {
      setUnmatched((prev) => [...misses, ...prev].slice(0, 10));
    }
  };

  const toggleListening = async () => {
    if (listening) {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        // ignore — recognizer may already be stopped
      }
      setListening(false);
      return;
    }
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        showMessage('Microphone needed', 'Please allow microphone access to use voice billing.');
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang,
        interimResults: true,
        continuous: true,
      });
      setListening(true);
    } catch (e: any) {
      // Native module missing = running in Expo Go. Voice needs a dev build.
      showMessage(
        'Voice not available here',
        'On Android, voice needs a development build: run "npx expo run:android" once from the project folder. (Voice works on the web version in Chrome right away.)',
      );
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.screen}>
        <View style={styles.langRow}>
          {LANGUAGES.map((l) => (
            <TouchableOpacity
              key={l.code}
              style={[styles.langChip, lang === l.code && styles.langChipActive]}
              onPress={() => !listening && setLang(l.code)}
            >
              <Text style={[styles.langText, lang === l.code && styles.langTextActive]}>
                {l.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.micBtn, listening && styles.micBtnActive]}
          onPress={toggleListening}
        >
          <Text style={styles.micIcon}>🎤</Text>
          <Text style={styles.micLabel}>
            {listening ? 'Listening… tap to stop' : 'Tap to speak'}
          </Text>
        </TouchableOpacity>

        {interim !== '' && <Text style={styles.interim}>{interim}</Text>}

        <Text style={styles.hint}>
          Say item and quantity, e.g. “kandi pappu rendu kilolu” or “Parle-G four packets”.
        </Text>

        {unmatched.length > 0 && (
          <View style={styles.unmatchedBox}>
            <Text style={styles.unmatchedTitle}>Not understood:</Text>
            <Text style={styles.unmatchedText}>{unmatched.join(', ')}</Text>
          </View>
        )}

        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={lines}
          keyExtractor={(l) => l.itemId}
          ListEmptyComponent={<Text style={styles.empty}>Spoken items will appear here.</Text>}
          renderItem={({ item: l }) => (
            <View style={styles.lineRow}>
              <Text style={styles.lineName}>{l.name}</Text>
              <Text style={styles.lineMeta}>
                {l.qty} {l.unit} × {formatMoney(l.price)} = {formatMoney(l.price * l.qty)}
              </Text>
            </View>
          )}
        />

        <View style={styles.totalBar}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatMoney(total)}</Text>
        </View>

        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => {
            // After a browser refresh there is no history, so "back" has
            // nowhere to go — fall back to the billing screen directly.
            if (router.canGoBack()) router.back();
            else router.replace('/');
          }}
        >
          <Text style={styles.doneBtnText}>✓ Done — back to bill</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 12 },
  langRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  langChip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  langChipActive: { backgroundColor: colors.accentPurple, borderColor: colors.accentPurple },
  langText: { fontSize: 15, color: '#334155' },
  langTextActive: { color: '#ffffff', fontWeight: '700' },
  micBtn: {
    backgroundColor: colors.accentPurple,
    borderRadius: radius.xl,
    paddingVertical: 22,
    alignItems: 'center',
    marginTop: 14,
    ...cardShadow,
  },
  micBtnActive: { backgroundColor: colors.accentRed },
  micIcon: { fontSize: 34 },
  micLabel: { color: '#ffffff', fontSize: 16, fontWeight: '700', marginTop: 6 },
  interim: {
    marginTop: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: '#ede9fe',
    borderRadius: radius.sm,
    padding: 10,
  },
  hint: { marginTop: 8, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  unmatchedBox: {
    backgroundColor: '#fef2f2',
    borderRadius: radius.sm,
    padding: 10,
    marginTop: 8,
  },
  unmatchedTitle: { color: '#b91c1c', fontWeight: '700', fontSize: 13 },
  unmatchedText: { color: '#b91c1c', fontSize: 13 },
  list: { flex: 1, marginTop: 10 },
  listContent: { paddingBottom: spacing.listBottom },
  empty: { textAlign: 'center', color: colors.textFaint, marginTop: 30, fontSize: 14 },
  lineRow: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 7,
    ...cardShadow,
  },
  lineName: { fontSize: 15, fontWeight: '600', color: colors.text },
  lineMeta: { fontSize: 13, color: colors.brand },
  totalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 6,
    ...cardShadow,
  },
  totalLabel: { color: colors.brandLight, fontSize: 16, fontWeight: '600' },
  totalValue: { color: '#ffffff', fontSize: 26, fontWeight: '800' },
  doneBtn: {
    backgroundColor: '#16a34a',
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    ...cardShadow,
  },
  doneBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
