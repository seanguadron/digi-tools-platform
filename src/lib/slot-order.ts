export function insertIntoSlots(
  slots: readonly string[],
  targetIndex: number,
  itemId: string,
  slotCount: number,
) {
  const normalizedSlots = Array.from(
    { length: slotCount },
    (_, index) => slots[index] ?? "",
  );
  const nextSlots = normalizedSlots.filter(
    (currentItemId) => currentItemId !== itemId,
  );
  const boundedIndex = Math.max(0, Math.min(targetIndex, slotCount - 1));

  nextSlots.splice(boundedIndex, 0, itemId);
  return nextSlots.slice(0, slotCount);
}
