import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Vulnerability, LinterResult } from '../models/types';
import { LoggingService } from './loggingService';

/**
 * Manages the decoration of vulnerabilities and linter issues in the editor.
 */
export class DecorationManager {
    private readonly logger: LoggingService;
    private readonly vulnerabilityDecorations = new Map<string, vscode.TextEditorDecorationType>();
    private readonly linterDecorations = new Map<string, vscode.TextEditorDecorationType>();
    // Store hover messages separately
    private readonly hoverMessages = new Map<string, vscode.MarkdownString>();

    /**
     * Creates a new DecorationManager instance.
     * 
     * @param logger The logging service
     */
    constructor(logger: LoggingService) {
        this.logger = logger;
        this.logger.debug('DecorationManager initialized');
    }

    /**
     * Highlights vulnerabilities in the editor.
     * 
     * @param vulnerabilities The vulnerabilities to highlight
     */
    public highlightVulnerabilities(vulnerabilities: Vulnerability[]): void {
        this.logger.debug(`Highlighting ${vulnerabilities.length} vulnerabilities in editor`); // Changed from info to debug

        for (const vulnerability of vulnerabilities) {
            if (!vulnerability.lines || vulnerability.lines.length === 0) {
                continue;
            }

            this.createVulnerabilityDecoration(vulnerability);
            this.applyDecorationToEditors(vulnerability);
        }
    }

    /**
     * Highlights linter issues in the editor.
     * 
     * @param linterResults The linter issues to highlight
     */
    public highlightLinterIssues(linterResults: LinterResult[]): void {
        this.logger.debug(`Highlighting ${linterResults.length} linter issues in editor`); // Changed from info to debug

        for (const linterResult of linterResults) {
            if (!linterResult.filePath || !linterResult.line) {
                continue;
            }

            this.createLinterDecoration(linterResult);
            this.applyLinterDecorationToEditors(linterResult);
        }
    }

    /**
     * Focuses the editor on a specific vulnerability.
     * 
     * @param vulnerability The vulnerability to focus on
     */
    public focusOnVulnerability(vulnerability: Vulnerability): void {
        if (!vulnerability.lines || vulnerability.lines.length === 0) {
            this.logger.warn(`Cannot focus on vulnerability without line information: ${vulnerability.id || vulnerability.title}`);
            return;
        }

        const firstLocation = vulnerability.lines[0];
        this.logger.debug(`Focusing on vulnerability in file: ${firstLocation.contract} at line ${firstLocation.lines[0]}`); // Changed from info to debug

        // Focus on the file and navigate to the line
        this.openAndFocusFile(firstLocation.contract, firstLocation.lines[0]);
    }

    /**
     * Focuses the editor on a specific linter issue.
     * 
     * @param linterIssue The linter issue to focus on
     */
    public focusOnLinterIssue(linterIssue: LinterResult): void {
        if (!linterIssue.filePath || !linterIssue.line) {
            this.logger.warn(`Cannot focus on linter issue without file or line information: ${linterIssue.ruleId}`);
            return;
        }

        this.logger.debug(`Focusing on linter issue in file: ${linterIssue.filePath} at line ${linterIssue.line}`); // Changed from info to debug

        // Focus on the file and navigate to the line
        this.openAndFocusFile(linterIssue.filePath, linterIssue.line);
    }

    /**
     * Opens a file and focuses on a specific line.
     * 
     * @param filePath The path of the file to open
     * @param line The line number to focus on
     */
    private async openAndFocusFile(filePath: string, line: number): Promise<void> {
        try {
            this.logger.debug(`Attempting to focus on file: ${filePath} at line: ${line}`);
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

            if (!workspaceFolder) {
                this.logger.error('No workspace folder found');
                vscode.window.showErrorMessage('No workspace folder found');
                return;
            }

            // Normalize file path and try various resolution strategies
            let resolvedPath: string | undefined;

            // 1. Try as absolute path
            if (fs.existsSync(filePath)) {
                resolvedPath = filePath;
                this.logger.debug(`File found as absolute path: ${resolvedPath}`);
            }
            // 2. Try resolving relative to workspace
            else if (fs.existsSync(path.join(workspaceFolder.uri.fsPath, filePath))) {
                resolvedPath = path.join(workspaceFolder.uri.fsPath, filePath);
                this.logger.debug(`File found as workspace-relative path: ${resolvedPath}`);
            }
            // 3. Try just the filename in any workspace folder
            else {
                const fileName = path.basename(filePath);
                this.logger.debug(`Searching for filename in workspace: ${fileName}`);

                const files = await vscode.workspace.findFiles(`**/${fileName}`, '**/node_modules/**');
                if (files.length > 0) {
                    resolvedPath = files[0].fsPath;
                    this.logger.debug(`File found by searching workspace: ${resolvedPath}`);
                }
            }

            if (!resolvedPath) {
                this.logger.error(`Could not resolve file path: ${filePath}`);
                vscode.window.showErrorMessage(`Could not find file: ${filePath}`);
                return;
            }

            const uri = vscode.Uri.file(resolvedPath);

            // First check which editors already have this document open,
            // and in which view columns (tab groups) they exist
            type EditorInfo = { editor: vscode.TextEditor; viewColumn: vscode.ViewColumn };
            const existingEditors: EditorInfo[] = [];

            // Gather all editors that have this file open
            for (const editor of vscode.window.visibleTextEditors) {
                if (editor.document.uri.fsPath === uri.fsPath) {
                    existingEditors.push({
                        editor: editor,
                        viewColumn: editor.viewColumn || vscode.ViewColumn.Active
                    });
                    this.logger.debug(`File found in editor in column ${editor.viewColumn}`);
                }
            }

            let editor: vscode.TextEditor;

            if (existingEditors.length > 0) {
                // File is already open in one or more editors, use the first one
                const existingEditor = existingEditors[0];
                this.logger.debug(`Focusing existing editor in column ${existingEditor.viewColumn}`);

                // Show the document in its existing view column
                editor = await vscode.window.showTextDocument(
                    existingEditor.editor.document,
                    {
                        viewColumn: existingEditor.viewColumn,
                        preserveFocus: false,
                        preview: false
                    }
                );
            } else {
                // Not visible in any editor, check if document is already loaded
                let existingDocument: vscode.TextDocument | undefined;
                let existingViewColumn: vscode.ViewColumn | undefined;

                // Find in all available text documents (may be hidden in tabs)
                for (const doc of vscode.workspace.textDocuments) {
                    if (doc.uri.fsPath === uri.fsPath) {
                        existingDocument = doc;

                        // Try to find out which view column this document lives in
                        // This is a bit tricky since hidden docs don't have editors
                        // We'll check for tab groups that might contain this file
                        for (const tabGroup of vscode.window.tabGroups.all) {
                            for (const tab of tabGroup.tabs) {
                                // Check if this tab input matches our document URI
                                if (tab.input instanceof vscode.TabInputText &&
                                    tab.input.uri.fsPath === uri.fsPath) {
                                    // Found the tab! Use its view column
                                    existingViewColumn = tabGroup.viewColumn;
                                    this.logger.debug(`Found existing tab in group ${existingViewColumn}`);
                                    break;
                                }
                            }
                            if (existingViewColumn) break;
                        }

                        break;
                    }
                }

                if (existingDocument) {
                    this.logger.debug(`Document already open but not visible. Using viewColumn: ${existingViewColumn}`);

                    // Show the existing document, using its view column if we found it
                    editor = await vscode.window.showTextDocument(
                        existingDocument,
                        {
                            viewColumn: existingViewColumn || vscode.ViewColumn.Beside, // If we found its view column, use that
                            preserveFocus: false,
                            preview: false
                        }
                    );
                } else {
                    // Document not open at all, open it fresh
                    this.logger.debug('Opening new document');
                    const document = await vscode.workspace.openTextDocument(uri);
                    editor = await vscode.window.showTextDocument(
                        document,
                        {
                            preserveFocus: false,
                            preview: false
                        }
                    );
                }
            }

            // Now we have an editor with our document, set the cursor position
            const targetLine = Math.max(0, line - 1); // Convert to 0-based

            if (targetLine >= editor.document.lineCount) {
                this.logger.warn(`Line ${line} exceeds document length (${editor.document.lineCount} lines)`);
                return;
            }

            // Position at the beginning of the line
            const position = new vscode.Position(targetLine, 0);

            // Give the editor a moment to stabilize
            await new Promise(resolve => setTimeout(resolve, 100));

            // Move cursor to position and reveal in editor
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(
                new vscode.Range(position, position),
                vscode.TextEditorRevealType.InCenter
            );

            // Add temporary highlighting effect for the target line
            this.highlightLineTemporarily(editor, targetLine);

            this.logger.debug(`Successfully focused on line ${targetLine} in ${uri.fsPath}`);
        } catch (error) {
            this.logger.error(`Failed to focus on file: ${error}`);
            vscode.window.showErrorMessage(`Failed to focus on file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Creates a temporary highlight effect for a line when it's focused.
     * 
     * @param editor The text editor to highlight in
     * @param line The line number to highlight
     */
    private highlightLineTemporarily(editor: vscode.TextEditor, line: number): void {
        // Create a temporary decoration type for the flash effect
        const flashDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 255, 0, 0.3)', // Yellow highlight
            isWholeLine: true,
        });

        // Apply the decoration
        const range = editor.document.lineAt(line).range;
        editor.setDecorations(flashDecoration, [{ range }]);

        // Remove the decoration after a short delay
        setTimeout(() => {
            flashDecoration.dispose();
        }, 1500); // Flash for 1.5 seconds
    }

    /**
     * Creates a decoration for a vulnerability.
     * 
     * @param vulnerability The vulnerability to create a decoration for
     * @returns The decoration type
     */
    private createVulnerabilityDecoration(vulnerability: Vulnerability): vscode.TextEditorDecorationType {
        const id = vulnerability.id || `vuln-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        // Return existing decoration if already created
        if (this.vulnerabilityDecorations.has(id)) {
            return this.vulnerabilityDecorations.get(id)!;
        }

        // Create hover message and store it separately
        const hoverMessage = new vscode.MarkdownString();
        hoverMessage.isTrusted = true;
        hoverMessage.appendMarkdown(`### ${vulnerability.title || vulnerability.check}\n\n`);
        hoverMessage.appendMarkdown(`**Impact:** ${vulnerability.impact} | **Confidence:** ${vulnerability.confidence}\n\n`);
        hoverMessage.appendMarkdown(`${vulnerability.description}\n\n`);
        hoverMessage.appendMarkdown(`[Dismiss This](command:solidity-analyzer.dismissSingleHighlight?${encodeURIComponent(JSON.stringify([id]))})`);

        // Store hover message for later use
        this.hoverMessages.set(id, hoverMessage);

        // Create decoration based on impact level - removing borders
        const decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: this.getBackgroundColorForImpact(vulnerability.impact),
            // Remove border properties to prevent borders between lines
            overviewRulerColor: this.getRulerColorForImpact(vulnerability.impact),
            overviewRulerLane: vscode.OverviewRulerLane.Right,
            after: {
                contentText: `  // ${vulnerability.title || vulnerability.check}`,
                color: new vscode.ThemeColor('editorLineNumber.foreground'),
                fontStyle: 'italic'
            },
            isWholeLine: true
        });

        this.vulnerabilityDecorations.set(id, decorationType);
        return decorationType;
    }

    /**
     * Creates a decoration for a linter issue.
     * 
     * @param linterIssue The linter issue to create a decoration for
     * @returns The decoration type
     */
    private createLinterDecoration(linterIssue: LinterResult): vscode.TextEditorDecorationType {
        const id = `lint-${linterIssue.filePath}-${linterIssue.line}-${linterIssue.ruleId}`;

        // Return existing decoration if already created
        if (this.linterDecorations.has(id)) {
            return this.linterDecorations.get(id)!;
        }

        // Create hover message and store it separately
        const hoverMessage = new vscode.MarkdownString();
        hoverMessage.isTrusted = true;
        hoverMessage.appendMarkdown(`### ${linterIssue.ruleId}\n\n`);
        hoverMessage.appendMarkdown(`**Category:** ${linterIssue.category} | **Severity:** ${this.getSeverityText(linterIssue.severity)}\n\n`);
        hoverMessage.appendMarkdown(`${linterIssue.message}\n\n`);
        hoverMessage.appendMarkdown(`[Dismiss This](command:solidity-analyzer.dismissSingleHighlight?${encodeURIComponent(JSON.stringify([id]))})`);

        // Store hover message for later use
        this.hoverMessages.set(id, hoverMessage);

        // Create decoration based on category - removing borders
        const decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: this.getBackgroundColorForCategory(linterIssue.category),
            // Remove border properties to prevent borders between lines
            overviewRulerColor: this.getRulerColorForCategory(linterIssue.category),
            overviewRulerLane: vscode.OverviewRulerLane.Right,
            after: {
                contentText: `  // ${linterIssue.ruleId}: ${linterIssue.message.substring(0, 50)}${linterIssue.message.length > 50 ? '...' : ''}`,
                color: new vscode.ThemeColor('editorLineNumber.foreground'),
                fontStyle: 'italic'
            },
            isWholeLine: true
        });

        this.linterDecorations.set(id, decorationType);
        return decorationType;
    }

    /**
     * Applies vulnerability decorations to all open text editors.
     * 
     * @param vulnerability The vulnerability to apply decorations for
     */
    private applyDecorationToEditors(vulnerability: Vulnerability): void {
        if (!vulnerability.lines) return;

        const id = vulnerability.id || '';
        const decorationType = this.vulnerabilityDecorations.get(id);
        if (!decorationType) return;

        const hoverMessage = this.hoverMessages.get(id);

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return;

        for (const editor of vscode.window.visibleTextEditors) {
            for (const location of vulnerability.lines) {
                const relativePath = this.getRelativePath(editor.document.uri.fsPath, workspaceFolder.uri.fsPath);

                // If this editor contains the file with the vulnerability
                if (relativePath.endsWith(location.contract) || location.contract.endsWith(relativePath)) {
                    const decorationsArray: vscode.DecorationOptions[] = [];

                    // Sort lines to identify consecutive ranges
                    const sortedLines = [...location.lines].sort((a, b) => a - b);

                    // Group consecutive lines
                    let currentRange: { start: number, end: number } | null = null;

                    for (let i = 0; i < sortedLines.length; i++) {
                        const line = sortedLines[i];
                        // Convert from 1-based to 0-based line numbers
                        const lineIndex = Math.max(0, line - 1);

                        // Skip if line is beyond document length
                        if (lineIndex >= editor.document.lineCount) continue;

                        // Start a new range or extend current range
                        if (currentRange === null) {
                            currentRange = { start: lineIndex, end: lineIndex };
                        } else if (lineIndex === currentRange.end + 1) {
                            // Consecutive line, extend the range
                            currentRange.end = lineIndex;
                        } else {
                            // Non-consecutive line, finish current range and start a new one
                            if (currentRange.start <= currentRange.end && currentRange.end < editor.document.lineCount) {
                                // Create decoration for the completed range
                                const rangeStart = editor.document.lineAt(currentRange.start).range.start;
                                const rangeEnd = editor.document.lineAt(currentRange.end).range.end;

                                decorationsArray.push({
                                    range: new vscode.Range(rangeStart, rangeEnd),
                                    hoverMessage: hoverMessage
                                });
                            }

                            // Start a new range
                            currentRange = { start: lineIndex, end: lineIndex };
                        }
                    }

                    // Handle the last range
                    if (currentRange !== null &&
                        currentRange.start <= currentRange.end &&
                        currentRange.end < editor.document.lineCount) {
                        const rangeStart = editor.document.lineAt(currentRange.start).range.start;
                        const rangeEnd = editor.document.lineAt(currentRange.end).range.end;

                        decorationsArray.push({
                            range: new vscode.Range(rangeStart, rangeEnd),
                            hoverMessage: hoverMessage
                        });
                    }

                    if (decorationsArray.length > 0) {
                        editor.setDecorations(decorationType, decorationsArray);
                    }
                }
            }
        }
    }

    /**
     * Applies linter issue decorations to all open text editors.
     * 
     * @param linterIssue The linter issue to apply decorations for
     */
    private applyLinterDecorationToEditors(linterIssue: LinterResult): void {
        if (!linterIssue.filePath || !linterIssue.line) return;

        const id = `lint-${linterIssue.filePath}-${linterIssue.line}-${linterIssue.ruleId}`;
        const decorationType = this.linterDecorations.get(id);
        if (!decorationType) return;

        const hoverMessage = this.hoverMessages.get(id);

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return;

        for (const editor of vscode.window.visibleTextEditors) {
            const relativePath = this.getRelativePath(editor.document.uri.fsPath, workspaceFolder.uri.fsPath);

            // If this editor contains the file with the linter issue
            if (relativePath.endsWith(linterIssue.filePath) || linterIssue.filePath.endsWith(relativePath)) {
                const decorationsArray: vscode.DecorationOptions[] = [];

                // Convert from 1-based to 0-based line number if needed
                const targetLine = Math.max(0, linterIssue.line - 1);

                if (targetLine < editor.document.lineCount) {
                    const lineText = editor.document.lineAt(targetLine);

                    decorationsArray.push({
                        range: lineText.range,
                        hoverMessage: hoverMessage
                    });
                }

                if (decorationsArray.length > 0) {
                    editor.setDecorations(decorationType, decorationsArray);
                }
            }
        }
    }

    /**
     * Dismisses all highlights from the editor.
     */
    public dismissHighlights(): void {
        this.logger.debug('Dismissing all highlights'); // Changed from info to debug

        // Dispose all vulnerability decorations
        for (const decoration of this.vulnerabilityDecorations.values()) {
            decoration.dispose();
        }
        this.vulnerabilityDecorations.clear();

        // Dispose all linter decorations
        for (const decoration of this.linterDecorations.values()) {
            decoration.dispose();
        }
        this.linterDecorations.clear();

        // Clear stored hover messages
        this.hoverMessages.clear();
    }

    /**
     * Dismisses a single highlight from the editor.
     * 
     * @param id The ID of the decoration to dismiss
     */
    public dismissSingleHighlight(id: string): void {
        // Try to dismiss as vulnerability decoration
        const vulnDecoration = this.vulnerabilityDecorations.get(id);
        if (vulnDecoration) {
            this.logger.debug(`Dismissing vulnerability highlight with ID: ${id}`); // Changed from info to debug
            vulnDecoration.dispose();
            this.vulnerabilityDecorations.delete(id);
            this.hoverMessages.delete(id);
            return;
        }

        // Try to dismiss as linter decoration
        const linterDecoration = this.linterDecorations.get(id);
        if (linterDecoration) {
            this.logger.debug(`Dismissing linter highlight with ID: ${id}`); // Changed from info to debug
            linterDecoration.dispose();
            this.linterDecorations.delete(id);
            this.hoverMessages.delete(id);
            return;
        }

        this.logger.warn(`No decoration found with ID: ${id}`);
    }

    /**
     * Cleans up resources when the extension is deactivated.
     */
    public dispose(): void {
        this.dismissHighlights();
    }

    /**
     * Gets the relative path of a file to a base path.
     * 
     * @param filePath The absolute file path
     * @param basePath The base path
     * @returns The relative path
     */
    private getRelativePath(filePath: string, basePath: string): string {
        if (filePath.startsWith(basePath)) {
            return filePath.substring(basePath.length + 1);
        }
        return filePath;
    }

    /**
     * Gets the background color for a vulnerability impact level.
     * 
     * @param impact The impact level
     * @returns The color string
     */
    private getBackgroundColorForImpact(impact: string): string {
        switch (impact.toLowerCase()) {
            case 'critical': return 'rgba(191, 7, 7, 0.2)';
            case 'high': return 'rgba(255, 73, 73, 0.15)';
            case 'medium': return 'rgba(255, 157, 0, 0.15)';
            case 'low': return 'rgba(255, 204, 0, 0.15)';
            case 'optimization': return 'rgba(0, 153, 255, 0.15)';
            case 'informational': return 'rgba(173, 216, 230, 0.15)';
            default: return 'rgba(200, 200, 200, 0.15)';
        }
    }

    /**
     * Gets the border color for a vulnerability impact level.
     * 
     * @param impact The impact level
     * @returns The color string
     */
    private getBorderColorForImpact(impact: string): string {
        switch (impact.toLowerCase()) {
            case 'critical': return 'rgba(191, 7, 7, 0.5)';
            case 'high': return 'rgba(255, 73, 73, 0.5)';
            case 'medium': return 'rgba(255, 157, 0, 0.5)';
            case 'low': return 'rgba(255, 204, 0, 0.5)';
            case 'optimization': return 'rgba(0, 153, 255, 0.5)';
            case 'informational': return 'rgba(173, 216, 230, 0.5)';
            default: return 'rgba(200, 200, 200, 0.5)';
        }
    }

    /**
     * Gets the ruler color for a vulnerability impact level.
     * 
     * @param impact The impact level
     * @returns The color string
     */
    private getRulerColorForImpact(impact: string): string {
        switch (impact.toLowerCase()) {
            case 'critical': return 'rgba(191, 7, 7, 1)';
            case 'high': return 'rgba(255, 73, 73, 1)';
            case 'medium': return 'rgba(255, 157, 0, 1)';
            case 'low': return 'rgba(255, 204, 0, 1)';
            case 'optimization': return 'rgba(0, 153, 255, 1)';
            case 'informational': return 'rgba(173, 216, 230, 1)';
            default: return 'rgba(200, 200, 200, 1)';
        }
    }

    /**
     * Gets the background color for a linter issue category.
     * 
     * @param category The category
     * @returns The color string
     */
    private getBackgroundColorForCategory(category?: string): string {
        if (!category) return 'rgba(200, 200, 200, 0.15)';

        switch (category) {
            case 'Security': return 'rgba(255, 73, 73, 0.15)';
            case 'Gas Consumption': return 'rgba(255, 157, 0, 0.15)';
            case 'Best Practice': return 'rgba(0, 153, 255, 0.15)';
            case 'Style Guide': return 'rgba(138, 43, 226, 0.15)';
            default: return 'rgba(200, 200, 200, 0.15)';
        }
    }

    /**
     * Gets the border color for a linter issue category.
     * 
     * @param category The category
     * @returns The color string
     */
    private getBorderColorForCategory(category?: string): string {
        if (!category) return 'rgba(200, 200, 200, 0.5)';

        switch (category) {
            case 'Security': return 'rgba(255, 73, 73, 0.5)';
            case 'Gas Consumption': return 'rgba(255, 157, 0, 0.5)';
            case 'Best Practice': return 'rgba(0, 153, 255, 0.5)';
            case 'Style Guide': return 'rgba(138, 43, 226, 0.5)';
            default: return 'rgba(200, 200, 200, 0.5)';
        }
    }

    /**
     * Gets the ruler color for a linter issue category.
     * 
     * @param category The category
     * @returns The color string
     */
    private getRulerColorForCategory(category?: string): string {
        if (!category) return 'rgba(200, 200, 200, 1)';

        switch (category) {
            case 'Security': return 'rgba(255, 73, 73, 1)';
            case 'Gas Consumption': return 'rgba(255, 157, 0, 1)';
            case 'Best Practice': return 'rgba(0, 153, 255, 1)';
            case 'Style Guide': return 'rgba(138, 43, 226, 1)';
            default: return 'rgba(200, 200, 200, 1)';
        }
    }

    /**
     * Gets the severity text for a numeric severity level.
     * 
     * @param severity The severity level
     * @returns The severity text
     */
    private getSeverityText(severity: number): string {
        switch (severity) {
            case 0: return "Info";
            case 1: return "Warning";
            case 2: return "Error";
            default: return "Unknown";
        }
    }
}
