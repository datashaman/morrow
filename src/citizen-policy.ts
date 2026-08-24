export const JOB_OFFER_ACTIONS = ["accept-job-offer", "decline-job-offer"] as const;

export type JobOfferAction = (typeof JOB_OFFER_ACTIONS)[number];

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

export type CitizenPolicyDecision = Readonly<{
  action: JobOfferAction;
  reasons: readonly string[];
  scores?: Readonly<Record<string, number>>;
}>;

export type CitizenPolicyInput = Readonly<{
  observation: JobOfferObservation;
  legalActions: readonly JobOfferAction[];
  random: () => number;
}>;

export interface CitizenPolicy {
  readonly id: string;
  decide(input: CitizenPolicyInput): CitizenPolicyDecision;
}

export class RuleCitizenPolicy implements CitizenPolicy {
  readonly id = "rule-v1";

  decide({ observation, random }: CitizenPolicyInput): CitizenPolicyDecision {
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
