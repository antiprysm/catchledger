import { ThemeContext } from '@/theme/ThemeProvider';
import { useContext } from 'react';

export type AppThemeColorName =
  | 'background'
  | 'text'
  | 'tint'
  | 'icon'
  | 'tabIconDefault'
  | 'tabIconSelected'
  | 'bg'
  | 'surface'
  | 'surface2'
  | 'mutedText'
  | 'primary'
  | 'primaryMuted'
  | 'border'
  | 'danger'
  | 'success'
  | 'warning'
  | 'shadow'
  | 'tabBarBg'
  | 'tabActive'
  | 'tabInactive';

export function useThemeColor(props: { light?: string; dark?: string }, colorName: AppThemeColorName) {
  const { mode, colors } = useContext(ThemeContext);
  const colorFromProps = mode === 'DARK' ? props.dark : props.light;

  if (colorFromProps) return colorFromProps;

  switch (colorName) {
    case 'background':
      return colors.bg;
    case 'tint':
      return colors.primary;
    case 'icon':
      return colors.tabInactive;
    case 'tabIconDefault':
      return colors.tabInactive;
    case 'tabIconSelected':
      return colors.tabActive;
    default:
      return colors[colorName] ?? colors.text;
  }
}
