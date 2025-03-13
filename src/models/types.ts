/**
 * Represents a vulnerability detected in Solidity code.
 */
export interface Vulnerability {
    /** The name or identifier of the vulnerability check */
    check: string;
    /** Detailed description of the vulnerability */
    description: string;
    /** Impact level of the vulnerability */
    impact: "Critical" | "High" | "Medium" | "Low" | "Informational" | string;
    /** Confidence level in the detection */
    confidence: "High" | "Medium" | "Low" | string;
    /** Lines affected by this vulnerability */
    lines?: { contract: string, lines: number[] }[];
    id?: string;
    title?: string;
    category?: string;
    function?: string;
    detector?: string;
}

/**
 * API response structure from the vulnerability analyzer service.
 */
export interface ApiResponse {
    /** Array of detected vulnerabilities */
    result: Vulnerability[];
    linter?: string;
}

/**
 * Structure for organizing code to be sent to the API.
 */
export interface CodeObject {
    [filePath: string]: {
        content: string;
    };
}

export type Category = "Best Practice" | "Style Guide" | "Gas Consumption" | "Security" | "Miscellaneous";

export interface LinterResult {
    line: number;
    column?: number;
    severity: number;
    message: string;
    ruleId: string;
    filePath?: string;
    category?: Category;
}
