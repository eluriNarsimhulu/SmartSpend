// frontend/src/services/aiService.js
// Wraps the AI conversation API calls and SSE stream parser.

import api from './api';
import { tokenStorage } from './api';

const BASE = '/ai/conversations';

// ── REST helpers ─────────────────────────────────────────────────────────────

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

// ── SSE streaming ─────────────────────────────────────────────────────────────
// Uses fetch() with a POST body because EventSource only supports GET.

/**
 * sendMessageStream – sends a message and streams the response.
 *
 * @param {string} conversationId
 * @param {string} message
 * @param {AbortSignal} signal   – pass an AbortController signal to cancel
 * @param {object} callbacks
 *   onStart(messageId)
 *   onDelta(text)
 *   onDone(messageId, conversationId)
 *   onError(errorMessage)
 */
export async function sendMessageStream(conversationId, message, signal, callbacks = {}) {
  const { onStart, onDelta, onDone, onError } = callbacks;

  const token = tokenStorage.get();
  const apiBase = import.meta.env.VITE_API_URL || '/api';
  const url = `${apiBase}/ai/conversations/${conversationId}/messages`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message }),
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
    } catch (_) {}
    onError?.(errMsg);
    return;
  }

  // ── Parse the SSE stream ──────────────────────────────────────────────────
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  function processBuffer() {
    const events = buffer.split('\n\n');
    buffer = events.pop(); // last element may be incomplete

    for (const raw of events) {
      if (!raw.trim()) continue;

      let eventType = 'message';
      let dataStr   = '';

      for (const line of raw.split('\n')) {
        if (line.startsWith('event: ')) eventType = line.slice(7).trim();
        else if (line.startsWith('data: ')) dataStr = line.slice(6);
      }

      if (!dataStr) continue;

      let data;
      try {
        data = JSON.parse(dataStr);
      } catch (_) {
        continue;
      }

      switch (eventType) {
        case 'start': onStart?.(data.messageId); break;
        case 'delta': onDelta?.(data.text || ''); break;
        case 'done':  onDone?.(data.messageId, data.conversationId); break;
        case 'error': onError?.(data.message || 'An error occurred.'); break;
        default: break;
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
    // Process any remaining buffer
    buffer += decoder.decode();
    processBuffer();
  } catch (err) {
    if (err.name !== 'AbortError') {
      onError?.('The connection was interrupted. Please try again.');
    }
  }
}

