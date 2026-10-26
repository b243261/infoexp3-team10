let currentMessages = [];
let bookmarkedIds = JSON.parse(localStorage.getItem('bookmarked_ids') || '[]');
let pollsData = [];
let eventsData = [];
let selectedCalendarDate = new Date();
let visibleCalendarMonth = new Date();

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// --- 1. 投稿（メッセージ）機能 ---

async function loadMessages() {
  try {
    const r = await fetch('/api/messages');
    currentMessages = await r.json();
  } catch (err) {
    currentMessages = [];
  }
  renderMessages();
  renderBookmarks();
}

function renderMessages() {
  const container = document.querySelector('#messages');
  if (!container) return;

  container.innerHTML = currentMessages.map(x => {
    const isBookmarked = bookmarkedIds.includes(x.id);
    return `
      <article class="message">
        <b>${escapeHtml(x.name)}</b>
        <p>${escapeHtml(x.message)}</p>
        <div class="meta">
          <span>#${x.id}</span>
          <button type="button" class="btn-bookmark" onclick="toggleBookmark(${x.id})">
            ${isBookmarked ? '★' : '☆'}
          </button>
        </div>
      </article>
    `;
  }).join('');
}

function renderBookmarks() {
  const container = document.querySelector('#bookmarks');
  if (!container) return;

  const bookmarkedPosts = currentMessages.filter(x => bookmarkedIds.includes(x.id));

  if (bookmarkedPosts.length === 0) {
    container.innerHTML = '<div class="message"><p class="meta">ブックマークした投稿はありません。</p></div>';
    return;
  }

  container.innerHTML = bookmarkedPosts.map(x => `
    <article class="message">
      <b>${escapeHtml(x.name)}</b>
      <p>${escapeHtml(x.message)}</p>
      <div class="meta">
        <span>#${x.id}</span>
        <button type="button" class="btn-bookmark" onclick="toggleBookmark(${x.id})">★</button>
      </div>
    </article>
  `).join('');
}

function toggleBookmark(id) {
  if (bookmarkedIds.includes(id)) {
    bookmarkedIds = bookmarkedIds.filter(bId => bId !== id);
  } else {
    bookmarkedIds.push(id);
  }
  localStorage.setItem('bookmarked_ids', JSON.stringify(bookmarkedIds));
  renderMessages();
  renderBookmarks();
}

document.querySelector('#form').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.querySelector('#name').value;
  const message = document.querySelector('#message').value;

  const r = await fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, message })
  });

  document.querySelector('#status').textContent = r.ok ? '投稿しました' : '投稿に失敗しました';
  if (r.ok) {
    document.querySelector('#message').value = '';
    const charCount = document.getElementById('char-count');
    if (charCount) {
      charCount.textContent = '0';
      charCount.style.color = 'inherit';
      charCount.style.fontWeight = 'normal';
    }
    await loadMessages();
  }
});

// 文字数表示機能
const messageInput = document.getElementById('message');
const charCount = document.getElementById('char-count');

// 入力イベントを監視して文字数を更新
messageInput.addEventListener('input', () => {
  const currentLength = messageInput.value.length;
  charCount.textContent = currentLength;

  // 300文字ギリギリ（例: 290文字以上）になったら文字を赤くする
  if (currentLength >= 290) {
    charCount.style.color = 'red';
    charCount.style.fontWeight = 'bold';
  } else {
    charCount.style.color = 'inherit';
    charCount.style.fontWeight = 'normal';
  }
});

// --- 2. 投票（Poll）機能 (API連携版) ---

// サーバーから投票一覧を取得する関数
async function loadPolls() {
  try {
    const r = await fetch('/api/polls');
    pollsData = await r.json();
    renderPoll();
  } catch (err) {
    console.error('投票データの取得に失敗しました', err);
  }
}

// 投票一覧の画面描画
function renderPoll() {
  const container = document.querySelector('#poll-container');
  if (!container) return;

  const pollsHtml = pollsData.map(poll => {
    const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);

    const optionsHtml = poll.options.map(opt => {
      const percent = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
      return `
        <div style="margin-bottom: 8px;">
          <button type="button" class="btn-vote" onclick="vote(${poll.id}, ${opt.id})" ${poll.has_voted ? 'disabled' : ''}>
            <span>${escapeHtml(opt.text)}</span>
            <b>${opt.votes}票 (${percent}%)</b>
          </button>
          <div class="poll-progress">
            <div class="poll-bar" style="width: ${percent}%;"></div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="poll-card">
        <b style="display:block; margin-bottom: 12px;">${escapeHtml(poll.question)}</b>
        ${poll.has_voted ? '<p class="meta">この投票には投票済みです。</p>' : ''}
        ${optionsHtml}
        <div class="meta" style="margin-top: 12px;">総投票数: ${totalVotes}票</div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <details class="poll-card" style="margin-bottom: 16px;">
      <summary style="cursor: pointer; font-weight: bold; font-size: 0.9rem;">＋ 新しい投票を作成する</summary>
      <form id="new-poll-form" onsubmit="handleCreatePoll(event)" style="margin-top: 12px; border: none; padding: 0;">
        <input id="poll-question" placeholder="質問文を入力" required>
        <input id="poll-option1" placeholder="選択肢 1" required>
        <input id="poll-option2" placeholder="選択肢 2" required>
        <input id="poll-option3" placeholder="選択肢 3 (任意)">
        <button type="submit" style="margin-top: 8px;">投票を作成</button>
      </form>
    </details>

    ${pollsHtml}
  `;
}

// 投票API呼び出し (POST /api/polls/<poll_id>/vote)
async function vote(pollId, optionId) {
  const r = await fetch(`/api/polls/${pollId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ option_id: optionId })
  });

  if (r.ok) {
    await loadPolls(); // 最新の得票数をサーバーから再取得して再描画
  } else {
    const result = await r.json();
    if (result.error === 'already voted') {
      await loadPolls();
    } else {
      console.error('投票に失敗しました', result.error);
    }
  }
}

// 新規投票作成API呼び出し (POST /api/polls)
async function handleCreatePoll(e) {
  e.preventDefault();

  const question = document.querySelector('#poll-question').value.trim();
  const opt1 = document.querySelector('#poll-option1').value.trim();
  const opt2 = document.querySelector('#poll-option2').value.trim();
  const opt3 = document.querySelector('#poll-option3').value.trim();

  if (!question || !opt1 || !opt2) return;

  const options = [opt1, opt2];
  if (opt3) options.push(opt3);

  const r = await fetch('/api/polls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, options })
  });

  if (r.ok) {
    await loadPolls(); // 作成した新しい投票を含めて一覧更新
  }
}

// --- 3. カレンダー・予定機能 ---

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatCalendarDate(date) {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  }).format(date);
}

async function loadEvents() {
  const status = document.querySelector('#event-status');
  try {
    const response = await fetch('/api/events');
    if (!response.ok) throw new Error(`予定の取得に失敗しました (${response.status})`);
    eventsData = await response.json();
    renderCalendar();
    renderSelectedDateEvents();
  } catch (error) {
    status.textContent = error.message;
  }
}

function renderCalendar() {
  const grid = document.querySelector('#calendar-grid');
  const monthHeading = document.querySelector('#calendar-month');
  if (!grid || !monthHeading) return;

  const year = visibleCalendarMonth.getFullYear();
  const month = visibleCalendarMonth.getMonth();
  monthHeading.textContent = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long'
  }).format(visibleCalendarMonth);

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const today = dateKey(new Date());

  grid.innerHTML = Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(year, month, index - firstWeekday + 1);
    const key = dateKey(date);
    const eventCount = eventsData.filter(event => event.event_date === key).length;
    const classes = [
      'calendar-day',
      date.getMonth() !== month ? 'is-outside' : '',
      key === dateKey(selectedCalendarDate) ? 'is-selected' : '',
      key === today ? 'is-today' : ''
    ].filter(Boolean).join(' ');
    return `
      <button type="button" class="${classes}" data-calendar-date="${key}"
        aria-pressed="${key === dateKey(selectedCalendarDate)}"
        aria-label="${formatCalendarDate(date)}${eventCount ? `、予定${eventCount}件` : ''}">
        <span class="calendar-day-number">${date.getDate()}</span>
        <span class="calendar-event-indicator">${eventCount ? `● ${eventCount}件` : ''}</span>
      </button>
    `;
  }).join('');
}

function renderSelectedDateEvents() {
  const heading = document.querySelector('#selected-date-heading');
  const dateInput = document.querySelector('#event-date');
  const container = document.querySelector('#event-list');
  if (!heading || !dateInput || !container) return;

  const key = dateKey(selectedCalendarDate);
  heading.textContent = `${formatCalendarDate(selectedCalendarDate)}の予定`;
  dateInput.value = key;
  const selectedEvents = eventsData.filter(event => event.event_date === key);

  if (selectedEvents.length === 0) {
    container.innerHTML = '<p class="meta">この日の予定はありません。</p>';
    return;
  }

  container.innerHTML = selectedEvents.map(event => `
    <article class="event-item">
      <span>${escapeHtml(event.title)}</span>
      <button type="button" class="event-delete" data-delete-event="${event.id}"
        aria-label="${escapeHtml(event.title)}を削除">削除</button>
    </article>
  `).join('');
}

document.querySelector('#calendar-grid').addEventListener('click', event => {
  const button = event.target.closest('[data-calendar-date]');
  if (!button) return;
  const [year, month, day] = button.dataset.calendarDate.split('-').map(Number);
  selectedCalendarDate = new Date(year, month - 1, day);
  visibleCalendarMonth = new Date(year, month - 1, 1);
  renderCalendar();
  renderSelectedDateEvents();
});

document.querySelector('#calendar-prev').addEventListener('click', () => {
  visibleCalendarMonth = new Date(
    visibleCalendarMonth.getFullYear(),
    visibleCalendarMonth.getMonth() - 1,
    1
  );
  renderCalendar();
});

document.querySelector('#calendar-next').addEventListener('click', () => {
  visibleCalendarMonth = new Date(
    visibleCalendarMonth.getFullYear(),
    visibleCalendarMonth.getMonth() + 1,
    1
  );
  renderCalendar();
});

document.querySelector('#event-date').addEventListener('change', event => {
  if (!event.target.value) return;
  const [year, month, day] = event.target.value.split('-').map(Number);
  selectedCalendarDate = new Date(year, month - 1, day);
  visibleCalendarMonth = new Date(year, month - 1, 1);
  renderCalendar();
  renderSelectedDateEvents();
});

document.querySelector('#event-form').addEventListener('submit', async event => {
  event.preventDefault();
  const status = document.querySelector('#event-status');
  const title = document.querySelector('#event-title').value.trim();
  const eventDate = document.querySelector('#event-date').value;
  if (!title || !eventDate) return;

  try {
    const response = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, event_date: eventDate })
    });
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || `予定の追加に失敗しました (${response.status})`);
    }
    document.querySelector('#event-title').value = '';
    status.textContent = '予定を追加しました。';
    await loadEvents();
  } catch (error) {
    status.textContent = error.message;
  }
});

document.querySelector('#event-list').addEventListener('click', async event => {
  const button = event.target.closest('[data-delete-event]');
  if (!button) return;

  const status = document.querySelector('#event-status');
  try {
    const response = await fetch(`/api/events/${button.dataset.deleteEvent}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error(`予定の削除に失敗しました (${response.status})`);
    status.textContent = '予定を削除しました。';
    await loadEvents();
  } catch (error) {
    status.textContent = error.message;
  }
});

// 初期化実行
loadMessages();
loadPolls();
renderCalendar();
renderSelectedDateEvents();
loadEvents();
