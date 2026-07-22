import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/auth-context';
import { useColors } from '@/hooks/useColors';

type Phase = 'idle' | 'preview' | 'uploading' | 'success' | 'error';

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export default function ScanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [phase, setPhase] = useState<Phase>('idle');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');
  const [docId, setDocId] = useState<number | null>(null);
  const [resultMessage, setResultMessage] = useState('');

  const webTop = Platform.OS === 'web' ? 67 : 0;
  const webBottom = Platform.OS === 'web' ? 84 : 0;
  const topPad = insets.top + webTop;
  const bottomPad = insets.bottom + webBottom;

  const captureWithCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Access Required',
        'Please allow camera access to scan documents.',
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageMime(result.assets[0].mimeType ?? 'image/jpeg');
      setPhase('preview');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Library Access Required',
        'Please allow photo library access to select a document.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageMime(result.assets[0].mimeType ?? 'image/jpeg');
      setPhase('preview');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const discard = () => {
    setImageUri(null);
    setDocId(null);
    setPhase('idle');
  };

  const uploadAndSend = async () => {
    if (!imageUri || !token) return;

    setPhase('uploading');

    try {
      // 1. Upload the document
      const formData = new FormData();
      const filename = `document_${Date.now()}.jpg`;
      (formData as any).append('file', {
        uri: imageUri,
        name: filename,
        type: imageMime,
      });

      const uploadRes = await fetch(`${BASE_URL}/api/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');

      const uploadedDocId: number = uploadData.id;
      setDocId(uploadedDocId);

      // 2. Send to configured recipients
      const sendRes = await fetch(`${BASE_URL}/api/documents/${uploadedDocId}/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const sendData = await sendRes.json();
      if (!sendRes.ok) throw new Error(sendData.error || 'Failed to send');

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResultMessage(sendData.message || 'Document sent successfully');
      setPhase('success');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setResultMessage(err.message || 'Something went wrong. Please try again.');
      setPhase('error');
    }
  };

  const retry = async () => {
    // If we have a docId, skip upload and just resend
    if (docId && token) {
      setPhase('uploading');
      try {
        const sendRes = await fetch(`${BASE_URL}/api/documents/${docId}/send`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        const sendData = await sendRes.json();
        if (!sendRes.ok) throw new Error(sendData.error || 'Failed to send');

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setResultMessage(sendData.message || 'Document sent successfully');
        setPhase('success');
      } catch (err: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setResultMessage(err.message || 'Something went wrong.');
        setPhase('error');
      }
    } else {
      uploadAndSend();
    }
  };

  const reset = () => {
    setImageUri(null);
    setDocId(null);
    setPhase('idle');
    setResultMessage('');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: '#0E192A' }]}>
        <View style={styles.headerLogo}>
          <Feather name="file-text" size={20} color="#FF8800" />
        </View>
        <Text style={styles.headerTitle}>DocScan</Text>
      </View>

      {/* === IDLE: Scan prompt === */}
      {phase === 'idle' && (
        <View style={[styles.idleContent, { paddingBottom: bottomPad }]}>
          {/* Document frame */}
          <View style={[styles.scanFrame, { borderColor: colors.border }]}>
            <View style={[styles.corner, styles.cornerTL, { borderColor: '#FF8800' }]} />
            <View style={[styles.corner, styles.cornerTR, { borderColor: '#FF8800' }]} />
            <View style={[styles.corner, styles.cornerBL, { borderColor: '#FF8800' }]} />
            <View style={[styles.corner, styles.cornerBR, { borderColor: '#FF8800' }]} />
            <Feather name="file" size={56} color={colors.border} />
            <Text style={[styles.scanHint, { color: colors.mutedForeground }]}>
              Align document in frame
            </Text>
          </View>

          {/* Camera button */}
          <Pressable
            style={({ pressed }) => [styles.cameraBtn, pressed && styles.pressed]}
            onPress={captureWithCamera}
          >
            <Feather name="camera" size={30} color="#0E192A" />
          </Pressable>

          {/* Library fallback */}
          <Pressable
            style={({ pressed }) => [
              styles.libraryBtn,
              { borderColor: colors.border },
              pressed && styles.pressed,
            ]}
            onPress={pickFromLibrary}
          >
            <Feather name="image" size={16} color={colors.mutedForeground} />
            <Text style={[styles.libraryBtnText, { color: colors.mutedForeground }]}>
              Choose from library
            </Text>
          </Pressable>
        </View>
      )}

      {/* === PREVIEW: Show captured image === */}
      {phase === 'preview' && imageUri && (
        <View style={[styles.previewContent, { paddingBottom: bottomPad + 16 }]}>
          <Image
            source={{ uri: imageUri }}
            style={[styles.previewImage, { backgroundColor: colors.muted }]}
            resizeMode="contain"
          />
          <View style={styles.previewActions}>
            <Pressable
              style={({ pressed }) => [
                styles.discardBtn,
                { borderColor: colors.border, backgroundColor: colors.card },
                pressed && styles.pressed,
              ]}
              onPress={discard}
            >
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.sendBtn, pressed && styles.pressed]}
              onPress={uploadAndSend}
            >
              <Feather name="send" size={20} color="#0E192A" />
              <Text style={styles.sendBtnText}>Send Document</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* === UPLOADING === */}
      {phase === 'uploading' && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FF8800" />
          <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
            Uploading & sending…
          </Text>
        </View>
      )}

      {/* === SUCCESS === */}
      {phase === 'success' && (
        <View style={styles.centered}>
          <View style={[styles.resultCircle, { backgroundColor: '#22C55E18' }]}>
            <Feather name="check-circle" size={52} color="#22C55E" />
          </View>
          <Text style={[styles.resultTitle, { color: colors.foreground }]}>Sent!</Text>
          <Text style={[styles.resultMsg, { color: colors.mutedForeground }]}>
            {resultMessage}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.doneBtn, pressed && styles.pressed]}
            onPress={reset}
          >
            <Text style={styles.doneBtnText}>Scan Another</Text>
          </Pressable>
        </View>
      )}

      {/* === ERROR === */}
      {phase === 'error' && (
        <View style={styles.centered}>
          <View style={[styles.resultCircle, { backgroundColor: '#EF444418' }]}>
            <Feather name="alert-circle" size={52} color="#EF4444" />
          </View>
          <Text style={[styles.resultTitle, { color: colors.foreground }]}>Failed</Text>
          <Text style={[styles.resultMsg, { color: colors.mutedForeground }]}>
            {resultMessage}
          </Text>
          <View style={styles.errorActions}>
            <Pressable
              style={({ pressed }) => [
                styles.discardBtn,
                { borderColor: colors.border, backgroundColor: colors.card },
                pressed && styles.pressed,
              ]}
              onPress={reset}
            >
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
              onPress={retry}
            >
              <Feather name="refresh-cw" size={18} color="#0E192A" />
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 10,
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: '#F6F9FC',
    letterSpacing: -0.3,
  },

  // Idle
  idleContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 28,
  },
  scanFrame: {
    width: '100%',
    aspectRatio: 0.75,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderWidth: 3,
  },
  cornerTL: {
    top: -1,
    left: -1,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    borderTopLeftRadius: 16,
  },
  cornerTR: {
    top: -1,
    right: -1,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopRightRadius: 16,
  },
  cornerBL: {
    bottom: -1,
    left: -1,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomLeftRadius: 16,
  },
  cornerBR: {
    bottom: -1,
    right: -1,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomRightRadius: 16,
  },
  scanHint: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  cameraBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FF8800',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF8800',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  libraryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  libraryBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },

  // Preview
  previewContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
  },
  previewImage: {
    flex: 1,
    borderRadius: 12,
  },
  previewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  discardBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sendBtn: {
    flex: 1,
    height: 52,
    backgroundColor: '#FF8800',
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#FF8800',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sendBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#0E192A',
  },

  // States
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  statusText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    marginTop: 8,
  },
  resultCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitle: {
    fontSize: 30,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
  },
  resultMsg: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
  doneBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: '#FF8800',
    borderRadius: 26,
    marginTop: 4,
    shadowColor: '#FF8800',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  doneBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#0E192A',
  },
  errorActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  retryBtn: {
    flex: 1,
    height: 52,
    backgroundColor: '#FF8800',
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  retryText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#0E192A',
  },

  pressed: { opacity: 0.7 },
});
