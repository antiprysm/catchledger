import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

type ReviewPromptModalProps = {
  visible: boolean;
  onLove: () => void | Promise<void>;
  onOkay: () => void | Promise<void>;
  onNotForMe: () => void | Promise<void>;
  onReportBug: () => void | Promise<void>;
  onClose: () => void;
};

export default function ReviewPromptModal({
  visible,
  onLove,
  onOkay,
  onNotForMe,
  onReportBug,
  onClose,
}: ReviewPromptModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>How’s CatchLedger working for you?</Text>
          <Text style={styles.subtitle}>
            Your feedback helps us improve the app for everyone.
          </Text>

          <Pressable style={styles.primaryButton} onPress={onLove}>
            <Text style={styles.primaryButtonText}>Loving it</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={onOkay}>
            <Text style={styles.secondaryButtonText}>It’s okay</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={onNotForMe}>
            <Text style={styles.secondaryButtonText}>Not for me right now</Text>
          </Pressable>

          <Pressable style={styles.linkButton} onPress={onReportBug}>
            <Text style={styles.linkButtonText}>Report a bug</Text>
          </Pressable>

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#4B5563",
    marginBottom: 18,
    textAlign: "center",
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#0F766E",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  secondaryButtonText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "600",
  },
  linkButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    marginTop: 2,
    marginBottom: 4,
  },
  linkButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F766E",
  },
  closeButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    marginTop: 4,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
});