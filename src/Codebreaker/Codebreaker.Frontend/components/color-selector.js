class ColorSelector extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    const colors = this.getAttribute('colors')?.split(',') ||
                   ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'];

    this.shadowRoot.innerHTML = `
      <style>
        .color-selector {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 8px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .color-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }

        .color-name {
          font-size: 0.875rem;
          color: #555;
          font-weight: 500;
        }
      </style>
      <div class="color-selector" role="toolbar" aria-label="Color selection">
        ${colors.map(color => `
          <div class="color-item">
            <color-peg
              color="${color.trim()}"
              size="60px"
              draggable="true"
              data-color="${color.trim()}">
            </color-peg>
            <span class="color-name">${color.trim()}</span>
          </div>
        `).join('')}
      </div>
    `;

    // Dispatch a composed custom event when a swatch is clicked so that listeners
    // outside the shadow boundary can determine the selected color.  The click target
    // is retargeted to the <color-peg> host element as it crosses the shadow boundary.
    this.shadowRoot.addEventListener('click', (e) => {
      const colorPeg = e.target.closest('color-peg');
      if (colorPeg) {
        // Visual selection feedback inside the shadow root
        this.shadowRoot.querySelectorAll('color-peg').forEach(p => {
          p.style.outline = '';
          p.style.outlineOffset = '';
        });
        colorPeg.style.outline = '3px solid #667eea';
        colorPeg.style.outlineOffset = '2px';

        this.dispatchEvent(new CustomEvent('color-selected', {
          bubbles: true,
          composed: true,
          detail: { color: colorPeg.getAttribute('color') }
        }));
      }
    });

    // Populate dataTransfer so drop zones in game-row can read the dragged color.
    this.shadowRoot.addEventListener('dragstart', (e) => {
      const colorPeg = e.target.closest('color-peg');
      if (colorPeg) {
        const color = colorPeg.getAttribute('color');
        e.dataTransfer.setData('text/plain', color);
        e.dataTransfer.effectAllowed = 'copy';
      }
    });
  }

  static get observedAttributes() {
    return ['colors'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.connectedCallback();
    }
  }
}

customElements.define('color-selector', ColorSelector);
