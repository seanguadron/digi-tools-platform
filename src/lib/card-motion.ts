export type CardMotionRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export function getCardTilt(
  pointerX: number,
  pointerY: number,
  rect: CardMotionRect,
  radius = 110,
) {
  const nearestX = Math.max(rect.left, Math.min(pointerX, rect.right));
  const nearestY = Math.max(rect.top, Math.min(pointerY, rect.bottom));
  const distance = Math.hypot(pointerX - nearestX, pointerY - nearestY);

  if (distance > radius) {
    return null;
  }

  const influence = 1 - distance / radius;
  const normalizedX = Math.max(
    -1,
    Math.min(1, (pointerX - (rect.left + rect.width / 2)) / (rect.width / 2)),
  );
  const normalizedY = Math.max(
    -1,
    Math.min(
      1,
      (pointerY - (rect.top + rect.height / 2)) / (rect.height / 2),
    ),
  );

  return {
    rotateX: -normalizedY * 3.2 * influence,
    rotateY: normalizedX * 4.2 * influence,
  };
}

export function attachCardDragPreview(
  source: HTMLElement,
  dataTransfer: DataTransfer,
  pointerX: number,
  pointerY: number,
) {
  const rect = source.getBoundingClientRect();
  const preview = source.cloneNode(true) as HTMLElement;
  const hasPointerPosition = pointerX !== 0 || pointerY !== 0;
  const offsetX = hasPointerPosition
    ? Math.max(0, Math.min(pointerX - rect.left, rect.width))
    : rect.width / 2;
  const offsetY = hasPointerPosition
    ? Math.max(0, Math.min(pointerY - rect.top, rect.height))
    : Math.min(24, rect.height / 4);

  preview.classList.add("card-drag-preview");
  preview.removeAttribute("id");
  preview.style.width = `${rect.width}px`;
  preview.style.height = `${rect.height}px`;
  document.body.appendChild(preview);
  dataTransfer.setDragImage(preview, offsetX, offsetY);

  return () => preview.remove();
}
