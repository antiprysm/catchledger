import { ThemeContext } from '@/theme/ThemeProvider';
import React, { useContext } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewProps } from 'react-native';

export function AppCard({ style, ...props }: ViewProps) {
  const { colors } = useContext(ThemeContext);
  return (
    <View
      {...props}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow },
        style,
      ]}
    />
  );
}

export function AppInput({ style, placeholderTextColor, ...props }: TextInputProps) {
  const { colors } = useContext(ThemeContext);
  return (
    <TextInput
      {...props}
      placeholderTextColor={placeholderTextColor ?? colors.mutedText}
      style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }, style]}
    />
  );
}

export function AppButton({
  title,
  onPress,
  variant = 'primary',
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
}) {
  const { colors } = useContext(ThemeContext);
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: isPrimary ? colors.primary : colors.surface2,
          borderColor: isPrimary ? colors.primary : colors.border,
        },
      ]}
    >
      <Text style={[styles.buttonText, { color: isPrimary ? '#F4F7FB' : colors.text }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  button: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontWeight: '600',
    fontSize: 16,
  },
});
