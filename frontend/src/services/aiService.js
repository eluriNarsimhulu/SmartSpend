
import api, { tokenStorage } from './api';

// Use the same backend URL and /api prefix as the shared Axios instance.
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, '')}/api`
  : '/api';

const BASE = '/ai/conversations';

// REST helpers
export const aiService = {
  createConversation: (title = 'New Chat') =>
    api.post(BASE, { title }).then((r) => r.data),

  listConversations: () =>
    api.get(BASE).then((r) => r.data),

  getConversation: (id) =>
    api.get(`${BASE}/${id}`).then((r) => r.data),

  renameConversation: (id, title) =>
    api.patch(`${BASE}/${id}`, { title }).then((r) => r.data),

  deleteConversation: (id) =>
    api.delete(`${BASE}/${id}`).then((r) => r.data),
};

// SSE streaming
export async function sendMessageStream(
  conversationId,
  message,
  signal,
  callbacks = {},
  options = {}
) {
  const { onStart, onDelta, onDone, onError } = callbacks;

  const token = tokenStorage.get();

  const url =
    `${API_BASE}/ai/conversations/${conversationId}/messages`;

  let response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        message,
        isRetry: Boolean(options.isRetry),
      }),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') return;

    onError?.('Cannot reach the server. Check that the backend is running.');
    return;
  }

  if (!response.ok) {
    let errMsg = 'Something went wrong.';

    try {
      const body = await response.json();
      errMsg = body.message || errMsg;
    } catch (_) { }

    onError?.(errMsg);
    return;
  }

  if (!response.body) {
    onError?.('The server returned an empty response.');
    return;
  }

  // Parse the SSE stream.
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  function processBuffer() {
    const events = buffer.split('\n\n');
    buffer = events.pop();

    for (const raw of events) {
      if (!raw.trim()) continue;

      let eventType = 'message';
      let dataStr = '';

      for (const line of raw.split('\n')) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          dataStr = line.slice(6);
        }
      }

      if (!dataStr) continue;

      let data;

      try {
        data = JSON.parse(dataStr);
      } catch (_) {
        continue;
      }

      switch (eventType) {
        case 'start':
          onStart?.(data.messageId);
          break;

        case 'delta':
          onDelta?.(data.text || '');
          break;

        case 'done':
          onDone?.(data.messageId, data.conversationId);
          break;

        case 'error':
          onError?.(data.message || 'An error occurred.');
          break;

        default:
          break;
      }
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      processBuffer();
    }

    buffer += decoder.decode();
    processBuffer();
  } catch (err) {
    if (err.name !== 'AbortError') {
      onError?.('The connection was interrupted. Please try again.');
    }
  }
}
