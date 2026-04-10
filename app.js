'use strict';

/* ─── State ─────────────────────────────────────────── */
const State = {
  today: null,        // today.json payload
  words: [],          // [{en, pos, ko, ex}]
  selectedKey: null,  // 선택된 날짜 key (null = 오늘)
  currentKey: null,   // 현재 로드된 key (progress 저장에 사용)

  // Learn
  learnIndex: 0,
  flipped: false,
  knownSet: new Set(),

  // Quiz
  quizMode: 'A',      // 'A' = en→ko,  'B' = ko→en
  quizWords: [],
  quizIndex: 0,
  quizScore: 0,
  wrongWords: [],
  answered: false,
};

/* ─── DOM refs ───────────────────────────────────────── */
const $ = id => document.getElementById(id);

/* ─── Screens ───────────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

/* ══════════════════════════════════════════════════════
   HOME
══════════════════════════════════════════════════════ */
async function loadDayData(key) {
  const url = key
    ? `./data/${key}.json?t=${Date.now()}`
    : `./today.json?t=${Date.now()}`;
  const res = await fetch(url);
  return res.json();
}

async function initHome(key) {
  try {
    State.today = await loadDayData(key || null);
    State.words = State.today.words;
    State.selectedKey = key || null;
  } catch {
    $('home-error').classList.remove('hidden');
    showScreen('screen-home');
    return;
  }

  const t = State.today;
  const label = t.type === 'review'
    ? `Review ${String(t.review_num).padStart(2,'0')}`
    : `Day ${String(t.day).padStart(3,'0')}`;

  // key 결정: 명시적으로 선택된 key 또는 today.json에서 파생
  State.currentKey = key || (t.type === 'review'
    ? `review${String(t.review_num).padStart(2,'0')}`
    : `day${String(t.day).padStart(3,'0')}`);

  $('home-day-label').textContent = label;
  $('home-day-date').textContent  = t.date;
  $('home-day-type').textContent  = t.type === 'review' ? '🔁 복습일' : '📖 학습일';
  $('home-total').textContent     = t.total;

  const prog = loadProgress(State.currentKey);
  $('prog-learn').textContent = prog.learnDone ? '완료' : '-';
  $('prog-qa').textContent    = prog.quizA >= 0 ? prog.quizA + '점' : '-';
  $('prog-qb').textContent    = prog.quizB >= 0 ? prog.quizB + '점' : '-';

  await renderArchive(key);
  showScreen('screen-home');
}

async function renderArchive(activeKey) {
  const container = $('archive-list');
  container.innerHTML = '';
  let archive = [];
  try {
    const res = await fetch('./data/archive.json?t=' + Date.now());
    archive = await res.json();
  } catch { return; }

  archive.forEach(entry => {
    const prog = loadProgress(entry.key);
    const isActive = (activeKey === entry.key) || (!activeKey && entry === archive[0]);

    const btn = document.createElement('button');
    btn.className = 'archive-item' + (isActive ? ' today-item' : '');

    const progText = prog.learnDone
      ? (prog.quizB >= 0 ? `A:${prog.quizA} B:${prog.quizB}` : prog.quizA >= 0 ? `A:${prog.quizA}점` : '학습완료')
      : '-';
    const progDone = prog.learnDone || prog.quizA >= 0;

    btn.innerHTML = `
      <span class="ai-label">${entry.label}</span>
      <span class="ai-date">${entry.date}</span>
      <span class="ai-prog${progDone ? ' done' : ''}">${progText}</span>
    `;
    btn.addEventListener('click', () => initHome(entry.key));
    container.appendChild(btn);
  });
}

/* ══════════════════════════════════════════════════════
   LEARN — card flip
══════════════════════════════════════════════════════ */
function startLearn() {
  State.learnIndex = 0;
  State.flipped    = false;
  State.knownSet   = new Set();
  renderCard();
  showScreen('screen-learn');
}

function renderCard() {
  const words = State.words;
  const idx   = State.learnIndex;
  const w     = words[idx];
  const total = words.length;

  // progress bar
  const pct = ((idx) / total * 100).toFixed(1);
  $('learn-bar').style.width = pct + '%';
  $('learn-counter').textContent = `${idx + 1} / ${total}`;

  // card content
  const wordLen = w.en.length;
  const wordSize = wordLen <= 8 ? '36px' : wordLen <= 12 ? '28px' : wordLen <= 16 ? '22px' : '18px';
  $('card-word').style.fontSize = wordSize;
  $('card-word').textContent    = w.en;
  $('card-pos-front').textContent = w.pos;
  $('card-ko').textContent      = w.ko;
  $('card-pos-back').textContent  = w.pos;
  $('card-example').textContent = w.ex;

  // reset flip
  State.flipped = false;
  $('flip-card').classList.remove('flipped');

  // nav buttons
  $('btn-prev').disabled = idx === 0;
  $('btn-next').disabled = idx === total - 1;
  $('btn-to-quiz').classList.toggle('hidden', idx < total - 1);
}

function flipCard() {
  State.flipped = !State.flipped;
  $('flip-card').classList.toggle('flipped', State.flipped);
}

function learnNav(dir) {
  const next = State.learnIndex + dir;
  if (next < 0 || next >= State.words.length) return;
  State.learnIndex = next;
  renderCard();
}

// swipe + tap support (iOS-safe)
let touchStartX = 0;
let touchStartY = 0;
let touchMoved  = false;

$('flip-card').addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touchMoved  = false;
}, { passive: true });

$('flip-card').addEventListener('touchmove', e => {
  const dx = Math.abs(e.touches[0].clientX - touchStartX);
  const dy = Math.abs(e.touches[0].clientY - touchStartY);
  if (dx > 8 || dy > 8) touchMoved = true;
}, { passive: true });

$('flip-card').addEventListener('touchend', e => {
  e.preventDefault(); // click 이벤트 중복 방지
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) > 50) {
    learnNav(dx < 0 ? 1 : -1);
  } else if (!touchMoved) {
    flipCard();
  }
});

$('btn-prev').addEventListener('click', () => learnNav(-1));
$('btn-next').addEventListener('click', () => learnNav(1));
$('btn-learn-back').addEventListener('click', () => showScreen('screen-home'));

$('btn-to-quiz').addEventListener('click', () => {
  saveProgress(State.currentKey, { learnDone: true });
  $('prog-learn').textContent = '완료';
  renderArchive(State.selectedKey);
  startQuiz('A');
});

/* ══════════════════════════════════════════════════════
   QUIZ
══════════════════════════════════════════════════════ */
function startQuiz(mode) {
  State.quizMode  = mode;
  State.quizWords = shuffle([...State.words]);
  State.quizIndex = 0;
  State.quizScore = 0;
  State.wrongWords = [];
  State.answered  = false;

  const modeLabel = mode === 'A' ? 'Part A — 영어 → 한국어' : 'Part B — 한국어 → 영어';
  $('quiz-mode-label').textContent = modeLabel;

  renderQuiz();
  showScreen('screen-quiz');
}

function renderQuiz() {
  const words  = State.quizWords;
  const idx    = State.quizIndex;
  const w      = words[idx];
  const total  = words.length;
  State.answered = false;

  // progress
  const pct = (idx / total * 100).toFixed(1);
  $('quiz-bar').style.width = pct + '%';
  $('quiz-counter').textContent = `${idx + 1} / ${total}`;
  $('quiz-feedback').textContent = '';
  $('quiz-feedback').className = 'quiz-feedback';

  // question
  if (State.quizMode === 'A') {
    $('quiz-q-label').textContent = '이 단어의 한국어 뜻은?';
    $('quiz-q-word').textContent  = w.en;
  } else {
    $('quiz-q-label').textContent = '이 뜻의 영어 단어는?';
    $('quiz-q-word').textContent  = w.ko;
  }
  $('quiz-q-pos').textContent = '';

  // choices
  const choices  = makeChoices(w, words, State.quizMode);
  const container = $('choices');
  container.innerHTML = '';
  choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = choice;
    btn.addEventListener('click', () => checkAnswer(btn, choice, w));
    container.appendChild(btn);
  });
}

function makeChoices(correct, allWords, mode) {
  const correctAns = mode === 'A' ? correct.ko : correct.en;
  const pool = allWords
    .filter(w => w !== correct)
    .map(w => mode === 'A' ? w.ko : w.en);
  const wrongs = shuffle(pool).slice(0, 3);
  return shuffle([correctAns, ...wrongs]);
}

function checkAnswer(btn, choice, w) {
  if (State.answered) return;
  State.answered = true;

  const correctAns = State.quizMode === 'A' ? w.ko : w.en;
  const isCorrect  = choice === correctAns;

  // mark buttons
  document.querySelectorAll('.choice-btn').forEach(b => {
    b.disabled = true;
    if (b.textContent === correctAns) b.classList.add('correct');
  });
  if (!isCorrect) {
    btn.classList.add('wrong');
    State.wrongWords.push(w);
  } else {
    State.quizScore++;
  }

  const fb = $('quiz-feedback');
  fb.textContent = isCorrect ? '✓ 정답!' : `✗ 정답: ${correctAns}`;
  fb.className   = 'quiz-feedback ' + (isCorrect ? 'ok' : 'err');

  // auto-advance after delay
  setTimeout(() => {
    State.quizIndex++;
    if (State.quizIndex >= State.quizWords.length) {
      finishQuiz();
    } else {
      renderQuiz();
    }
  }, isCorrect ? 700 : 1400);
}

function finishQuiz() {
  const score = State.quizScore;
  const total = State.quizWords.length;

  if (State.quizMode === 'A') {
    saveProgress(State.currentKey, { quizA: score });
    $('prog-qa').textContent = score + '점';
    showResult(score, total, '영어 → 한국어');
  } else {
    saveProgress(State.currentKey, { quizB: score });
    $('prog-qb').textContent = score + '점';
    showResult(score, total, '한국어 → 영어');
  }
}

$('btn-quiz-back').addEventListener('click', () => showScreen('screen-home'));

/* ══════════════════════════════════════════════════════
   RESULT
══════════════════════════════════════════════════════ */
function showResult(score, total, modeLabel) {
  $('result-score').textContent = `${score}`;
  $('result-total').textContent = `/ ${total}점`;
  $('result-mode').textContent  = modeLabel;

  const pct = Math.round(score / total * 100);
  const grade = pct >= 90 ? '🏆 완벽해요!' :
                pct >= 70 ? '👍 잘했어요!' :
                pct >= 50 ? '💪 조금만 더!' : '📚 다시 외워요!';
  $('result-grade').textContent = grade;

  // wrong words list
  const container = $('wrong-list');
  container.innerHTML = '';
  if (State.wrongWords.length === 0) {
    container.innerHTML = '<p style="color:#22C55E;font-weight:700;text-align:center;padding:12px">전부 맞혔어요! 🎉</p>';
  } else {
    $('wrong-title').classList.remove('hidden');
    State.wrongWords.forEach(w => {
      const div = document.createElement('div');
      div.className = 'wrong-item';
      div.innerHTML = `<div class="wi-en">${w.en} <span style="font-weight:400;font-size:12px;color:#999">${w.pos}</span></div>
                       <div class="wi-ko">${w.ko}</div>`;
      container.appendChild(div);
    });
  }

  showScreen('screen-result');
}

// 결과 화면 버튼
$('btn-result-home').addEventListener('click', () => showScreen('screen-home'));
$('btn-retry').addEventListener('click', () => startQuiz(State.quizMode));
$('btn-next-part').addEventListener('click', () => {
  const next = State.quizMode === 'A' ? 'B' : null;
  if (next) startQuiz(next);
  else showScreen('screen-home');
});

/* ══════════════════════════════════════════════════════
   WORDLIST
══════════════════════════════════════════════════════ */
function showWordlist() {
  const t = State.today;
  const label = t.type === 'review'
    ? `Review ${String(t.review_num).padStart(2,'0')}`
    : `Day ${String(t.day).padStart(3,'0')}`;
  $('wordlist-title').textContent = label + ' — 단어 목록';
  $('wordlist-badge').textContent = State.words.length + '개';

  const body = $('wordlist-body');
  body.innerHTML = '';
  State.words.forEach((w, i) => {
    const div = document.createElement('div');
    div.className = 'wl-item';
    div.innerHTML = `
      <div class="wl-num">${String(i + 1).padStart(2, '0')}</div>
      <div class="wl-content">
        <div class="wl-en">${w.en}</div>
        <div class="wl-pos">${w.pos}</div>
        <div class="wl-ko">${w.ko}</div>
        <div class="wl-ex">${w.ex}</div>
      </div>
    `;
    body.appendChild(div);
  });
  showScreen('screen-wordlist');
}

$('btn-wordlist').addEventListener('click', showWordlist);
$('btn-wordlist-back').addEventListener('click', () => showScreen('screen-home'));

/* ══════════════════════════════════════════════════════
   HOME button handlers
══════════════════════════════════════════════════════ */
$('btn-start-learn').addEventListener('click', startLearn);
$('btn-start-quiz-a').addEventListener('click', () => startQuiz('A'));
$('btn-start-quiz-b').addEventListener('click', () => startQuiz('B'));

/* ══════════════════════════════════════════════════════
   PROGRESS (localStorage)
══════════════════════════════════════════════════════ */
const PROG_KEY = 'engword_progress';

function loadProgress(date) {
  const raw = localStorage.getItem(PROG_KEY);
  const all = raw ? JSON.parse(raw) : {};
  return all[date] || { learnDone: false, quizA: -1, quizB: -1 };
}

function saveProgress(date, patch) {
  const raw = localStorage.getItem(PROG_KEY);
  const all = raw ? JSON.parse(raw) : {};
  all[date] = { ...loadProgress(date), ...patch };
  localStorage.setItem(PROG_KEY, JSON.stringify(all));
}

/* ══════════════════════════════════════════════════════
   UTIL
══════════════════════════════════════════════════════ */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── TTS ── */
function speakCurrent() {
  const word = State.words[State.learnIndex]?.en;
  if (!word || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.lang = 'en-US';
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

/* ── Service Worker ── */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

/* ── Boot ── */
initHome();
