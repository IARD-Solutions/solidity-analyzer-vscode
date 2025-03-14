/**
 * Type definitions for API responses to improve type safety
 * These interfaces represent the raw data format received from the Solidity analyzer API
 * and the linter service, before processing into our internal types.
 */

/**
 * Raw vulnerability data from the Solidity analyzer API
 * 
 * @example
 * {
 *   "id": "VULN-123",
 *   "check": "reentrancy",
 *   "title": "Reentrancy Vulnerability",
 *   "description": "Contract allows state changes after external calls...",
 *   "impact": "High",
 *   "confidence": "Medium",
 *   "category": "Security"
 *   "lines": [
 *     {
 *       "contract": "MyContract.sol",
 *       "lines": [42, 43, 44]
 *     }
 *   ]
 * }
 */
export interface RawVulnerability {
    /** Unique identifier for the vulnerability */
    id?: string;
    /** Type of check that found the vulnerability */
    check?: string;
    /** Human-readable title of the vulnerability */
    title?: string;
    /** Detailed description of the vulnerability and potential impact */
    description?: string;
    /** Severity level: Critical, High, Medium, Low, Informational, or Optimization */
    impact?: string;
    /** Confidence level in the finding: High, Medium, or Low */
    confidence?: string;
    /** Category of the vulnerability: Security, Gas Consumption, etc. */
    category?: string;
    /** Function name where the vulnerability was found */
    function?: string;
    /** Name of the detector/rule that found the vulnerability */
    detector?: string;
    /** Source code locations affected by this vulnerability */
    lines?: Array<{ contract: string, lines: number[] }>;
    /** Additional fields that might be in the API response */
    [key: string]: any;
}

/**
 * Raw linter result data from the linter API
 * 
 * @example
 * {
 *   "line": 42,
 *   "column": 5,
 *   "severity": 2,
 *   "message": "Explicitly mark visibility in function",
 *   "ruleId": "func-visibility",
 *   "filePath": "contracts/MyContract.sol"
 * }
 */
export interface RawLinterResult {
    /** Line number where the issue was found (1-based) */
    line?: number;
    /** Column number where the issue was found (1-based) */
    column?: number;
    /** Severity level: 2 (error), 1 (warning), 0 (info) */
    severity?: number;
    /** Human-readable description of the issue */
    message?: string;
    /** Unique identifier for the linter rule that was violated */
    ruleId?: string;
    /** Path to the file containing the issue */
    filePath?: string;
    /** Additional fields that might be in the API response */
    [key: string]: any;
}

/**
 * Structure of the Solidity analyzer API response
 * This is the top-level object returned by the analyzer API
 * 
 * @example
 * {
 *   "vulnerabilities": [...],
 *   "linterResults": "...",  // Can be string, array, or object
 * }
 */
export interface AnalyzerApiResponse {
    /** Array of detected vulnerabilities */
    vulnerabilities: RawVulnerability[];
    /** 
     * Linter results in various possible formats:
     * - String: Raw text output from the linter
     * - Array: Direct array of linter results
     * - Object: Container with a "results" property holding the array
     */
    linterResults?: string | RawLinterResult[] | {
        results: RawLinterResult[];
    };
    /** Additional fields that might be in the API response */
    [key: string]: any;
}

/**
 * Structured linter output from text-based format
 * Used for intermediate processing when parsing console output from linters
 */
export interface ParsedLinterLine {
    /** Line number where the issue was found */
    lineNumber: number;
    /** Column number where the issue was found */
    column: number;
    /** Severity level as text: "error", "warning", or "info" */
    level: string;
    /** Human-readable description of the issue */
    message: string;
    /** Unique identifier for the linter rule that was violated */
    ruleId: string;
}
