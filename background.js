import { SITES } from './sites.js';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'send') broadcast(msg).then(sendResponse);
  else if (msg.type === 'checkLogin') checkLogins().then(sendResponse);
  else return;
  return true; // 비동기 응답
});

// 로그인 쿠키가 있는지로 로그인 여부를 판단합니다. { claude: true, chatgpt: false, ... }
async function checkLogins() {
  const entries = await Promise.all(
    Object.entries(SITES).map(async ([id, site]) => [id, await isLoggedIn(site)])
  );
  return Object.fromEntries(entries);
}

async function isLoggedIn(site) {
  const cookies = await chrome.cookies.getAll({ url: site.cookieUrl });
  const now = Date.now() / 1000;
  return cookies.some(
    (c) =>
      site.loginCookies.some((name) => c.name.startsWith(name)) &&
      (c.session || c.expirationDate > now)
  );
}

async function broadcast({ text, siteIds, newChat, tile }) {
  await chrome.action.setBadgeBackgroundColor({ color: '#6b7280' });
  await chrome.action.setBadgeText({ text: '…' });

  const bounds = tile ? await tileBounds(siteIds.length) : [];
  const results = await Promise.all(
    siteIds.map((id, i) => sendTo(id, text, newChat, bounds[i]))
  );

  const okCount = results.filter((r) => r.ok).length;
  await chrome.action.setBadgeBackgroundColor({
    color: okCount === results.length ? '#16a34a' : '#dc2626',
  });
  await chrome.action.setBadgeText({ text: `${okCount}/${results.length}` });
  await chrome.storage.local.set({ lastResults: results, lastSentAt: Date.now() });
  return results;
}

async function sendTo(id, text, newChat, bounds) {
  const site = SITES[id];
  try {
    if (!(await isLoggedIn(site))) {
      return { id, name: site.name, ok: false, error: '로그인이 필요해요.' };
    }
    const tab = await prepareTab(site, newChat, bounds);
    await waitForLoad(tab.id);
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectPrompt,
      args: [text, site.input, site.send],
    });
    return { id, name: site.name, ...result };
  } catch (e) {
    return { id, name: site.name, ok: false, error: String(e?.message || e) };
  }
}

// 이미 열린 탭이 있으면 재사용하고, 없으면 새로 엽니다.
async function prepareTab(site, newChat, bounds) {
  let [tab] = await chrome.tabs.query({ url: site.matches });

  if (!tab) {
    if (bounds) {
      const win = await chrome.windows.create({ url: site.newChatUrl, ...bounds, focused: false });
      return win.tabs[0];
    }
    return chrome.tabs.create({ url: site.newChatUrl, active: false });
  }

  if (newChat) tab = await chrome.tabs.update(tab.id, { url: site.newChatUrl });

  if (bounds) {
    const siblings = await chrome.tabs.query({ windowId: tab.windowId });
    if (siblings.length === 1) {
      await chrome.windows.update(tab.windowId, { ...bounds, state: 'normal' });
    } else {
      await chrome.windows.create({ tabId: tab.id, ...bounds, focused: false });
    }
  }
  return tab;
}

async function waitForLoad(tabId) {
  await sleep(500); // 탭 이동이 시작될 시간을 줌
  for (let i = 0; i < 60; i++) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') return;
    await sleep(500);
  }
}

// 주 모니터 작업 영역을 가로로 n등분
async function tileBounds(count) {
  const displays = await chrome.system.display.getInfo();
  const { workArea: wa } = displays.find((d) => d.isPrimary) || displays[0];
  const width = Math.floor(wa.width / count);
  return Array.from({ length: count }, (_, i) => ({
    left: wa.left + i * width,
    top: wa.top,
    width,
    height: wa.height,
  }));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// 아래 함수는 각 AI 페이지 안에서 실행됩니다. 바깥 변수를 쓰면 안 됩니다.
async function injectPrompt(text, inputSelectors, sendSelectors) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const visible = (el) => el && el.getClientRects().length > 0;
  const findFirst = (selectors) => {
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) if (visible(el)) return el;
    }
    return null;
  };
  const waitFor = async (fn, timeout) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const v = fn();
      if (v) return v;
      await sleep(250);
    }
    return null;
  };
  const norm = (s) => (s || '').replace(/\s+/g, '');
  const textOf = (el) => (el.value !== undefined ? el.value : el.innerText);

  const input = await waitFor(() => findFirst(inputSelectors), 20000);
  if (!input) return { ok: false, error: '입력창을 찾지 못했어요. 로그인 상태를 확인해 주세요.' };

  input.focus();
  if (input instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    document.execCommand('selectAll');
    document.execCommand('delete');
    // 줄바꿈을 그대로 넣으면 에디터가 뒷줄을 버리므로 한 줄씩 문단으로 넣음
    text.split('\n').forEach((line, i) => {
      if (i) document.execCommand('insertParagraph');
      if (line) document.execCommand('insertText', false, line);
    });
  }

  const head = norm(text).slice(0, 30);
  const filled = await waitFor(() => norm(textOf(input)).includes(norm(text)), 3000);
  if (!filled) return { ok: false, error: '입력창에 질문을 넣지 못했어요.' };

  const button = await waitFor(() => {
    const b = findFirst(sendSelectors);
    return b && !b.disabled && b.getAttribute('aria-disabled') !== 'true' ? b : null;
  }, 5000);

  if (button) {
    button.click();
  } else {
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true,
    }));
  }

  // 입력창이 비워지면 전송된 것으로 판단
  const sent = await waitFor(() => {
    const el = findFirst(inputSelectors) || input;
    return !norm(textOf(el)).includes(head);
  }, 5000);
  return sent ? { ok: true } : { ok: false, error: '전송 버튼을 누르지 못했어요. 탭을 확인해 주세요.' };
}
