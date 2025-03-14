import * as vscode from 'vscode';
import * as path from 'path';
import { LoggingService } from './loggingService';

/**
 * Manages the welcome experience for new users.
 */
export class WelcomeService {
    private readonly logger: LoggingService;
    private readonly context: vscode.ExtensionContext;
    private readonly WELCOME_SHOWN_KEY = 'solidityAnalyzer.welcomeShown';

    /**
     * Creates a new WelcomeService instance.
     * 
     * @param context The extension context
     * @param logger The logging service
     */
    constructor(context: vscode.ExtensionContext, logger: LoggingService) {
        this.context = context;
        this.logger = logger;
        this.logger.debug('WelcomeService initialized');
    }

    /**
     * Shows the welcome experience if this is the first time the extension is used.
     */
    public async showWelcomeExperience(): Promise<void> {
        // Check if welcome has already been shown
        const welcomeShown = this.context.globalState.get<boolean>(this.WELCOME_SHOWN_KEY, false);

        if (!welcomeShown) {
            this.logger.info('Showing welcome experience for first-time user');

            // Mark welcome as shown so it doesn't appear again
            await this.context.globalState.update(this.WELCOME_SHOWN_KEY, true);

            // Show welcome view
            this.showWelcomeView();
        }
    }

    /**
     * Shows the welcome view regardless of whether it has been shown before.
     * This can be called directly as a command.
     */
    public showWelcomeView(): void {
        // Create and show welcome panel
        const panel = vscode.window.createWebviewPanel(
            'solidityAnalyzerWelcome',
            'Welcome to Solidity Analyzer',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(this.context.extensionPath)]
            }
        );

        // Get path to the extension resources
        const extensionPath = this.context.extensionPath;
        const iconPath = panel.webview.asWebviewUri(vscode.Uri.file(
            path.join(extensionPath, 'icon.png')
        ));

        panel.webview.html = this.getWelcomeHtml(iconPath.toString());

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'analyzeCurrentFile':
                        vscode.commands.executeCommand('extension.analyzeCurrentSolidityFile');
                        return;
                    case 'analyzeAllFiles':
                        vscode.commands.executeCommand('extension.analyzeAllSolidityFiles');
                        return;
                    case 'openSettings':
                        vscode.commands.executeCommand('workbench.action.openSettings', 'solidityAnalyzer');
                        return;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    /**
     * Gets the HTML content for the welcome view.
     * 
     * @param iconPath The path to the extension icon
     * @returns The HTML content for the welcome view
     */
    private getWelcomeHtml(iconPath: string): string {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Welcome to Solidity Analyzer</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-foreground);
                        padding: 20px;
                        line-height: 1.6;
                    }
                    .container {
                        max-width: 800px;
                        margin: 0 auto;
                    }
                    h1 {
                        color: var(--vscode-textLink-foreground);
                        font-size: 24px;
                        margin-bottom: 20px;
                    }
                    h2 {
                        font-size: 18px;
                        margin-top: 30px;
                        margin-bottom: 10px;
                        color: var(--vscode-textLink-foreground);
                    }
                    .logo-container {
                        text-align: center;
                        margin-bottom: 20px;
                    }
                    .logo {
                        max-width: 100px;
                        height: auto;
                    }
                    .card {
                        background-color: var(--vscode-editor-background);
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 5px;
                        padding: 15px;
                        margin-bottom: 20px;
                    }
                    .shortcut {
                        display: inline-block;
                        background-color: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                        padding: 2px 8px;
                        border-radius: 3px;
                        font-family: monospace;
                        margin: 0 2px;
                    }
                    .button {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 8px 16px;
                        border-radius: 2px;
                        cursor: pointer;
                        margin-right: 10px;
                        margin-bottom: 10px;
                        font-size: 14px;
                    }
                    .button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    .button-row {
                        margin: 20px 0;
                    }
                    ul {
                        padding-left: 20px;
                    }
                    li {
                        margin-bottom: 10px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="logo-container">
                        <img src="${iconPath}" alt="Solidity Analyzer Logo" class="logo">
                    </div>
                    
                    <h1>Welcome to Solidity Analyzer!</h1>
                    
                    <div class="card">
                        <p>
                            Solidity Analyzer helps you find vulnerabilities, gas optimizations, and best practice issues in your Solidity code.
                        </p>
                    </div>
                    
                    <h2>Getting Started</h2>
                    <ul>
                        <li><strong>Analyze a File:</strong> With a Solidity file open, press <span class="shortcut">Ctrl+Alt+A</span> or use the command palette and select "Solidity Analyzer: Analyze current Solidity file".</li>
                        <li><strong>Analyze All Files:</strong> To scan your entire workspace, press <span class="shortcut">Ctrl+Alt+Shift+A</span> or use the command palette.</li>
                        <li><strong>View Results:</strong> Results will appear in a separate panel, showing vulnerabilities and linter issues.</li>
                        <li><strong>Focus on Issues:</strong> Click "Focus" on any finding to jump directly to the relevant code.</li>
                        <li><strong>Dismiss Highlights:</strong> Press <span class="shortcut">Ctrl+Alt+D</span> to clear all highlighting from your code.</li>
                    </ul>
                    
                    <h2>Keyboard Shortcuts</h2>
                    <ul>
                        <li><span class="shortcut">Ctrl+Alt+A</span> - Analyze current file</li>
                        <li><span class="shortcut">Ctrl+Alt+Shift+A</span> - Analyze all files in workspace</li>
                        <li><span class="shortcut">Ctrl+Alt+D</span> - Dismiss all highlights</li>
                    </ul>
                    
                    <div class="button-row">
                        <button class="button" id="analyzeCurrentBtn">Analyze Current File</button>
                        <button class="button" id="analyzeAllBtn">Analyze All Files</button>
                        <button class="button" id="settingsBtn">Open Settings</button>
                    </div>
                </div>
                
                <script>
                    const vscode = acquireVsCodeApi();
                    
                    document.getElementById('analyzeCurrentBtn').addEventListener('click', () => {
                        vscode.postMessage({ command: 'analyzeCurrentFile' });
                    });
                    
                    document.getElementById('analyzeAllBtn').addEventListener('click', () => {
                        vscode.postMessage({ command: 'analyzeAllFiles' });
                    });
                    
                    document.getElementById('settingsBtn').addEventListener('click', () => {
                        vscode.postMessage({ command: 'openSettings' });
                    });
                </script>
            </body>
            </html>`;
    }
}
