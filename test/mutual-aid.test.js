import assert from "node:assert/strict";
import test from "node:test";
import { MotivationCitizenPolicy } from "../src/citizen-policy.ts";
import { FOOD_PANTRY_CAPACITY } from "../src/config.js";
import { TownSimulation } from "../src/simulation.js";

class ForcedMutualAidPolicy extends MotivationCitizenPolicy {
  constructor({ offer = () => true, accept = () => true, beforeAccept = null } = {}) {
    super();
    this.offer = offer;
    this.accept = accept;
    this.beforeAccept = beforeAccept;
  }

  decide(input) {
    if (input.observation.kind === "mutual-aid-offer") {
      const option = input.observation.options.find(this.offer);
      return { action: option?.action ?? "keep-meals", reasons: ["forced test offer"] };
    }
    if (input.observation.kind === "mutual-aid-receive") {
      this.beforeAccept?.(input.observation);
      const option = input.observation.options.find(this.accept);
      return { action: option?.action ?? "refuse-all-meal-gifts", reasons: ["forced test response"] };
    }
    return super.decide(input);
  }
}

function meal(town, owner, mealId, { processedDay = town.day, shelfLife = 3, quality = 0.8 } = {}) {
  const seller = town.firms.find((firm) => firm.sector === "food");
  return {
    mealId,
    product: seller.sells,
    processedDay,
    purchasedDay: town.day,
    quality,
    qualityAtPurchase: quality,
    shelfLife,
    seller: seller.id,
    ownerKind: owner.kind,
    ownerId: owner.id,
    ownerName: owner.name,
    custody: [],
  };
}

function mutualAidTown(policy = new ForcedMutualAidPolicy()) {
  const town = new TownSimulation({ seed: 59, cooperationMode: "mutual-aid", citizenPolicy: policy });
  town.people.forEach((person) => {
    person.relationships = {};
    person.foodStock = [];
    person.mutualAidHistory = [];
    person.decisions = [];
    person.foodReserveTarget = 1;
  });
  town.foodItemSequence = 10;
  return town;
}

function closeFriends(town, leftId, rightId, strength = 0.9) {
  town.formFriendship(town.people[leftId], town.people[rightId], strength, town.day);
}

test("one renewed initial friendship crosses the exact close threshold", () => {
  const town = mutualAidTown();
  const left = town.people[0];
  const right = town.people[1];
  town.formFriendship(left, right, 0.6, town.day);

  town.pairSocialVisitors([left, right], "park");

  assert.equal(left.relationships[right.id].strength, 0.78);
  assert.equal(right.relationships[left.id].strength, 0.78);
  assert.equal(town.closeFriendshipStrength(left, right), 0.78);
});

test("an accepted mutual-aid gift moves the exact meal without moving money", () => {
  const town = mutualAidTown();
  const giver = town.people[0];
  const recipient = town.people[1];
  closeFriends(town, giver.id, recipient.id);
  giver.foodStock = [meal(town, giver, 1), meal(town, giver, 2)];
  const moneyBefore = town.totalMoney();
  const exactMeal = giver.foodStock[0];

  town.runMutualAidExchange();

  assert.equal(town.totalMoney(), moneyBefore);
  assert.equal(giver.foodStock.length, 1);
  assert.equal(recipient.foodStock.length, 1);
  assert.equal(recipient.foodStock[0], exactMeal);
  assert.equal(exactMeal.ownerId, recipient.id);
  assert.deepEqual(exactMeal.custody.map(({ offerId, day, block, phase, processingPhase, giverId, recipientId }) => ({ offerId, day, block, phase, processingPhase, giverId, recipientId })), [
    { offerId: 1, day: 1, block: "Evening", phase: "Food shopping", processingPhase: "Food", giverId: giver.id, recipientId: recipient.id },
  ]);
  assert.equal(giver.mutualAidHistory[0].direction, "out");
  assert.equal(recipient.mutualAidHistory[0].direction, "in");
  assert.equal(giver.mutualAidHistory[0].offerId, recipient.mutualAidHistory[0].offerId);
  assert.equal(Object.isFrozen(giver.mutualAidHistory[0]), true);
});

test("closure-aware protected meals cannot be offered", () => {
  const town = mutualAidTown();
  const giver = town.people[0];
  const recipient = town.people[1];
  closeFriends(town, giver.id, recipient.id);
  giver.foodReserveTarget = 2;
  giver.foodStock = [
    meal(town, giver, 1, { processedDay: 1, shelfLife: 2 }),
    meal(town, giver, 2, { processedDay: 1, shelfLife: 5 }),
  ];

  town.runMutualAidExchange();

  assert.equal(giver.foodStock.length, 2);
  assert.equal(recipient.foodStock.length, 0);
  assert.equal(giver.decisions.some((decision) => decision.kind === "mutual-aid-offer"), false);
});

test("weak friendships and expired surplus never create legal offers", () => {
  for (const blockedBy of ["friendship", "expiry"]) {
    const town = mutualAidTown();
    const giver = town.people[0];
    const recipient = town.people[1];
    closeFriends(town, giver.id, recipient.id, blockedBy === "friendship" ? 0.74 : 0.9);
    giver.foodStock = [
      meal(town, giver, 1),
      meal(town, giver, 2, blockedBy === "expiry" ? { processedDay: -3, shelfLife: 3 } : {}),
    ];

    town.runMutualAidExchange();

    assert.equal(recipient.foodStock.length, 0);
    assert.equal(giver.decisions.some((decision) => decision.kind === "mutual-aid-offer"), false);
  }
});

test("kept and refused offers leave food and custody unchanged", () => {
  for (const policy of [
    new ForcedMutualAidPolicy({ offer: () => false }),
    new ForcedMutualAidPolicy({ accept: () => false }),
  ]) {
    const town = mutualAidTown(policy);
    const giver = town.people[0];
    const recipient = town.people[1];
    closeFriends(town, giver.id, recipient.id);
    giver.foodStock = [meal(town, giver, 1), meal(town, giver, 2)];

    town.runMutualAidExchange();

    assert.equal(giver.foodStock.length, 2);
    assert.equal(recipient.foodStock.length, 0);
    assert.deepEqual(giver.foodStock.flatMap((item) => item.custody), []);
    assert.deepEqual(giver.mutualAidHistory, []);
  }
});

test("a recipient can accept at most one offer from an immutable daily batch", () => {
  const town = mutualAidTown();
  const recipient = town.people[2];
  [0, 1].forEach((giverId) => {
    const giver = town.people[giverId];
    closeFriends(town, giver.id, recipient.id);
    giver.foodStock = [meal(town, giver, giverId * 2 + 1), meal(town, giver, giverId * 2 + 2)];
  });

  town.runMutualAidExchange();

  assert.equal(recipient.foodStock.length, 1);
  assert.equal(town.people[0].foodStock.length + town.people[1].foodStock.length, 3);
  assert.equal(recipient.decisions.filter((decision) => decision.kind === "mutual-aid-receive").length, 1);
});

test("death during batched resolution prevents transfer and is attributable", () => {
  let town;
  const policy = new ForcedMutualAidPolicy({ beforeAccept: () => { town.people[0].alive = false; } });
  town = mutualAidTown(policy);
  const giver = town.people[0];
  const recipient = town.people[1];
  closeFriends(town, giver.id, recipient.id);
  giver.foodStock = [meal(town, giver, 1), meal(town, giver, 2)];

  town.runMutualAidExchange();

  assert.equal(giver.foodStock.length, 2);
  assert.equal(recipient.foodStock.length, 0);
  const decision = recipient.decisions.find((entry) => entry.kind === "mutual-aid-receive");
  assert.deepEqual(decision.application, { offerId: 1, applied: false, failure: "giver or recipient was no longer living" });
});

test("expiry and pantry contention are revalidated after recipient choice", () => {
  for (const constraint of ["expiry", "pantry"]) {
    let town;
    const policy = new ForcedMutualAidPolicy({
      beforeAccept: () => {
        if (constraint === "expiry") {
          town.people[0].foodStock[0].processedDay = -10;
          town.people[0].foodStock[0].shelfLife = 1;
        } else {
          const recipient = town.people[1];
          recipient.foodStock = Array.from({ length: FOOD_PANTRY_CAPACITY }, (_, index) => meal(town, recipient, 40 + index));
        }
      },
    });
    town = mutualAidTown(policy);
    const giver = town.people[0];
    const recipient = town.people[1];
    closeFriends(town, giver.id, recipient.id);
    giver.foodStock = [meal(town, giver, 1), meal(town, giver, 2)];

    town.runMutualAidExchange();

    assert.equal(giver.foodStock.length, 2);
    const decision = recipient.decisions.find((entry) => entry.kind === "mutual-aid-receive");
    assert.equal(decision.application.applied, false);
    assert.match(decision.application.failure, constraint === "expiry" ? /no longer unexpired/ : /pantry no longer had room/);
  }
});

test("a received meal may be re-gifted only in a later exchange", () => {
  const policy = new ForcedMutualAidPolicy();
  const town = mutualAidTown(policy);
  const firstGiver = town.people[0];
  const intermediary = town.people[1];
  const finalRecipient = town.people[2];
  closeFriends(town, firstGiver.id, intermediary.id);
  firstGiver.foodStock = [meal(town, firstGiver, 1), meal(town, firstGiver, 2)];

  town.runMutualAidExchange();
  const received = intermediary.foodStock[0];
  assert.equal(received.custody.length, 1);
  assert.equal(finalRecipient.foodStock.length, 0);

  town.day += 1;
  firstGiver.foodStock = Array.from({ length: FOOD_PANTRY_CAPACITY }, (_, index) => meal(town, firstGiver, 20 + index, { shelfLife: 5 }));
  delete firstGiver.relationships[intermediary.id];
  delete intermediary.relationships[firstGiver.id];
  closeFriends(town, intermediary.id, finalRecipient.id);
  intermediary.foodStock.push(meal(town, intermediary, 30, { shelfLife: 5 }));
  policy.offer = (option) => option.mealId === received.mealId && option.recipientId === finalRecipient.id;

  town.runMutualAidExchange();

  assert.equal(finalRecipient.foodStock.includes(received), true);
  assert.equal(received.custody.length, 2);
  assert.deepEqual(received.custody.map((entry) => [entry.day, entry.giverId, entry.recipientId]), [[1, 0, 1], [2, 1, 2]]);
});

test("motivation-v3 applies the specified offer and refusal tie preferences", () => {
  const policy = new MotivationCitizenPolicy();
  const profile = { comfort: 1, connection: 1.3, mastery: 1, security: 0.7, foodQuality: 1.3, planning: 1.1, avoidance: 0.7 };
  const offerObservation = {
    kind: "mutual-aid-offer", citizenId: 0, citizenName: "A", stress: 0.2, runwayDays: 12, protectedReserve: 1, profile,
    options: [{ action: "offer-meal:1", offerId: 1, mealId: 1, recipientId: 1, recipientName: "B", relationshipStrength: 0.9, recipientNeed: 0.8, reserveHeadroom: 1, spoilagePressure: 0.5 }],
  };
  const offer = policy.decide({ observation: offerObservation, legalActions: ["keep-meals", "offer-meal:1"], random: () => 0 });
  assert.equal(offer.action, "offer-meal:1");

  const refusalObservation = {
    kind: "mutual-aid-receive", citizenId: 1, citizenName: "B", stress: 0, pantryFill: 1, profile: { ...profile, planning: 3, foodQuality: 3 },
    options: [{ action: "accept-meal:1", offerId: 1, mealId: 1, giverId: 0, giverName: "A", relationshipStrength: 0.75, recipientNeed: 0, mealQuality: 0.2, remainingLifeFraction: 0 }],
  };
  const refusal = policy.decide({ observation: refusalObservation, legalActions: ["refuse-all-meal-gifts", "accept-meal:1"], random: () => 0 });
  assert.equal(refusal.action, "refuse-all-meal-gifts");
});

test("reset clears cooperation and custody state while retaining the configured mode", () => {
  const town = mutualAidTown();
  const giver = town.people[0];
  const recipient = town.people[1];
  closeFriends(town, giver.id, recipient.id);
  giver.foodStock = [meal(town, giver, 1), meal(town, giver, 2)];
  town.runMutualAidExchange();
  assert.equal(recipient.mutualAidHistory.length, 1);

  town.reset();

  assert.equal(town.cooperationMode, "mutual-aid");
  assert.equal(town.mutualAidOfferSequence, 0);
  assert.equal(town.mutualAidTransferSequence, 0);
  assert.deepEqual(town.foodItems, {});
  assert.ok(town.people.every((person) => person.mutualAidHistory.length === 0 && person.foodStock.length === 0));
});
