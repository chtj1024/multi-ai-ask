// 각 AI 사이트 설정.
// 사이트 화면이 바뀌어서 전송이 안 되면 여기 선택자(input / send)만 고치면 됩니다.
// 선택자는 위에서부터 순서대로 시도하고, 화면에 보이는 첫 번째 요소를 사용합니다.
// loginCookies: 로그인하면 생기는 쿠키 이름(앞부분 일치). 로그인 확인이 틀리면 이 값을 고치세요.
export const SITES = {
  claude: {
    name: 'Claude',
    newChatUrl: 'https://claude.ai/new',
    loginUrl: 'https://claude.ai/login',
    cookieUrl: 'https://claude.ai/',
    loginCookies: ['sessionKey'],
    matches: ['https://claude.ai/*'],
    input: [
      'div.ProseMirror[contenteditable="true"]',
      '[data-testid="chat-input"]',
      'div[contenteditable="true"]',
    ],
    send: [
      'button[aria-label="Send message"]',
      'button[aria-label*="Send"]',
      'button[aria-label*="보내기"]',
      'button[aria-label*="전송"]',
    ],
  },
  chatgpt: {
    name: 'ChatGPT',
    newChatUrl: 'https://chatgpt.com/',
    loginUrl: 'https://chatgpt.com/auth/login',
    cookieUrl: 'https://chatgpt.com/',
    loginCookies: ['__Secure-next-auth.session-token'],
    matches: ['https://chatgpt.com/*', 'https://chat.openai.com/*'],
    input: [
      '#prompt-textarea',
      'div.ProseMirror[contenteditable="true"]',
      '#mobile-composer-prompt',
      'main textarea',
    ],
    send: [
      '[data-testid="send-button"]',
      '#composer-submit-button',
      'button[aria-label*="Send"]',
      'button[aria-label*="보내기"]',
    ],
  },
  gemini: {
    name: 'Gemini',
    newChatUrl: 'https://gemini.google.com/app',
    loginUrl: 'https://accounts.google.com/ServiceLogin?continue=https://gemini.google.com/app',
    cookieUrl: 'https://gemini.google.com/',
    // 구글 로그인 쿠키는 .google.com에 있어서 manifest에 https://google.com/* 권한이 필요함
    loginCookies: ['__Secure-1PSID', 'SID'],
    matches: ['https://gemini.google.com/*'],
    input: [
      'rich-textarea div.ql-editor[contenteditable="true"]',
      'div.ql-editor[contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]',
    ],
    send: [
      'button.send-button',
      'button[aria-label*="Send"]',
      'button[aria-label*="보내기"]',
      'button[aria-label*="전송"]',
    ],
  },
};
