// Renders pack pictures / boards from the real pack data (packages/packs/data/transportation.json).
const PACK = {
  tram: {
    name: 'Tram',
    palette: ['#d4483b', '#e8f1f5', '#2c3038', '#8a9199'],
    rows: [
      '.....3......',
      '.....3......',
      '.0000000000.',
      '.0111011110.',
      '.0111011110.',
      '.0000000000.',
      '.0000000000.',
      '..2......2..',
    ],
  },
  sailboat: {
    name: 'Sailboat',
    palette: ['#8a5a34', '#f3ede2', '#4a3b2a', '#3f8fbf'],
    rows: [
      '.....2.....',
      '...112.....',
      '..1112.....',
      '.11112.....',
      '111112.....',
      '.....2.....',
      '.0000000...',
      '..00000....',
      '.333333333.',
    ],
  },
  balloon: {
    name: 'Hot-air balloon',
    palette: ['#e0703a', '#f5c451', '#7a5230', '#5c6670'],
    rows: [
      '...000...',
      '.0000000.',
      '000000000',
      '011111110',
      '011111110',
      '000000000',
      '.0000000.',
      '..00000..',
      '...3.3...',
      '..22222..',
      '..22222..',
    ],
  },
};

function parseCoords(v) {
  const set = new Set();
  if (!v) return set;
  for (const pair of v.split(';')) if (pair.trim()) set.add(pair.trim());
  return set;
}

function render(el) {
  const pic = PACK[el.dataset.pic];
  if (!pic) return;
  const size = Number(el.dataset.cell || 12);
  const mode = el.dataset.mode || 'target';
  const progress = Number(el.dataset.progress || 0);
  const seats = (el.dataset.seats || '0').split(',').map(Number);
  const cand = parseCoords(el.dataset.cand);
  const inv = parseCoords(el.dataset.inv);
  const lock = parseCoords(el.dataset.lock);
  const width = pic.rows[0].length;
  el.classList.add('grid');
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', pic.name);
  el.style.gridTemplateColumns = `repeat(${width}, ${size}px)`;
  el.innerHTML = '';
  pic.rows.forEach((row, y) => {
    Array.from(row).forEach((char, x) => {
      const span = document.createElement('span');
      span.className = 'cell';
      span.style.width = size + 'px';
      span.style.height = size + 'px';
      const blank = char === '.';
      const key = `${x},${y}`;
      if (mode === 'target') {
        span.style.background = blank ? 'var(--cell-blank)' : pic.palette[Number(char)];
      } else if (mode === 'outline') {
        span.style.background = 'var(--cell-blank)';
        if (!blank) {
          span.style.outline = '1px solid var(--cell-fillable)';
          span.style.outlineOffset = '-1px';
        }
      } else {
        // board: live play state
        if (blank) {
          span.classList.add('c-blank');
        } else if (inv.has(key)) {
          span.classList.add('c-inv');
        } else if (cand.has(key)) {
          span.classList.add('c-cand');
        } else if (lock.has(key)) {
          span.classList.add('c-locked');
        } else if (((x * 73 + y * 151 + 17) % 97) / 97 < progress) {
          span.classList.add('c-done', 'p' + seats[(x + y) % seats.length]);
        } else {
          span.classList.add('c-fill-empty');
        }
      }
      el.appendChild(span);
    });
  });
}

document.querySelectorAll('[data-pic]').forEach(render);
