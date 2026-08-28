const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const STAGE_ORDER = ["collapsed", "subsistence", "stability", "convenience", "affluence", "complexity"];

export function inferTownStage({ day, people, firms, policy, essentialCost }) {
  const living = people.filter((person) => person.alive);
  const adults = living.filter((person) => !person.isDependent);
  const essentialArchetypes = ["farm", "everyday-grocer", "housing-provider", "toolmaker"];
  const essentialStates = essentialArchetypes.map((archetypeId) => {
    const firm = firms.find((candidate) => candidate.active && candidate.archetypeId === archetypeId);
    return { archetypeId, operating: Boolean(firm), readiness: firm ? clamp(firm.operationalReadiness ?? 1) : 0 };
  });
  const essentialReliability = essentialStates.reduce((sum, state) => sum + state.readiness, 0) / essentialStates.length;
  const employmentRate = adults.length ? adults.filter((person) => person.employer >= 0).length / adults.length : 0;
  const reserveShare = adults.length ? adults.filter((person) => person.cash / Math.max(0.01, essentialCost) >= 10).length / adults.length : 0;
  const optionalFirms = firms.filter((firm) => firm.active && ["cafe", "premium-grocer"].includes(firm.archetypeId));
  const persistentOptionalSectors = optionalFirms.filter((firm) => day - firm.foundingDay >= 7).length;
  const oldestOptionalAge = optionalFirms.reduce((oldest, firm) => Math.max(oldest, day - firm.foundingDay), 0);
  const discretionaryDemand = clamp(policy.discretionaryDemand / 100);
  const activeArchetypes = new Set(firms.filter((firm) => firm.active).map((firm) => firm.archetypeId)).size;

  let id = "subsistence";
  if (!living.length || essentialReliability < 0.5) id = "collapsed";
  else if (essentialReliability >= 0.9 && employmentRate >= 0.45 && reserveShare >= 0.35) {
    id = "stability";
    if (persistentOptionalSectors >= 1 && discretionaryDemand >= 0.4) id = "convenience";
    if (optionalFirms.length >= 2 && employmentRate >= 0.65 && reserveShare >= 0.65) id = "affluence";
    if (id === "affluence" && activeArchetypes >= 6 && persistentOptionalSectors >= 2 && oldestOptionalAge >= 30) id = "complexity";
  }

  const descriptions = {
    collapsed: living.length ? "The essential foundation is no longer reliably operating." : "No living citizens remain; development has ended.",
    subsistence: "Morrow is meeting needs unevenly and has not established broad household security.",
    stability: "Essential sectors are reliable and work and reserves support a meaningful share of citizens.",
    convenience: "A persistent optional sector is serving demand beyond immediate essentials.",
    affluence: "Both optional sectors coexist with broad employment and protected household reserves.",
    complexity: "A long-lived six-sector economy combines essentials with persistent optional services.",
  };
  return Object.freeze({
    id,
    rank: STAGE_ORDER.indexOf(id),
    label: id[0].toUpperCase() + id.slice(1),
    description: descriptions[id],
    evidence: Object.freeze({
      livingCitizens: living.length,
      adultCitizens: adults.length,
      essentialReliability,
      essentialStates: Object.freeze(essentialStates),
      employmentRate,
      reserveShare,
      reserveRunwayDays: 10,
      discretionaryDemand,
      activeOptionalSectors: optionalFirms.length,
      persistentOptionalSectors,
      oldestOptionalAge,
      activeArchetypes,
    }),
  });
}
