// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];
type SFSymbolName = SymbolViewProps["name"];

// ✅ IMPORTANT: Partial so you don't have to map every possible SF symbol
type IconMapping = Partial<Record<SFSymbolName, MaterialIconName>>;

const MAPPING: IconMapping = {
  "house.fill": "home",
  "ferry.fill": "directions-boat",
  "fish.fill": "set-meal",
  "dollarsign.circle.fill": "paid",

  // ✅ your Android-friendly replacements
  "doc.text.fill": "receipt-long",     // expenses
  "checkmark.shield.fill": "security", // compliance
  "gearshape.fill": "settings",        // settings

  "scroll.fill": "description",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
};

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}

// Tab mappings: Dashboard=ferry.fill->directions-boat, Inventory=fish.fill->set-meal,
// Sales=dollarsign.circle.fill->paid, Expenses=anchor.fill->anchor,
// Reports=scroll.fill->description, Compliance=lighthouse.fill->wb-incandescent,
// Settings=compass.fill->explore.
