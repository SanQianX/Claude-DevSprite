/**
 * Design Consistency Checker — Backward-compatible re-export
 *
 * The original DesignChecker has been split into two agents:
 * - DesignScanner: scans code against design docs, writes findings to reviews table
 * - DesignFixer: reads pending reviews, fixes via AI, git commits
 *
 * This file re-exports DesignScanner as DesignChecker for backward compatibility.
 */

export { DesignScanner as DesignChecker } from './designScanner';
export type { DesignFinding, DesignCheckResult, ScannerConfig } from './designScanner';
