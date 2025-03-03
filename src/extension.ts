import * as vscode from 'vscode';
import * as path from 'path';
import dotenv from 'dotenv';
import { SolidityAnalyzer } from './services/analyzer';
import { DecorationManager } from './services/decorationManager';
import { WebviewProvider } from './services/webviewProvider';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// API configuration
const apiURL = process.env.API_URL || "https://api.iard.solutions/v2/analyze";
const apiKey = process.env.API_KEY || "";

/**
 * Activates the Solidity Analyzer extension.
 * This function is called when the extension is activated by VS Code.
 * 
 * @param context The extension context
 */
export function activate(context: vscode.ExtensionContext) {
    const analyzer = new SolidityAnalyzer(apiURL, apiKey);
    const decorationManager = new DecorationManager();
    const webviewProvider = new WebviewProvider();

    // Register command to analyze all Solidity files
    const analyzeAllCommand = vscode.commands.registerCommand(
        'extension.analyzeAllSolidityFiles', 
        async () => {
            try {
                const vulnerabilities = await analyzer.analyzeAllSolidityFiles();
                
                // Create webview to display results
                webviewProvider.createWebviewPanel(
                    vulnerabilities,
                    context,
                    (vulnerability) => decorationManager.focusOnVulnerability(vulnerability),
                    () => decorationManager.dismissHighlights()
                );
                
                // Highlight vulnerabilities in the editor
                decorationManager.highlightVulnerabilities(vulnerabilities);
            } catch (error) {
                vscode.window.showErrorMessage(`${error}`);
            }
        }
    );

    // Register command to analyze the current Solidity file
    const analyzeCurrentFileCommand = vscode.commands.registerCommand(
        'extension.analyzeCurrentSolidityFile', 
        async () => {
            try {
                const vulnerabilities = await analyzer.analyzeCurrentSolidityFile();
                
                // Create webview to display results
                webviewProvider.createWebviewPanel(
                    vulnerabilities,
                    context,
                    (vulnerability) => decorationManager.focusOnVulnerability(vulnerability),
                    () => decorationManager.dismissHighlights()
                );
                
                // Highlight vulnerabilities in the editor
                decorationManager.highlightVulnerabilities(vulnerabilities);
            } catch (error) {
                vscode.window.showErrorMessage(`${error}`);
            }
        }
    );

    // Register command to dismiss vulnerability highlights
    const dismissHighlightsCommand = vscode.commands.registerCommand(
        'extension.dismissHighlights', 
        () => decorationManager.dismissHighlights()
    );

    // Add commands to subscriptions
    context.subscriptions.push(analyzeAllCommand);
    context.subscriptions.push(analyzeCurrentFileCommand);
    context.subscriptions.push(dismissHighlightsCommand);
    
    // Make sure the decoration manager is disposed when the extension is deactivated
    context.subscriptions.push({ dispose: () => decorationManager.dispose() });
}

/**
 * This method is called when the extension is deactivated
 */
export function deactivate() {
    // Resources are cleaned up through the context subscriptions
}
