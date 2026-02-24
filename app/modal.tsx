import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppCard } from '@/components/ui/primitives';
import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useTranslation } from "react-i18next";

export default function ModalScreen() {
  const { t } = useTranslation();

  return (
    <ThemedView style={styles.container}>
      <AppCard style={styles.card}>
        <ThemedText type="title">{t("modal.bodyTitle")}</ThemedText>
        <Link href="/" dismissTo style={styles.link}>
          <ThemedText type="link">{t("modal.goHome")}</ThemedText>
        </Link>
      </AppCard>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
  },
  link: {
    marginTop: 15,
    paddingVertical: 8,
  },
});
