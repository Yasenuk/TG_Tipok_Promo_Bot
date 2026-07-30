import type { PrizeSnapshot, RuleContext } from '../../../src/domain/rules/types.js';

export function prize(
  key: string,
  overrides: Partial<PrizeSnapshot> = {},
): PrizeSnapshot {
  return {
    key,
    title: key,
    stock: null,
    reserved: 0,
    issued: 0,
    ...overrides,
  };
}

export function ctx(
  activationCount: number,
  prizes: PrizeSnapshot[],
  random = () => 0.99,
): RuleContext {
  return {
    campaignId: 'campaign-1',
    userId: 'user-1',
    position: activationCount,
    activationCount,
    activationId: `activation-${activationCount}`,
    prizes,
    random,
  };
}

export const HYPE_PRIZES = [prize('opener'), prize('mug'), prize('cap')];

export const HYPE_RULES = {
  strategies: [
    {
      type: 'cyclic-threshold',
      config: {
        cycleLength: 6,
        awards: { '2': 'opener', '4': 'mug', '0': 'cap' },
      },
    },
  ],
};
