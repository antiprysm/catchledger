import { REVIEW_KEYS, getNumber, incrementNumber, setNumber } from "@/utils/reviewStorage";
import React, { createContext, useContext, useMemo, useState } from "react";
import InAppReview from "react-native-in-app-review";

type ReviewPromptContextValue = {
  showPrompt: boolean;
  setShowPrompt: React.Dispatch<React.SetStateAction<boolean>>;
  incrementSuccess: () => Promise<void>;
  triggerStoreReview: () => Promise<void>;
};

const ReviewPromptContext = createContext<ReviewPromptContextValue | undefined>(undefined);

const MIN_SUCCESS_COUNT = 5;
const PROMPT_INTERVAL_DAYS = 30;

export function ReviewPromptProvider({ children }: { children: React.ReactNode }) {
  const [showPrompt, setShowPrompt] = useState(false);

  const incrementSuccess = async () => {
    const newCount = await incrementNumber(REVIEW_KEYS.SUCCESS_COUNT);
    const hasReviewed = (await getNumber(REVIEW_KEYS.HAS_REVIEWED)) === 1;
    const lastPrompt = await getNumber(REVIEW_KEYS.LAST_PROMPT);

    const daysSincePrompt =
      lastPrompt > 0 ? (Date.now() - lastPrompt) / (1000 * 60 * 60 * 24) : Infinity;

    if (
      newCount >= MIN_SUCCESS_COUNT &&
      !hasReviewed &&
      daysSincePrompt >= PROMPT_INTERVAL_DAYS
    ) {
      setShowPrompt(true);
    }
  };

  const triggerStoreReview = async () => {
    try {
      if (InAppReview.isAvailable()) {
        await InAppReview.RequestInAppReview();
        await setNumber(REVIEW_KEYS.HAS_REVIEWED, 1);
        await setNumber(REVIEW_KEYS.LAST_PROMPT, Date.now());
      }
    } catch (error) {
      console.log("[review] triggerStoreReview error", error);
    }
  };

  const value = useMemo(
    () => ({
      showPrompt,
      setShowPrompt,
      incrementSuccess,
      triggerStoreReview,
    }),
    [showPrompt]
  );

  return (
    <ReviewPromptContext.Provider value={value}>
      {children}
    </ReviewPromptContext.Provider>
  );
}

export function useReviewPrompt() {
  const context = useContext(ReviewPromptContext);
  if (!context) {
    throw new Error("useReviewPrompt must be used within ReviewPromptProvider");
  }
  return context;
}