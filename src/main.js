import { BOARD_TRANSITIONS, createBoard } from "./game/board.js";

const boardElement = document.querySelector("#game-board");
const boardStartElement = document.querySelector("#board-start");
const playerCountElement = document.querySelector("#player-count");
const playerColorsElement = document.querySelector("#player-colors");
const setupForm = document.querySelector("#player-setup");
const statusElement = document.querySelector(".controls__status");
const diceFaceElement = document.querySelector("#dice-face");
const diceResultElement = document.querySelector("#dice-result");
const rollButton = document.querySelector("#roll-dice");
const winnerDialog = document.querySelector("#winner-dialog");
const winnerHeading = document.querySelector("#winner-heading");
const newGameButton = document.querySelector("#new-game");

if (
  !boardElement ||
  !boardStartElement ||
  !playerCountElement ||
  !playerColorsElement ||
  !setupForm ||
  !statusElement ||
  !diceFaceElement ||
  !diceResultElement ||
  !rollButton ||
  !(winnerDialog instanceof HTMLDialogElement) ||
  !winnerHeading ||
  !newGameButton
) {
  throw new Error("A required game setup element was not found.");
}

const cellsBySquare = new Map();
const transitionsByStart = new Map(
  BOARD_TRANSITIONS.map((transition) => [transition.start, transition]),
);
let players = [];
let currentPlayerIndex = 0;
let gameFinished = false;
let audioContext;

function playSound(effect) {
  const AudioContextConstructor = window.AudioContext;
  if (!AudioContextConstructor) {
    return;
  }

  audioContext ??= new AudioContextConstructor();
  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }

  const notes = {
    jump: [{ start: 0, frequency: 280, endFrequency: 680, duration: 0.2, type: "triangle" }],
    ladder: [
      { start: 0, frequency: 523.25, duration: 0.18, type: "sine" },
      { start: 0.12, frequency: 659.25, duration: 0.18, type: "sine" },
      { start: 0.24, frequency: 783.99, duration: 0.3, type: "sine" },
    ],
    snake: [{ start: 0, frequency: 420, endFrequency: 130, duration: 0.48, type: "sawtooth" }],
  }[effect];

  if (!notes) {
    throw new Error(`Unknown sound effect: ${effect}.`);
  }

  const now = audioContext.currentTime;
  for (const note of notes) {
    const oscillator = audioContext.createOscillator();
    const volume = audioContext.createGain();
    const start = now + note.start;

    oscillator.type = note.type;
    oscillator.frequency.setValueAtTime(note.frequency, start);
    if (note.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        note.endFrequency,
        start + note.duration,
      );
    }

    volume.gain.setValueAtTime(0.001, start);
    volume.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
    volume.gain.exponentialRampToValueAtTime(0.001, start + note.duration);
    oscillator.connect(volume);
    volume.connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + note.duration + 0.02);
  }
}

const boardSquares = createBoard();
const boardIndexesBySquare = new Map(
  boardSquares.map((square, index) => [square, index]),
);

for (const square of boardSquares) {
  const cell = document.createElement("div");
  cell.className = "board__cell";
  cell.setAttribute("role", "gridcell");
  cell.setAttribute("aria-label", `Square ${square}`);

  const number = document.createElement("span");
  number.className = "board__number";
  number.textContent = String(square);
  cell.append(number);

  const transition = transitionsByStart.get(square);
  if (transition) {
    const marker = document.createElement("span");
    marker.className = `board__feature board__feature--${transition.type}`;
    marker.setAttribute("aria-label", `${transition.type} to square ${transition.end}`);
    marker.textContent = `${transition.type === "ladder" ? "↑" : "↓"}${transition.end}`;
    cell.append(marker);
  }

  boardElement.append(cell);
  cellsBySquare.set(square, cell);
}

function createBoardArtwork() {
  const namespace = "http://www.w3.org/2000/svg";
  const artwork = document.createElementNS(namespace, "svg");
  artwork.classList.add("board__artwork");
  artwork.setAttribute("viewBox", "0 0 1000 1000");
  artwork.setAttribute("preserveAspectRatio", "none");
  artwork.setAttribute("aria-hidden", "true");
  artwork.setAttribute("focusable", "false");

  const pointForSquare = (square) => {
    const index = boardIndexesBySquare.get(square);
    if (index === undefined) {
      throw new Error(`No board square exists for position ${square}.`);
    }

    return {
      x: (index % 10) * 100 + 50,
      y: Math.floor(index / 10) * 100 + 50,
    };
  };

  for (const transition of BOARD_TRANSITIONS) {
    const start = pointForSquare(transition.start);
    const end = pointForSquare(transition.end);
    const group = document.createElementNS(namespace, "g");
    group.classList.add(`board__artwork-${transition.type}`);
    group.dataset.startSquare = String(transition.start);

    if (transition.type === "ladder") {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy);
      const offsetX = (-dy / length) * 11;
      const offsetY = (dx / length) * 11;

      const movementPath = document.createElementNS(namespace, "line");
      movementPath.setAttribute("x1", String(start.x));
      movementPath.setAttribute("y1", String(start.y));
      movementPath.setAttribute("x2", String(end.x));
      movementPath.setAttribute("y2", String(end.y));
      movementPath.classList.add("board__movement-path");
      group.append(movementPath);

      for (const side of [-1, 1]) {
        const rail = document.createElementNS(namespace, "line");
        rail.setAttribute("x1", String(start.x + offsetX * side));
        rail.setAttribute("y1", String(start.y + offsetY * side));
        rail.setAttribute("x2", String(end.x + offsetX * side));
        rail.setAttribute("y2", String(end.y + offsetY * side));
        rail.classList.add("board__ladder-rail");
        group.append(rail);
      }

      const rungCount = Math.max(2, Math.floor(length / 48));
      for (let rung = 1; rung < rungCount; rung += 1) {
        const progress = rung / rungCount;
        const centerX = start.x + dx * progress;
        const centerY = start.y + dy * progress;
        const step = document.createElementNS(namespace, "line");
        step.setAttribute("x1", String(centerX + offsetX));
        step.setAttribute("y1", String(centerY + offsetY));
        step.setAttribute("x2", String(centerX - offsetX));
        step.setAttribute("y2", String(centerY - offsetY));
        step.classList.add("board__ladder-rung");
        group.append(step);
      }
    } else {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const distance = Math.hypot(dx, dy);
      const amplitude = Math.min(18, distance / 6);
      const points = Array.from({ length: 33 }, (_, index) => {
        const progress = index / 32;
        const wave = Math.sin(progress * Math.PI * 4) * Math.sin(progress * Math.PI);
        return {
          x: start.x - (dy / distance) * amplitude * wave + dx * progress,
          y: start.y + (dx / distance) * amplitude * wave + dy * progress,
        };
      });
      const body = document.createElementNS(namespace, "polyline");
      body.setAttribute(
        "points",
        points.map(({ x, y }) => `${x},${y}`).join(" "),
      );
      body.classList.add("board__snake-body");
      body.classList.add("board__movement-path");
      group.append(body);

      const head = document.createElementNS(namespace, "circle");
      head.setAttribute("cx", String(start.x));
      head.setAttribute("cy", String(start.y));
      head.setAttribute("r", "10");
      head.classList.add("board__snake-head");
      group.append(head);
    }

    artwork.append(group);
  }

  boardElement.append(artwork);
}

createBoardArtwork();

const defaultColors = ["#d95555", "#3978c5", "#32a36a", "#e3a52f"];

function renderPlayerColorFields() {
  const playerCount = Number(playerCountElement.value);
  playerColorsElement.replaceChildren();

  for (let index = 0; index < playerCount; index += 1) {
    const field = document.createElement("div");
    field.className = "player-color";

    const nameLabel = document.createElement("label");
    nameLabel.className = "player-color__label";
    nameLabel.htmlFor = `player-${index + 1}-name`;
    nameLabel.textContent = `Player ${index + 1} name`;

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.id = `player-${index + 1}-name`;
    nameInput.name = `player-${index + 1}-name`;
    nameInput.placeholder = "Enter name";
    nameInput.maxLength = 24;
    nameInput.setAttribute("aria-label", `Player ${index + 1} name`);

    const colorLabel = document.createElement("label");
    colorLabel.className = "player-color__label";
    colorLabel.htmlFor = `player-${index + 1}-color`;
    colorLabel.textContent = "Pawn color";

    const picker = document.createElement("input");
    picker.type = "color";
    picker.id = `player-${index + 1}-color`;
    picker.name = `player-${index + 1}-color`;
    picker.value = defaultColors[index];

    field.append(nameLabel, colorLabel, nameInput, picker);
    playerColorsElement.append(field);
  }
}

function clearStartedGame() {
  for (const cell of cellsBySquare.values()) {
    cell.querySelector(".player-tokens")?.remove();
  }
  boardStartElement.querySelector(".player-tokens")?.remove();
  players = [];
  currentPlayerIndex = 0;
  gameFinished = false;
  rollButton.disabled = true;
  diceFaceElement.dataset.value = "0";
  diceFaceElement.setAttribute("aria-label", "Die has not been rolled");
  diceResultElement.textContent = "No roll yet";
  statusElement.textContent =
    "Choose how many players, then enter each name and pawn color before starting.";
}

playerCountElement.addEventListener("change", () => {
  renderPlayerColorFields();
  clearStartedGame();
});

function setSetupDisabled(disabled) {
  playerCountElement.disabled = disabled;
  playerColorsElement
    .querySelectorAll("input")
    .forEach((input) => {
      input.disabled = disabled;
    });
  setupForm.querySelector(".start-button").disabled = disabled;
}

function resetGame() {
  winnerDialog.close();
  winnerHeading.textContent = "";
  for (const cell of cellsBySquare.values()) {
    cell.querySelector(".player-tokens")?.remove();
  }
  boardStartElement.querySelector(".player-tokens")?.remove();
  boardElement.querySelector(".player-token--moving")?.remove();

  players = [];
  currentPlayerIndex = 0;
  gameFinished = false;
  setSetupDisabled(false);
  rollButton.disabled = true;
  diceFaceElement.dataset.value = "0";
  diceFaceElement.setAttribute("aria-label", "Die has not been rolled");
  diceResultElement.textContent = "No roll yet";
  statusElement.textContent =
    "Choose how many players, then enter each name and pawn color before starting.";
}

newGameButton.addEventListener("click", resetGame);

function renderPlayers(hiddenPlayerIndex = -1) {
  for (const cell of cellsBySquare.values()) {
    cell.querySelector(".player-tokens")?.remove();
  }
  boardStartElement.querySelector(".player-tokens")?.remove();

  const playersByPosition = new Map();
  for (const [index, player] of players.entries()) {
    if (index === hiddenPlayerIndex) {
      continue;
    }

    const playersOnSquare = playersByPosition.get(player.position) ?? [];
    playersOnSquare.push({ ...player, index });
    playersByPosition.set(player.position, playersOnSquare);
  }

  for (const [position, playersOnSquare] of playersByPosition) {
    const cell = position === 0 ? boardStartElement : cellsBySquare.get(position);
    if (!cell) {
      throw new Error(`No board square exists for position ${position}.`);
    }

    const tokenGroup = document.createElement("span");
    tokenGroup.className = "player-tokens";
    tokenGroup.setAttribute("role", "group");
    tokenGroup.setAttribute(
      "aria-label",
      position === 0
        ? `${playersOnSquare.length} player pawns at the start`
        : `${playersOnSquare.length} player pawns on square ${position}`,
    );

    for (const player of playersOnSquare) {
      const pawn = document.createElement("span");
      pawn.className = "player-token";
      pawn.style.setProperty("--player-color", player.color);
      pawn.setAttribute("role", "img");
      pawn.setAttribute("aria-label", `${player.name} pawn`);
      pawn.title = player.name;
      tokenGroup.append(pawn);
    }

    cell.append(tokenGroup);
  }
}

function boardPointForSquare(square) {
  const cell = cellsBySquare.get(square);
  if (!cell) {
    throw new Error(`No board square exists for position ${square}.`);
  }

  const boardRect = boardElement.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();
  return {
    x: cellRect.left - boardRect.left + cellRect.width / 2,
    y: cellRect.top - boardRect.top + cellRect.height / 2,
  };
}

function animatePawnAlongPath(pawn, path, duration) {
  const pathLength = path.getTotalLength();
  const boardRect = boardElement.getBoundingClientRect();
  const artworkRect = path.ownerSVGElement.getBoundingClientRect();
  const framesCount = Math.max(12, Math.ceil(pathLength / 18));
  const keyframes = Array.from({ length: framesCount + 1 }, (_, index) => {
    const progress = index / framesCount;
    const point = path.getPointAtLength(pathLength * progress);
    const x = artworkRect.left - boardRect.left + (point.x / 1000) * artworkRect.width;
    const y = artworkRect.top - boardRect.top + (point.y / 1000) * artworkRect.height;
    const hop = Math.sin(progress * Math.PI) * 8;

    return {
      left: `${x}px`,
      top: `${y}px`,
      transform: `translate(-50%, -50%) translateY(${-hop}px)`,
      offset: progress,
    };
  });

  const finalFrame = keyframes[keyframes.length - 1];
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    pawn.style.left = finalFrame.left;
    pawn.style.top = finalFrame.top;
    pawn.style.transform = finalFrame.transform;
    return Promise.resolve();
  }

  const animation = pawn.animate(keyframes, {
    duration,
    easing: "linear",
  });

  return animation.finished.then(() => {
    pawn.style.left = finalFrame.left;
    pawn.style.top = finalFrame.top;
    pawn.style.transform = finalFrame.transform;
  });
}

function animatePawnHop(pawn, destination) {
  const startX = Number.parseFloat(pawn.style.left);
  const startY = Number.parseFloat(pawn.style.top);
  const cell = cellsBySquare.get(destination.square);
  const cellRect = cell.getBoundingClientRect();
  const endX = destination.x;
  const endY = destination.y;
  const midpointX = (startX + endX) / 2;
  const midpointY = (startY + endY) / 2;
  const hopHeight = Math.max(12, cellRect.height * 0.42);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    pawn.style.left = `${endX}px`;
    pawn.style.top = `${endY}px`;
    return Promise.resolve();
  }

  const animation = pawn.animate(
    [
      { left: `${startX}px`, top: `${startY}px`, transform: "translate(-50%, -50%)" },
      {
        left: `${midpointX}px`,
        top: `${midpointY}px`,
        transform: `translate(-50%, -50%) translateY(-${hopHeight}px) scale(1.12)`,
        offset: 0.5,
      },
      { left: `${endX}px`, top: `${endY}px`, transform: "translate(-50%, -50%)" },
    ],
    { duration: 180, easing: "ease-in-out" },
  );

  return animation.finished.then(() => {
    pawn.style.left = `${endX}px`;
    pawn.style.top = `${endY}px`;
    pawn.style.transform = "translate(-50%, -50%)";
  });
}

async function animatePawnMovement(player, fromPosition, landedPosition, transition) {
  const pawn = document.createElement("span");
  pawn.className = "player-token player-token--moving";
  pawn.style.setProperty("--player-color", player.color);
  pawn.setAttribute("role", "img");
  pawn.setAttribute("aria-label", `${player.name} pawn moving`);
  pawn.title = player.name;
  boardElement.append(pawn);

  const firstSquare = fromPosition === 0 ? 1 : fromPosition;
  const firstPoint = boardPointForSquare(firstSquare);
  pawn.style.left = `${firstPoint.x}px`;
  const firstCell = cellsBySquare.get(firstSquare);
  const firstCellRect = firstCell.getBoundingClientRect();
  pawn.style.top =
    fromPosition === 0
      ? `${firstPoint.y + firstCellRect.height / 2}px`
      : `${firstPoint.y}px`;
  pawn.style.transform = "translate(-50%, -50%)";

  for (let square = Math.max(1, fromPosition + 1); square <= landedPosition; square += 1) {
    const point = boardPointForSquare(square);
    await animatePawnHop(pawn, { ...point, square });
  }

  if (transition) {
    const path = boardElement.querySelector(
      `[data-start-square="${transition.start}"] .board__movement-path`,
    );
    if (!path) {
      throw new Error(`No movement path exists for square ${transition.start}.`);
    }

    playSound(transition.type);
    await animatePawnAlongPath(pawn, path, transition.type === "ladder" ? 550 : 700);
  }

  pawn.remove();
}

setupForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (players.length > 0) {
    return;
  }

  const playerColors = Array.from(
    playerColorsElement.querySelectorAll('input[type="color"]'),
    (picker) => picker.value,
  );
  if (playerColors.length < 2 || playerColors.length > 4) {
    throw new Error("The game needs 2 to 4 players.");
  }

  const playerNames = Array.from(
    playerColorsElement.querySelectorAll('input[type="text"]'),
    (input, index) => input.value.trim() || `Player ${index + 1}`,
  );

  players = playerColors.map((color, index) => ({
    color,
    name: playerNames[index],
    position: 0,
  }));
  currentPlayerIndex = 0;
  gameFinished = false;
  setSetupDisabled(true);
  diceFaceElement.dataset.value = "0";
  diceFaceElement.setAttribute("aria-label", "Die has not been rolled");
  diceResultElement.textContent = "No roll yet";
  rollButton.disabled = false;
  renderPlayers();
  statusElement.textContent = `${players[currentPlayerIndex].name}'s turn. Roll the dice to leave the starting area.`;
});

rollButton.addEventListener("click", async () => {
  if (players.length < 2 || gameFinished) {
    return;
  }

  rollButton.disabled = true;
  const playerIndex = currentPlayerIndex;
  const player = players[playerIndex];
  const roll = Math.floor(Math.random() * 6) + 1;
  const previousPosition = player.position;
  const landedPosition = previousPosition + roll;
  diceFaceElement.dataset.value = String(roll);
  diceFaceElement.setAttribute("aria-label", `Die rolled ${roll}`);
  diceResultElement.textContent = `Rolled a ${roll}`;

  if (landedPosition > 100) {
    currentPlayerIndex = (playerIndex + 1) % players.length;
    const stepsToWin = 100 - previousPosition;
    statusElement.textContent =
      `${player.name} rolled ${roll} but needs exactly ${stepsToWin} to reach 100. ${player.name} stays on square ${previousPosition}. ${players[currentPlayerIndex].name}'s turn.`;
    renderPlayers();
    rollButton.disabled = false;
    return;
  }

  const transition = transitionsByStart.get(landedPosition);
  playSound("jump");
  renderPlayers(playerIndex);
  statusElement.textContent =
    `${player.name} rolled ${roll} and is moving from ${previousPosition === 0 ? "the start" : `square ${previousPosition}`} to square ${landedPosition}${transition ? `, then along the ${transition.type}` : ""}.`;
  await animatePawnMovement(player, previousPosition, landedPosition, transition);
  player.position = transition?.end ?? landedPosition;
  renderPlayers();

  if (player.position === 100) {
    gameFinished = true;
    statusElement.textContent =
      `${player.name} rolled ${roll}, moved from ${previousPosition === 0 ? "the start" : `square ${previousPosition}`} to square 100, and wins!`;
    winnerHeading.textContent = `${player.name} wins!`;
    winnerDialog.showModal();
    return;
  }

  currentPlayerIndex = (playerIndex + 1) % players.length;
  const transitionMessage = transition
    ? `, then ${transition.type === "ladder" ? "climbed the ladder" : "slid down the snake"} to square ${player.position}`
    : "";
  statusElement.textContent =
    `${player.name} rolled ${roll} and moved from ${previousPosition === 0 ? "the start" : `square ${previousPosition}`} to square ${landedPosition}${transitionMessage}. ${players[currentPlayerIndex].name}'s turn.`;
  rollButton.disabled = false;
});

renderPlayerColorFields();
