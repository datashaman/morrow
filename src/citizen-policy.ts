import { createRandom } from "./random.js";

export const JOB_OFFER_ACTIONS = ["accept-job-offer", "decline-job-offer"] as const;
export const PERSONAL_TIME_ACTIONS = ["do-nothing", "buy-comfort", "social-visit", "buy-learning-tools"] as const;

export type JobOfferAction = (typeof JOB_OFFER_ACTIONS)[number];
export type PersonalTimeAction = (typeof PERSONAL_TIME_ACTIONS)[number];
export type CitizenAction = JobOfferAction | PersonalTimeAction;

export type MotivationProfile = Readonly<{
  comfort: number;
  connection: number;
  mastery: number;
  security: number;
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
  profile: MotivationProfile;
}>;

export type CitizenObservation = JobOfferObservation | PersonalTimeObservation;

export type CitizenPolicyDecision = Readonly<{
  action: CitizenAction;
  reasons: readonly string[];
  scores?: Readonly<Record<string, number>>;
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
  });
}

export class RuleCitizenPolicy implements CitizenPolicy {
  readonly id = "rule-v1";

  decide({ observation, random }: CitizenPolicyInput): CitizenPolicyDecision {
    if (observation.kind !== "job-offer") throw new Error(`${this.id} cannot decide ${observation.kind}`);
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

    const draw = random();
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
}

export class MotivationCitizenPolicy implements CitizenPolicy {
  readonly id = "motivation-v1";
  readonly jobOfferPolicy = new RuleCitizenPolicy();

  decide(input: CitizenPolicyInput): CitizenPolicyDecision {
    if (input.observation.kind === "job-offer") return this.jobOfferPolicy.decide(input);

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
      "do-nothing": "Doing nothing",
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
}
