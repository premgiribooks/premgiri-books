import { describe, expect, it } from "vitest";

import { allocateFifoQuantity, takeFromAllocationQueue } from "@/engines/inventory/warehouse-allocation";

describe("allocateFifoQuantity", () => {
  it("fully satisfies demand from the single oldest candidate when it has enough", () => {
    const result = allocateFifoQuantity(
      [
        { warehouseId: "old", availableQuantity: 50 },
        { warehouseId: "new", availableQuantity: 20 },
      ],
      10
    );

    expect(result.allocations).toEqual([{ warehouseId: "old", quantity: 10 }]);
    expect(result.shortfall).toBe(0);
  });

  it("spills over into the next candidate in order once the first is exhausted", () => {
    const result = allocateFifoQuantity(
      [
        { warehouseId: "old", availableQuantity: 5 },
        { warehouseId: "middle", availableQuantity: 3 },
        { warehouseId: "new", availableQuantity: 100 },
      ],
      10
    );

    expect(result.allocations).toEqual([
      { warehouseId: "old", quantity: 5 },
      { warehouseId: "middle", quantity: 3 },
      { warehouseId: "new", quantity: 2 },
    ]);
    expect(result.shortfall).toBe(0);
  });

  it("skips a candidate with zero or negative available quantity", () => {
    const result = allocateFifoQuantity(
      [
        { warehouseId: "empty", availableQuantity: 0 },
        { warehouseId: "negative", availableQuantity: -5 },
        { warehouseId: "stocked", availableQuantity: 10 },
      ],
      4
    );

    expect(result.allocations).toEqual([{ warehouseId: "stocked", quantity: 4 }]);
  });

  it("reports the unmet shortfall when no combination of candidates covers the requirement", () => {
    const result = allocateFifoQuantity([{ warehouseId: "only", availableQuantity: 3 }], 10);

    expect(result.allocations).toEqual([{ warehouseId: "only", quantity: 3 }]);
    expect(result.shortfall).toBe(7);
  });

  it("returns no allocations and the full shortfall when there are no candidates at all", () => {
    const result = allocateFifoQuantity([], 5);

    expect(result.allocations).toEqual([]);
    expect(result.shortfall).toBe(5);
  });

  it("never over-allocates beyond the required quantity", () => {
    const result = allocateFifoQuantity([{ warehouseId: "abundant", availableQuantity: 1000 }], 7);

    expect(result.allocations).toEqual([{ warehouseId: "abundant", quantity: 7 }]);
  });
});

describe("takeFromAllocationQueue", () => {
  it("takes the full requirement from the front of the queue when one chunk covers it", () => {
    const { taken, remainingQueue } = takeFromAllocationQueue(
      [
        { warehouseId: "a", quantity: 10 },
        { warehouseId: "b", quantity: 5 },
      ],
      4
    );

    expect(taken).toEqual([{ warehouseId: "a", quantity: 4 }]);
    expect(remainingQueue).toEqual([
      { warehouseId: "a", quantity: 6 },
      { warehouseId: "b", quantity: 5 },
    ]);
  });

  it("splits across chunks when the first isn't enough, in queue order", () => {
    const { taken, remainingQueue } = takeFromAllocationQueue(
      [
        { warehouseId: "a", quantity: 3 },
        { warehouseId: "b", quantity: 10 },
      ],
      5
    );

    expect(taken).toEqual([
      { warehouseId: "a", quantity: 3 },
      { warehouseId: "b", quantity: 2 },
    ]);
    expect(remainingQueue).toEqual([{ warehouseId: "b", quantity: 8 }]);
  });

  it("supports two lines of the same product consuming the same queue in sequence without double-claiming stock", () => {
    const productQueue = [
      { warehouseId: "old", quantity: 6 },
      { warehouseId: "new", quantity: 4 },
    ];

    const firstLine = takeFromAllocationQueue(productQueue, 5);
    expect(firstLine.taken).toEqual([{ warehouseId: "old", quantity: 5 }]);

    const secondLine = takeFromAllocationQueue(firstLine.remainingQueue, 3);
    expect(secondLine.taken).toEqual([{ warehouseId: "old", quantity: 1 }, { warehouseId: "new", quantity: 2 }]);
    expect(secondLine.remainingQueue).toEqual([{ warehouseId: "new", quantity: 2 }]);
  });

  it("does not mutate the input queue", () => {
    const queue = [{ warehouseId: "a", quantity: 10 }];
    takeFromAllocationQueue(queue, 4);

    expect(queue).toEqual([{ warehouseId: "a", quantity: 10 }]);
  });

  it("stops taking once the queue is exhausted, even if the requirement isn't fully met", () => {
    const { taken, remainingQueue } = takeFromAllocationQueue([{ warehouseId: "a", quantity: 2 }], 10);

    expect(taken).toEqual([{ warehouseId: "a", quantity: 2 }]);
    expect(remainingQueue).toEqual([]);
  });
});
