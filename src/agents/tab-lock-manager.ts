import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TabLock {
  tabId: string;
  agentId: string;
  acquiredAt: number;
  expiresAt: number;
}

const DEFAULT_LOCK_TIMEOUT_MS = 60_000; // 60 seconds

// ─── Manager ─────────────────────────────────────────────────────────────────

/**
 * TabLockManager — Prevents multiple agents from controlling the same tab.
 */
export class TabLockManager extends EventEmitter {

  // === 1. Private state ===

  private locks: Map<string, TabLock> = new Map();
  private lockTimeoutMs: number;

  // === 2. Constructor ===

  constructor(lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS) {
    super();
    this.lockTimeoutMs = lockTimeoutMs;
  }

  // === 4. Public methods ===

  /**
   * Try to acquire a lock on a tab for an agent.
   * Robin always succeeds (overrides existing locks).
   * Returns true if lock acquired, false if tab is locked by another agent.
   */
  acquire(tabId: string, agentId: string): { acquired: boolean; owner?: string } {
    this.cleanExpired();

    // Robin always has priority
    if (agentId === 'robin') {
      const existing = this.locks.get(tabId);
      if (existing && existing.agentId !== 'robin') {
        this.emit('lock-overridden', { tabId, previousOwner: existing.agentId, newOwner: 'robin' });
      }
      this.locks.set(tabId, {
        tabId,
        agentId: 'robin',
        acquiredAt: Date.now(),
        expiresAt: Date.now() + this.lockTimeoutMs,
      });
      return { acquired: true };
    }

    const existing = this.locks.get(tabId);
    if (existing && existing.agentId !== agentId) {
      // Tab is locked by someone else
      return { acquired: false, owner: existing.agentId };
    }

    // Acquire or renew lock
    this.locks.set(tabId, {
      tabId,
      agentId,
      acquiredAt: existing?.acquiredAt ?? Date.now(),
      expiresAt: Date.now() + this.lockTimeoutMs,
    });
    this.emit('lock-acquired', { tabId, agentId });
    return { acquired: true };
  }

  /**
   * Release a lock. Only the owner (or robin) can release.
   */
  release(tabId: string, agentId: string): boolean {
    const existing = this.locks.get(tabId);
    if (!existing) return true;

    if (existing.agentId !== agentId && agentId !== 'robin') {
      return false;
    }

    this.locks.delete(tabId);
    this.emit('lock-released', { tabId, agentId: existing.agentId });
    return true;
  }

  /**
   * Check if a tab is locked.
   */
  isLocked(tabId: string): boolean {
    this.cleanExpired();
    return this.locks.has(tabId);
  }

  /**
   * Get the owner of a tab lock, or null if unlocked.
   */
  getOwner(tabId: string): string | null {
    this.cleanExpired();
    const lock = this.locks.get(tabId);
    return lock ? lock.agentId : null;
  }

  /**
   * Get all current locks.
   */
  getAllLocks(): TabLock[] {
    this.cleanExpired();
    return Array.from(this.locks.values());
  }

  /**
   * Release all locks for a specific agent.
   */
  releaseAllForAgent(agentId: string): number {
    let released = 0;
    for (const [tabId, lock] of this.locks) {
      if (lock.agentId === agentId) {
        this.locks.delete(tabId);
        this.emit('lock-released', { tabId, agentId });
        released++;
      }
    }
    return released;
  }

  // === 6. Cleanup ===

  /**
   * Cleanup: release all locks.
   */
  destroy(): void {
    this.locks.clear();
    this.removeAllListeners();
  }

  // === 7. Private helpers ===

  /**
   * Remove all expired locks.
   */
  private cleanExpired(): void {
    const now = Date.now();
    for (const [tabId, lock] of this.locks) {
      if (lock.expiresAt <= now) {
        this.locks.delete(tabId);
        this.emit('lock-expired', { tabId, agentId: lock.agentId });
      }
    }
  }
}
