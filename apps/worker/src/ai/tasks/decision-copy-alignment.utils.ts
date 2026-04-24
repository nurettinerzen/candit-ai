import { Recommendation } from "@prisma/client";
import {
  looksLikeLowSignalDecisionSummary,
  normalizeComparableText
} from "./task-text-sanitizer.utils.js";

type DecisionCopyMode = "screening" | "review_pack";

type AlignDecisionCopyInput = {
  mode: DecisionCopyMode;
  recommendation: Recommendation;
  summary: string;
  action: string;
  strengths?: string[];
  weaknesses?: string[];
  missingInformation?: string[];
};

const ADVANCE_SIGNAL_PATTERN =
  /(uygun oldugu|uygun gorunuyor|guclu aday|\bilerlet(?!me)\w*|sonraki asama|mulakata al|mulakata davet|gorusmeye al|gorusmeye davet)/;
const HOLD_SIGNAL_PATTERN =
  /(teyit|dogrula|follow up|follow-up|acik nokta|ek gorusme|kisa gorusme|incelemesinde tut|kritik nokta|beklet)/;
const REVIEW_SIGNAL_PATTERN =
  /(manuel inceleme|daha siki|ilerletmeden once|ilerletme karari vermeden once|yakindan incele|uyum net degil|risk|review|yeniden degerlendir)/;

function hasPattern(value: string, pattern: RegExp) {
  return pattern.test(normalizeComparableText(value));
}

function summaryLooksAligned(summary: string, recommendation: Recommendation) {
  if (!summary.trim() || looksLikeLowSignalDecisionSummary(summary)) {
    return false;
  }

  const hasAdvance = hasPattern(summary, ADVANCE_SIGNAL_PATTERN);
  const hasHold = hasPattern(summary, HOLD_SIGNAL_PATTERN);
  const hasReview = hasPattern(summary, REVIEW_SIGNAL_PATTERN);

  switch (recommendation) {
    case Recommendation.ADVANCE:
      return hasAdvance && !hasReview;
    case Recommendation.HOLD:
      return hasHold && !hasAdvance;
    case Recommendation.REVIEW:
      return hasReview && !hasAdvance;
    default:
      return false;
  }
}

function actionLooksAligned(action: string, recommendation: Recommendation) {
  const hasAdvance = hasPattern(action, ADVANCE_SIGNAL_PATTERN);
  const hasHold = hasPattern(action, HOLD_SIGNAL_PATTERN);
  const hasReview = hasPattern(action, REVIEW_SIGNAL_PATTERN);

  switch (recommendation) {
    case Recommendation.ADVANCE:
      return hasAdvance && !hasReview;
    case Recommendation.HOLD:
      return hasHold && !hasAdvance;
    case Recommendation.REVIEW:
      return hasReview && !hasAdvance;
    default:
      return false;
  }
}

function buildFallbackSummary(input: AlignDecisionCopyInput) {
  if (input.recommendation === Recommendation.ADVANCE) {
    const leadingSignal =
      input.strengths?.[0] ??
      (input.mode === "screening"
        ? "Role yakin guclu sinyaller mevcut."
        : "Ilerlemeyi destekleyen yeterli mulakat sinyali var.");
    return input.mode === "screening"
      ? `${leadingSignal} Recruiter ilk gorusmeye alip kritik gereksinimleri hizlica dogrulayabilir.`
      : `${leadingSignal} Adayi sonraki asamaya tasiyip kalan riskleri kisa bir recruiter teyidiyle kapatin.`;
  }

  if (input.recommendation === Recommendation.HOLD) {
    const openQuestion =
      input.weaknesses?.[0] ??
      input.missingInformation?.[0] ??
      "Karar icin birkac kritik nokta halen teyit bekliyor.";
    return input.mode === "screening"
      ? `${openQuestion} Bu nedenle kisa bir recruiter gorusmesiyle acik noktalar kapatilmalidir.`
      : `${openQuestion} Hedefli bir follow-up ile acik noktalar netlestikten sonra karar verin.`;
  }

  const mainRisk =
    input.weaknesses?.[0] ??
    input.missingInformation?.[0] ??
    "Bu asamada role uyum ve execution seviyesi yeterince net degil.";
  return input.mode === "screening"
    ? `${mainRisk} Adayi ilerletmeden once manuel recruiter incelemesi yapin.`
    : `${mainRisk} Ilerletme karari vermeden once daha derin bir recruiter incelemesi yapin.`;
}

function buildFallbackAction(input: AlignDecisionCopyInput) {
  if (input.recommendation === Recommendation.ADVANCE) {
    return input.mode === "screening"
      ? "Adayi ilk recruiter/mulakat asamasina tasiyin; kritik gereksinimleri ilk gorusmede dogrulayin."
      : "Adayi sonraki asamaya tasiyin; kalan riskleri kisa bir recruiter teyidiyle kapatin.";
  }

  if (input.recommendation === Recommendation.HOLD) {
    return input.mode === "screening"
      ? "Adayi recruiter incelemesinde tutun; acik noktalar icin hedefli bir follow-up yapin."
      : "Adayi recruiter incelemesinde tutun; eksik noktalar icin hedefli bir follow-up planlayin.";
  }

  return "Adayi ilerletmeden once manuel recruiter incelemesi yapin.";
}

export function alignDecisionCopy(input: AlignDecisionCopyInput) {
  const summary = summaryLooksAligned(input.summary, input.recommendation)
    ? input.summary.trim().slice(0, 700)
    : buildFallbackSummary(input).slice(0, 700);
  const action = actionLooksAligned(input.action, input.recommendation)
    ? input.action.trim().slice(0, 700)
    : buildFallbackAction(input).slice(0, 700);

  return {
    summary,
    action
  };
}
