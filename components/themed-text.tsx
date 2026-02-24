import { useThemeColor } from '@/hooks/use-theme-color';
import { StyleSheet, Text, type TextProps } from 'react-native';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link' | 'muted';
};

export function ThemedText({ style, lightColor, darkColor, type = 'default', ...rest }: ThemedTextProps) {
  const defaultColor = useThemeColor({ light: lightColor, dark: darkColor }, type === 'muted' ? 'mutedText' : 'text');
  const linkColor = useThemeColor({ light: lightColor, dark: darkColor }, 'primary');

  return (
    <Text
      style={[
        { color: type === 'link' ? linkColor : defaultColor },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        type === 'muted' ? styles.muted : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
  },
  link: {
    lineHeight: 24,
    fontSize: 16,
    fontWeight: '600',
  },
  muted: {
    fontSize: 14,
    lineHeight: 20,
  },
});
