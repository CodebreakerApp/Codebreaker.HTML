class GameRow extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    // Guard against re-rendering when the element is moved to a different DOM parent
    // (e.g. from the active-row area to the history container after a move is submitted).
    // Moving a custom element triggers connectedCallback again, which would reset
    // this.shadowRoot.innerHTML and wipe the peg colors and feedback that were set.
    if (this._initialized) return;
    this._initialized = true;

    const slots = parseInt(this.getAttribute('slots') || '4');
    const moveNumber = this.getAttribute('move-number') || '1';

    this.shadowRoot.innerHTML = `
      <style>
        .game-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: white;
          border-radius: 8px;
          margin-bottom: 0.5rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .move-number {
          font-weight: bold;
          color: #667eea;
          min-width: 30px;
        }

        .peg-slots {
          display: flex;
          gap: 0.5rem;
          flex: 1;
        }

        .peg-slot {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: #f0f0f0;
          border: 2px dashed #ccc;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          transition: all 0.3s ease;
          cursor: pointer;
        }

        .peg-slot.filled {
          border: none;
          cursor: pointer;
        }

        .peg-slot:focus-visible {
          outline: 3px solid #667eea;
          outline-offset: 2px;
        }

        .peg-slot.drag-over {
          background: #e3f2fd;
          border-color: #2196f3;
          border-style: solid;
          transform: scale(1.1);
        }

        .feedback {
          display: flex;
          gap: 0.25rem;
          flex-wrap: wrap;
          width: 80px;
        }

        @media (max-width: 480px) {
          .game-row {
            gap: 0.5rem;
            padding: 0.75rem 0.5rem;
            flex-wrap: wrap;
          }

          .peg-slot {
            width: 44px;
            height: 44px;
          }

          .feedback {
            width: auto;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .peg-slot {
            transition: none;
          }
        }
      </style>
      <div class="game-row">
        <div class="move-number">Move ${moveNumber}</div>
        <div class="peg-slots" data-slots="${slots}">
          ${this.createPegSlots(slots)}
        </div>
        <div class="feedback" role="status" aria-label="Move feedback">
          <!-- Feedback pegs will be added here -->
        </div>
      </div>
    `;

    setTimeout(() => this.setupDropZones(), 0);
  }

  createPegSlots(count) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `<div class="peg-slot" data-index="${i}" data-droppable="true" tabindex="0" role="button" aria-pressed="false" aria-label="Slot ${i + 1}"></div>`;
    }
    return html;
  }

  setupDropZones() {
    const slots = this.shadowRoot.querySelectorAll('.peg-slot');
    slots.forEach((slot, index) => {
      slot.addEventListener('dragover', (e) => this.handleDragOver(e));
      slot.addEventListener('dragenter', (e) => this.handleDragEnter(e));
      slot.addEventListener('dragleave', (e) => this.handleDragLeave(e));
      slot.addEventListener('drop', (e) => this.handleDrop(e, index));
      slot.addEventListener('click', (e) => this.handleClick(e, index));
      slot.addEventListener('contextmenu', (e) => this.handleContextMenu(e, index));
      slot.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.handleClick(e, index);
        }
      });
    });
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  handleDragEnter(e) {
    e.preventDefault();
    const slot = e.currentTarget;
    if (!slot.classList.contains('filled')) {
      slot.classList.add('drag-over');
    }
  }

  handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
  }

  handleDrop(e, index) {
    e.preventDefault();
    const slot = e.currentTarget;
    slot.classList.remove('drag-over');

    if (slot.classList.contains('filled')) return;

    const color = e.dataTransfer.getData('text/plain');

    this.dispatchEvent(new CustomEvent('peg-dropped', {
      bubbles: true,
      composed: true,
      detail: { color, index }
    }));
  }

  handleClick(e, index) {
    const slot = e.currentTarget;
    if (slot.classList.contains('filled')) {
      // Clicking a filled slot removes the peg — accessible alternative to right-click
      this.dispatchEvent(new CustomEvent('peg-removed', {
        bubbles: true,
        composed: true,
        detail: { index }
      }));
    } else {
      this.dispatchEvent(new CustomEvent('peg-clicked', {
        bubbles: true,
        composed: true,
        detail: { index }
      }));
    }
  }

  handleContextMenu(e, index) {
    e.preventDefault();
    const slot = e.currentTarget;
    if (slot.classList.contains('filled')) {
      this.dispatchEvent(new CustomEvent('peg-removed', {
        bubbles: true,
        composed: true,
        detail: { index }
      }));
    }
  }

  setPegColor(index, color) {
    const slots = this.shadowRoot.querySelectorAll('.peg-slot');
    if (slots[index]) {
      slots[index].innerHTML = `<color-peg color="${color}"></color-peg>`;
      slots[index].classList.add('filled');
      slots[index].setAttribute('aria-pressed', 'true');
      slots[index].setAttribute('aria-label', `Slot ${index + 1}: ${color} peg — click to remove`);
    }
  }

  clearPeg(index) {
    const slots = this.shadowRoot.querySelectorAll('.peg-slot');
    if (slots[index]) {
      slots[index].innerHTML = '';
      slots[index].classList.remove('filled');
      slots[index].setAttribute('aria-pressed', 'false');
      slots[index].setAttribute('aria-label', `Slot ${index + 1}`);
    }
  }

  setFeedback(feedback) {
    const feedbackContainer = this.shadowRoot.querySelector('.feedback');
    feedbackContainer.innerHTML = feedback.map(result =>
      `<feedback-peg type="${result}"></feedback-peg>`
    ).join('');
  }

  static get observedAttributes() {
    return ['slots', 'move-number'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      // Reset the flag so connectedCallback will re-render when attributes change
      // (e.g. when the same element object is reused with different slot/move-number values).
      this._initialized = false;
      this.connectedCallback();
    }
  }
}

customElements.define('game-row', GameRow);
