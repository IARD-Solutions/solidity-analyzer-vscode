import * as vscode from 'vscode';
import { Vulnerability } from '../models/types';

/**
 * Service for managing the extension's status bar integration.
 */
export class StatusBarService {
    private statusBarItem: vscode.StatusBarItem;
    private vulnerabilityCount: number = 0;
    private configListener: vscode.Disposable;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right, 
            100
        );
        this.statusBarItem.command = 'extension.analyzeCurrentSolidityFile';
        this.statusBarItem.tooltip = 'Analyze Solidity vulnerabilities';
        this.refresh();
        
        // Check if should be hidden based on config
        this.updateVisibility();
        
        // Listen for configuration changes
        this.configListener = vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('solidityAnalyzer.hideStatusBar')) {
                this.updateVisibility();
            }
        });
    }

    /**
     * Updates the status bar visibility based on configuration.
     */
    private updateVisibility(): void {
        const config = vscode.workspace.getConfiguration('solidityAnalyzer');
        const hideStatusBar = config.get<boolean>('hideStatusBar', false);
        
        if (hideStatusBar) {
            this.statusBarItem.hide();
        } else {
            this.statusBarItem.show();
        }
    }

    /**
     * Updates the status bar with the latest vulnerability count.
     */
    public updateVulnerabilityCount(vulnerabilities: Vulnerability[]): void {
        this.vulnerabilityCount = vulnerabilities.length;
        this.refresh();
        
        // Show more detailed breakdown in tooltip
        const breakdown = this.getVulnerabilityBreakdown(vulnerabilities);
        this.statusBarItem.tooltip = 'Solidity Security Analysis\n\n' + 
            `Total issues: ${this.vulnerabilityCount}\n` +
            `Critical: ${breakdown.Critical}\n` +
            `High: ${breakdown.High}\n` +
            `Medium: ${breakdown.Medium}\n` +
            `Low: ${breakdown.Low}\n` +
            `Informational: ${breakdown.Informational}`;
            
        // Update visibility in case setting changed
        this.updateVisibility();
    }

    /**
     * Refreshes the status bar display.
     */
    public refresh(): void {
        if (this.vulnerabilityCount > 0) {
            this.statusBarItem.text = `$(shield) ${this.vulnerabilityCount} Issues`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else {
            this.statusBarItem.text = `$(shield) Solidity Analyzer`;
            this.statusBarItem.backgroundColor = undefined;
        }
        
        // Update visibility in case setting changed
        this.updateVisibility();
    }

    /**
     * Shows the status bar item (unless hidden by configuration).
     */
    public show(): void {
        const config = vscode.workspace.getConfiguration('solidityAnalyzer');
        const hideStatusBar = config.get<boolean>('hideStatusBar', false);
        
        if (!hideStatusBar) {
            this.statusBarItem.show();
        }
    }

    /**
     * Hides the status bar item.
     */
    public hide(): void {
        this.statusBarItem.hide();
    }

    /**
     * Gets stats about vulnerability severity levels.
     */
    private getVulnerabilityBreakdown(vulnerabilities: Vulnerability[]): Record<string, number> {
        const result: Record<string, number> = {
            Critical: 0,
            High: 0,
            Medium: 0,
            Low: 0,
            Informational: 0
        };
        
        vulnerabilities.forEach(vuln => {
            const impact = vuln.impact as keyof typeof result;
            if (impact in result) {
                result[impact]++;
            } else {
                // Default to Low if unknown impact level
                result.Low++;
            }
        });
        
        return result;
    }

    /**
     * Sets the status bar to show a scanning indicator.
     */
    public showScanning(): void {
        this.statusBarItem.text = `$(sync~spin) Analyzing...`;
        this.statusBarItem.tooltip = 'Analyzing Solidity files for vulnerabilities...';
        this.statusBarItem.backgroundColor = undefined;
        
        // Update visibility in case setting changed
        this.updateVisibility();
    }

    /**
     * Clean up resources.
     */
    public dispose(): void {
        this.statusBarItem.dispose();
        this.configListener.dispose();
    }
}
