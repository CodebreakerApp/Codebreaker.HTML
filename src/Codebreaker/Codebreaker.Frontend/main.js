import {
  log,
  tracer,
  gamesStartedCounter,
  movesSubmittedCounter,
  gamesWonCounter,
  gamesLostCounter,
  errorsCounter,
  moveLatencyHistogram,
} from './telemetry.js';
import './components/color-peg.js';
import './components/game-row.js';
import './components/feedback-peg.js';
import './components/color-selector.js';
import { GameService } from './services/gameService.js';

const gameService = new GameService();

// Game state
let gameState = {
  playerName: '',
  gameType: '',
  gameId: null,
  numberCodes: 4,
  maxMoves: 12,
  currentMove: [],
  moves: [],
  availableColors: []
};

let selectedColor = null;

// DOM Elements
const setupForm = document.getElementById('setup-form');
const gameSetup = document.getElementById('game-setup');
const gamePlayground = document.getElementById('game-playground');
const currentPlayerSpan = document.getElementById('current-player');
const currentGameTypeSpan = document.getElementById('current-game-type');
const movesLeftSpan = document.getElementById('moves-left');
const colorPalette = document.getElementById('color-palette');
const currentMoveRow = document.getElementById('current-move-row');
const movesContainer = document.getElementById('moves-container');
const submitMoveBtn = document.getElementById('submit-move');

// Event Listeners
setupForm.addEventListener('submit', handleGameSetup);
submitMoveBtn.addEventListener('click', handleSubmitMove);

document.addEventListener('peg-drag-start', () => {
  document.body.classList.add('dragging');
});

document.addEventListener('peg-drag-end', () => {
  document.body.classList.remove('dragging');
});

async function handleGameSetup(event) {
  event.preventDefault();

  const formData = new FormData(event.target);
  gameState.playerName = formData.get('playerName');
  gameState.gameType = formData.get('gameType');

  const submitBtn = setupForm.querySelector('.btn-primary');
  const originalText = submitBtn.textContent;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Starting...';

  // startActiveSpan activates the span in the current async context so that
  // the fetch call inside gameService.createGame() is automatically linked as
  // a child span and the traceparent header is propagated correctly.
  await tracer.startActiveSpan('game.start', async (span) => {
    try {
      const gameData = await gameService.createGame(gameState.gameType, gameState.playerName);

      gameState.gameId = gameData.id;
      gameState.numberCodes = gameData.numberCodes;
      gameState.maxMoves = gameData.maxMoves;
      gameState.availableColors = gameData.fieldValues?.colors || getGameConfig(gameState.gameType).colors;

      gamesStartedCounter.add(1, { 'game.type': gameState.gameType });

      log('Game started', {
        'event.name': 'game.started',
        'player.name': gameState.playerName,
        'game.type': gameState.gameType,
        'game.id': gameState.gameId,
        'game.max_moves': gameState.maxMoves,
      });

      span.setAttribute('game.id', gameState.gameId);
      span.setAttribute('game.type', gameState.gameType);
      span.setAttribute('player.name', gameState.playerName);

      currentPlayerSpan.textContent = gameState.playerName;
      currentGameTypeSpan.textContent = gameState.gameType;
      movesLeftSpan.textContent = gameState.maxMoves;

      initializeGame();

      gameSetup.style.opacity = '0';
      gameSetup.style.transform = 'scale(0.95)';

      setTimeout(() => {
        gameSetup.hidden = true;
        gamePlayground.hidden = false;
        gamePlayground.style.opacity = '0';
        gamePlayground.style.transform = 'scale(0.95)';
        gamePlayground.offsetHeight;
        gamePlayground.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        gamePlayground.style.opacity = '1';
        gamePlayground.style.transform = 'scale(1)';
      }, 300);

    } catch (error) {
      errorsCounter.add(1, { 'error.context': 'game.start', 'game.type': gameState.gameType });
      log('Failed to start game', {
        'event.name': 'game.start.error',
        'player.name': gameState.playerName,
        'game.type': gameState.gameType,
        'error.message': error.message,
      }, 'ERROR');
      span.recordException(error);
      alert('Error starting game. Make sure the backend is running and accessible.');
      console.error(error);
    } finally {
      span.end();
    }
  });

  submitBtn.disabled = false;
  submitBtn.textContent = originalText;
}

function getGameConfig(gameType) {
  const configs = {
    'Game6x4': {
      numberCodes: 4,
      maxMoves: 12,
      colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange']
    },
    'Game6x4Mini': {
      numberCodes: 4,
      maxMoves: 10,
      colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange']
    },
    'Game8x5': {
      numberCodes: 5,
      maxMoves: 12,
      colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Pink', 'Brown']
    }
  };
  return configs[gameType] || configs['Game6x4'];
}

function initializeGame() {
  const colorSelector = document.createElement('color-selector');
  colorSelector.setAttribute('colors', gameState.availableColors.join(','));
  colorPalette.innerHTML = '';
  colorPalette.appendChild(colorSelector);

  // color-selector dispatches a composed 'color-selected' event so the color choice
  // is visible outside the shadow boundary
  colorPalette.addEventListener('color-selected', handleColorSelection);

  const gameRow = document.createElement('game-row');
  gameRow.setAttribute('slots', gameState.numberCodes.toString());
  gameRow.setAttribute('move-number', '1');
  gameRow.id = 'active-row';
  currentMoveRow.innerHTML = '';
  currentMoveRow.appendChild(gameRow);

  gameRow.addEventListener('peg-dropped', handlePegDropped);
  gameRow.addEventListener('peg-clicked', handlePegClicked);
  gameRow.addEventListener('peg-removed', handlePegRemoved);

  movesContainer.innerHTML = '';
  gameState.currentMove = [];
  gameState.moves = [];

  updateSubmitButton();
}

function handleColorSelection(e) {
  selectedColor = e.detail.color;
  // Visual feedback is handled internally by color-selector's shadow root listener.
}

function handlePegDropped(event) {
  const { color, index } = event.detail;
  placePeg(index, color);
}

function handlePegClicked(event) {
  const { index } = event.detail;
  if (selectedColor) {
    placePeg(index, selectedColor);
  }
}

function handlePegRemoved(event) {
  const { index } = event.detail;
  const activeRow = document.getElementById('active-row');
  activeRow.clearPeg(index);
  gameState.currentMove[index] = undefined;
  updateSubmitButton();
}

function placePeg(index, color) {
  const activeRow = document.getElementById('active-row');
  activeRow.setPegColor(index, color);
  gameState.currentMove[index] = color;
  updateSubmitButton();
}

function updateSubmitButton() {
  const filledSlots = gameState.currentMove.filter(peg => peg !== undefined).length;
  submitMoveBtn.disabled = filledSlots !== gameState.numberCodes;
}

async function handleSubmitMove() {
  if (!gameState.gameId) {
    alert('No game ID. Please start a new game.');
    return;
  }

  const originalText = submitMoveBtn.textContent;
  let gameEnded = false;
  const moveNumber = gameState.moves.length + 1;

  submitMoveBtn.disabled = true;
  submitMoveBtn.textContent = 'Submitting...';

  // startActiveSpan activates the span in the current async context so that
  // the fetch call inside gameService.submitMove() is automatically linked as
  // a child span and the traceparent header is propagated correctly.
  await tracer.startActiveSpan('game.move.submit', async (span) => {
    span.setAttribute('game.id', gameState.gameId);
    span.setAttribute('game.type', gameState.gameType);
    span.setAttribute('game.move_number', moveNumber);

    const moveStartTime = performance.now();

    try {
      const result = await gameService.submitMove(
        gameState.gameId,
        gameState.gameType,
        gameState.playerName,
        moveNumber,
        gameState.currentMove
      );

      const moveDurationMs = performance.now() - moveStartTime;
      moveLatencyHistogram.record(moveDurationMs, {
        'game.type': gameState.gameType,
      });
      movesSubmittedCounter.add(1, { 'game.type': gameState.gameType });

      log('Move submitted', {
        'event.name': 'game.move.submitted',
        'player.name': gameState.playerName,
        'game.type': gameState.gameType,
        'game.id': gameState.gameId,
        'game.move_number': moveNumber,
        'move.duration_ms': Math.round(moveDurationMs),
        'move.ended': result.ended ?? false,
        'move.victory': result.isVictory ?? false,
      });

      const activeRow = document.getElementById('active-row');
      activeRow.removeAttribute('id');

      if (result.results) {
        activeRow.setFeedback(result.results);
      }

      // Move the element into history — preserves the live shadow-DOM state
      // (feedback pegs, peg colors) that cloneNode(true) would not carry over.
      movesContainer.appendChild(activeRow);

      gameState.moves.push({
        pegs: [...gameState.currentMove],
        results: result.results
      });

      if (result.ended) {
        gameEnded = true;
        handleGameEnd(result.isVictory);
        return;
      }

      const newRow = document.createElement('game-row');
      newRow.setAttribute('slots', gameState.numberCodes.toString());
      newRow.setAttribute('move-number', (moveNumber + 1).toString());
      newRow.id = 'active-row';
      currentMoveRow.innerHTML = '';
      currentMoveRow.appendChild(newRow);

      newRow.addEventListener('peg-dropped', handlePegDropped);
      newRow.addEventListener('peg-clicked', handlePegClicked);
      newRow.addEventListener('peg-removed', handlePegRemoved);

      gameState.currentMove = [];

      const movesLeft = gameState.maxMoves - gameState.moves.length;
      movesLeftSpan.textContent = movesLeft;

    } catch (error) {
      errorsCounter.add(1, {
        'error.context': 'game.move.submit',
        'game.type': gameState.gameType,
      });
      log('Failed to submit move', {
        'event.name': 'game.move.submit.error',
        'player.name': gameState.playerName,
        'game.type': gameState.gameType,
        'game.id': gameState.gameId,
        'game.move_number': moveNumber,
        'error.message': error.message,
      }, 'ERROR');
      span.recordException(error);
      alert('Error submitting move!');
      console.error(error);
    } finally {
      span.end();
    }
  });

  // Do not re-enable the button when the game has ended; handleGameEnd manages state.
  if (!gameEnded) {
    submitMoveBtn.disabled = false;
    submitMoveBtn.textContent = originalText;
    updateSubmitButton();
  }
}

function handleGameEnd(isVictory) {
  const message = isVictory
    ? '🎉 Congratulations! You won!'
    : '😔 Game over! Better luck next time!';

  if (isVictory) {
    gamesWonCounter.add(1, { 'game.type': gameState.gameType });
  } else {
    gamesLostCounter.add(1, { 'game.type': gameState.gameType });
  }

  log(isVictory ? 'Game won' : 'Game lost', {
    'event.name': isVictory ? 'game.won' : 'game.lost',
    'player.name': gameState.playerName,
    'game.type': gameState.gameType,
    'game.id': gameState.gameId,
    'game.total_moves': gameState.moves.length,
  }, isVictory ? 'INFO' : 'WARN');

  setTimeout(() => {
    alert(message);
    submitMoveBtn.disabled = true;
  }, 500);
}

document.getElementById('new-game').addEventListener('click', () => {
  gamePlayground.style.opacity = '0';
  gamePlayground.style.transform = 'scale(0.95)';

  setTimeout(() => {
    gameSetup.hidden = false;
    gamePlayground.hidden = true;
    setupForm.reset();

    gameSetup.style.opacity = '0';
    gameSetup.style.transform = 'scale(0.95)';
    gameSetup.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    gameSetup.offsetHeight;
    gameSetup.style.opacity = '1';
    gameSetup.style.transform = 'scale(1)';

    gameState = {
      playerName: '',
      gameType: '',
      gameId: null,
      numberCodes: 4,
      maxMoves: 12,
      currentMove: [],
      moves: [],
      availableColors: []
    };
    selectedColor = null;
  }, 300);
});
