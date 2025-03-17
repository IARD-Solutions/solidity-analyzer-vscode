import * as vscode from 'vscode';
import { Vulnerability, LinterResult, Category } from '../models/types';
import * as path from 'path';
import { LoggingService } from './loggingService';
import { formatRuleId } from '../utils/vulnerabilityProcessor';

/**
 * Manages the creation and handling of webviews for displaying vulnerabilities.
 * This class is responsible for:
 * - Creating and reusing webview panels
 * - Generating HTML content for the webview
 * - Handling messages from the webview to the extension
 * - Managing webview lifecycle and state
 */
export class WebviewProvider {
    private readonly logger: LoggingService;
    // Make currentPanel public static so it can be accessed from the extension.ts
    public static currentPanel: vscode.WebviewPanel | undefined;

    /**
     * Creates a new WebviewProvider instance.
     * 
     * @param logger The logging service
     */
    constructor(logger: LoggingService) {
        this.logger = logger;
    }

    /**
     * Creates or reuses a webview panel to display vulnerabilities and linter results.
     * 
     * @param vulnerabilities The vulnerabilities to display
     * @param linterResults The linter results to display
     * @param context The extension context
     * @param onFocusVulnerability Callback for when a vulnerability is selected for focus
     * @param onFocusLinterIssue Callback for when a linter issue is selected for focus
     * @param onDismissHighlights Callback for when highlights should be dismissed
     * @returns The created webview panel
     */
    public createWebviewPanel(
        vulnerabilities: Vulnerability[],
        linterResults: LinterResult[],
        context: vscode.ExtensionContext,
        onFocusVulnerability: (vulnerability: Vulnerability) => void,
        onFocusLinterIssue: (linterIssue: LinterResult) => void,
        onDismissHighlights: () => void
    ): vscode.WebviewPanel {
        this.logger.debug(`Creating or reusing webview panel to display ${vulnerabilities.length} vulnerabilities and ${linterResults.length} linter issues`);

        const totalIssues = vulnerabilities.length + linterResults.length;

        // Check if we already have a panel and it's not disposed
        if (WebviewProvider.currentPanel) {
            try {
                // Update the existing panel
                this.logger.debug('Reusing existing webview panel'); // Changed from info to debug
                WebviewProvider.currentPanel.webview.html = this.getWebviewContent(vulnerabilities, linterResults, WebviewProvider.currentPanel.webview, context);
                WebviewProvider.currentPanel.reveal();

                return WebviewProvider.currentPanel;
            } catch (e) {
                // Panel was probably disposed, reset the reference
                this.logger.warn('Previously tracked panel was disposed, creating a new one', e);
                WebviewProvider.currentPanel = undefined;
            }
        }

        // Create a new panel if we don't have one or the previous one was disposed
        const panel = vscode.window.createWebviewPanel(
            'solidityAnalyzer',
            `Solidity Analyzer (${totalIssues} issues)`,
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(context.extensionPath)],
                retainContextWhenHidden: true
            }
        );

        // Store the panel reference
        WebviewProvider.currentPanel = panel;

        // Handle panel disposal
        panel.onDidDispose(() => {
            WebviewProvider.currentPanel = undefined;
        }, null, context.subscriptions);

        // Set the webview's initial html content
        panel.webview.html = this.getWebviewContent(vulnerabilities, linterResults, panel.webview, context);
        this.logger.debug('Webview HTML content generated');

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'dismissHighlights':
                        this.logger.info('User requested to dismiss all highlights from webview');
                        onDismissHighlights();
                        return;
                    case 'focusOnVulnerability':
                        const vulnInfo = message.vulnerability;
                        const vulnId = vulnInfo.id ||
                            (vulnInfo.title ? `"${vulnInfo.title}"` :
                                (vulnInfo.description ? `desc: "${vulnInfo.description.substring(0, 30)}..."` : 'unknown'));
                        this.logger.info(`User requested to focus on vulnerability: ${vulnId}`);
                        onFocusVulnerability(message.vulnerability);
                        return;
                    case 'focusOnLinterIssue':
                        const issueInfo = message.linterIssue;
                        this.logger.info(`User requested to focus on linter issue: ${issueInfo.ruleId} at line ${issueInfo.line}`);
                        onFocusLinterIssue(message.linterIssue);
                        return;
                    case 'logError':
                        this.logger.error(`Webview error: ${message.error}`);
                        return;
                    case 'ignoreLinterRule':
                        this.logger.info(`User requested to ignore linter rule: ${message.ruleId}`);
                        vscode.commands.executeCommand('extension.ignoreLinterRule', message.ruleId);
                        return;
                    default:
                        this.logger.warn(`Unknown message command received from webview: ${message.command}`);
                }
            },
            undefined,
            context.subscriptions
        );

        this.logger.debug('New webview panel created successfully'); // Changed from info to debug
        return panel;
    }

    /**
     * Updates the title of the panel to show the current issue count
     * 
     * @param vulnCount Number of vulnerabilities
     * @param linterCount Number of linter issues
     */
    public updatePanelTitle(vulnCount: number, linterCount: number): void {
        if (WebviewProvider.currentPanel) {
            const totalCount = vulnCount + linterCount;
            WebviewProvider.currentPanel.title = `Solidity Analyzer (${totalCount} issues)`;
        }
    }

    /**
     * Get the webview content for the vulnerability and linter display panel.
     * 
     * @param vulnerabilities The vulnerabilities to display
     * @param linterResults The linter results to display
     * @param webview The webview to create content for
     * @param context The extension context
     * @returns The HTML content for the webview
     */
    private getWebviewContent(
        vulnerabilities: Vulnerability[],
        linterResults: LinterResult[],
        webview: vscode.Webview,
        context: vscode.ExtensionContext
    ): string {
        // Get resource paths
        const cssUri = this.getResourceUri(webview, context, 'media', 'vulnerabilities.css');
        const scriptUri = this.getResourceUri(webview, context, 'media', 'vulnerabilities.js');
        const codiconsUri = this.getResourceUri(
            webview,
            context,
            'node_modules',
            '@vscode/codicons',
            'dist',
            'codicon.css'
        );

        const totalIssues = vulnerabilities.length + linterResults.length;

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Solidity Analyzer</title>
                <link href="${codiconsUri}" rel="stylesheet" />
                <link href="${cssUri}" rel="stylesheet" />
                <style>
                    /* Additional styles not in the CSS file */
                    .tab-container {
                        display: flex;
                        border-bottom: 1px solid var(--vscode-panel-border);
                        margin-bottom: 16px;
                    }
                    
                    .tab {
                        padding: 8px 16px;
                        cursor: pointer;
                        font-weight: 500;
                        border-bottom: 2px solid transparent;
                        transition: all 0.2s ease;
                    }
                    
                    .tab.active {
                        border-bottom-color: var(--vscode-button-background);
                        background-color: var(--vscode-tab-activeBackground);
                    }
                    
                    .tab:hover:not(.active) {
                        background-color: var(--vscode-tab-hoverBackground);
                    }
                    
                    .tab-content {
                        display: none;
                    }
                    
                    .tab-content.active {
                        display: block;
                    }
                </style>
            </head>
            <body class="vscode-body">
                <div class="container">
                    <div class="header">
                        <h1>Solidity Analyzer <span id="vulnerability-count">${totalIssues}</span></h1>
                        <div class="toolbar">
                            <button id="dismiss-button" class="button" title="Dismiss all highlights">
                                <span class="codicon codicon-clear-all"></span> Dismiss Highlights
                            </button>
                        </div>
                    </div>
                    
                    <div class="tab-container">
                        <div class="tab active" data-tab="vulnerabilities">
                            Vulnerabilities <span class="tab-badge">${vulnerabilities.length}</span>
                        </div>
                        <div class="tab" data-tab="linter">
                            Linter Issues <span class="tab-badge">${linterResults.length}</span>
                        </div>
                    </div>
                    
                    <!-- Vulnerabilities Tab -->
                    <div id="vulnerabilities-tab" class="tab-content active">
                        <div class="filters-container">
                            <div class="filter-group">
                                <label class="filter-label">Confidence:</label>
                                <select id="filter-confidence" aria-label="Filter by confidence">
                                    <option value="all">All Confidence</option>
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                            </div>
                            
                            <div class="filter-group">
                                <label class="filter-label">Impact:</label>
                                <div class="toggle-button-group" id="impact-toggles">
                                    <div class="toggle-button critical" data-impact="Critical">
                                        <span class="toggle-icon codicon codicon-check"></span>
                                        Critical
                                    </div>
                                    <div class="toggle-button high" data-impact="High">
                                        <span class="toggle-icon codicon codicon-check"></span>
                                        High
                                    </div>
                                    <div class="toggle-button medium" data-impact="Medium">
                                        <span class="toggle-icon codicon codicon-check"></span>
                                        Medium
                                    </div>
                                    <div class="toggle-button low" data-impact="Low">
                                        <span class="toggle-icon codicon codicon-check"></span>
                                        Low
                                    </div>
                                    <div class="toggle-button optimization" data-impact="Optimization">
                                        <span class="toggle-icon codicon codicon-check"></span>
                                        Optimization
                                    </div>
                                    <div class="toggle-button informational" data-impact="Informational">
                                        <span class="toggle-icon codicon codicon-check"></span>
                                        Informational
                                    </div>
                                </div>
                            </div>
                        </div>
                    
                        <div id="loading" class="loading" style="display: none;">
                            <span class="codicon codicon-loading codicon-modifier-spin"></span>
                            <span>Loading...</span>
                        </div>
                    
                        <div id="no-results" class="message-container" style="display: none;">
                            <span class="codicon codicon-info"></span>
                            <p>No vulnerabilities match the current filters</p>
                        </div>
                    
                        <ul id="vulnerability-list" class="vulnerability-list"></ul>
                    </div>
                    
                    <!-- Linter Tab -->
                    <div id="linter-tab" class="tab-content">
                        <div class="filters-container">
                            <div class="filter-group">
                                <label class="filter-label">Category:</label>
                                <div class="toggle-button-group" id="category-toggles">
                                    <div class="toggle-button security" data-category="Security">
                                        <span class="toggle-icon codicon codicon-check"></span>
                                        Security
                                    </div>
                                    <div class="toggle-button gas" data-category="Gas Consumption">
                                        <span class="toggle-icon codicon codicon-check"></span>
                                        Gas
                                    </div>
                                    <div class="toggle-button best-practice" data-category="Best Practice">
                                        <span class="toggle-icon codicon codicon-check"></span>
                                        Best Practice
                                    </div>
                                    <div class="toggle-button style" data-category="Style Guide">
                                        <span class="toggle-icon codicon codicon-check"></span>
                                        Style
                                    </div>
                                    <div class="toggle-button misc" data-category="Miscellaneous">
                                        <span class="toggle-icon codicon codicon-check"></span>
                                        Misc
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div id="linter-loading" class="loading" style="display: none;">
                            <span class="codicon codicon-loading codicon-modifier-spin"></span>
                            <span>Loading...</span>
                        </div>
                        
                        <div id="linter-no-results" class="message-container" style="display: none;">
                            <span class="codicon codicon-info"></span>
                            <p>No linter issues match the current filters</p>
                        </div>
                        
                        <ul id="linter-list" class="vulnerability-list"></ul>
                    </div>
                </div>
                
                <script>
                    // Make vulnerability and linter data available to the vulnerabilities.js script
                    window.vulnerabilities = ${JSON.stringify(vulnerabilities)};
                    window.linterResults = ${JSON.stringify(linterResults)};
                </script>
                <script src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    /**
     * Helper function to create URIs for webview resources
     */
    private getResourceUri(webview: vscode.Webview, context: vscode.ExtensionContext, ...pathSegments: string[]): vscode.Uri {
        const resourcePath = path.join(context.extensionPath, ...pathSegments);
        return webview.asWebviewUri(vscode.Uri.file(resourcePath));
    }
}
