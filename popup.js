import { SITES } from './sites.js';

const $ = (s) => document.querySelector(s);
const promptEl = $('#prompt');
const sitesEl = $('#sites');
const newChatEl = $('#newChat');
const tileEl = $('#tile');
const sendBtn = $('#send');
const resultsEl = $('#results');
const loginEl = $('#login');

for (const [id, site] of Object.entries(SITES)) {
  const label = document.createElement('label');
  label.innerHTML = `<input type="checkbox" value="${id}" checked><span class="dot"></span>${site.name}`;
  sitesEl.append(label);
}
const siteBoxes = [...sitesEl.querySelectorAll('input')];

// 로그인 상태 확인: 로그인 안 된 사이트는 표시하고 로그인 버튼을 보여줌
const logins = await chrome.runtime.sendMessage({ type: 'checkLogin' });
for (const box of siteBoxes) box.parentElement.dataset.login = logins[box.value] ? 'yes' : 'no';
loginEl.replaceChildren(
  ...Object.entries(SITES)
    .filter(([id]) => !logins[id])
    .map(([, site]) => {
      const li = document.createElement('li');
      li.innerHTML = '<span></span><a href="#">로그인하기</a>';
      li.children[0].textContent = `${site.name}에 로그인되어 있지 않아요.`;
      li.children[1].addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: site.loginUrl });
      });
      return li;
    })
);

// 지난 설정과 작성 중이던 질문 불러오기
const saved = await chrome.storage.local.get(['siteIds', 'newChat', 'tile', 'draft', 'lastResults', 'lastSentAt']);
if (saved.siteIds) siteBoxes.forEach((b) => (b.checked = saved.siteIds.includes(b.value)));
newChatEl.checked = saved.newChat ?? true;
tileEl.checked = saved.tile ?? false;
promptEl.value = saved.draft ?? '';
if (saved.lastResults) showResults(saved.lastResults, saved.lastSentAt);

const saveSettings = () =>
  chrome.storage.local.set({
    siteIds: siteBoxes.filter((b) => b.checked).map((b) => b.value),
    newChat: newChatEl.checked,
    tile: tileEl.checked,
  });
[...siteBoxes, newChatEl, tileEl].forEach((el) => el.addEventListener('change', saveSettings));
promptEl.addEventListener('input', () => chrome.storage.local.set({ draft: promptEl.value }));

promptEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    send();
  }
});
sendBtn.addEventListener('click', send);

async function send() {
  const text = promptEl.value.trim();
  const siteIds = siteBoxes.filter((b) => b.checked).map((b) => b.value);
  if (!text) return promptEl.focus();
  if (!siteIds.length) return showMessage('보낼 AI를 하나 이상 선택해 주세요.');

  sendBtn.disabled = true;
  sendBtn.textContent = '보내는 중…';
  resultsEl.replaceChildren();
  await chrome.storage.local.set({ draft: '' });

  // 창 배치로 포커스가 바뀌면 팝업이 닫힐 수 있지만, 전송은 백그라운드에서 계속됩니다.
  const results = await chrome.runtime.sendMessage({
    type: 'send', text, siteIds, newChat: newChatEl.checked, tile: tileEl.checked,
  });

  promptEl.value = '';
  sendBtn.disabled = false;
  sendBtn.textContent = '동시에 보내기';
  showResults(results, Date.now());
}

function showResults(results, at) {
  resultsEl.replaceChildren(
    ...results.map((r) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="name"></span><span class="${r.ok ? 'ok' : 'err'}"></span>`;
      li.children[0].textContent = r.name;
      li.children[1].textContent = r.ok ? '✓ 전송됨' : `✗ ${r.error}`;
      return li;
    })
  );
  if (at) {
    const meta = document.createElement('li');
    meta.className = 'meta';
    meta.textContent = `마지막 전송: ${new Date(at).toLocaleTimeString('ko-KR')}`;
    resultsEl.append(meta);
  }
}

function showMessage(text) {
  const li = document.createElement('li');
  li.className = 'err';
  li.textContent = text;
  resultsEl.replaceChildren(li);
}
