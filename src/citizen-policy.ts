import { createRandom } from "./random.js";

export const JOB_OFFER_ACTIONS = ["accept-job-offer", "decline-job-offer"] as const;
export const ATTENDANCE_ACTIONS = ["attend-shift", "miss-shift"] as const;
export const SKIP_JOB_SEARCH = "skip-job-search" as const;
export const PERSONAL_TIME_ACTIONS = ["do-nothing", "buy-comfort", "social-visit", "buy-learning-tools"] as const;

export type JobOfferAction = (typeof JOB_OFFER_ACTIONS)[number];
export type AttendanceAction = (typeof ATTENDANCE_ACTIONS)[number];
export type JobSearchAction = typeof SKIP_JOB_SEARCH | `apply-job:${number}`;
export type PersonalTimeAction = (typeof PERSONAL_TIME_ACTIONS)[number];
export type FoodAction = "skip-food" | `eat-stored-food:${number}` | `buy-food:${number}:${number}`;
export type HousingAction = "defer-housing" | "remain-unhoused" | `pay-housing:${number}` | `secure-housing:${number}`;
export type OwnerAction = "draw-owner-wage" | "waive-owner-wage" | "contribute-owner-capital" | "wait-on-owner-financing" | "choose-voluntary-insolvency" | "hold-owner-price" | "lower-owner-price" | "raise-owner-price" | "retain-owner-cash" | "take-owner-distribution";
export type CitizenAction = JobOfferAction | AttendanceAction | JobSearchAction | PersonalTimeAction | FoodAction | HousingAction | OwnerAction;

export type MotivationProfile = Readonly<{
  comfort: number;
  connection: number;
  mastery: number;
  security: number;
  foodQuality: number;
  planning: number;
  avoidance: number;
}>;

export type JobOfferObservation = Readonly<{
  kind: "job-offer";
  citizenId: number;
  citizenName: string;
  firmId: number;
  firmName: string;
  offeredWage: number;
  reservationWage: number;
  skill: number;
  reliability: number;
  acceptanceProbability: number;
  acceptanceDraw: number;
  stress: number;
  runwayDays: number;
  safetyNeed: number;
  profile: MotivationProfile;
}>;

export type JobSearchOption = Readonly<{
  action: `apply-job:${number}`;
  firmId: number;
  firmName: string;
  offeredWage: number;
  reservationWage: number;
  firmTrouble: number;
  vacancyAge: number;
}>;

export type JobSearchObservation = Readonly<{
  kind: "job-search";
  citizenId: number;
  citizenName: string;
  skill: number;
  reliability: number;
  stress: number;
  runwayDays: number;
  safetyNeed: number;
  profile: MotivationProfile;
  options: readonly JobSearchOption[];
}>;

export type AttendanceObservation = Readonly<{
  kind: "attendance";
  citizenId: number;
  citizenName: string;
  firmId: number;
  firmName: string;
  health: number;
  stress: number;
  hungryDays: number;
  runwayDays: number;
  reliability: number;
  missedWork: number;
  baselineMissChance: number;
  attendanceDraw: number;
  profile: MotivationProfile;
}>;

export type PersonalTimeObservation = Readonly<{
  kind: "personal-time";
  citizenId: number;
  citizenName: string;
  stress: number;
  runwayDays: number;
  focus: string;
  needs: Readonly<Record<string, number>>;
  relationshipCount: number;
  strongestRelationship: number;
  freeActivity?: "rest" | "park-social" | "self-study";
  profile: MotivationProfile;
}>;

export type FoodOption = Readonly<{
  action: FoodAction;
  source: "stored" | "seller";
  sellerId: number;
  sellerName: string;
  units: number;
  unitPrice: number;
  totalPrice: number;
  effectiveQuality: number;
  age: number;
  capacityAvailable: boolean;
}>;

export type FoodObservation = Readonly<{
  kind: "food";
  citizenId: number;
  citizenName: string;
  stress: number;
  health: number;
  hungryDays: number;
  runwayDays: number;
  reserveTarget: number;
  scarcityError: boolean;
  profile: MotivationProfile;
  options: readonly FoodOption[];
}>;

export type HousingOption = Readonly<{
  action: HousingAction;
  firmId: number;
  firmName: string;
  totalPrice: number;
  capacityAvailable: boolean;
}>;

export type HousingObservation = Readonly<{
  kind: "housing";
  citizenId: number;
  citizenName: string;
  housed: boolean;
  rentArrears: number;
  stress: number;
  runwayDays: number;
  scarcityError: boolean;
  profile: MotivationProfile;
  options: readonly HousingOption[];
}>;

export type OwnerOption = Readonly<{
  action: OwnerAction;
  label: string;
  amount?: number;
  resultingPrice?: number;
  personalSafety: number;
  firmContinuity: number;
  workerProtection: number;
  growth: number;
  extraction: number;
  exitRelief: number;
}>;

export type OwnerObservation = Readonly<{
  kind: "owner";
  domain: "wage" | "financing" | "pricing" | "distribution";
  citizenId: number;
  citizenName: string;
  firmId: number;
  firmName: string;
  ownerRunwayDays: number;
  firmRunwayDays: number;
  firmTrouble: number;
  employeeCount: number;
  extractionPreference: number;
  profile: MotivationProfile;
  options: readonly OwnerOption[];
}>;

export type CitizenObservation = JobOfferObservation | JobSearchObservation | AttendanceObservation | PersonalTimeObservation | FoodObservation | HousingObservation | OwnerObservation;

export type CitizenPolicyDecision = Readonly<{
  action: CitizenAction;
  reasons: readonly string[];
  scores?: Readonly<Record<string, number>>;
  control?: Readonly<{
    mode: "deterministic" | "neural";
    domain: "personal-time";
    policy: string;
    fallbackPolicy: string;
    weightsVersion: string;
    schemaVersion: number;
    gateVersion: number;
    probabilities: Readonly<Record<string, number>>;
  }>;
  shadow?: Readonly<{
    policy: string;
    weightsVersion: string;
    schemaVersion: number;
    action: CitizenAction;
    diverged: boolean;
    unmaskedPreference: string;
    unmaskedActionKind: string;
    invalidPreferenceBeforeMask: boolean;
    legalMask: Readonly<Record<string, boolean>>;
    scores: Readonly<Record<string, number>>;
  }>;
}>;

export type CitizenPolicyInput = Readonly<{
  observation: CitizenObservation;
  legalActions: readonly CitizenAction[];
  random: () => number;
}>;

export interface CitizenPolicy {
  readonly id: string;
  decide(input: CitizenPolicyInput): CitizenPolicyDecision;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const roundedWeight = (value: number) => Math.round(value * 1000) / 1000;

export function createMotivationProfile(seed: number, citizenId: number): MotivationProfile {
  const profileRandom = createRandom((seed ^ Math.imul(citizenId + 1, 0x9e3779b1)) >>> 0);
  const weight = () => roundedWeight(0.7 + profileRandom() * 0.6);
  return Object.freeze({
    comfort: weight(),
    connection: weight(),
    mastery: weight(),
    security: weight(),
    foodQuality: weight(),
    planning: weight(),
    avoidance: weight(),
  });
}

export class RuleCitizenPolicy implements CitizenPolicy {
  readonly id = "rule-v2";

  decide({ observation, legalActions }: CitizenPolicyInput): CitizenPolicyDecision {
    if (observation.kind !== "job-offer") return this.decideDeterministicRule(observation, legalActions);
    if (observation.offeredWage < observation.reservationWage) {
      return {
        action: "decline-job-offer",
        reasons: ["offered wage was below the citizen's skill-based reservation wage"],
        scores: {
          offeredWage: observation.offeredWage,
          reservationWage: observation.reservationWage,
          acceptanceProbability: observation.acceptanceProbability,
        },
      };
    }

    const draw = observation.acceptanceDraw;
    const accepted = draw < observation.acceptanceProbability;
    return {
      action: accepted ? "accept-job-offer" : "decline-job-offer",
      reasons: [accepted
        ? "offered wage met the reservation wage and the acceptance draw succeeded"
        : "offered wage met the reservation wage but the acceptance draw failed"],
      scores: {
        offeredWage: observation.offeredWage,
        reservationWage: observation.reservationWage,
        acceptanceProbability: observation.acceptanceProbability,
        randomDraw: draw,
      },
    };
  }

  decideDeterministicRule(observation: Exclude<CitizenObservation, JobOfferObservation>, legalActions: readonly CitizenAction[]): CitizenPolicyDecision {
    let action: CitizenAction = legalActions[0];
    if (observation.kind === "attendance") {
      action = observation.attendanceDraw >= observation.baselineMissChance ? "attend-shift" : "miss-shift";
    } else if (observation.kind === "job-search") {
      action = observation.options[0]?.action ?? SKIP_JOB_SEARCH;
    } else if (observation.kind === "food") {
      const stored = observation.options.filter((option) => option.source === "stored").sort((a, b) => b.age - a.age)[0];
      const purchase = observation.options.filter((option) => option.source === "seller").sort((a, b) => a.totalPrice - b.totalPrice || b.units - a.units)[0];
      action = stored?.action ?? purchase?.action ?? "skip-food";
    } else if (observation.kind === "housing") {
      action = observation.options[0]?.action ?? (observation.housed ? "defer-housing" : "remain-unhoused");
    } else if (observation.kind === "personal-time") {
      action = legalActions.includes("do-nothing") ? "do-nothing" : legalActions[0];
    } else if (observation.kind === "owner") {
      if (observation.domain === "wage") {
        const waive = observation.options.find((option) => option.action === "waive-owner-wage");
        const draw = observation.options.find((option) => option.action === "draw-owner-wage");
        action = waive && draw && waive.firmContinuity > draw.firmContinuity ? waive.action : draw?.action ?? legalActions[0];
      } else if (observation.domain === "financing") {
        action = observation.options.find((option) => option.action === "contribute-owner-capital")?.action
          ?? observation.options.find((option) => option.action === "choose-voluntary-insolvency")?.action
          ?? legalActions[0];
      } else if (observation.domain === "pricing") {
        action = observation.options.reduce((best, option) => option.firmContinuity > best.firmContinuity ? option : best).action;
      } else {
        action = observation.options.find((option) => option.action === "take-owner-distribution")?.action ?? legalActions[0];
      }
    }
    return {
      action,
      reasons: [`The deterministic ${this.id} baseline selected its fixed legal ${observation.kind} rule.`],
      scores: Object.fromEntries(legalActions.map((candidate) => [candidate, candidate === action ? 1 : 0])),
    };
  }
}

export class MotivationCitizenPolicy implements CitizenPolicy {
  readonly id = "motivation-v3";

  decide(input: CitizenPolicyInput): CitizenPolicyDecision {
    if (input.observation.kind === "job-offer") return this.decideJobOffer(input.observation, input.legalActions);
    if (input.observation.kind === "job-search") return this.decideJobSearch(input.observation, input.legalActions);
    if (input.observation.kind === "attendance") return this.decideAttendance(input.observation, input.legalActions);
    if (input.observation.kind === "food") return this.decideFood(input.observation, input.legalActions);
    if (input.observation.kind === "housing") return this.decideHousing(input.observation, input.legalActions);
    if (input.observation.kind === "owner") return this.decideOwner(input.observation, input.legalActions);

    const { observation, legalActions } = input;
    const belongingGap = 1 - (observation.needs.belonging ?? 0);
    const esteemGap = 1 - (observation.needs.esteem ?? 0);
    const growthGap = 1 - (observation.needs.growth ?? 0);
    const scarcity = clamp(1 - observation.runwayDays / 12);
    const scores: Record<string, number> = {
      "do-nothing": 0.2 + observation.profile.security * scarcity * 0.55,
      "buy-comfort": observation.profile.comfort * (0.35 + observation.stress),
      "social-visit": observation.profile.connection * (0.35 + belongingGap * 0.8),
      "buy-learning-tools": observation.profile.mastery * (0.35 + (esteemGap + growthGap) * 0.35),
    };
    const action = legalActions.reduce((best, candidate) => (
      scores[candidate] > scores[best] ? candidate : best
    ));
    const actionReasons: Record<PersonalTimeAction, string> = {
      "do-nothing": observation.freeActivity === "park-social"
        ? "Free time in the park"
        : observation.freeActivity === "self-study"
          ? "Self-directed learning"
          : "Rest",
      "buy-comfort": "Short-term comfort",
      "social-visit": "A social visit",
      "buy-learning-tools": "Learning tools",
    };
    const roundedScores = Object.fromEntries(legalActions.map((candidate) => [candidate, roundedWeight(scores[candidate])]));
    return {
      action,
      reasons: [`${actionReasons[action as PersonalTimeAction]} had the highest score among the currently legal personal-time actions.`],
      scores: roundedScores,
    };
  }

  decideOwner(observation: OwnerObservation, legalActions: readonly CitizenAction[]): CitizenPolicyDecision {
    const personalScarcity = clamp(1 - observation.ownerRunwayDays / 12);
    const scores: Record<string, number> = {};
    observation.options.forEach((option) => {
      scores[option.action] = observation.profile.security * option.personalSafety * (0.75 + personalScarcity * 0.75)
        + observation.profile.planning * option.firmContinuity * 0.65
        + observation.profile.connection * option.workerProtection * 0.4
        + observation.profile.mastery * option.growth * 0.3
        + observation.profile.comfort * option.extraction * (0.25 + observation.extractionPreference)
        + observation.profile.avoidance * option.exitRelief * 0.4;
    });
    const decision = this.highestScoringDecision(legalActions, scores, `owner-${observation.domain}`);
    return {
      ...decision,
      scores: {
        ...decision.scores,
        ownerRunwayDays: roundedWeight(observation.ownerRunwayDays),
        firmRunwayDays: roundedWeight(observation.firmRunwayDays),
        firmTrouble: roundedWeight(observation.firmTrouble),
        employeeCount: observation.employeeCount,
        extractionPreference: roundedWeight(observation.extractionPreference),
      },
    };
  }

  decideJobSearch(observation: JobSearchObservation, legalActions: readonly CitizenAction[]): CitizenPolicyDecision {
    const scarcity = clamp(1 - observation.runwayDays / 12);
    const safetyGap = 1 - observation.safetyNeed;
    const scores: Record<string, number> = {
      [SKIP_JOB_SEARCH]: 0.12 + observation.profile.avoidance * observation.stress * 0.45,
    };
    observation.options.forEach((option) => {
      const wageFit = (option.offeredWage - option.reservationWage) / Math.max(1, option.reservationWage);
      const firmStability = 1 - clamp(option.firmTrouble / 4);
      scores[option.action] = observation.profile.security * (0.5 + safetyGap * 0.7 + scarcity * 0.45)
        + observation.profile.mastery * (0.15 + wageFit * 0.35)
        + observation.reliability * 0.15
        + firmStability * 0.15
        - observation.profile.avoidance * observation.stress * 0.08;
    });
    const decision = this.highestScoringDecision(legalActions, scores, "job-search");
    return {
      ...decision,
      scores: {
        ...decision.scores,
        safetyNeed: roundedWeight(observation.safetyNeed),
        runwayDays: roundedWeight(observation.runwayDays),
        reliability: roundedWeight(observation.reliability),
      },
    };
  }

  decideJobOffer(observation: JobOfferObservation, legalActions: readonly CitizenAction[]): CitizenPolicyDecision {
    const scarcity = clamp(1 - observation.runwayDays / 12);
    const safetyGap = 1 - observation.safetyNeed;
    const wageFit = (observation.offeredWage - observation.reservationWage) / Math.max(1, observation.reservationWage);
    const favorableDraw = observation.acceptanceDraw < observation.acceptanceProbability;
    const scores: Record<string, number> = {
      "accept-job-offer": observation.profile.security * (0.55 + safetyGap * 0.65 + scarcity * 0.4)
        + observation.reliability * 0.3
        + wageFit * 0.7
        + (favorableDraw ? 0.25 : 0),
      "decline-job-offer": observation.profile.avoidance * (0.25 + observation.stress * 0.35)
        + Math.max(0, -wageFit) * 0.9
        + (favorableDraw ? 0 : 0.35),
    };
    const decision = this.highestScoringDecision(legalActions, scores, "job-offer");
    return {
      ...decision,
      scores: {
        ...decision.scores,
        offeredWage: roundedWeight(observation.offeredWage),
        reservationWage: roundedWeight(observation.reservationWage),
        reliability: roundedWeight(observation.reliability),
        safetyNeed: roundedWeight(observation.safetyNeed),
        runwayDays: roundedWeight(observation.runwayDays),
        acceptanceProbability: roundedWeight(observation.acceptanceProbability),
        acceptanceDraw: roundedWeight(observation.acceptanceDraw),
      },
    };
  }

  decideAttendance(observation: AttendanceObservation, legalActions: readonly CitizenAction[]): CitizenPolicyDecision {
    const scarcity = clamp(1 - observation.runwayDays / 12);
    const healthGap = 1 - observation.health;
    const hungerPressure = observation.hungryDays > 0 ? Math.min(1, observation.hungryDays / 2) : 0;
    const unluckyDraw = observation.attendanceDraw < observation.baselineMissChance
      ? 1 + (observation.baselineMissChance - observation.attendanceDraw) / Math.max(0.01, observation.baselineMissChance)
      : 0;
    const scores: Record<string, number> = {
      "attend-shift": observation.profile.security * (0.55 + scarcity * 0.45)
        + observation.profile.mastery * 0.18
        + observation.reliability * 0.24,
      "miss-shift": observation.profile.avoidance * (
        unluckyDraw * 0.52
        + observation.stress * 0.28
        + healthGap * 0.55
        + hungerPressure * 0.38
      ),
    };
    const decision = this.highestScoringDecision(legalActions, scores, "attendance");
    return {
      ...decision,
      scores: {
        ...decision.scores,
        health: roundedWeight(observation.health),
        stress: roundedWeight(observation.stress),
        runwayDays: roundedWeight(observation.runwayDays),
        reliability: roundedWeight(observation.reliability),
        baselineMissChance: roundedWeight(observation.baselineMissChance),
        attendanceDraw: roundedWeight(observation.attendanceDraw),
      },
    };
  }

  decideFood(observation: FoodObservation, legalActions: readonly CitizenAction[]): CitizenPolicyDecision {
    const scarcity = clamp(1 - observation.runwayDays / 12);
    const urgency = 0.9 + observation.hungryDays * 0.35 + (1 - observation.health) * 0.45;
    const scores: Record<string, number> = {
      "skip-food": 0.08 + observation.profile.avoidance * observation.stress * scarcity * (observation.scarcityError ? 1.8 : 0.18),
    };
    observation.options.forEach((option) => {
      if (option.source === "stored") {
        const spoilagePriority = observation.profile.planning * Math.min(1, option.age / 4) * 0.35;
        scores[option.action] = urgency + option.effectiveQuality * observation.profile.foodQuality * 0.55 + spoilagePriority;
        return;
      }
      const stockBenefit = observation.profile.planning * (option.units / observation.reserveTarget) * 0.55;
      const qualityBenefit = option.effectiveQuality * observation.profile.foodQuality * 0.6;
      const costPressure = observation.profile.security * scarcity * (option.totalPrice / Math.max(1, observation.runwayDays + option.totalPrice)) * 0.8;
      const capacityPenalty = option.capacityAvailable ? 0 : 1.4;
      scores[option.action] = urgency + stockBenefit + qualityBenefit - costPressure - capacityPenalty;
    });
    return this.highestScoringDecision(legalActions, scores, "food");
  }

  decideHousing(observation: HousingObservation, legalActions: readonly CitizenAction[]): CitizenPolicyDecision {
    const scarcity = clamp(1 - observation.runwayDays / 12);
    const inactiveAction = observation.housed ? "defer-housing" : "remain-unhoused";
    const scores: Record<string, number> = {
      [inactiveAction]: 0.12 + observation.profile.avoidance * observation.stress * scarcity * (observation.scarcityError ? 1.25 : 0.2),
    };
    observation.options.forEach((option) => {
      const housingNeed = observation.housed ? 1.15 + observation.rentArrears * 0.45 : 1.25 + observation.stress * 0.4;
      const costPressure = observation.profile.security * scarcity * (option.totalPrice / Math.max(1, observation.runwayDays + option.totalPrice)) * 0.45;
      const capacityPenalty = option.capacityAvailable ? 0 : 1.2;
      scores[option.action] = observation.profile.security * housingNeed - costPressure - capacityPenalty;
    });
    return this.highestScoringDecision(legalActions, scores, "housing");
  }

  highestScoringDecision(legalActions: readonly CitizenAction[], scores: Record<string, number>, domain: string): CitizenPolicyDecision {
    const action = legalActions.reduce((best, candidate) => (
      scores[candidate] > scores[best] ? candidate : best
    ));
    return {
      action,
      reasons: [`The chosen ${domain} action had the highest score among the currently legal alternatives.`],
      scores: Object.fromEntries(legalActions.map((candidate) => [candidate, roundedWeight(scores[candidate])])),
    };
  }
}
