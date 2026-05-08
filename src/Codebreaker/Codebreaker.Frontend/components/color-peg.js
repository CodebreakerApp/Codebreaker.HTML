class ColorPeg extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    const color = this.getAttribute('color') || 'gray';
    const size = this.getAttribute('size') || '50px';

    this.shadowRoot.innerHTML = `
      <style>
        .peg {
          width: ${size};
          height: ${size};
          border-radius: 50%;
          background-color: ${this.getColorValue(color)};
          border: 3px solid #333;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2),
                      inset -2px -2px 4px rgba(0, 0, 0, 0.3),
                      inset 2px 2px 4px rgba(255, 255, 255, 0.5);
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          display: inline-block;
        }

        .peg:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3),
                      inset -2px -2px 4px rgba(0, 0, 0, 0.3),
                      inset 2px 2px 4px rgba(255, 255, 255, 0.5);
        }

        .peg:focus-visible {
          outline: 3px solid #667eea;
          outline-offset: 3px;
        }

        .peg.empty {
          background: #e0e0e0;
          border: 2px dashed #999;
          box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.1);
          cursor: default;
        }

        .peg.empty:hover {
          transform: none;
        }
      </style>
      <div class="peg ${color === 'empty' ? 'empty' : ''}"
           data-color="${color}"
           role="button"
           tabindex="0"
           aria-label="${color} peg">
      </div>
    `;

    // Allow keyboard users to activate the peg with Enter or Space
    const pegDiv = this.shadowRoot.querySelector('.peg');
    pegDiv.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pegDiv.click();
      }
    });
  }

  getColorValue(colorName) {
    const colors = {
      Red: '#e74c3c',
      Blue: '#3498db',
      Green: '#2ecc71',
      Yellow: '#f1c40f',
      Purple: '#9b59b6',
      Orange: '#e67e22',
      Pink: '#fd79a8',
      White: '#ecf0f1',
      Brown: '#8B4513',
      empty: 'transparent'
    };
    return colors[colorName] || '#95a5a6';
  }

  static get observedAttributes() {
    return ['color', 'size'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.connectedCallback();
    }
  }
}

customElements.define('color-peg', ColorPeg);
