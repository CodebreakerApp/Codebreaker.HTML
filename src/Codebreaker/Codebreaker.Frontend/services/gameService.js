// All API calls go through the /api prefix, which Vite proxies to the Games API backend.
// When running under Aspire, the proxy target is automatically configured via service
// discovery environment variables in vite.config.js.
const API_BASE_URL = '/api';

export class GameService {
  /**
   * Create a new game
   */
  async createGame(gameType, playerName) {
    const response = await fetch(`${API_BASE_URL}/games/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameType, playerName })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Submit a move
   */
  async submitMove(gameId, gameType, playerName, moveNumber, guessPegs) {
    const response = await fetch(`${API_BASE_URL}/games/${gameId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: gameId, gameType, playerName, moveNumber, guessPegs })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get game information
   */
  async getGame(gameId) {
    const response = await fetch(`${API_BASE_URL}/games/${gameId}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }
}
