// Initialize FormKit if present
if (window.formkit) {
  window.formkit.init();
}

/**
 * Core Configuration and Constants
 */
const CONFIG = {
  animation: {
    duration: 120,
    frameCount: 30,
    chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*+-{}[]<>?',
    timing: {
      initialDelay: 0,
      buffer: 0,
      traceScrambleInterval: 400,
      waveDelay: 20,
      resetDelay: 100,
    },
    respectReducedMotion: true,
  },
  enrollment: {
    open: new Date('2025-02-25T23:59:00-05:00'),
    close: new Date('2025-03-04T23:59:00-05:00'),
  },
  selectors: {
    scrambleable: 'h1, h2, p, a:not([href="https://shiftnudge.com"]), button',
    encrypt: '[href="#encrypt"]',
    date: '#date',
    inputs: 'input[type="text"], input[type="email"]',
    shiftnudge: 'a[href="https://shiftnudge.com"]',
  },
};

// Check if animations should be enabled
CONFIG.animation.isEnabled = !CONFIG.animation.respectReducedMotion ||
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Utility Functions
 */
const Utils = {
  getRandomChar: () => {
    const chars = CONFIG.animation.chars;
    return chars[Math.floor(Math.random() * chars.length)];
  },
  scrambleText: (text, shouldScrambleChar) =>
    text
      .split('')
      .map((char, index) => {
        if ([' ', '(', ')', '_', '-'].includes(char)) {
          return char;
        }
        return shouldScrambleChar(char, index) ? Utils.getRandomChar() : char;
      })
      .join(''),
  formatTimeParts: date => ({
    year: date.getFullYear(),
    month: String(date.getMonth() + 1).padStart(2, '0'),
    day: String(date.getDate()).padStart(2, '0'),
    hours: String(date.getHours()).padStart(2, '0'),
    minutes: String(date.getMinutes()).padStart(2, '0'),
    seconds: String(date.getSeconds()).padStart(2, '0'),
    milliseconds: String(date.getMilliseconds()).padStart(3, '0'),
  }),
};

/**
 * State Management
 */
const PageState = {
  encrypted: false,
  originalTexts: new Map(),

  toggle() {
    this.encrypted = !this.encrypted;
    return this.encrypted;
  },

  saveOriginalText(element, text) {
    if (!this.originalTexts.has(element)) {
      this.originalTexts.set(element, text);
    }
  },

  getOriginalText(element) {
    return this.originalTexts.get(element);
  },
};

/**
 * Animation System
 */
const AnimationSystem = {
  animate(element, text, options = {}) {
    const {
      permanent = false,
      updateFn = updatedText => {
        element.textContent = updatedText;
      },
      onComplete = null,
    } = options;

    let startTime = null;
    let animationFrame = null;
    const textLength = text.length;
    const duration = CONFIG.animation.duration;

    const update = currentTime => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;

      if (elapsed >= duration) {
        const finalText = permanent ? this.scramble(text) : text;
        updateFn(finalText);
        if (onComplete) onComplete(finalText);
        return;
      }

      const progress = elapsed / duration;
      const frame = Math.floor(progress * CONFIG.animation.frameCount);
      const scrambledText = this.getAnimationFrame(text, frame, permanent);

      updateFn(scrambledText);
      animationFrame = requestAnimationFrame(update);
    };

    animationFrame = requestAnimationFrame(update);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        if (!permanent) updateFn(text);
      }
    };
  },

  scramble(text) {
    return Utils.scrambleText(text, () => true);
  },

  getAnimationFrame(text, frame, permanent) {
    const threshold = (frame / CONFIG.animation.frameCount) * (text.length * 2);
    return Utils.scrambleText(text, (char, index) => {
      if (text.length === 1) {
        return permanent || Math.random() > 0.5;
      }
      return permanent || index <= threshold;
    });
  },
};

/**
 * Element Handlers
 */
const ElementHandlers = {
  text(element) {
    if (element.querySelector('.scrambled')) return;

    const originalText = element.textContent?.trim();
    if (!originalText) return;

    PageState.saveOriginalText(element, originalText);

    // Create scrambled span
    const scrambledSpan = document.createElement('span');
    scrambledSpan.className = 'scrambled';
    scrambledSpan.setAttribute('aria-hidden', 'true');
    scrambledSpan.setAttribute('role', 'presentation');
    scrambledSpan.textContent = originalText;

    if (element.matches('a, button')) {
      element.style.position = 'relative';
      element.setAttribute('aria-label', originalText);
      element.textContent = '';
      element.appendChild(scrambledSpan);

      element.addEventListener('mouseenter', () => {
        if (PageState.encrypted) {
          AnimationSystem.animate(scrambledSpan, scrambledSpan.textContent, { permanent: true });
        } else {
          AnimationSystem.animate(scrambledSpan, originalText);
        }
      });
    } else {
      // Visually hide the original element
      element.style.position = 'absolute';
      element.style.opacity = '0';
      element.style.width = '1px';
      element.style.height = '1px';
      element.style.overflow = 'hidden';
      element.style.clip = 'rect(0 0 0 0)';
      element.style.clipPath = 'inset(50%)';
      element.setAttribute('aria-label', originalText);

      // Insert scrambled span
      element.parentNode.insertBefore(scrambledSpan, element.nextSibling);

      AnimationSystem.animate(scrambledSpan, originalText);
    }
  },

  input(element) {
    if (!element?.placeholder) return;

    const originalPlaceholder = element.placeholder;
    PageState.saveOriginalText(element, originalPlaceholder);
    element.setAttribute('aria-label', originalPlaceholder);

    element.addEventListener('mouseenter', () => {
      if (PageState.encrypted) {
        AnimationSystem.animate(element, element.placeholder, {
          permanent: true,
          updateFn: text => (element.placeholder = text),
        });
      } else {
        AnimationSystem.animate(element, originalPlaceholder, {
          updateFn: text => (element.placeholder = text),
        });
      }
    });
  },
};

/**
 * Time Management
 */
const TimeManager = {
  scrambledUnits: null,
  lastSecond: -1,
  utcAnimation: null,
  isInitialLoad: true,

  startUpdates() {
    this.updateTimes();
    requestAnimationFrame(() => this.startUpdates());
  },

  updateTimes() {
    this.updateDateElement();
    this.updateShiftNudgeTime();
  },

  updateDateElement() {
    const dateElement = document.querySelector(CONFIG.selectors.date);
    if (dateElement) {
      const now = new Date();
      dateElement.textContent = this.formatDateTime(now);
    }
  },

  updateShiftNudgeTime() {
    const timeSpan = document.querySelector(`${CONFIG.selectors.shiftnudge} .time-status`);
    if (timeSpan) {
      const now = new Date();
      const targetDate = now < CONFIG.enrollment.open ? CONFIG.enrollment.open : CONFIG.enrollment.close;
      const timeString = this.formatDuration(targetDate - now);
      timeSpan.textContent = timeString;
    }
  },

  formatDateTime(date) {
    const parts = Utils.formatTimeParts(date);
    const timezone = this.getTimezoneOffset();

    return `${parts.year}${parts.month}${parts.day}_${parts.hours}${parts.minutes}${parts.seconds}.${parts.milliseconds}_${timezone}`;
  },

  formatDuration(ms) {
    const parts = {
      days: Math.floor(ms / (24 * 60 * 60 * 1000)),
      hours: String(Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))).padStart(2, '0'),
      minutes: String(Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))).padStart(2, '0'),
      seconds: String(Math.floor((ms % (60 * 1000)) / 1000)).padStart(2, '0'),
      milliseconds: ms % 1000,
    };

    const paddedMs = String(parts.milliseconds).padStart(3, '0');
    const shiftNudgeLink = document.querySelector(CONFIG.selectors.shiftnudge);
    const isEncrypted = shiftNudgeLink?.hasAttribute('data-encrypted') || this.isInitialLoad;

    this.updateScrambledUnits(isEncrypted);

    const units = isEncrypted
      ? this.scrambledUnits
      : { D: 'D', H: 'H', M: 'M', S: 'S', UTC: 'UTC', OFFSET: '5' };

    if (this.isInitialLoad) {
      setTimeout(() => {
        this.isInitialLoad = false;
      }, CONFIG.animation.timing.buffer);
    }

    if (isEncrypted !== Boolean(this.utcAnimation)) {
      this.animateUTCOffset(isEncrypted);
    }

    const offset = -new Date().getTimezoneOffset() / 60;
    const sign = offset >= 0 ? '+' : '-';

    return `${parts.days}${units.D}_${parts.hours}${units.H}_${parts.minutes}${units.M}_${parts.seconds}${units.S}_${paddedMs}MS_${units.UTC}${sign}${units.OFFSET}`;
  },

  updateScrambledUnits(isEncrypted) {
    const currentSecond = new Date().getSeconds();
    if (isEncrypted && currentSecond !== this.lastSecond) {
      this.lastSecond = currentSecond;
      this.scrambledUnits = {
        D: Utils.getRandomChar(),
        H: Utils.getRandomChar(),
        M: Utils.getRandomChar(),
        S: Utils.getRandomChar(),
        UTC: 'UTC',
        OFFSET: Utils.getRandomChar(),
      };
    }
  },

  animateUTCOffset(isEncrypted) {
    const tempSpan = document.createElement('span');
    AnimationSystem.animate(tempSpan, 'UTC-5', {
      permanent: isEncrypted,
      updateFn: text => {
        const [utc, offset] = text.split('-');
        this.scrambledUnits = {
          ...this.scrambledUnits,
          UTC: utc,
          OFFSET: isEncrypted ? Utils.getRandomChar() : offset,
        };
      },
      onComplete: () => {
        this.utcAnimation = isEncrypted ? true : null;
      },
    });
  },

  getTimezoneOffset() {
    const offset = -new Date().getTimezoneOffset() / 60;
    const sign = offset >= 0 ? '+' : '-';
    const units = this.scrambledUnits || { UTC: 'UTC', OFFSET: Math.abs(offset) };
    return `${units.UTC}${sign}${units.OFFSET}`;
  },
};

/**
 * Event Handlers
 */
function animateElementOnEncryption(element, isNowEncrypted) {
  const scrambledEl = element.nextElementSibling?.classList.contains('scrambled')
    ? element.nextElementSibling
    : element.querySelector('.scrambled');

  if (scrambledEl) {
    const originalText = PageState.getOriginalText(element) || scrambledEl.textContent;
    AnimationSystem.animate(scrambledEl, originalText, {
      permanent: isNowEncrypted,
    });
  }
}

function handleEncryption(e) {
  if (e) e.preventDefault();
  const isNowEncrypted = PageState.toggle();

  // Add ASCII art scrambling
  scrambleAsciiArt(isNowEncrypted);

  // Call the grid animation
  window.canvasGridScramble(isNowEncrypted);

  // Update button text
  const encryptButton = e?.currentTarget || document.querySelector(CONFIG.selectors.encrypt);
  const buttonSpan = encryptButton?.querySelector('.scrambled');
  const newText = isNowEncrypted ? 'Decrypt' : 'Encrypt';

  if (encryptButton) {
    encryptButton.setAttribute('data-mode', isNowEncrypted ? 'decrypt' : 'encrypt');
    encryptButton.setAttribute('aria-label', newText);
    if (buttonSpan) {
      AnimationSystem.animate(buttonSpan, newText, {
        permanent: isNowEncrypted,
        updateFn: text => (buttonSpan.textContent = text),
      });
    }
  }

  // Encrypt/decrypt all elements
  document.querySelectorAll(CONFIG.selectors.scrambleable).forEach(element => {
    if (element === encryptButton) return;
    animateElementOnEncryption(element, isNowEncrypted);
  });

  // Handle ShiftNudge separately
  animateShiftNudge(isNowEncrypted);

  // Handle inputs separately
  document.querySelectorAll(CONFIG.selectors.inputs).forEach(input => {
    const originalText = PageState.getOriginalText(input) || input.placeholder;
    AnimationSystem.animate(input, originalText, {
      permanent: isNowEncrypted,
      updateFn: text => (input.placeholder = text),
    });
  });

  // Start/stop trace scramble based on encryption state
  isNowEncrypted ? stopTraceScramble() : startTraceScramble();
}

function animateShiftNudge(isNowEncrypted) {
  const shiftNudgeLink = document.querySelector(CONFIG.selectors.shiftnudge);
  if (!shiftNudgeLink) return;

  const titleSpan = shiftNudgeLink.querySelector('.scrambled-title');
  const statusSpan = shiftNudgeLink.querySelector('.scrambled-status');
  const timeSpan = statusSpan?.querySelector('.time-status');
  const timeText = timeSpan?.textContent || '';
  const now = new Date();
  const statusText = now < CONFIG.enrollment.open ? 'Enrollment opens in' : 'Enrollment closes in';

  if (isNowEncrypted) {
    shiftNudgeLink.setAttribute('data-encrypted', 'true');
  } else {
    shiftNudgeLink.removeAttribute('data-encrypted');
  }

  if (titleSpan) {
    AnimationSystem.animate(titleSpan, 'Shift Nudge', { permanent: isNowEncrypted });
  }
  if (statusSpan) {
    AnimationSystem.animate(statusSpan, statusText, {
      permanent: isNowEncrypted,
      updateFn: text => {
        statusSpan.innerHTML = ` (${text} <span class="time-status">${timeText}</span>)`;
      },
    });
  }
}

/**
 * Initialization Functions
 */
function initializeElements(selector, handler) {
  document.querySelectorAll(selector).forEach(element => {
    if (element.querySelector('.scrambled')) return;
    handler(element);
  });
}

function initializeShiftNudge() {
  const shiftNudgeLink = document.querySelector(CONFIG.selectors.shiftnudge);
  if (!shiftNudgeLink) return;

  const now = new Date();
  const statusText = now < CONFIG.enrollment.open ? 'Enrollment opens in' : 'Enrollment closes in';

  shiftNudgeLink.addEventListener('mouseenter', () => {
    animateShiftNudge(shiftNudgeLink.hasAttribute('data-encrypted'));
  });
}

/**
 * Trace Scramble Functions
 */
let traceInterval;

function traceScramble() {
  if (PageState.encrypted) return;

  const elements = Array.from(document.querySelectorAll('.scrambled'));
  if (!elements.length) return;

  const randomSpan = elements[Math.floor(Math.random() * elements.length)];
  if (!randomSpan) return;

  const originalText = randomSpan.textContent;
  const scrambleLength = Math.floor(Math.random() * 3) + 3;
  const startPos = Math.floor(Math.random() * (originalText.length - scrambleLength));

  const chars = originalText.split('');
  const scrambledChars = chars.slice();

  for (let i = 0; i < scrambleLength; i++) {
    const pos = startPos + i;
    if (pos < scrambledChars.length) {
      scrambledChars[pos] = Utils.getRandomChar();
    }
  }

  randomSpan.textContent = scrambledChars.join('');

  setTimeout(() => {
    randomSpan.textContent = originalText;
  }, CONFIG.animation.timing.resetDelay);
}

function stopTraceScramble() {
  if (traceInterval) {
    clearInterval(traceInterval);
    traceInterval = null;
  }
}

function startTraceScramble() {
  stopTraceScramble(); // Clear any existing interval first
  traceInterval = setInterval(traceScramble, CONFIG.animation.timing.traceScrambleInterval);
}

function stopTraceScramble() {
  if (traceInterval) {
    clearInterval(traceInterval);
    traceInterval = null;
  }
}

/**
  * Initialization
  */
function initialize() {
  if (!CONFIG.animation.isEnabled) return;

  initializeElements(CONFIG.selectors.scrambleable, ElementHandlers.text);
  initializeElements(CONFIG.selectors.inputs, ElementHandlers.input);

  const encryptButton = document.querySelector(CONFIG.selectors.encrypt);
  if (encryptButton) {
    encryptButton.addEventListener('click', handleEncryption);

    encryptButton.addEventListener('mouseenter', () => {
      const buttonSpan = encryptButton.querySelector('.scrambled');
      const isEncrypted = encryptButton.getAttribute('data-mode') === 'decrypt';

      AnimationSystem.animate(buttonSpan, isEncrypted ? 'Decrypt' : 'Encrypt', {
        updateFn: text => (buttonSpan.textContent = text),
      });
    });

    encryptButton.addEventListener('mouseleave', () => {
      const buttonSpan = encryptButton.querySelector('.scrambled');
      const isEncrypted = encryptButton.getAttribute('data-mode') === 'decrypt';

      if (isEncrypted) {
        AnimationSystem.animate(buttonSpan, 'Decrypt', {
          permanent: true,
          updateFn: text => (buttonSpan.textContent = text),
        });
      } else {
        buttonSpan.textContent = 'Encrypt';
      }
    });
  }

  initializeShiftNudge();
  TimeManager.startUpdates();
  startTraceScramble();
}

document.addEventListener('DOMContentLoaded', initialize);

window.addEventListener('load', () => {
  document.querySelectorAll(CONFIG.selectors.scrambleable).forEach(element => {
    const scrambledEl = element.nextElementSibling?.classList.contains('scrambled')
      ? element.nextElementSibling
      : element.querySelector('.scrambled');
    if (scrambledEl) {
      const originalText = PageState.getOriginalText(element) || scrambledEl.textContent;

      AnimationSystem.animate(scrambledEl, originalText, {
        permanent: true,
        onComplete: () => {
          setTimeout(() => {
            AnimationSystem.animate(scrambledEl, originalText);
          }, CONFIG.animation.timing.initialDelay);
        },
      });
    }
  });

  document.querySelectorAll(CONFIG.selectors.inputs).forEach(input => {
    const originalText = PageState.getOriginalText(input) || input.placeholder;

    AnimationSystem.animate(input, originalText, {
      permanent: true,
      updateFn: text => (input.placeholder = text),
      onComplete: () => {
        setTimeout(() => {
          AnimationSystem.animate(input, originalText, {
            updateFn: text => (input.placeholder = text),
          });
        }, CONFIG.animation.timing.initialDelay);
      },
    });
  });

  // Initialize Shift Nudge on page load
  animateShiftNudge(PageState.encrypted);
});

// Canvas Initialization Code

// Color data array for the MDS logo (16x16 grid)
const GRID_COLORS = [
/* Row A */ "#111111", "#111111", "#111111", "#111111", "#111111", "#111111", "#111111", "#111111", "#111111", "#111111", "#111111", "#111111", "#111111", "#111111", "#111111", "#111111",
/* Row B */ "#111111", "#111111", "#111111", "#111111", "#111111", "#111111", "#111111", "#111111", "#262626", "#404040", "#1d1d1d", "#111111", "#111111", "#111111", "#111111", "#111111",
/* Row C */ "#111111", "#111111", "#111111", "#111111", "#111111", "#111111", "#262626", "#0f0f0f", "#404040", "#171717", "#2b2b2b", "#3e3e3e", "#111111", "#111111", "#111111", "#111111",
/* Row D */ "#111111", "#111111", "#111111", "#111111", "#111111", "#171717", "#0f0f0f", "#101010", "#101010", "#111111", "#111111", "#404040", "#111111", "#111111", "#111111", "#111111",
/* Row E */ "#111111", "#111111", "#111111", "#111111", "#151515", "#3f3f3f", "#111111", "#101010", "#111111", "#111111", "#1f1f1f", "#c7c7c7", "#111111", "#111111", "#111111", "#111111",
/* Row F */ "#111111", "#111111", "#111111", "#111111", "#272727", "#111111", "#111111", "#0f0f0f", "#111111", "#111111", "#1f1f1f", "#767676", "#111111", "#111111", "#111111", "#111111",
/* Row G */ "#111111", "#111111", "#111111", "#111111", "#1d1d1d", "#929292", "#404040", "#262626", "#111111", "#111111", "#121212", "#767676", "#1b1b1b", "#111111", "#111111", "#111111",
/* Row H */ "#111111", "#111111", "#111111", "#111111", "#0f0f0f", "#929292", "#404040", "#3a3a3a", "#111111", "#111111", "#1d1d1d", "#bbbbbb", "#111111", "#111111", "#111111", "#111111",
/* Row I */ "#111111", "#111111", "#111111", "#111111", "#111111", "#1b1b1b", "#5b5b5b", "#232323", "#111111", "#111111", "#111111", "#3c3c3c", "#111111", "#111111", "#111111", "#111111",
/* Row J */ "#111111", "#111111", "#111111", "#111111", "#111111", "#5e5e5e", "#5e5e5e", "#5e5e5e", "#0f0f0f", "#111111", "#262626", "#9b9b9b", "#111111", "#111111", "#111111", "#111111",
/* Row K */ "#111111", "#111111", "#111111", "#111111", "#111111", "#5e5e5e", "#111111", "#1a1a1a", "#0f0f0f", "#111111", "#1b1b1b", "#111111", "#111111", "#111111", "#111111", "#111111",
/* Row L */ "#111111", "#111111", "#111111", "#111111", "#3e3e3e", "#5e5e5e", "#111111", "#111111", "#1b1b1b", "#515151", "#111111", "#111111", "#111111", "#111111", "#111111", "#111111",
/* Row M */ "#111111", "#111111", "#171717", "#171717", "#5e5e5e", "#242424", "#111111", "#111111", "#1b1b1b", "#a2a2a2", "#262626", "#111111", "#111111", "#111111", "#111111", "#111111",
/* Row N */ "#171717", "#171717", "#111111", "#111111", "#111111", "#131313", "#111111", "#111111", "#5d5d5d", "#1a1a1a", "#3a3a3a", "#262626", "#111111", "#111111", "#111111", "#111111",
/* Row O */ "#171717", "#111111", "#111111", "#111111", "#111111", "#111111", "#222222", "#111111", "#1a1a1a", "#1a1a1a", "#1a1a1a", "#2b2b2b", "#222222", "#3a3a3a", "#111111", "#111111",
/* Row P */ "#111111", "#111111", "#111111", "#111111", "#111111", "#111111", "#111111", "#171717", "#171717", "#171717", "#2b2b2b", "#2b2b2b", "#222222", "#222222", "#3a3a3a", "#111111",
];

// Canvas initialization
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.querySelector('.grid-canvas');
  const ctx = canvas.getContext('2d');
  const GRID_SIZE = 16;

  // State variables
  let mouseX = -1;
  let mouseY = -1;
  let currentPositions = [...Array(GRID_SIZE * GRID_SIZE)].map((_, i) => i);
  let isAnimating = false;
  let startTime = Date.now();
  const PULSE_DURATION = 1000;

  // Trace variables
  let traceSquares = new Set();
  const TRACE_DURATION = 2000;
  const TRACE_INTERVAL = 1600;

  let selectedAdjacent = new Set();
  let lastAdjacentUpdate = 0;
  const ADJACENT_UPDATE_INTERVAL = 100;

  window.canvasGridScramble = (isEncrypting) => {
    animateGridScramble(isEncrypting);
  };

  function updateCanvasSize() {
    const GRID_LINE = 1;
    const GRID_SIZE = 16;
    let CELL_SIZE = 8;

    if (window.innerWidth >= 1200) {
      CELL_SIZE = 12;
    }

    if (window.innerWidth >= 1970) {
      CELL_SIZE = 18;
    }

    const exactSize = (GRID_SIZE * CELL_SIZE) + ((GRID_SIZE + 1) * GRID_LINE);

    canvas.width = exactSize;
    canvas.height = exactSize;
    canvas.style.width = '';
    canvas.style.height = '';

    canvas.cellSize = CELL_SIZE;

    drawGrid();
  }

  function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const CELL_SIZE = canvas.cellSize;
    const GRID_LINE = 1;
    const TOTAL_CELL_SIZE = CELL_SIZE + GRID_LINE;

    let hoveredRow = -1;
    let hoveredCol = -1;
    if (mouseX >= 0 && mouseY >= 0) {
      hoveredCol = Math.floor(mouseX / TOTAL_CELL_SIZE);
      hoveredRow = Math.floor(mouseY / TOTAL_CELL_SIZE);
    }

    if (hoveredRow !== -1 && hoveredCol !== -1) {
      const currentTime = Date.now();
      if (currentTime - lastAdjacentUpdate > ADJACENT_UPDATE_INTERVAL) {
        selectedAdjacent.clear();
        const adjacentPositions = [];

        for (let r = -1; r <= 1; r++) {
          for (let c = -1; c <= 1; c++) {
            if (r === 0 && c === 0) continue;
            const adjRow = hoveredRow + r;
            const adjCol = hoveredCol + c;
            if (adjRow >= 0 && adjRow < GRID_SIZE && adjCol >= 0 && adjCol < GRID_SIZE) {
              adjacentPositions.push([adjRow, adjCol]);
            }
          }
        }

        shuffleArray(adjacentPositions)
          .slice(0, Math.floor(adjacentPositions.length / 2))
          .forEach(([row, col]) => {
            selectedAdjacent.add(`${row},${col}`);
          });
        lastAdjacentUpdate = currentTime;
      }
    }

    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      const currentIndex = currentPositions[i];
      const row = Math.floor(i / GRID_SIZE);
      const col = i % GRID_SIZE;

      const x = col * TOTAL_CELL_SIZE;
      const y = row * TOTAL_CELL_SIZE;

      const baseColor = GRID_COLORS[currentIndex];

      let fillColor = baseColor;

      const isMainHover = row === hoveredRow && col === hoveredCol;
      const isAdjacent = selectedAdjacent.has(`${row},${col}`);
      const isTrace = Array.from(traceSquares).find(trace => trace.index === i);

      if (isMainHover) {
        fillColor = '#FFFFFF';
      } else if (isAdjacent) {
        const uniqueOffset = (row * GRID_SIZE + col) * 100;
        const elapsed = (Date.now() - startTime + uniqueOffset) % PULSE_DURATION;
        const progress = elapsed / PULSE_DURATION;
        const opacity = 0.1 + (Math.sin(progress * Math.PI * 2) * 0.2 + 0.2);
        fillColor = `rgba(255, 255, 255, ${opacity})`;
      } else if (isTrace) {
        const traceAge = (Date.now() - isTrace.startTime) / TRACE_DURATION;
        const elapsed = (Date.now() - isTrace.startTime) % PULSE_DURATION;
        const progress = elapsed / PULSE_DURATION;
        const pulseOpacity = 0.1 + (Math.sin(progress * Math.PI * 2) * 0.2 + 0.2);
        const fadeOpacity = 1 - traceAge;
        const finalOpacity = pulseOpacity * fadeOpacity;
        fillColor = `rgba(255, 255, 255, ${finalOpacity})`;
      }

      ctx.fillStyle = fillColor;
      ctx.fillRect(x + GRID_LINE, y + GRID_LINE, CELL_SIZE, CELL_SIZE);
    }

    // Get the computed surface color from CSS variables
    const gridLineColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-surface').trim();

    // Use it when drawing grid lines
    ctx.fillStyle = gridLineColor;

    for (let i = 0; i <= GRID_SIZE; i++) {
      const x = i * TOTAL_CELL_SIZE;
      ctx.fillRect(x, 0, GRID_LINE, canvas.height);
    }

    for (let i = 0; i <= GRID_SIZE; i++) {
      const y = i * TOTAL_CELL_SIZE;
      ctx.fillRect(0, y, canvas.width, GRID_LINE);
    }

    if (hoveredRow !== -1 && hoveredCol !== -1 || traceSquares.size > 0) {
      requestAnimationFrame(() => drawGrid());
    }
  }

  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function lerp(start, end, t) {
    return start * (1 - t) + end * t;
  }

  function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  function updateTraceSquares() {
    if (Math.random() < 0.6) {
      const randomIndex = Math.floor(Math.random() * (GRID_SIZE * GRID_SIZE));
      traceSquares.add({
        index: randomIndex,
        startTime: Date.now()
      });
    }

    if (Math.random() < 0.3) {
      const randomIndex = Math.floor(Math.random() * (GRID_SIZE * GRID_SIZE));
      traceSquares.add({
        index: randomIndex,
        startTime: Date.now()
      });
    }

    const currentTime = Date.now();
    traceSquares.forEach(trace => {
      if (currentTime - trace.startTime > TRACE_DURATION) {
        traceSquares.delete(trace);
      }
    });

    drawGrid();
    setTimeout(updateTraceSquares, TRACE_INTERVAL);
  }

  function animateGridScramble(isEncrypting, callback) {
    if (isAnimating) return;
    isAnimating = true;

    const originalPositions = [...Array(GRID_SIZE * GRID_SIZE)].map((_, i) => i);
    const targetPositions = isEncrypting
      ? shuffleArray([...originalPositions])
      : [...originalPositions];

    let start = null;
    const duration = 500;

    function animate(timestamp) {
      if (!start) start = timestamp;
      const progress = (timestamp - start) / duration;

      if (progress < 1) {
        currentPositions = currentPositions.map((pos, i) => {
          const target = targetPositions[i];
          return Math.floor(lerp(pos, target, easeInOutCubic(progress)));
        });
        drawGrid();
        requestAnimationFrame(animate);
      } else {
        currentPositions = [...targetPositions];
        drawGrid();
        isAnimating = false;
        if (callback) callback();
      }
    }

    requestAnimationFrame(animate);
  }

  canvas.addEventListener('mousemove', (e) => {
    if (isAnimating) return;
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    drawGrid();
  });

  canvas.addEventListener('mouseleave', () => {
    mouseX = -1;
    mouseY = -1;
    selectedAdjacent.clear();
    drawGrid();
  });

  canvas.addEventListener('click', () => {
    const encryptButton = document.querySelector(CONFIG.selectors.encrypt);
    if (encryptButton) {
      encryptButton.click();
    } else {
      handleEncryption();
    }
  });

  window.addEventListener('resize', () => {
    updateCanvasSize();
  });

  updateCanvasSize();
  updateTraceSquares();
});

// Store both the original ASCII art and its comment node reference
let originalAsciiArt = '';
let asciiArtComment = null;

// Get and store the original ASCII art and its node on page load
document.addEventListener('DOMContentLoaded', () => {
  const iterator = document.createNodeIterator(
    document,
    NodeFilter.SHOW_COMMENT,
    null,
    false
  );

  let comment = iterator.nextNode();
  while (comment) {
    if (comment.textContent.includes('@@@@@')) {
      originalAsciiArt = comment.textContent;
      asciiArtComment = comment;
      break;
    }
    comment = iterator.nextNode();
  }
});

function scrambleAsciiArt(isEncrypting) {
  if (asciiArtComment) {
    if (isEncrypting) {
      // First replace @ symbols with random characters
      let scrambled = asciiArtComment.textContent.replace(/[@]/g, () => {
        const chars = '#$%&*+=?[]{}()<>';
        return chars[Math.floor(Math.random() * chars.length)];
      });

      // Then randomly shuffle ALL characters in each line, including spaces
      scrambled = scrambled.split('\n').map(line => {
        if (line.trim()) {
          const chars = line.split('');
          for (let i = chars.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [chars[i], chars[j]] = [chars[j], chars[i]];
          }
          return chars.join('');
        }
        return line;
      }).join('\n');

      asciiArtComment.textContent = scrambled;
    } else {
      asciiArtComment.textContent = originalAsciiArt;
    }
  }
}

//Chat Agent
let geminiApiKey = null;

document.addEventListener('DOMContentLoaded', () => {
  const sendButton = document.getElementById('send-button');
  const userInput = document.getElementById('user-input');
  const chatMessages = document.querySelector('.chat-messages');
  const setApiKeyButton = document.getElementById('set-api-key');
  const apiKeyInput = document.getElementById('api-key');

  setApiKeyButton.addEventListener('click', () => {
    geminiApiKey = apiKeyInput.value.trim();
  });

  async function getGeminiResponse(userMessage) {
      if (userMessage.toLowerCase().includes("curriculum") || userMessage.toLowerCase().includes("cv")) {
        const cvLink = document.createElement('a');
        cvLink.href = 'cv.txt';
        cvLink.download = 'cv.txt';
        cvLink.textContent = 'Download CV';
        return cvLink;
      } else {
        if (!geminiApiKey) {
          return 'API key not set. Please set the API key.';
        }
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`;
          const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: userMessage }] }] }) });
          const data = await response.json();
          return data.candidates[0].content.parts[0].text;
        } catch (error) {
          console.error('Error fetching Gemini response:', error);
          return 'Error getting response from Gemini API.';
        }
      }
    }
  }

  sendButton.addEventListener('click', () => {
    const message = userInput.value.trim();
    if (message !== '') {
      const newMessage = document.createElement('div');
      newMessage.classList.add('user-message');
      newMessage.textContent = message;
      chatMessages.appendChild(newMessage);
      userInput.value = '';
      getGeminiResponse(message).then((response) => {
        const agentResponse = document.createElement('div');
        agentResponse.classList.add('agent-message');
        if (typeof response === 'string') agentResponse.textContent = response;
        else agentResponse.appendChild(response);
        chatMessages.appendChild(agentResponse);
      });
    }
  });
});
