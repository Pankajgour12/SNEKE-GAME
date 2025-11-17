

document.addEventListener('DOMContentLoaded', () => {
  const board = document.querySelector('.board');
  const scoreEl = document.getElementById('score');
  const highScoreEl = document.getElementById('high-score');
  const timeEl = document.getElementById('time');
  const speedRangeEl = document.getElementById('speed-range');
  const speedValueEl = document.getElementById('speed-value');

  let blockSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--block-size')) || 28;
  let cols = 0;
  let rows = 0;

  let blocks = {}; 

  // Speed is the delay (ms) between frames. We'll map a 1..10 slider to a delay
  // where higher slider means faster (lower delay). Value persisted in localStorage.
  function sliderToDelay(v) {
    // map 1..10 -> 400..90 (approx)
    return Math.round(400 - (v - 1) * 34);
  }

  let speedSetting = Number(localStorage.getItem('sneke-speed') || 5);
  if (!speedSetting || speedSetting < 1) speedSetting = 5;
  let speed = sliderToDelay(speedSetting);
  if (speedRangeEl) {
    speedRangeEl.value = String(speedSetting);
  }
  if (speedValueEl) speedValueEl.textContent = String(speedSetting);
  let loopId = null;

  let snake = [];
  let direction = 'right';
  let nextDirection = direction;

  let food = null;
  let score = 0;
  let highScore = Number(localStorage.getItem('sneke-high') || 0);
  highScoreEl.textContent = highScore;

  let startTime = null;

  // overlay for game over
  const overlay = createOverlay();
  document.body.appendChild(overlay);

  // wire speed slider
  if (speedRangeEl) {
    speedRangeEl.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      speedSetting = val;
      speed = sliderToDelay(val);
      localStorage.setItem('sneke-speed', String(val));
      if (speedValueEl) speedValueEl.textContent = String(val);
      // apply immediately by restarting loop (keeps game state)
      if (loopId) startLoop();
    });
  }

  // initialize board and start game
  function init() {
    // read block size (allows responsive CSS to control block size)
    blockSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--block-size')) || blockSize;

    // ensure board has a sensible size before calculating rows/cols
    const bw = board.clientWidth || Math.floor(window.innerWidth - 32);
    const bh = board.clientHeight || Math.floor(window.innerHeight * 0.6);

    cols = Math.max(6, Math.floor(bw / blockSize));
    rows = Math.max(8, Math.floor(bh / blockSize));

    // make grid explicit so each cell is blockSize pixels
    board.style.display = 'grid';
    board.style.gridTemplateColumns = `repeat(${cols}, ${blockSize}px)`;
    board.style.gridTemplateRows = `repeat(${rows}, ${blockSize}px)`;
    board.style.justifyContent = 'center';

    // build blocks
    blocks = {};
    board.innerHTML = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const el = document.createElement('div');
        el.className = 'block';
        el.style.width = `${blockSize}px`;
        el.style.height = `${blockSize}px`;
        el.dataset.r = r;
        el.dataset.c = c;
        board.appendChild(el);
        blocks[`${r}-${c}`] = el;
      }
    }

    resetGame();
  }

  function resetGame() {
    // center snake horizontally near middle of board
    const startRow = Math.floor(rows / 2);
    const startCol = Math.floor(cols / 2);
    snake = [
      { x: startRow, y: startCol },
      { x: startRow, y: startCol - 1 },
      { x: startRow, y: startCol - 2 }
    ];
    direction = 'right';
    nextDirection = direction;
    score = 0;
    scoreEl.textContent = score;
    startTime = Date.now();
    placeFood();
    draw();
    startLoop();
    overlay.hide();
  }

  function startLoop() {
    stopLoop();
    loopId = setInterval(tick, speed);
  }

  function stopLoop() {
    if (loopId) {
      clearInterval(loopId);
      loopId = null;
    }
  }

  function tick() {
    updateDirection();
    const head = { x: snake[0].x, y: snake[0].y };
    if (direction === 'left') head.y -= 1;
    else if (direction === 'right') head.y += 1;
    else if (direction === 'up') head.x -= 1;
    else if (direction === 'down') head.x += 1;

    // collisions with walls
    if (head.x < 0 || head.x >= rows || head.y < 0 || head.y >= cols) {
      gameOver();
      return;
    }

    // collision with self
    if (snake.some(seg => seg.x === head.x && seg.y === head.y)) {
      gameOver();
      return;
    }

    // eat food
    const ate = (food && head.x === food.x && head.y === food.y);
    snake.unshift(head);
    if (ate) {
      score += 1;
      scoreEl.textContent = score;
      if (score > highScore) {
        highScore = score;
        localStorage.setItem('sneke-high', String(highScore));
        highScoreEl.textContent = highScore;
      }
      placeFood();
    } else {
      snake.pop();
    }

    draw();
    updateTime();
  }

  function updateDirection() {
    // apply nextDirection if it's not directly opposite
    if (isOpposite(direction, nextDirection)) return;
    direction = nextDirection;
  }

  function isOpposite(a, b) {
    return (a === 'left' && b === 'right') ||
      (a === 'right' && b === 'left') ||
      (a === 'up' && b === 'down') ||
      (a === 'down' && b === 'up');
  }

  function placeFood() {
    // pick a random cell not occupied by snake
    const empty = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!snake.some(s => s.x === r && s.y === c)) empty.push({ x: r, y: c });
      }
    }
    if (empty.length === 0) {
      // board full -> win
      gameOver(true);
      return;
    }
    const pick = empty[Math.floor(Math.random() * empty.length)];
    food = pick;
  }

  function draw() {
    // clear fills and food markers
    Object.values(blocks).forEach(el => {
      el.classList.remove('fill');
      el.classList.remove('food');
      el.classList.remove('head');
    });

    // draw food
    if (food) {
      const f = blocks[`${food.x}-${food.y}`];
      if (f) f.classList.add('food');
    }

    // draw snake
    snake.forEach((seg, i) => {
      const el = blocks[`${seg.x}-${seg.y}`];
      if (el) el.classList.add('fill');
      if (i === 0 && el) el.classList.add('head');
    });
  }

  function updateTime() {
    if (!startTime) return;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const ss = String(elapsed % 60).padStart(2, '0');
    timeEl.textContent = `${mm}:${ss}`;
  }

  function gameOver(won = false) {
    stopLoop();
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    overlay.show({ score, highScore, time: elapsed, won });
  }

  function createOverlay() {
    const el = document.createElement('div');
    el.className = 'overlay';
    el.innerHTML = `
      <div class="panel">
        <h2 class="ov-title">Game Over</h2>
        <p class="ov-stats"></p>
        <div class="ov-actions">
          <button class="btn-restart">Restart</button>
        </div>
      </div>`;

    el.hide = () => { el.style.display = 'none'; };
    el.show = ({ score, highScore, time, won }) => {
      el.style.display = 'flex';
      el.querySelector('.ov-title').textContent = won ? 'You Win!' : 'Game Over';
      const mm = String(Math.floor(time / 60)).padStart(2, '0');
      const ss = String(time % 60).padStart(2, '0');
      el.querySelector('.ov-stats').textContent = `Score: ${score} • High: ${highScore} • Time: ${mm}:${ss}`;
    };

    el.querySelector('.btn-restart').addEventListener('click', () => {
      resetGame();
    });

    el.style.display = 'none';
    return el;
  }

  // keyboard controls (arrows + WASD)
  window.addEventListener('keydown', (ev) => {
    const k = ev.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') nextDirection = 'left';
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') nextDirection = 'right';
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') nextDirection = 'up';
    else if (k === 'ArrowDown' || k === 's' || k === 'S') nextDirection = 'down';
  });

  // handle resize: rebuild board for new rows/cols
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      init();
    }, 250);
  });

  // initial setup
  init();
});







