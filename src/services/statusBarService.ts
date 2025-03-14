import * as vscode from 'vscode';
import * as path from 'path';
import { Vulnerability, LinterResult } from '../models/types';
import { LoggingService } from './loggingService';

/**
 * Manages the extension's status bar items.
 * 
 * The StatusBarService displays information about analysis results in the VS Code status bar,
 * providing users with a quick overview of detected issues and an easy way to trigger analysis.
 */
export class StatusBarService {
    private statusBarItem: vscode.StatusBarItem;
    private readonly logger: LoggingService;

    /**
     * Creates a new StatusBarService instance.
     * 
     * @param logger The logging service for diagnostic output
     */
    constructor(logger: LoggingService) {
        this.logger = logger;

        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        // Change command to re-analyze current file when clicked
        this.statusBarItem.command = 'extension.analyzeCurrentSolidityFile';
        this.refresh();
        this.statusBarItem.show();

        this.logger.debug('StatusBarService initialized');
    }

    /**
     * Shows scanning status in the status bar.
     * Updates the status bar to indicate that vulnerability scanning is in progress.
     */
    public showScanning(): void {
        this.statusBarItem.text = '$(sync~spin) Scanning Solidity...';
        this.statusBarItem.tooltip = 'Scanning for Solidity vulnerabilities';
        this.statusBarItem.show();
    }

    /**
     * Updates the status bar with the vulnerability count.
     * 
     * @param vulnerabilities The list of vulnerabilities
     * @param linterResults The list of linter issues (optional)
     */
    public updateVulnerabilityCount(vulnerabilities: Vulnerability[], linterResults: LinterResult[] = []): void {
        const vulnCount = vulnerabilities.length;
        const linterCount = linterResults.length;
        const totalCount = vulnCount + linterCount;

        // Find the Solidity file that would be analyzed when clicked
        const targetFile = this.getTargetSolidityFile();

        // Format the file path to be more readable in the tooltip
        const targetFileDisplay = targetFile ? `\n\nWill analyze: ${this.formatFilePath(targetFile)}` : '';

        if (totalCount === 0) {
            this.statusBarItem.text = '$(shield) No Issues';
            this.statusBarItem.tooltip = `No Solidity issues detected. Click to re-analyze current file.${targetFileDisplay}`;
        } else {
            this.statusBarItem.text = `$(shield) ${totalCount} Issues`;

            // Create a detailed tooltip showing the breakdown
            let tooltip = '';

            // Vulnerabilities breakdown by impact
            if (vulnCount > 0) {
                // Count vulnerabilities by impact
                const impactCounts = this.countByProperty(vulnerabilities, 'impact');
                tooltip += `${vulnCount} Vulnerabilities:\n`;

                Object.entries(impactCounts)
                    .sort(([a], [b]) => this.compareImpacts(a, b))
                    .forEach(([impact, count]) => {
                        tooltip += `  • ${impact}: ${count}\n`;
                    });

                if (linterCount > 0) tooltip += '\n';
            }

            // Linter issues breakdown by category
            if (linterCount > 0) {
                // Count linter issues by category
                const categoryCounts = this.countByProperty(linterResults, 'category');
                tooltip += `${linterCount} Linter Issues:\n`;

                Object.entries(categoryCounts)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .forEach(([category, count]) => {
                        tooltip += `  • ${category || 'Other'}: ${count}\n`;
                    });
            }

            // Add hint about clicking to re-analyze with the target file name
            tooltip += `\nClick to re-analyze current file${targetFileDisplay}`;

            this.statusBarItem.tooltip = tooltip;
        }

        this.statusBarItem.show();
        this.logger.debug(`Status bar updated with ${totalCount} total issues`);
    }

    /**
     * Format a file path for display in the UI.
     * Uses workspace-relative paths when possible for shorter, more readable paths.
     * 
     * @param filePath The absolute file path to format
     * @returns A formatted file path (workspace-relative if possible, otherwise the filename)
     */
    private formatFilePath(filePath: string): string {
        // Try to use workspace relative path for cleaner display
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (workspaceFolders && workspaceFolders.length > 0) {
            for (const folder of workspaceFolders) {
                const relativePath = path.relative(folder.uri.fsPath, filePath);

                // If the relative path doesn't start with '..' it's within this workspace folder
                if (!relativePath.startsWith('..')) {
                    return relativePath;
                }
            }
        }

        // If no workspace or file is outside workspace, just show the filename
        return path.basename(filePath);
    }

    /**
     * Get the path to the Solidity file that would be analyzed when the 
     * status bar item is clicked.
     * 
     * @returns Path to the Solidity file or undefined if none found
     */
    private getTargetSolidityFile(): string | undefined {
        // First check active editor
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor?.document.languageId === 'solidity') {
            return activeEditor.document.fileName;
        }

        // If active editor is not a Solidity file, check all visible editors
        for (const editor of vscode.window.visibleTextEditors) {
            if (editor.document.languageId === 'solidity') {
                return editor.document.fileName;
            }
        }

        // If no visible editors have Solidity, check all open documents
        for (const document of vscode.workspace.textDocuments) {
            if (document.languageId === 'solidity') {
                return document.fileName;
            }
        }

        return undefined;
    }

    /**
     * Count items by a specific property value
     * 
     * @param items The items to count
     * @param property The property to count by
     * @returns An object with counts by property value
     */
    private countByProperty<T>(items: T[], property: keyof T): { [key: string]: number } {
        const counts: { [key: string]: number } = {};

        items.forEach(item => {
            const value = String(item[property] || 'Unknown');
            counts[value] = (counts[value] || 0) + 1;
        });

        return counts;
    }

    /**
     * Compare impact levels to sort them by severity
     * 
     * @param a First impact level
     * @param b Second impact level
     * @returns Negative if a is more severe than b, positive if b is more severe than a, 0 if equal
     */
    private compareImpacts(a: string, b: string): number {
        const order: Record<string, number> = {
            'Critical': 0,
            'High': 1,
            'Medium': 2,
            'Low': 3,
            'Optimization': 4,
            'Informational': 5
        };

        const orderA = a in order ? order[a] : 999;
        const orderB = b in order ? order[b] : 999;

        return orderA - orderB;
    }

    /**
     * Resets the status bar to the default state.
     * Used when no analysis is active or when the extension starts up.
     */
    public refresh(): void {
        this.statusBarItem.text = '$(shield) Solidity Analyzer';
        this.statusBarItem.tooltip = 'Analyze Solidity Code. Click to analyze current file.';
        this.statusBarItem.show();
    }

    /**
     * Disposes of the status bar item.
     * Called when the extension is deactivated to clean up resources.
     */
    public dispose(): void {
        this.statusBarItem.dispose();
    }
}
