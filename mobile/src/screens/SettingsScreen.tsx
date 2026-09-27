import React from "react";
import { View, Text, StyleSheet, ScrollView, Switch } from "react-native";
import { Header } from "../components/Header";
import { OfflineBanner } from "../components/OfflineBanner";
import { TouchButton } from "../components/TouchButton";
import { useAuth } from "../context/AuthContext";
import { useNetwork } from "../context/NetworkContext";
import { useWallet } from "../context/WalletContext";
import { colors, spacing } from "../theme";

export const SettingsScreen: React.FC = () => {
  const { biometryType, isBiometryEnabled, toggleBiometry } = useAuth();
  const { isOnline, pendingCount, toggleSimulatedNetwork, triggerSync } = useNetwork();
  const { session, isConnected, disconnect } = useWallet();

  return (
    <View style={styles.container}>
      <Header title="Settings" />
      <OfflineBanner />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Security & Biometrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security & Access</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>Biometric Unlock ({biometryType})</Text>
              <Text style={styles.settingDesc}>Require {biometryType} to unlock app and view earnings</Text>
            </View>
            <Switch
              value={isBiometryEnabled}
              onValueChange={toggleBiometry}
              trackColor={{ false: colors.cardBorder, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Offline & Sync */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Offline Mode & Sync</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>Network Connectivity</Text>
              <Text style={styles.settingDesc}>
                Current status: {isOnline ? "Online (Live API)" : "Offline (Local Cache)"}
              </Text>
            </View>
            <TouchButton
              title={isOnline ? "Go Offline" : "Go Online"}
              variant="outline"
              onPress={toggleSimulatedNetwork}
              style={styles.toggleNetBtn}
              textStyle={{ fontSize: 12 }}
            />
          </View>

          <View style={styles.syncInfoRow}>
            <Text style={styles.syncInfoText}>
              Pending Offline Mutations: <Text style={{ color: colors.primary, fontWeight: "700" }}>{pendingCount}</Text>
            </Text>
            <TouchButton
              title="Force Sync Now"
              variant="secondary"
              disabled={!isOnline || pendingCount === 0}
              onPress={() => void triggerSync()}
              style={styles.syncBtn}
            />
          </View>
        </View>

        {/* Mobile Wallet */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected Wallet</Text>
          {isConnected ? (
            <View>
              <Text style={styles.walletAddress}>Address: {session?.address}</Text>
              <Text style={styles.walletType}>Provider: {session?.walletType.toUpperCase()}</Text>
              <TouchButton
                title="Disconnect Wallet"
                variant="danger"
                onPress={() => void disconnect()}
                style={styles.disconnectBtn}
              />
            </View>
          ) : (
            <Text style={styles.settingDesc}>No mobile wallet currently connected.</Text>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.versionText}>Stellar Royalty Splitter Mobile v0.1.0</Text>
          <Text style={styles.versionSubtext}>Built with React Native & Soroban Smart Contracts</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  settingTextGroup: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  settingDesc: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  toggleNetBtn: {
    minHeight: 34,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginVertical: 0,
  },
  syncInfoRow: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  syncInfoText: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  syncBtn: {
    marginVertical: 4,
  },
  walletAddress: {
    fontSize: 13,
    color: colors.text,
    fontFamily: "Courier",
    marginBottom: 4,
  },
  walletType: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  disconnectBtn: {
    marginVertical: 0,
  },
  footer: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  versionText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
  },
  versionSubtext: {
    fontSize: 11,
    color: colors.textSubtle,
    marginTop: 2,
  },
});
