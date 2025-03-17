import * as vscode from 'vscode';
import * as path from 'path';
import dotenv from 'dotenv';
import { SolidityAnalyzer } from './services/analyzer';
import { DecorationManager } from './services/decorationManager';
import { WebviewProvider } from './services/webviewProvider';
import { LoggingService } from './services/loggingService';
import { StatusBarService } from './services/statusBarService';
import { WelcomeService } from './services/welcomeService';
import { Vulnerability, LinterResult } from './models/types';
import { RULE_PRESETS } from './config/linterRulePresets';

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
let welcomeService: WelcomeService;
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
    welcomeService = new WelcomeService(context, logger);

    logger.info('Solidity Analyzer extension activated');

    // Show welcome experience for first-time users
    welcomeService.showWelcomeExperience();

    // Register the show welcome command
    const showWelcomeCommand = vscode.commands.registerCommand(
        'extension.showSolidityAnalyzerWelcome',
        () => welcomeService.showWelcomeView()
    );

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
                logger.info('Starting analysis of current or last active Solidity file');

                // Check if we have an active editor with a Solidity file
                const activeEditor = vscode.window.activeTextEditor;
                let activeDocument: vscode.TextDocument | undefined = activeEditor?.document;

                // If no active document or not a Solidity file, try to find a Solidity document
                if (!activeDocument || activeDocument.languageId !== 'solidity') {
                    logger.info('No active Solidity editor, looking for Solidity documents');

                    // Check all open documents for Solidity files
                    const allDocs = vscode.workspace.textDocuments.filter(doc => doc.languageId === 'solidity');

                    if (allDocs.length > 0) {
                        activeDocument = allDocs[0];
                        logger.info(`Found Solidity document: ${activeDocument.fileName}`);
                    } else {
                        logger.warn('No Solidity documents found, cannot analyze');
                        vscode.window.showWarningMessage('No Solidity files found to analyze');
                        statusBarService.refresh();
                        return;
                    }
                }

                // Store the current file path for analysis
                const fileToAnalyze = activeDocument.uri;
                logger.info(`Preparing to analyze file: ${fileToAnalyze.fsPath}`);

                // Analyze the document directly instead of relying on the active editor
                // Modify analyzer.analyzeCurrentSolidityFile to accept a document parameter
                const result = await analyzer.analyzeSolidityDocument(activeDocument);

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

    // Command to ignore a specific linter rule
    const ignoreLinterRuleCommand = vscode.commands.registerCommand(
        'extension.ignoreLinterRule',
        async (ruleId?: string) => {
            try {
                // If ruleId is not provided directly, show a dropdown with all rules
                if (!ruleId) {
                    const allRules = getSolhintRulesList();
                    const selectedRule = await vscode.window.showQuickPick(
                        allRules.map(rule => ({
                            label: rule.id,
                            description: rule.category,
                            detail: rule.description || 'No description available'
                        })),
                        { placeHolder: 'Select a linter rule to ignore' }
                    );

                    if (!selectedRule) return;
                    ruleId = selectedRule.label;
                }

                // Add the rule to the ignored rules list in settings
                const config = vscode.workspace.getConfiguration('solidityAnalyzer');
                const currentIgnoredRules = config.get<string[]>('lintIgnoreRules', []);

                if (!currentIgnoredRules.includes(ruleId)) {
                    currentIgnoredRules.push(ruleId);
                    await config.update('lintIgnoreRules', currentIgnoredRules, vscode.ConfigurationTarget.Workspace);

                    // Show a notification with an Undo button
                    const undoAction = 'Undo';
                    vscode.window.showInformationMessage(
                        `Added "${ruleId}" to ignored linter rules`,
                        undoAction
                    ).then(async selection => {
                        if (selection === undoAction) {
                            // Remove the rule from ignored rules if Undo is clicked
                            const updatedRules = currentIgnoredRules.filter(rule => rule !== ruleId);
                            await config.update('lintIgnoreRules', updatedRules, vscode.ConfigurationTarget.Workspace);
                            vscode.window.showInformationMessage(`Removed "${ruleId}" from ignored linter rules`);

                            // If the webview panel exists, tell it to restore the rule
                            if (WebviewProvider.currentPanel) {
                                WebviewProvider.currentPanel.webview.postMessage({
                                    command: 'ruleRestored',
                                    ruleId: ruleId
                                });
                            }
                        }
                    });

                    // Instead of re-analyzing, send a message to the webview to update the UI
                    if (WebviewProvider.currentPanel) {
                        WebviewProvider.currentPanel.webview.postMessage({
                            command: 'ruleIgnored',
                            ruleId: ruleId
                        });
                    }
                } else {
                    vscode.window.showInformationMessage(`Rule "${ruleId}" was already in the ignore list`);
                }
            } catch (error) {
                logger.error('Error ignoring linter rule', error);
                vscode.window.showErrorMessage(`Failed to ignore rule: ${error}`);
            }
        }
    );

    // Register the new command
    context.subscriptions.push(ignoreLinterRuleCommand);

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
        showWelcomeCommand,
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

    // Filter linter results by category, severity, and ignored rules
    const enableLinting = config.get<boolean>('enableLinting', true);
    let filteredLinterResults = linterResults;

    if (enableLinting) {
        const categoryFilter = config.get<string[]>('filterLintCategories', []);
        const severityFilter = config.get<string[]>('filterLintSeverity', []);
        const ignoreRules = config.get<string[]>('lintIgnoreRules', []);
        const ignorePresets = config.get<string[]>('lintIgnorePresets', []);

        // Build a complete list of rules to ignore, including from presets
        const allIgnoredRules = [...ignoreRules];

        // Add rules from selected presets using the imported RULE_PRESETS
        ignorePresets.forEach(presetName => {
            if (RULE_PRESETS[presetName]) {
                allIgnoredRules.push(...RULE_PRESETS[presetName]);
            }
        });

        filteredLinterResults = linterResults.filter(result => {
            // Filter by category
            if (categoryFilter.length && result.category && !categoryFilter.includes(result.category)) {
                return false;
            }

            // Filter by severity
            const severityText = result.severity === 2 ? 'Error' :
                result.severity === 1 ? 'Warning' : 'Info';
            if (severityFilter.length && !severityFilter.includes(severityText)) {
                return false;
            }

            // Filter by ignored rules
            if (allIgnoredRules.includes(result.ruleId)) {
                return false;
            }

            return true;
        });
    } else {
        filteredLinterResults = []; // Disable linting completely
    }

    // Create webview if there are issues to show
    if (filteredVulns.length > 0 || filteredLinterResults.length > 0) {
        webviewProvider.createWebviewPanel(
            filteredVulns,
            filteredLinterResults,
            context,
            (vulnerability) => decorationManager.focusOnVulnerability(vulnerability),
            (linterIssue) => decorationManager.focusOnLinterIssue(linterIssue),
            () => decorationManager.dismissHighlights()
        );

        // Update decorations
        decorationManager.highlightVulnerabilities(filteredVulns);
        decorationManager.highlightLinterIssues(filteredLinterResults);

        // Update status bar
        statusBarService.updateVulnerabilityCount(vulnerabilities, filteredLinterResults);
    } else if (vulnerabilities.length > 0) {
        vscode.window.showInformationMessage(
            `Found ${vulnerabilities.length} vulnerabilities, but all are filtered out by your current settings.`
        );
    } else if (filteredLinterResults.length > 0) {
        vscode.window.showInformationMessage(
            `No vulnerabilities found, but ${filteredLinterResults.length} linter issues were detected.`
        );

        // Still create the webview for linter issues
        webviewProvider.createWebviewPanel(
            [],
            filteredLinterResults,
            context,
            (vulnerability) => decorationManager.focusOnVulnerability(vulnerability),
            (linterIssue) => decorationManager.focusOnLinterIssue(linterIssue),
            () => decorationManager.dismissHighlights()
        );

        // Update linter decorations
        decorationManager.highlightLinterIssues(filteredLinterResults);
    } else {
        vscode.window.showInformationMessage('No issues found. Great job!');
    }

    // Update status bar
    statusBarService.updateVulnerabilityCount(vulnerabilities, filteredLinterResults);
}

/**
 * Get a list of all Solhint rules with their categories and descriptions.
 * This could be enhanced in the future to pull from official documentation.
 */
function getSolhintRulesList(): Array<{ id: string, category: string, description?: string }> {
    // This is a simplified version but could be enhanced with more detailed descriptions
    return Object.entries(require('./utils/vulnerabilityProcessor').solhintCategories)
        .map(([id, category]) => ({
            id,
            category: String(category)
        }));
}

/**
 * Clean up all services when the extension is deactivated.
 */
function cleanupServices(): void {
    logger.debug('Cleaning up Solidity Analyzer services'); // Changed from info to debug
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
