import * as vscode from 'vscode';
import * as path from 'path';
import dotenv from 'dotenv';
import { SolidityAnalyzer } from './services/analyzer';
import { DecorationManager } from './services/decorationManager';
import { WebviewProvider } from './services/webviewProvider';
import { LoggingService } from './services/loggingService';
import { StatusBarService } from './services/statusBarService';
import { Vulnerability } from './models/types';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// API configuration
const apiURL = process.env.API_URL || "https://api.iard.solutions/v2/analyze";
const apiKey = process.env.API_KEY || "";

// Create global services
let logger: LoggingService;
let analyzer: SolidityAnalyzer;
let decorationManager: DecorationManager;
let webviewProvider: WebviewProvider;
let statusBarService: StatusBarService;
let lastAnalyzedVulnerabilities: Vulnerability[] = [];

/**
 * Activates the Solidity Analyzer extension.
 * This function is called when the extension is activated by VS Code.
 * 
 * @param context The extension context
 */
export function activate(context: vscode.ExtensionContext) {
    // Initialize services
    logger = new LoggingService();
    analyzer = new SolidityAnalyzer(apiURL, apiKey);
    decorationManager = new DecorationManager();
    webviewProvider = new WebviewProvider();
    statusBarService = new StatusBarService();

    logger.info('Solidity Analyzer extension activated');
    
    // Register analysis commands
    const analyzeAllCommand = vscode.commands.registerCommand(
        'extension.analyzeAllSolidityFiles', 
        async () => {
            try {
                statusBarService.showScanning();
                logger.info('Starting analysis of all Solidity files');
                
                const vulnerabilities = await analyzer.analyzeAllSolidityFiles();
                lastAnalyzedVulnerabilities = vulnerabilities;
                
                logger.info(`Analysis complete. Found ${vulnerabilities.length} vulnerabilities`);
                
                // Update UI components with vulnerabilities
                updateWithVulnerabilities(vulnerabilities, context);
            } catch (error) {
                logger.error('Error analyzing Solidity files', error);
                vscode.window.showErrorMessage(`Analysis failed: ${error}`);
                statusBarService.refresh();
            }
        }
    );

    const analyzeCurrentFileCommand = vscode.commands.registerCommand(
        'extension.analyzeCurrentSolidityFile', 
        async () => {
            try {
                statusBarService.showScanning();
                logger.info('Starting analysis of current Solidity file');
                
                const vulnerabilities = await analyzer.analyzeCurrentSolidityFile();
                lastAnalyzedVulnerabilities = vulnerabilities;
                
                logger.info(`Analysis complete. Found ${vulnerabilities.length} vulnerabilities`);
                
                // Update UI components with vulnerabilities
                updateWithVulnerabilities(vulnerabilities, context);
            } catch (error) {
                logger.error('Error analyzing current file', error);
                vscode.window.showErrorMessage(`Analysis failed: ${error}`);
                statusBarService.refresh();
            }
        }
    );

    const dismissHighlightsCommand = vscode.commands.registerCommand(
        'extension.dismissHighlights', 
        () => {
            logger.debug('Dismissing vulnerability highlights');
            decorationManager.dismissHighlights();
        }
    );

    const showOutputCommand = vscode.commands.registerCommand(
        'extension.showSolidityAnalyzerOutput',
        () => {
            logger.show();
        }
    );

    // Setup file save listener for auto-analysis
    const fileWatcher = vscode.workspace.onDidSaveTextDocument(async (document) => {
        const config = vscode.workspace.getConfiguration('solidityAnalyzer');
        const autoAnalyzeOnSave = config.get<boolean>('autoAnalyzeOnSave', false);
        
        if (autoAnalyzeOnSave && document.languageId === 'solidity') {
            logger.info(`Auto-analyzing saved file: ${document.fileName}`);
            await vscode.commands.executeCommand('extension.analyzeCurrentSolidityFile');
        }
    });

    // Register commands and disposables
    context.subscriptions.push(
        analyzeAllCommand,
        analyzeCurrentFileCommand,
        dismissHighlightsCommand,
        showOutputCommand,
        fileWatcher,
        { dispose: () => cleanupServices() }
    );
}

/**
 * Updates all UI components with vulnerability data.
 */
function updateWithVulnerabilities(vulnerabilities: Vulnerability[], context: vscode.ExtensionContext): void {
    // Filter vulnerabilities by severity if configured
    const config = vscode.workspace.getConfiguration('solidityAnalyzer');
    const severityFilter = config.get<string[]>('filterSeverity', []);
    
    const filteredVulns = vulnerabilities.filter(vuln => 
        !severityFilter.length || severityFilter.includes(vuln.impact)
    );
    
    // Create webview if there are vulnerabilities
    if (filteredVulns.length > 0) {
        webviewProvider.createWebviewPanel(
            filteredVulns,
            context,
            (vulnerability) => decorationManager.focusOnVulnerability(vulnerability),
            () => decorationManager.dismissHighlights()
        );
    } else if (vulnerabilities.length > 0) {
        vscode.window.showInformationMessage(
            `Found ${vulnerabilities.length} vulnerabilities, but all are filtered out by your current settings.`
        );
    } else {
        vscode.window.showInformationMessage('No vulnerabilities found. Great job!');
    }
    
    // Update other services
    decorationManager.highlightVulnerabilities(filteredVulns);
    statusBarService.updateVulnerabilityCount(vulnerabilities);
}

/**
 * Clean up all services when the extension is deactivated.
 */
function cleanupServices(): void {
    logger.info('Cleaning up Solidity Analyzer services');
    decorationManager.dispose();
    statusBarService.dispose();
    logger.dispose();
}

/**
 * This method is called when the extension is deactivated
 */
export function deactivate() {
    cleanupServices();
}
