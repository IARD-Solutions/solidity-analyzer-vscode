import * as vscode from 'vscode';

/**
 * Service for accessing extension settings.
 */
export class SettingsService {
    /**
     * Get the direct configuration object
     */
    private getConfig() {
        return vscode.workspace.getConfiguration('solidityAnalyzer');
    }

    /**
     * Whether to analyze Solidity files in node_modules folder
     */
    public getAnalyzeNodeModules(): boolean {
        return this.getConfig().get<boolean>('analyzeNodeModules', false);
    }

    /**
     * Whether to automatically analyze files on save
     */
    public getAutoAnalyzeOnSave(): boolean {
        return this.getConfig().get<boolean>('autoAnalyzeOnSave', false);
    }

    /**
     * Whether linting functionality is enabled
     */
    public getEnableLinting(): boolean {
        return this.getConfig().get<boolean>('enableLinting', true);
    }

    /**
     * Whether explanations for vulnerabilities are shown
     */
    public getShowExplanations(): boolean {
        return this.getConfig().get<boolean>('showExplanations', true);
    }

    /**
     * Whether recommendations for fixing vulnerabilities are shown
     */
    public getShowRecommendations(): boolean {
        return this.getConfig().get<boolean>('showRecommendations', true);
    }

    /**
     * Whether to hide the status bar item
     */
    public getHideStatusBar(): boolean {
        return this.getConfig().get<boolean>('hideStatusBar', false);
    }

    /**
     * Get vulnerability severity levels to display
     */
    public getFilterSeverity(): string[] {
        return this.getConfig().get<string[]>('filterSeverity',
            ['Critical', 'High', 'Medium', 'Low', 'Informational', 'Optimization']);
    }

    /**
     * Get linter categories to filter by
     */
    public getFilterLintCategories(): string[] {
        return this.getConfig().get<string[]>('filterLintCategories', []);
    }

    /**
     * Get linter severity levels to filter by
     */
    public getFilterLintSeverity(): string[] {
        return this.getConfig().get<string[]>('filterLintSeverity', []);
    }

    /**
     * Get ignored linter rules
     */
    public getIgnoreRules(): string[] {
        return this.getConfig().get<string[]>('ignoreRules', []);
    }

    /**
     * Get ignored rule presets
     */
    public getIgnorePresets(): string[] {
        return this.getConfig().get<string[]>('ignorePresets', []);
    }

    /**
     * Get the logging level for the extension
     */
    public getLogLevel(): string {
        return this.getConfig().get<string>('logLevel', 'info');
    }
}

// Export singleton instance
export const settingsService = new SettingsService();
