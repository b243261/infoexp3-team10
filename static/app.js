let currentMessages = [];
let bookmarkedIds = JSON.parse(localStorage.getItem('bookmarked_ids') || '[]');
let pollsData = [];

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

// 初期化実行
loadMessages();
loadPolls();
