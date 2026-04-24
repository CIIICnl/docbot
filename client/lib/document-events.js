/**
 * Document Events Client
 * SSE connection for real-time document updates.
 */

/**
 * Create an SSE connection for a document
 * @param {string} documentId - Document ID to subscribe to
 * @param {Object} handlers - Event handlers
 * @returns {Object} Connection control object
 */
export function createDocumentEventSource(documentId, handlers = {}) {
  let eventSource = null;
  let reconnectTimer = null;
  let reconnectDelay = 1000;
  const maxReconnectDelay = 30000;

  /**
   * Connect to the SSE endpoint
   */
  function connect() {
    if (eventSource) {
      eventSource.close();
    }

    eventSource = new EventSource(`/api/documents/${documentId}/events`);

    // Connection opened
    eventSource.addEventListener('connected', (event) => {
      reconnectDelay = 1000; // Reset delay on successful connection
      const data = JSON.parse(event.data);
      handlers.onConnected?.(data);
    });

    // Document updated
    eventSource.addEventListener('document:updated', (event) => {
      const data = JSON.parse(event.data);
      handlers.onDocumentUpdated?.(data);
    });

    // Document locked
    eventSource.addEventListener('document:locked', (event) => {
      const data = JSON.parse(event.data);
      handlers.onDocumentLocked?.(data);
    });

    // Document unlocked
    eventSource.addEventListener('document:unlocked', (event) => {
      const data = JSON.parse(event.data);
      handlers.onDocumentUnlocked?.(data);
    });

    // Lock requested
    eventSource.addEventListener('document:lock_requested', (event) => {
      const data = JSON.parse(event.data);
      handlers.onLockRequested?.(data);
    });

    // Collaborator added
    eventSource.addEventListener('collaborator:added', (event) => {
      const data = JSON.parse(event.data);
      handlers.onCollaboratorAdded?.(data);
    });

    // Collaborator removed
    eventSource.addEventListener('collaborator:removed', (event) => {
      const data = JSON.parse(event.data);
      handlers.onCollaboratorRemoved?.(data);
    });

    // Comment created
    eventSource.addEventListener('comment:created', (event) => {
      const data = JSON.parse(event.data);
      handlers.onCommentCreated?.(data);
    });

    // Comment resolved
    eventSource.addEventListener('comment:resolved', (event) => {
      const data = JSON.parse(event.data);
      handlers.onCommentResolved?.(data);
    });

    // Handle errors
    eventSource.onerror = () => {
      eventSource.close();
      handlers.onDisconnected?.();

      // Reconnect with exponential backoff
      reconnectTimer = setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
        connect();
      }, reconnectDelay);
    };
  }

  /**
   * Disconnect from the SSE endpoint
   */
  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    handlers.onDisconnected?.();
  }

  /**
   * Check if connected
   */
  function isConnected() {
    return eventSource?.readyState === EventSource.OPEN;
  }

  // Start connection
  connect();

  return {
    disconnect,
    isConnected,
    reconnect: connect,
  };
}

/**
 * Simple event emitter for document events
 */
export function createEventEmitter() {
  const listeners = new Map();

  return {
    on(event, handler) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event).add(handler);
      return () => this.off(event, handler);
    },

    off(event, handler) {
      listeners.get(event)?.delete(handler);
    },

    emit(event, data) {
      listeners.get(event)?.forEach((handler) => handler(data));
    },

    clear() {
      listeners.clear();
    },
  };
}
