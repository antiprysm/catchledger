import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";

const ONBOARDING_KEY = "catchledger_onboarding_done_v1";

export default function Index() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    async function checkOnboarding() {
      const done = await AsyncStorage.getItem(ONBOARDING_KEY);

      if (done) {
        setTarget("/(tabs)/dashboard");
      } else {
        setTarget("/onboarding");
      }
    }

    checkOnboarding();
  }, []);

  if (!target) return null;

  return <Redirect href={target as any} />;
}