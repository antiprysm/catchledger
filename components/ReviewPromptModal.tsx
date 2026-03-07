import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import * as Linking from "expo-linking";

type ReviewPromptModalProps = {
  visible: boolean;
  onLove: () => void;
  onOkay: () => void;
  onNotForMe: () => void;
  onReportBug: () => void;
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
  const handleLove = () => {
    void Linking.openURL(
      "https://hambungle.com/feedback?source=catchledger&type=general",
    );
    onLove();
  };

  const handleOkay = () => {
    void Linking.openURL(
      "https://hambungle.com/feedback?source=catchledger&type=improvement",
    );
    onOkay();
  };

  const handleNotForMe = () => {
    void Linking.openURL(
      "https://hambungle.com/feedback?source=catchledger&type=improvement",
    );
    onNotForMe();
  };

  const handleReportBug = () => {
    void Linking.openURL(
      "https://hambungle.com/feedback?source=catchledger&type=bug",
    );
    onReportBug();
  };

  const handleClose = () => {
    void Linking.openURL(
      "https://hambungle.com/feedback?source=catchledger&type=general",
    );
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>How’s CatchLedger working for you?</Text>

          <Pressable style={styles.primaryButton} onPress={handleLove}>
            <Text style={styles.primaryButtonText}>Loving it</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={handleOkay}>
            <Text style={styles.secondaryButtonText}>It’s okay</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={handleNotForMe}>
            <Text style={styles.secondaryButtonText}>Not for me right now</Text>
          </Pressable>

          <Pressable style={styles.linkButton} onPress={handleReportBug}>
            <Text style={styles.linkButtonText}>Report a bug</Text>
          </Pressable>

          <Pressable style={styles.closeButton} onPress={handleClose}>
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
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: 20,
  },
  title: {
    marginBottom: 16,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  primaryButton: {
    marginBottom: 10,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#0F766E",
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  secondaryButton: {
    marginBottom: 10,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  linkButton: {
    marginTop: 2,
    marginBottom: 4,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  linkButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F766E",
  },
  closeButton: {
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
});
