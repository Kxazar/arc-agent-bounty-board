type MilestoneArray = [bigint, bigint, bigint];

export function singleMilestonePlan(amount: bigint): { milestoneAmounts: MilestoneArray; milestoneCount: number } {
  return {
    milestoneAmounts: [amount, 0n, 0n],
    milestoneCount: 1
  };
}

export function percentageMilestonePlan(
  amount: bigint,
  percentages: readonly number[]
): { milestoneAmounts: MilestoneArray; milestoneCount: number } {
  if (percentages.length === 0 || percentages.length > 3) {
    throw new Error("Milestone percentage plan must contain between 1 and 3 values.");
  }

  const milestoneAmounts = [0n, 0n, 0n] as MilestoneArray;
  let allocated = 0n;
  let totalPercentage = 0;

  for (let index = 0; index < percentages.length; index += 1) {
    totalPercentage += percentages[index];
    const isLast = index === percentages.length - 1;
    const tranche = isLast ? amount - allocated : (amount * BigInt(percentages[index])) / 100n;

    if (tranche <= 0n) {
      throw new Error("Milestone percentage plan resolved to a zero tranche.");
    }

    milestoneAmounts[index] = tranche;
    allocated += tranche;
  }

  if (totalPercentage !== 100 || allocated !== amount) {
    throw new Error("Milestone percentage plan must add up to 100% of the payout.");
  }

  return {
    milestoneAmounts,
    milestoneCount: percentages.length
  };
}

export function existingMilestonePlan(input: {
  milestoneAmounts: readonly [bigint, bigint, bigint];
  milestoneCount: number;
}): { milestoneAmounts: MilestoneArray; milestoneCount: number } {
  return {
    milestoneAmounts: [...input.milestoneAmounts] as MilestoneArray,
    milestoneCount: input.milestoneCount
  };
}
