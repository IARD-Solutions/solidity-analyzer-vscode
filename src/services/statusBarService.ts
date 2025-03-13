import * as vscode from 'vscode';
import { Vulnerability, LinterResult } from '../models/types';
import { LoggingService } from './loggingService';

/**
 * Manages the extension's status bar items.
 */
export class StatusBarService {
    private statusBarItem: vscode.StatusBarItem;
    private readonly logger: LoggingService;

    /**
     * Creates a new StatusBarService instance.
     * 
     * @param logger The logging service
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
        
        if (totalCount === 0) {
            this.statusBarItem.text = '$(shield) No Issues';
            this.statusBarItem.tooltip = 'No Solidity issues detected. Click to re-analyze current file.';
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
            
            // Add hint about clicking to re-analyze
            tooltip += '\nClick to re-analyze current file';
            
            this.statusBarItem.tooltip = tooltip;
        }
        
        this.statusBarItem.show();
        this.logger.debug(`Status bar updated with ${totalCount} total issues`);
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
     */
    public refresh(): void {
        this.statusBarItem.text = '$(shield) Solidity Analyzer';
        this.statusBarItem.tooltip = 'Analyze Solidity Code. Click to analyze current file.';
        this.statusBarItem.show();
    }

    /**
     * Disposes of the status bar item.
     */
    public dispose(): void {
        this.statusBarItem.dispose();
    }
}
