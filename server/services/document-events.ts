/**
 * Document Events Service
 * Server-Sent Events (SSE) for real-time document updates.
 */

import type { ServerResponse } from 'node:http';

export type EventType =
  | 'document:updated'
  | 'document:locked'
  | 'document:unlocked'
  | 'document:lock_requested'
  | 'collaborator:added'
  | 'collaborator:removed'
  | 'collaborator:updated'
  | 'comment:created'
  | 'comment:updated'
  | 'comment:deleted'
  | 'comment:resolved'
  | 'comment:reopened'
  | 'ping';

export interface DocumentEvent {
  type: EventType;
  documentId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

interface Connection {
  documentId: string;
  userEmail: string;
  res: ServerResponse;
  lastPing: number;
}

// Store active connections by document ID
const connectionsByDocument = new Map<string, Set<Connection>>();

// Ping interval to keep connections alive
const PING_INTERVAL = 30000; // 30 seconds
let pingTimer: NodeJS.Timeout | null = null;

/**
 * Add a new SSE connection for a document
 */
export function addConnection(
  documentId: string,
  userEmail: string,
  res: ServerResponse
): () => void {
  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ documentId, userEmail })}\n\n`);

  const connection: Connection = {
    documentId,
    userEmail,
    res,
    lastPing: Date.now(),
  };

  // Add to document's connection set
  if (!connectionsByDocument.has(documentId)) {
    connectionsByDocument.set(documentId, new Set());
  }
  connectionsByDocument.get(documentId)!.add(connection);

  // Start ping timer if not running
  startPingTimer();

  // Return cleanup function
  return () => {
    const connections = connectionsByDocument.get(documentId);
    if (connections) {
      connections.delete(connection);
      if (connections.size === 0) {
        connectionsByDocument.delete(documentId);
      }
    }
    stopPingTimerIfEmpty();
  };
}

/**
 * Broadcast an event to all connections for a document
 */
export function broadcast(documentId: string, event: Omit<DocumentEvent, 'documentId' | 'timestamp'>): void {
  const connections = connectionsByDocument.get(documentId);
  if (!connections || connections.size === 0) {
    return;
  }

  const fullEvent: DocumentEvent = {
    ...event,
    documentId,
    timestamp: new Date().toISOString(),
  };

  const eventData = `event: ${event.type}\ndata: ${JSON.stringify(fullEvent)}\n\n`;

  const deadConnections: Connection[] = [];

  for (const connection of connections) {
    try {
      connection.res.write(eventData);
    } catch {
      // Connection is dead, mark for removal
      deadConnections.push(connection);
    }
  }

  // Clean up dead connections
  for (const conn of deadConnections) {
    connections.delete(conn);
  }

  if (connections.size === 0) {
    connectionsByDocument.delete(documentId);
    stopPingTimerIfEmpty();
  }
}

/**
 * Broadcast to a specific user only
 */
export function broadcastToUser(
  documentId: string,
  userEmail: string,
  event: Omit<DocumentEvent, 'documentId' | 'timestamp'>
): void {
  const connections = connectionsByDocument.get(documentId);
  if (!connections) return;

  const fullEvent: DocumentEvent = {
    ...event,
    documentId,
    timestamp: new Date().toISOString(),
  };

  const eventData = `event: ${event.type}\ndata: ${JSON.stringify(fullEvent)}\n\n`;

  for (const connection of connections) {
    if (connection.userEmail === userEmail) {
      try {
        connection.res.write(eventData);
      } catch {
        // Ignore dead connections
      }
    }
  }
}

/**
 * Get active connection count for a document
 */
export function getConnectionCount(documentId: string): number {
  return connectionsByDocument.get(documentId)?.size ?? 0;
}

/**
 * Get list of connected users for a document
 */
export function getConnectedUsers(documentId: string): string[] {
  const connections = connectionsByDocument.get(documentId);
  if (!connections) return [];

  const users = new Set<string>();
  for (const conn of connections) {
    users.add(conn.userEmail);
  }
  return [...users];
}

/**
 * Start the ping timer to keep connections alive
 */
function startPingTimer(): void {
  if (pingTimer) return;

  pingTimer = setInterval(() => {
    const now = Date.now();
    const deadConnections: Array<{ documentId: string; connection: Connection }> = [];

    for (const [documentId, connections] of connectionsByDocument) {
      for (const connection of connections) {
        try {
          connection.res.write(`: ping\n\n`);
          connection.lastPing = now;
        } catch {
          deadConnections.push({ documentId, connection });
        }
      }
    }

    // Clean up dead connections
    for (const { documentId, connection } of deadConnections) {
      const connections = connectionsByDocument.get(documentId);
      if (connections) {
        connections.delete(connection);
        if (connections.size === 0) {
          connectionsByDocument.delete(documentId);
        }
      }
    }

    stopPingTimerIfEmpty();
  }, PING_INTERVAL);
}

/**
 * Stop the ping timer if no connections remain
 */
function stopPingTimerIfEmpty(): void {
  if (connectionsByDocument.size === 0 && pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

// ========== Event Helper Functions ==========

/**
 * Notify that a document was updated
 */
export function notifyDocumentUpdated(documentId: string, updatedBy: string): void {
  broadcast(documentId, {
    type: 'document:updated',
    data: { updatedBy },
  });
}

/**
 * Notify that a document was locked
 */
export function notifyDocumentLocked(
  documentId: string,
  holderEmail: string,
  holderName: string | null,
  expiresAt: string
): void {
  broadcast(documentId, {
    type: 'document:locked',
    data: { holderEmail, holderName, expiresAt },
  });
}

/**
 * Notify that a document was unlocked
 */
export function notifyDocumentUnlocked(documentId: string): void {
  broadcast(documentId, {
    type: 'document:unlocked',
    data: {},
  });
}

/**
 * Notify that a lock was requested
 */
export function notifyLockRequested(
  documentId: string,
  requesterEmail: string,
  message: string | null
): void {
  broadcast(documentId, {
    type: 'document:lock_requested',
    data: { requesterEmail, message },
  });
}

/**
 * Notify that a collaborator was added
 */
export function notifyCollaboratorAdded(
  documentId: string,
  userEmail: string,
  permission: string
): void {
  broadcast(documentId, {
    type: 'collaborator:added',
    data: { userEmail, permission },
  });
}

/**
 * Notify that a collaborator was removed
 */
export function notifyCollaboratorRemoved(documentId: string, userEmail: string): void {
  broadcast(documentId, {
    type: 'collaborator:removed',
    data: { userEmail },
  });
}

/**
 * Notify that a comment was created
 */
export function notifyCommentCreated(
  documentId: string,
  comment: { id: string; authorEmail: string; body: string; parentId?: string | null }
): void {
  broadcast(documentId, {
    type: 'comment:created',
    data: comment,
  });
}

/**
 * Notify that a comment was resolved
 */
export function notifyCommentResolved(
  documentId: string,
  commentId: string,
  resolvedBy: string
): void {
  broadcast(documentId, {
    type: 'comment:resolved',
    data: { commentId, resolvedBy },
  });
}
