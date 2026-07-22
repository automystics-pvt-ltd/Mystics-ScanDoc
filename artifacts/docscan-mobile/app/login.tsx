import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/auth-context';
import { useColors } from '@/hooks/useColors';

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const webTop = Platform.OS === 'web' ? 67 : 0;
  const webBottom = Platform.OS === 'web' ? 34 : 0;

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      Alert.alert('Required', 'Please enter your email and password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await login(data.token, data.user);
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Sign In Failed', err.message || 'Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: '#0E192A', paddingTop: insets.top + webTop },
      ]}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.logoWrap}>
          <Feather name="file-text" size={38} color="#FF8800" />
        </View>
        <Text style={styles.appName}>DocScan</Text>
        <Text style={styles.tagline}>Scan and email documents from your pocket</Text>
      </View>

      {/* Card */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            paddingBottom: insets.bottom + 28 + webBottom,
          },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Sign In</Text>

        {/* Email */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>EMAIL</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.muted,
                color: colors.foreground,
                borderColor: colors.border,
              },
            ]}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            editable={!isLoading}
          />
        </View>

        {/* Password */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>PASSWORD</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              ref={passwordRef}
              style={[
                styles.input,
                styles.passwordInput,
                {
                  backgroundColor: colors.muted,
                  color: colors.foreground,
                  borderColor: colors.border,
                },
              ]}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry={!showPassword}
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              editable={!isLoading}
            />
            <Pressable
              style={styles.eyeBtn}
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={8}
            >
              <Feather
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color={colors.mutedForeground}
              />
            </Pressable>
          </View>
        </View>

        {/* Submit */}
        <Pressable
          style={({ pressed }) => [
            styles.loginBtn,
            pressed && styles.pressed,
            isLoading && styles.disabled,
          ]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#0E192A" size="small" />
          ) : (
            <Text style={styles.loginBtnText}>Sign In</Text>
          )}
        </Pressable>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  logoWrap: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  appName: {
    fontSize: 38,
    fontFamily: 'Inter_700Bold',
    color: '#F6F9FC',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(246,249,252,0.55)',
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 28,
    gap: 16,
  },
  cardTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
  },
  input: {
    height: 50,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
  },
  passwordWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
  },
  loginBtn: {
    height: 52,
    backgroundColor: '#FF8800',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  loginBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#0E192A',
  },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.65 },
});
