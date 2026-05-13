/**
 * Design Consistency Checker — Backward-compatible re-export
 *
 * This module provides backward compatibility for the original DesignChecker API.
 * The actual implementation has been refactored into:
 * - DesignScanner (in designScanner.ts): responsible for scanning code against design docs
 * - DesignFixer: handles fixing and committing (not exported here)
 *
 * For detailed functionality, refer to the DesignScanner class in designScanner.ts.
 * 
 * Note: The design documentation (FUNCTIONAL-LOGIC-ANALYSIS.md) should be updated
 * to reflect this new module organization, where DesignChecker acts as a wrapper.
 */

export { DesignScanner as DesignChecker } from './designScanner';
export type { DesignFinding, DesignCheckResult, ScannerConfig } from './designScanner';