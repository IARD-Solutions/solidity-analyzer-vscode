import * as vscode from 'vscode';
import { Vulnerability } from '../models/types';
import * as path from 'path';

/**
 * Manages the creation and handling of webviews for displaying vulnerabilities.
 */
export class WebviewProvider {
    /**
     * Creates a webview panel to display vulnerabilities.
     * 
     * @param vulnerabilities The vulnerabilities to display
     * @param context The extension context
     * @param onFocusVulnerability Callback for when a vulnerability is selected for focus
     * @param onDismissHighlights Callback for when highlights should be dismissed
     * @returns The created webview panel
     */
    public createWebviewPanel(
        vulnerabilities: Vulnerability[],
        context: vscode.ExtensionContext,
        onFocusVulnerability: (vulnerability: Vulnerability) => void,
        onDismissHighlights: () => void
    ): vscode.WebviewPanel {
        const panel = vscode.window.createWebviewPanel(
            'solidityAnalyzer',
            'Solidity Analyzer',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(context.extensionPath)],
                retainContextWhenHidden: true
            }
        );

        // Set the webview's initial html content
        panel.webview.html = this.getWebviewContent(vulnerabilities, panel.webview, context);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'dismissHighlights':
                        onDismissHighlights();
                        return;
                    case 'focusOnVulnerability':
                        onFocusVulnerability(message.vulnerability);
                        return;
                    case 'logError':
                        console.error(`Webview error: ${message.error}`);
                        return;
                }
            },
            undefined,
            context.subscriptions
        );

        return panel;
    }

    /**
     * Get the webview content for the vulnerability display panel.
     * 
     * @param vulnerabilities The vulnerabilities to display
     * @param webview The webview to create content for
     * @param context The extension context
     * @returns The HTML content for the webview
     */
    private getWebviewContent(
        vulnerabilities: Vulnerability[],
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

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Solidity Vulnerabilities</title>
                <link href="${codiconsUri}" rel="stylesheet" />
                <link href="${cssUri}" rel="stylesheet" />
            </head>
            <body class="vscode-body">
                <div class="container">
                    <div class="header">
                        <h1>Vulnerabilities <span id="vulnerability-count">${vulnerabilities.length}</span></h1>
                        <div class="toolbar">
                            <button id="dismiss-button" class="button" title="Dismiss all highlights">
                                <span class="codicon codicon-clear-all"></span> Dismiss Highlights
                            </button>
                        </div>
                    </div>

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
                
                <script>
                    const vulnerabilities = ${JSON.stringify(vulnerabilities)};
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

    /**
     * Gets the display color for a confidence level.
     */
    private getConfidenceColor(confidence: string): string {
        switch (confidence) {
            case 'High':
                return '#d9534f'; // red
            case 'Medium':
                return '#f0ad4e'; // orange
            case 'Low':
                return '#5bc0de'; // blue
            case 'Informational':
                return '#5bc0de'; // blue
            default:
                return '#d4d4d4'; // default color
        }
    }

    /**
     * Gets the display color for an impact level.
     */
    private getImpactColor(impact: string): string {
        switch (impact) {
            case 'Critical':
                return '#d9534f'; // red
            case 'High':
                return '#f0ad4e'; // orange
            case 'Medium':
                return '#f7e359'; // yellow
            case 'Low':
                return '#5bc0de'; // blue
            case 'Informational':
                return '#5bc0de'; // blue
            default:
                return '#d4d4d4'; // default color
        }
    }
}
