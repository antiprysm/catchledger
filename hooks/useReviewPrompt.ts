import { useState } from "react";
import InAppReview from "react-native-in-app-review";
import { REVIEW_KEYS, getNumber, setNumber } from "../utils/reviewStorage";

const MIN_SUCCESS_COUNT = 5;
const PROMPT_INTERVAL_DAYS = 30;

export const useReviewPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);

  const incrementSuccess = async () => {
    const count = await getNumber(REVIEW_KEYS.SUCCESS_COUNT);
    const newCount = count + 1;

    await setNumber(REVIEW_KEYS.SUCCESS_COUNT, newCount);

    const lastPrompt = await getNumber(REVIEW_KEYS.LAST_PROMPT);
    const daysSince = (Date.now() - lastPrompt) / (1000 * 60 * 60 * 24);

    if (newCount >= MIN_SUCCESS_COUNT && daysSince > PROMPT_INTERVAL_DAYS) {
      setShowPrompt(true);
    }
  };

  const triggerStoreReview = async () => {
    if (InAppReview.isAvailable()) {
      await InAppReview.RequestInAppReview();
      await setNumber(REVIEW_KEYS.HAS_REVIEWED, 1);
      await setNumber(REVIEW_KEYS.LAST_PROMPT, Date.now());
    }
  };

  return {
    showPrompt,
    setShowPrompt,
    incrementSuccess,
    triggerStoreReview
  };
};