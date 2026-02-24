import { useThemeColor } from '@/hooks/use-theme-color';
import { View, type ViewProps } from 'react-native';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  tone?: 'bg' | 'surface' | 'surface2';
};

export function ThemedView({ style, lightColor, darkColor, tone = 'bg', ...otherProps }: ThemedViewProps) {
  const backgroundColor = useThemeColor(
    { light: lightColor, dark: darkColor },
    tone === 'bg' ? 'background' : tone
  );

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
