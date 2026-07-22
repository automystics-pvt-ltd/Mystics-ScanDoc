import { Feather } from '@expo/vector-icons';
import { useGetDocumentHistory } from '@workspace/api-client-react';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/auth-context';
import { useColors } from '@/hooks/useColors';

interface EmailLog {
  id: number;
  documentId: number;
  recipientEmail: string;
  status: 'queued' | 'sent' | 'failed';
  sentAt: string | null;
  errorMessage?: string | null;
}

interface DocumentWithLogs {
  id: number;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  uploadedAt: string;
  emailLogs: EmailLog[];
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function formatSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function DocRow({ doc, colors }: { doc: DocumentWithLogs; colors: ReturnType<typeof useColors> }) {
  const hasLogs = doc.emailLogs.length > 0;
  const hasSent = doc.emailLogs.some((l) => l.status === 'sent');
  const hasFailed = doc.emailLogs.some((l) => l.status === 'failed');

  const statusLabel = !hasLogs
    ? 'Unsent'
    : hasSent && !hasFailed
    ? 'Sent'
    : hasFailed && !hasSent
    ? 'Failed'
    : 'Partial';

  const statusColor = !hasLogs
    ? colors.mutedForeground
    : hasSent && !hasFailed
    ? '#22C55E'
    : '#EF4444';

  const fileIcon: keyof typeof Feather.glyphMap =
    doc.fileType === 'application/pdf' ? 'file-text' : 'image';

  const recipientList = doc.emailLogs
    .map((l) => l.recipientEmail)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ');

  return (
    <View
      style={[
        rowStyles.row,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[rowStyles.icon, { backgroundColor: colors.muted }]}>
        <Feather name={fileIcon} size={20} color={colors.mutedForeground} />
      </View>
      <View style={rowStyles.info}>
        <Text style={[rowStyles.name, { color: colors.foreground }]} numberOfLines={1}>
          {doc.fileName}
        </Text>
        <Text style={[rowStyles.meta, { color: colors.mutedForeground }]}>
          {formatDate(doc.uploadedAt)}
          {doc.fileSize ? ` · ${formatSize(doc.fileSize)}` : ''}
        </Text>
        {recipientList ? (
          <Text style={[rowStyles.recipients, { color: colors.mutedForeground }]} numberOfLines={1}>
            {recipientList}
          </Text>
        ) : null}
      </View>
      <View style={[rowStyles.badge, { backgroundColor: `${statusColor}18` }]}>
        <Text style={[rowStyles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    marginBottom: 10,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  meta: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  recipients: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
});

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { logout, user } = useAuth();

  const webTop = Platform.OS === 'web' ? 67 : 0;
  const webBottom = Platform.OS === 'web' ? 84 : 0;
  const topPad = insets.top + webTop;
  const bottomPad = insets.bottom + webBottom;

  const {
    data: docs,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useGetDocumentHistory();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: '#0E192A' }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>History</Text>
            {user ? (
              <Text style={styles.headerSub}>{user.name}</Text>
            ) : null}
          </View>
          <Pressable
            onPress={logout}
            style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.6 }]}
            hitSlop={8}
          >
            <Feather name="log-out" size={20} color="rgba(246,249,252,0.6)" />
          </Pressable>
        </View>
        {docs ? (
          <Text style={styles.headerCount}>
            {docs.length} document{docs.length !== 1 ? 's' : ''}
          </Text>
        ) : null}
      </View>

      {/* Loading */}
      {isLoading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FF8800" />
        </View>
      )}

      {/* Error */}
      {!isLoading && error && (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={40} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            Failed to load history
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={({ pressed }) => [
              styles.retryBtn,
              { backgroundColor: colors.muted },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.retryText, { color: colors.foreground }]}>Try again</Text>
          </Pressable>
        </View>
      )}

      {/* List */}
      {!isLoading && !error && (
        <FlatList
          data={docs as DocumentWithLogs[] | undefined}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <DocRow doc={item} colors={colors} />}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 16 }]}
          scrollEnabled={!!docs && docs.length > 0}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor="#FF8800"
              colors={['#FF8800']}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="inbox" size={44} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No documents yet</Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                Switch to Scan to capture and send your first document
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: '#F6F9FC',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(246,249,252,0.55)',
    marginTop: 2,
  },
  logoutBtn: {
    marginTop: 4,
    padding: 4,
  },
  headerCount: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(246,249,252,0.55)',
    marginTop: 4,
  },
  list: {
    padding: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  errorText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 21,
  },
});
