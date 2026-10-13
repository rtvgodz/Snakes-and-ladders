export const BOARD_SIZE = 100;
export const BOARD_WIDTH = 10;

export const BOARD_TRANSITIONS = Object.freeze([
  { type: "ladder", start: 3, end: 22 },
  { type: "ladder", start: 5, end: 8 },
  { type: "ladder", start: 11, end: 26 },
  { type: "ladder", start: 20, end: 29 },
  { type: "ladder", start: 27, end: 56 },
  { type: "ladder", start: 36, end: 44 },
  { type: "ladder", start: 51, end: 67 },
  { type: "ladder", start: 71, end: 92 },
  { type: "ladder", start: 80, end: 99 },
  { type: "snake", start: 17, end: 4 },
  { type: "snake", start: 19, end: 7 },
  { type: "snake", start: 21, end: 9 },
  { type: "snake", start: 43, end: 34 },
  { type: "snake", start: 49, end: 30 },
  { type: "snake", start: 62, end: 18 },
  { type: "snake", start: 64, end: 60 },
  { type: "snake", start: 87, end: 24 },
  { type: "snake", start: 95, end: 75 },
  { type: "snake", start: 98, end: 79 },
]);

export function createBoard() {
  return Array.from({ length: BOARD_SIZE }, (_, index) => {
    const displayRow = Math.floor(index / BOARD_WIDTH);
    const column = index % BOARD_WIDTH;
    const boardRow = BOARD_WIDTH - 1 - displayRow;
    const positionInRow =
      boardRow % 2 === 0 ? column : BOARD_WIDTH - 1 - column;

    return boardRow * BOARD_WIDTH + positionInRow + 1;
  });
}
