import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { loadItems, type Item } from '../lib/db';
import { matchItem } from '../lib/matcher';
import { cardShadow, colors, pressedDim, radius, ripple, spacing } from '../lib/theme';
import { formatMoney, showMessage } from '../lib/ui';
import { parseTranscript } from '../lib/voiceParser';
import { useBill } from '../state/bill';

const LANGUAGES = [
  { code: 'te-IN', label: 'తెలుగు' },
  { code: 'en-IN', label: 'English' },
  { code: 'hi-IN', label: 'हिंदी' },
];

const ADDED_TOAST_MS = 2200;

export default function VoiceScreen() {
  const router = useRouter();
  const { lines, total, addLine, updateQty, removeLine } = useBill();
  const [items, setItems] = useState<Item[]>([]);
  const [lang, setLang] = useState('te-IN');
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  // items in state may be stale inside event handlers; keep a ref in sync.
  const itemsRef = useRef<Item[]>([]);
  // The recognizer fires "end" after every pause even with continuous:true
  // (varies by device) — this ref tracks whether the shopkeeper actually
  // asked us to stop, so "end" can restart listening automatically instead.
  const keepListeningRef = useRef(false);
  const addedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadItems().then((loaded) => {
      setItems(loaded);
      itemsRef.current = loaded;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (addedTimerRef.current) clearTimeout(addedTimerRef.current);
    };
  }, []);

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript ?? '';
    setInterim(transcript);
    if (event.isFinal && transcript.trim()) {
      handleFinalTranscript(transcript);
      setInterim('');
    }
  });

  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    if (keepListeningRef.current) {
      startRecognizer();
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    setListening(false);
    if (event.error === 'no-speech') {
      // Just silence — keep the session going if the shopkeeper hasn't stopped.
      if (keepListeningRef.current) startRecognizer();
      return;
    }
    keepListeningRef.current = false;
    showMessage('Voice error', event.message || event.error);
  });

  const flashAdded = (label: string) => {
    setJustAdded(label);
    if (addedTimerRef.current) clearTimeout(addedTimerRef.current);
    addedTimerRef.current = setTimeout(() => setJustAdded(null), ADDED_TOAST_MS);
  };

  const handleFinalTranscript = (transcript: string) => {
    const entries = parseTranscript(transcript);
    const misses: string[] = [];
    const added: string[] = [];
    for (const entry of entries) {
      const item = matchItem(entry.query, itemsRef.current);
      if (item) {
        addLine(item, entry.qty);
        added.push(`${entry.qty} ${item.unit} ${item.name_en}`);
      } else {
        misses.push(entry.query);
      }
    }
    if (added.length > 0) {
      flashAdded(added.join(', '));
    }
    if (misses.length > 0) {
      setUnmatched((prev) => [...misses, ...prev].slice(0, 10));
    }
  };

  const startRecognizer = async () => {
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        keepListeningRef.current = false;
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
      keepListeningRef.current = false;
      showMessage(
        'Voice not available here',
        'On Android, voice needs a development build: run "npx expo run:android" once from the project folder. (Voice works on the web version in Chrome right away.)',
      );
    }
  };

  const toggleListening = async () => {
    if (listening || keepListeningRef.current) {
      keepListeningRef.current = false;
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        // ignore — recognizer may already be stopped
      }
      setListening(false);
      return;
    }
    keepListeningRef.current = true;
    await startRecognizer();
  };

  return (
    <ScreenContainer>
      <View style={styles.screen}>
        {/* Everything (controls + spoken items + total + done) lives inside
            ONE FlatList via header/footer components, so the whole screen
            scrolls as a unit. Previously the controls above the list (mic
            button, hint, "Not understood" box) were fixed outside any
            scroll view — a long "Not understood" list could push the total
            bar and Done button off-screen with no way to reach them. */}
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={lines}
          keyExtractor={(l) => l.itemId}
          ListHeaderComponent={
            <View>
              <View style={styles.langRow}>
                {LANGUAGES.map((l) => (
                  <Pressable
                    key={l.code}
                    style={({ pressed }) => [
                      styles.langChip,
                      lang === l.code && styles.langChipActive,
                      pressed && pressedDim,
                    ]}
                    android_ripple={ripple.onLight}
                    onPress={() => !listening && setLang(l.code)}
                  >
                    <Text style={[styles.langText, lang === l.code && styles.langTextActive]}>
                      {l.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.micBtn,
                  listening && styles.micBtnActive,
                  pressed && pressedDim,
                ]}
                android_ripple={ripple.onDark}
                onPress={toggleListening}
              >
                <Text style={styles.micIcon}>🎤</Text>
                <Text style={styles.micLabel}>
                  {listening ? 'Listening… say the next item, or tap to stop' : 'Tap to speak'}
                </Text>
              </Pressable>

              {interim !== '' && <Text style={styles.interim}>{interim}</Text>}

              {justAdded && (
                <View style={styles.addedToast}>
                  <Text style={styles.addedToastText}>✓ Added {justAdded}</Text>
                </View>
              )}

              <Text style={styles.hint}>
                Say item and quantity, e.g. “kandi pappu rendu kilolu” or “Parle-G four packets”.
              </Text>

              {unmatched.length > 0 && (
                <View style={styles.unmatchedBox}>
                  <Text style={styles.unmatchedTitle}>Not understood:</Text>
                  <Text style={styles.unmatchedText}>{unmatched.join(', ')}</Text>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={<Text style={styles.empty}>Spoken items will appear here.</Text>}
          ListFooterComponent={
            <View>
              <View style={styles.totalBar}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatMoney(total)}</Text>
              </View>

              <Pressable
                style={({ pressed }) => [styles.doneBtn, pressed && pressedDim]}
                android_ripple={ripple.onDark}
                onPress={() => {
                  // After a browser refresh there is no history, so "back" has
                  // nowhere to go — fall back to the billing screen directly.
                  if (router.canGoBack()) router.back();
                  else router.replace('/');
                }}
              >
                <Text style={styles.doneBtnText}>✓ Done — back to bill</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item: l }) => (
            <View style={styles.lineRow}>
              <View style={styles.lineInfo}>
                <Text style={styles.lineName}>{l.name}</Text>
                <Text style={styles.lineMeta}>
                  {l.qty} {l.unit} × {formatMoney(l.price)}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.qtyBtn, pressed && pressedDim]}
                android_ripple={ripple.onLight}
                onPress={() => updateQty(l.itemId, l.qty - 1)}
              >
                <Text style={styles.qtyBtnText}>−</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.qtyBtn, pressed && pressedDim]}
                android_ripple={ripple.onLight}
                onPress={() => updateQty(l.itemId, l.qty + 1)}
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </Pressable>
              <Text style={styles.lineTotal}>{formatMoney(l.price * l.qty)}</Text>
              <Pressable
                style={({ pressed }) => [styles.removeBtn, pressed && pressedDim]}
                android_ripple={ripple.onLight}
                onPress={() => removeLine(l.itemId)}
              >
                <Text style={styles.remove}>✕</Text>
              </Pressable>
            </View>
          )}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: spacing.listBottom,
  },
  langRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  langChip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.card,
    overflow: 'hidden',
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
    overflow: 'hidden',
    ...cardShadow,
  },
  micBtnActive: { backgroundColor: colors.accentRed },
  micIcon: { fontSize: 34 },
  micLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  interim: {
    marginTop: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: '#ede9fe',
    borderRadius: radius.sm,
    padding: 10,
  },
  addedToast: {
    marginTop: 10,
    backgroundColor: colors.brand,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    ...cardShadow,
  },
  addedToastText: { color: '#ffffff', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  hint: { marginTop: 8, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  unmatchedBox: {
    backgroundColor: '#fef2f2',
    borderRadius: radius.sm,
    padding: 10,
    marginTop: 8,
  },
  unmatchedTitle: { color: '#b91c1c', fontWeight: '700', fontSize: 13 },
  unmatchedText: { color: '#b91c1c', fontSize: 13 },
  list: { flex: 1 },
  listContent: { paddingBottom: spacing.listBottom, flexGrow: 1 },
  empty: { textAlign: 'center', color: colors.textFaint, marginTop: 30, fontSize: 14 },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 10,
    marginTop: 10,
    marginBottom: 7,
    gap: 8,
    ...cardShadow,
  },
  lineInfo: { flex: 1 },
  lineName: { fontSize: 15, fontWeight: '600', color: colors.text },
  lineMeta: { fontSize: 13, color: colors.textMuted },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  qtyBtnText: { fontSize: 16, fontWeight: '700', color: colors.text },
  lineTotal: { fontSize: 14, fontWeight: '700', color: colors.brand, minWidth: 54, textAlign: 'right' },
  removeBtn: { paddingHorizontal: 4, borderRadius: radius.sm, overflow: 'hidden' },
  remove: { color: colors.accentRed, fontSize: 16 },
  totalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 10,
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
    overflow: 'hidden',
    ...cardShadow,
  },
  doneBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});