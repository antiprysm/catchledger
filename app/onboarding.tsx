import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  Easing,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useReviewPrompt } from "@/hooks/useReviewPrompt";

const ONBOARDING_KEY = "catchledger_onboarding_done_v1";

type Slide = {
  key: string;
  title: string;
  description: string;
  image: any;
};

export default function OnboardingScreen() {
  const { width, height } = useWindowDimensions();
  const shortestSide = Math.min(width, height);

  const isTablet = shortestSide >= 768;
  const isSmallPhone = shortestSide < 375;
  const isPhone = !isTablet;
  const isLandscape = width > height;
  const isTabletLandscape = isTablet && isLandscape;
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Slide>>(null);
  const { t } = useTranslation();
  const { incrementSuccess } = useReviewPrompt();
  const orientationKey = `${width}-${height}`;

  const slides = useMemo<Slide[]>(
    () => [
      {
        key: "s1",
        title: t("onboarding.s1Title"),
        description: t("onboarding.s1Description"),
        image: require("../assets/onboarding/01.png"),
      },
      {
        key: "s2",
        title: t("onboarding.s2Title"),
        description: t("onboarding.s2Description"),
        image: require("../assets/onboarding/02.png"),
      },
      {
        key: "s3",
        title: t("onboarding.s3Title"),
        description: t("onboarding.s3Description"),
        image: require("../assets/onboarding/03.png"),
      },
    ],
    [t]
  );

  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => {
      listRef.current?.scrollToOffset({
        offset: index * width,
        animated: false,
      });
    }, 0);
  
    return () => clearTimeout(id);
  }, [width, height, index]);

  const isLast = index === slides.length - 1;

  const imageOpacity = useRef(new Animated.Value(0)).current;

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(18)).current;

  const descOpacity = useRef(new Animated.Value(0)).current;
  const descTranslateY = useRef(new Animated.Value(18)).current;

  const progressAnim = useRef(new Animated.Value(1 / slides.length)).current;
  const scrollX = useRef(new Animated.Value(0)).current;

  const textBlockMinHeight = isTablet ? 200 : 160;

  useEffect(() => {
    runImageEntranceAnimation();
    runTextEntranceAnimation();
  }, []);
  
  useEffect(() => {
    runProgressAnimation(index);
    runTextEntranceAnimation();
  }, [index]);

  function runImageEntranceAnimation() {
    imageOpacity.setValue(0);
  
    Animated.timing(imageOpacity, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }
  
  function runTextEntranceAnimation() {
    titleOpacity.setValue(0);
    titleTranslateY.setValue(18);
  
    descOpacity.setValue(0);
    descTranslateY.setValue(18);
  
    Animated.sequence([
      Animated.delay(140),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(descOpacity, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(descTranslateY, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }

  function runProgressAnimation(currentIndex: number) {
    const progress = (currentIndex + 1) / slides.length;
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }

  async function finish() {
    await AsyncStorage.setItem(ONBOARDING_KEY, "1");
    await incrementSuccess();
    router.replace("/(tabs)/dashboard");
  }

  function scrollTo(i: number) {
    listRef.current?.scrollToOffset({
      offset: i * width,
      animated: true,
    });
  }

  function onMomentumEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(newIndex);
  }

  function renderSlide(item: Slide, slideIndex: number) {
    const isActiveSlide = slideIndex === index;
    const inputRange = [
      (slideIndex - 1) * width,
      slideIndex * width,
      (slideIndex + 1) * width,
    ];
  
    const imageParallax = scrollX.interpolate({
      inputRange,
      outputRange: [18, 0, -18],
      extrapolate: "clamp",
    });
  
    if (isTabletLandscape) {
      return renderTabletLandscapeSlide(item, slideIndex, isActiveSlide, imageParallax);
    }
  
    return renderStackedSlide(item, slideIndex, isActiveSlide, imageParallax);
  }

  function renderStackedSlide(
    item: Slide,
    slideIndex: number,
    isActiveSlide: boolean,
    imageParallax: Animated.AnimatedInterpolation<string | number>
  ) {
    return (
      <View
        style={[
          styles.slide,
          {
            width,
            paddingTop: isTablet ? 24 : isSmallPhone ? 8 : 16,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.imageStage,
            {
              height: isTablet ? height * 0.52 : isSmallPhone ? height * 0.22 : height * 0.40,
              opacity: imageOpacity,
              marginBottom: isTablet ? 20 : 10,
            },
          ]}
        >
          <Animated.Image
            source={item.image}
            resizeMode="contain"
            style={[
              styles.image,
              {
                width: isTablet ? width * 0.72 : isSmallPhone ? width * 0.82 : width * 0.9,
                height: isTablet ? height * 0.50 : isSmallPhone ? height * 0.30 : height * 0.46,
                transform: [{ translateX: imageParallax }],
              },
            ]}
          />
        </Animated.View>
  
        <View
          style={[
            styles.textSection,
            isTablet && styles.textSectionTablet,
            { minHeight: textBlockMinHeight },
          ]}
        >
          {isActiveSlide ? (
            <Animated.View key={`text-${item.key}-${index}`} style={styles.textInner}>
              <Animated.Text
                style={[
                  styles.title,
                  isTablet && styles.titleTablet,
                  {
                    opacity: titleOpacity,
                    transform: [{ translateY: titleTranslateY }],
                  },
                ]}
              >
                {item.title}
              </Animated.Text>
  
              <Animated.Text
                style={[
                  styles.desc,
                  isTablet && styles.descTablet,
                  {
                    opacity: descOpacity,
                    transform: [{ translateY: descTranslateY }],
                  },
                ]}
              >
                {item.description}
              </Animated.Text>
            </Animated.View>
          ) : (
            <View style={styles.textPlaceholder} />
          )}
        </View>
      </View>
    );
  }

  function renderTabletLandscapeSlide(
    item: Slide,
    slideIndex: number,
    isActiveSlide: boolean,
    imageParallax: Animated.AnimatedInterpolation<string | number>
  ) {
    return (
      <View style={[styles.slideLandscape, { width }]}>
        <View style={styles.landscapeInner}>
          <View style={styles.landscapeImageColumn}>
            <Animated.Image
              source={item.image}
              resizeMode="contain"
              style={[
                styles.image,
                styles.landscapeImage,
                {
                  opacity: imageOpacity,
                  transform: [{ translateX: imageParallax }],
                },
              ]}
            />
          </View>

          <View style={styles.landscapeTextColumn}>
            {isActiveSlide ? (
              <Animated.View
                key={`text-landscape-${item.key}-${index}`}
                style={styles.landscapeTextInner}
              >
                <Animated.Text
                  style={[
                    styles.title,
                    styles.titleTablet,
                    styles.landscapeTitle,
                    {
                      opacity: titleOpacity,
                      transform: [{ translateY: titleTranslateY }],
                    },
                  ]}
                >
                  {item.title}
                </Animated.Text>

                <Animated.Text
                  style={[
                    styles.desc,
                    styles.descTablet,
                    styles.landscapeDesc,
                    {
                      opacity: descOpacity,
                      transform: [{ translateY: descTranslateY }],
                    },
                  ]}
                >
                  {item.description}
                </Animated.Text>
              </Animated.View>
            ) : (
              <View style={styles.textPlaceholder} />
            )}
          </View>
        </View>
      </View>
    );
  }

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandPill}>
            <Text style={styles.brandText}>CatchLedger</Text>
          </View>

          {!isLast ? (
            <Pressable style={styles.skipBtn} onPress={finish}>
              <Text style={styles.skipText}>{t("common.skip")}</Text>
            </Pressable>
          ) : (
            <View style={styles.skipPlaceholder} />
          )}
        </View>

        <View style={styles.progressTrack}>
          <Animated.View
            style={[styles.progressFill, { width: progressWidth }]}
          />
        </View>

        <Text style={styles.stepText}>
            {t("onboarding.stepCounter", { current: index + 1, total: slides.length })}
        </Text>
      </View>

      <Animated.FlatList
        key={orientationKey}
        ref={listRef}
        data={slides}
        initialScrollIndex={index}
        getItemLayout={(_, i) => ({
          length: width,
          offset: width * i,
          index: i,
        })}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        decelerationRate={0.92}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        renderItem={({ item, index: slideIndex }) =>
          renderSlide(item, slideIndex)
        }
      />

        <View
        style={[
            styles.footer,
            {
            paddingTop: isSmallPhone ? 6 : 12,
            paddingBottom: Math.max(insets.bottom, 12) + (isSmallPhone ? 8 : 12),
            },
        ]}
        >
        <View style={styles.bottomRow}>
          <Pressable
            style={[
              styles.btn,
              styles.btnSecondary,
              index === 0 && styles.btnDisabled,
            ]}
            onPress={() => scrollTo(Math.max(index - 1, 0))}
            disabled={index === 0}
          >
            <Text style={styles.btnSecondaryText}>{t("common.back")}</Text>
          </Pressable>

          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => (isLast ? finish() : scrollTo(index + 1))}
          >
            <Text style={styles.btnPrimaryText}>
              {isLast ? t("onboarding.getStarted") : t("common.next")}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FBFD",
  },

  header: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  brandPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#E8F3F7",
  },

  brandText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#184B5A",
    letterSpacing: 0.2,
  },

  skipBtn: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },

  skipText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#5C6B73",
  },

  skipPlaceholder: {
    width: 44,
    height: 28,
  },

  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    backgroundColor: "#DCEAF0",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#184B5A",
  },

  stepText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7C86",
    textAlign: "right",
  },

  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
  },

  image: {
    alignSelf: "center",
  },

  imageStage: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
    flexShrink: 0,
  },

  slideContent: {
    width: "100%",
    flex: 1,
  },

  slideContentTabletLandscape: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },

  landscapeColumn: {
    width: "50%",
    alignItems: "center",
    justifyContent: "center",
  },

  textSectionTabletLandscape: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 0,
    paddingHorizontal: 20,
  },

  imageStageTabletLandscape: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 20,
  },

  textSection: {
    width: "100%",
    paddingHorizontal: 28,
    paddingTop: 15,
    alignItems: "center",
    justifyContent: "center",
  },

  textSectionTablet: {
    paddingTop: 34,
  },

  textInner: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    justifyContent: "center",
  },

  textInnerLandscape: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  textPlaceholder: {
    width: "100%",
    flex: 1,
  },

  title: {
    width: "100%",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 10,
  },

  titleTablet: {
    fontSize: 32,
    lineHeight: 38,
  },

  desc: {
    width: "100%",
    fontSize: 16,
    lineHeight: 24,
    color: "#52616B",
    textAlign: "center",
    maxWidth: 360,
  },

  descTablet: {
    fontSize: 18,
    lineHeight: 28,
  },

  footer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 12,
  },

  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },

  btn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  btnPrimary: {
    backgroundColor: "#184B5A",
  },

  btnPrimaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  btnSecondary: {
    backgroundColor: "#EAF1F4",
  },

  btnSecondaryText: {
    color: "#24414D",
    fontSize: 16,
    fontWeight: "700",
  },

  btnDisabled: {
    opacity: 0.45,
  },

  btnDisabledText: {
    color: "#6F7F88",
  },

  slideLandscape: {
    flex: 1,
    justifyContent: "center",
    alignItems: "stretch",
    paddingTop: 12,
    paddingBottom: 12,
  },
  
  landscapeInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20, // same as footer
  },
  
  landscapeImageColumn: {
    width: "50%",
    alignItems: "center",
    justifyContent: "center",
  },
  
  landscapeTextColumn: {
    width: "50%",
    alignItems: "center",
    justifyContent: "center",
  },
  
  landscapeTextInner: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  
  landscapeImage: {
    width: 400,
    height: 400,
  },
  
  landscapeTitle: {
    width: "100%",
    textAlign: "center",
  },
  
  landscapeDesc: {
    width: "100%",
    textAlign: "center",
    maxWidth: 420,
  },
  landscapeGap: {
    width: 16,
  },
});