class FeedbackPeg extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    const type = this.getAttribute('type') || 'none';

    this.shadowRoot.innerHTML = `
      <style>
        .feedback-peg {
          width: 15px;
          height: 15px;
          border-radius: 50%;
          border: 1px solid #333;
          display: inline-block;
        }

        .feedback-peg.black {
          background: #2c3e50;
        }

        .feedback-peg.white {
          background: #ecf0f1;
        }

        .feedback-peg.none {
          background: transparent;
          border: 1px dashed #ccc;
        }
      </style>
      <div class="feedback-peg ${this.getFeedbackClass(type)}"
           role="img"
           aria-label="${this.getFeedbackLabel(type)}">
      </div>
    `;
  }

  getFeedbackClass(type) {
    if (type === 'black' || type === 'Black') return 'black';
    if (type === 'white' || type === 'White') return 'white';
    return 'none';
  }

  getFeedbackLabel(type) {
    if (type === 'black' || type === 'Black') return 'Correct position and color';
    if (type === 'white' || type === 'White') return 'Correct color, wrong position';
    return 'No match';
  }

  static get observedAttributes() {
    return ['type'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.connectedCallback();
    }
  }
}

customElements.define('feedback-peg', FeedbackPeg);
