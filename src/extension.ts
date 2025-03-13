import * as vscode from 'vscode';
import * as path from 'path';
import dotenv from 'dotenv';
import { SolidityAnalyzer } from './services/analyzer';
import { DecorationManager } from './services/decorationManager';
import { WebviewProvider } from './services/webviewProvider';
import { LoggingService } from './services/loggingService';
import { StatusBarService } from './services/statusBarService';
import { Vulnerability, LinterResult } from './models/types';

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
let lastAnalyzedLinterResults: LinterResult[] = [];

/**
 * Activates the Solidity Analyzer extension.
 * This function is called when the extension is activated by VS Code.
 * 
 * @param context The extension context
 */
export function activate(context: vscode.ExtensionContext) {
    // Initialize services
    logger = new LoggingService();
    analyzer = new SolidityAnalyzer(apiURL, apiKey, logger);
    decorationManager = new DecorationManager(logger);
    webviewProvider = new WebviewProvider(logger);
    statusBarService = new StatusBarService(logger);

    logger.info('Solidity Analyzer extension activated');
    
    // Register analysis commands
    const analyzeAllCommand = vscode.commands.registerCommand(
        'extension.analyzeAllSolidityFiles', 
        async () => {
            try {
                statusBarService.showScanning();
                logger.info('Starting analysis of all Solidity files');
                
                const result = await analyzer.analyzeAllSolidityFiles();
                lastAnalyzedVulnerabilities = result.vulnerabilities;
                lastAnalyzedLinterResults = result.linterResults || [];
                
                logger.info(`Analysis complete. Found ${result.vulnerabilities.length} vulnerabilities and ${lastAnalyzedLinterResults.length} linter issues`);
                
                // Update UI components with analysis results
                updateAnalysisResults(result.vulnerabilities, lastAnalyzedLinterResults, context);
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
                
                const result = await analyzer.analyzeCurrentSolidityFile();
                lastAnalyzedVulnerabilities = result.vulnerabilities;
                lastAnalyzedLinterResults = result.linterResults || [];
                
                logger.info(`Analysis complete. Found ${result.vulnerabilities.length} vulnerabilities and ${lastAnalyzedLinterResults.length} linter issues`);
                
                // Update UI components with analysis results
                updateAnalysisResults(result.vulnerabilities, lastAnalyzedLinterResults, context);
            } catch (error) {
                logger.error('Error analyzing current file', error);
                vscode.window.showErrorMessage(`Analysis failed: ${error}`);
                statusBarService.refresh();
            }
        }
    );

    const dismissHighlightsCommand = vscode.commands.registerCommand(
        'solidity-analyzer.dismissHighlights', 
        () => {
            decorationManager.dismissHighlights();
        }
    );
    
    // Fix the command to properly handle the parameter
    const dismissSingleHighlightCommand = vscode.commands.registerCommand(
        'solidity-analyzer.dismissSingleHighlight',
        (decorationId) => {
            console.log("Raw decoration ID received:", decorationId);
            
            // Handle the parameter regardless of how it's passed
            let id = decorationId;
            
            if (Array.isArray(decorationId)) {
                id = decorationId[0];
            } else if (typeof decorationId === 'string') {
                // Try to remove any quotes that might wrap the ID
                id = decorationId.replace(/^["'](.*)["']$/, '$1');
                
                // Try to decode if it's URL encoded
                try {
                    if (id.includes('%')) {
                        id = decodeURIComponent(id);
                    }
                } catch (e) {
                    // If decoding fails, use the original
                    console.error("Error decoding ID:", e);
                }
                
                // Try to parse as JSON if it looks like a JSON string
                try {
                    if (id.startsWith('[') || id.startsWith('{')) {
                        const parsed = JSON.parse(id);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            id = parsed[0];
                        } else if (typeof parsed === 'string') {
                            id = parsed;
                        }
                    }
                } catch (e) {
                    // Not valid JSON, use as is
                    console.log("Not valid JSON, using as is");
                }
            }
            
            console.log(`Final ID to dismiss: ${id}`);
            decorationManager.dismissSingleHighlight(id);
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
        dismissSingleHighlightCommand,
        showOutputCommand,
        fileWatcher,
        { dispose: () => cleanupServices() }
    );
}

/**
 * Updates all UI components with analysis results.
 * 
 * @param vulnerabilities The discovered vulnerabilities
 * @param linterResults The linter issues
 * @param context The extension context
 */
function updateAnalysisResults(
    vulnerabilities: Vulnerability[],
    linterResults: LinterResult[],
    context: vscode.ExtensionContext
): void {
    // Filter vulnerabilities by severity if configured
    const config = vscode.workspace.getConfiguration('solidityAnalyzer');
    const severityFilter = config.get<string[]>('filterSeverity', []);
    
    const filteredVulns = vulnerabilities.filter(vuln => 
        !severityFilter.length || severityFilter.includes(vuln.impact)
    );
    
    // Create webview if there are issues to show
    if (filteredVulns.length > 0 || linterResults.length > 0) {
        webviewProvider.createWebviewPanel(
            filteredVulns,
            linterResults,
            context,
            (vulnerability) => decorationManager.focusOnVulnerability(vulnerability),
            (linterIssue) => decorationManager.focusOnLinterIssue(linterIssue),
            () => decorationManager.dismissHighlights()
        );
        
        // Update decorations
        decorationManager.highlightVulnerabilities(filteredVulns);
        decorationManager.highlightLinterIssues(linterResults);
        
        // Update status bar
        statusBarService.updateVulnerabilityCount(vulnerabilities, linterResults);
    } else if (vulnerabilities.length > 0) {
        vscode.window.showInformationMessage(
            `Found ${vulnerabilities.length} vulnerabilities, but all are filtered out by your current settings.`
        );
    } else if (linterResults.length > 0) {
        vscode.window.showInformationMessage(
            `No vulnerabilities found, but ${linterResults.length} linter issues were detected.`
        );
        
        // Still create the webview for linter issues
        webviewProvider.createWebviewPanel(
            [],
            linterResults,
            context,
            (vulnerability) => decorationManager.focusOnVulnerability(vulnerability),
            (linterIssue) => decorationManager.focusOnLinterIssue(linterIssue),
            () => decorationManager.dismissHighlights()
        );
        
        // Update linter decorations
        decorationManager.highlightLinterIssues(linterResults);
    } else {
        vscode.window.showInformationMessage('No issues found. Great job!');
    }
    
    // Update status bar
    statusBarService.updateVulnerabilityCount(vulnerabilities, linterResults);
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
