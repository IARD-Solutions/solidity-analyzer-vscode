import * as vscode from 'vscode';
import { Vulnerability } from '../models/types';

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
                localResourceRoots: [vscode.Uri.file(context.extensionPath)]
            }
        );

        panel.webview.html = this.getWebviewContent(vulnerabilities);

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
                }
            },
            undefined,
            context.subscriptions
        );

        return panel;
    }

    /**
     * Generates the HTML content for the vulnerability webview.
     * 
     * @param vulnerabilities The vulnerabilities to display
     * @returns The HTML content for the webview
     */
    private getWebviewContent(vulnerabilities: Vulnerability[]): string {
        const vulnerabilityItems = vulnerabilities.map((vuln, index) => {
            const confidenceColor = this.getConfidenceColor(vuln.confidence);
            const impactColor = this.getImpactColor(vuln.impact);

            return `
                <li data-vuln-index="${index}">
                    <h2 class="toggle"><span class="arrow">▶</span>${vuln.check}</h2>
                    <div class="vuln-details" data-vuln-index="${index}">
                        <p class="impact" style="color: ${impactColor};">Impact: ${vuln.impact}</p>
                        <p class="confidence" style="color: ${confidenceColor};">Confidence: ${vuln.confidence}</p>
                        <p class="description clickable" data-vuln-index="${index}">${vuln.description}</p>
                    </div>
                </li>`;
        }).join('');

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Vulnerabilities</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; background-color: #1e1e1e; color: #d4d4d4; }
                    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                    h1 { color: #d4d4d4; margin: 0; }
                    ul { list-style-type: none; padding: 0; }
                    li { background: #2d2d2d; margin: 10px 0; padding: 10px; border-radius: 5px; }
                    li h2 { margin: 0; font-size: 1.2em; color: #d9534f; cursor: pointer; }
                    li p { margin: 5px 0; }
                    li .impact { font-weight: bold; }
                    li .description { white-space: pre-wrap; display: none; }
                    .clickable { cursor: pointer; }
                    .clickable:hover { text-decoration: underline; }
                    .arrow { margin-right: 10px; }
                    #dismissButton { background-color: #d9534f; color: white; border: none; padding: 8px 15px; cursor: pointer; border-radius: 5px; }
                </style>
                <script>
                    const vscode = acquireVsCodeApi();
                    let vulnerabilities = ${JSON.stringify(vulnerabilities)};
                    
                    function toggleDescription(event) {
                        const li = event.currentTarget.parentElement;
                        const description = li.querySelector('.description');
                        const arrow = event.currentTarget.querySelector('.arrow');
                        
                        if (description.style.display === 'none' || description.style.display === '') {
                            description.style.display = 'block';
                            arrow.textContent = '▼';
                        } else {
                            description.style.display = 'none';
                            arrow.textContent = '▶';
                        }
                    }
                    
                    function dismissHighlights() {
                        vscode.postMessage({ command: 'dismissHighlights' });
                    }
                    
                    function focusOnVulnerability(index) {
                        vscode.postMessage({
                            command: 'focusOnVulnerability',
                            vulnerabilityIndex: index,
                            vulnerability: vulnerabilities[index]
                        });
                    }
                    
                    window.addEventListener('DOMContentLoaded', () => {
                        document.querySelectorAll('.toggle').forEach(item => {
                            item.addEventListener('click', toggleDescription);
                        });
                        
                        document.getElementById('dismissButton').addEventListener('click', dismissHighlights);
                        
                        document.querySelectorAll('.clickable').forEach(item => {
                            item.addEventListener('click', (e) => {
                                // Get the index from the parent div
                                const vulnDetails = e.target.closest('.vuln-details');
                                if (vulnDetails) {
                                    const index = parseInt(vulnDetails.getAttribute('data-vuln-index'), 10);
                                    focusOnVulnerability(index);
                                }
                                
                                // Stop event propagation to prevent parent elements from handling the click
                                e.stopPropagation();
                            });
                        });
                    });
                </script>
            </head>
            <body>
                <div class="header">
                    <h1>Vulnerabilities</h1>
                    <button id="dismissButton">Dismiss Highlights</button>
                </div>
                <ul>
                    ${vulnerabilityItems}
                </ul>
            </body>
            </html>`;
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
