import * as vscode from 'vscode';
import { Vulnerability } from '../models/types';
import { LoggingService } from './loggingService';

/**
 * Manages editor decorations for highlighting vulnerable code.
 */
export class DecorationManager {
    private readonly errorHighlightDecoration: vscode.TextEditorDecorationType;
    private readonly logger: LoggingService;
    
    // Registry of all active decorations, keyed by UUID
    private decorationRegistry = new Map<string, {
        editor: vscode.TextEditor,
        range: vscode.Range,
        descriptions: string[]
    }>();
    
    // Mapping of editors to their active decoration IDs
    private editorDecorations = new Map<string, Set<string>>();
    
    // Current sequence ID to track the latest operation
    private operationSequence = 0;

    /**
     * Creates a new DecorationManager instance.
     */
    constructor(logger: LoggingService) {
        this.logger = logger;
        this.errorHighlightDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255,0,0,0.3)',
            overviewRulerColor: 'red',
            overviewRulerLane: vscode.OverviewRulerLane.Right,
            after: {
                contentText: ' ',
                color: new vscode.ThemeColor('editorError.foreground'),
                margin: '0 0 0 5px',
            },
            light: {
                backgroundColor: 'rgba(255,0,0,0.3)'
            },
            dark: {
                backgroundColor: 'rgba(255,0,0,0.3)'
            }
        });
    }

    /**
     * Highlights vulnerabilities in the current editor.
     * 
     * @param vulnerabilities The vulnerabilities to highlight
     * @returns The editor with applied decorations
     */
    public highlightVulnerabilities(vulnerabilities: Vulnerability[]): vscode.TextEditor | undefined {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        
        // Clear existing decorations for this editor
        this.dismissHighlightsInEditor(editor);

        // Track this operation with a new sequence ID
        const sequence = ++this.operationSequence;

        // Group vulnerabilities by range
        const vulnerabilitiesByRange = this.groupVulnerabilitiesByRange(vulnerabilities, editor);
        
        // Create decorations and register them
        const decorations: vscode.DecorationOptions[] = [];
        const editorId = this.getEditorId(editor);
        const editorDecorationIds = new Set<string>();
        
        for (const [rangeKey, item] of vulnerabilitiesByRange.entries()) {
            // Generate a unique ID for this decoration
            const decorationId = this.generateUniqueId();
            
            // Create the decoration
            const decorationOption = {
                range: item.range,
                hoverMessage: this.createCombinedHoverMessage(item.descriptions, decorationId)
            };
            
            decorations.push(decorationOption);
            editorDecorationIds.add(decorationId);
            
            // Store in the registry
            this.decorationRegistry.set(decorationId, {
                editor,
                range: item.range,
                descriptions: item.descriptions
            });
            
            this.logger.debug(`Created decoration ${decorationId} for range ${rangeKey}`);
        }
        
        // Only update if this is still the latest operation
        if (sequence === this.operationSequence) {
            // Store the editor's decoration IDs
            this.editorDecorations.set(editorId, editorDecorationIds);
            
            // Apply decorations to the editor
            editor.setDecorations(this.errorHighlightDecoration, decorations);
            this.logger.debug(`Applied ${decorations.length} decorations to editor ${editorId}`);
        }
        
        return editor;
    }

    /**
     * Focuses on a specific vulnerability by highlighting only its affected lines
     * and scrolling to show them.
     * 
     * @param vulnerability The vulnerability to focus on
     */
    public async focusOnVulnerability(vulnerability: Vulnerability): Promise<void> {
        // Dismiss existing highlights first
        this.dismissHighlights();
        
        const vulnId = vulnerability.id || 
            (vulnerability.title ? `"${vulnerability.title}"` : 
            (vulnerability.description ? `desc: "${vulnerability.description.substring(0, 30)}..."` : 'unknown'));
        
        this.logger.info(`Focusing on vulnerability: ${vulnId}`);
        
        if (!vulnerability.lines || vulnerability.lines.length === 0) {
            this.logger.warn(`Vulnerability ${vulnId} has no line information to highlight`);
            return;
        }
        
        // Track this operation with a new sequence ID
        const sequence = ++this.operationSequence;
        
        for (const lineInfo of vulnerability.lines) {
            // Skip node_modules
            if (lineInfo.contract.includes('node_modules')) continue;
            
            try {
                // Find or open the document containing this vulnerability
                await this.openOrFocusDocument(lineInfo.contract);
                
                const editor = vscode.window.activeTextEditor;
                if (!editor) continue;
                
                const document = editor.document;
                const decorations: vscode.DecorationOptions[] = [];
                const editorId = this.getEditorId(editor);
                const editorDecorationIds = new Set<string>();
                
                // Create decorations for this vulnerability
                this.createDecorationsForVulnerability(
                    editor,
                    document,
                    lineInfo.lines,
                    vulnerability.description,
                    decorations,
                    editorDecorationIds
                );
                
                // Only update if this is still the latest operation
                if (sequence === this.operationSequence) {
                    // Store the editor's decoration IDs
                    this.editorDecorations.set(editorId, editorDecorationIds);
                    
                    // Apply decorations
                    editor.setDecorations(this.errorHighlightDecoration, decorations);
                    
                    // Scroll to the first highlighted line
                    if (decorations.length > 0) {
                        editor.revealRange(
                            decorations[0].range, 
                            vscode.TextEditorRevealType.InCenter
                        );
                    }
                }
            } catch (error) {
                this.logger.error('Error focusing on vulnerability:', error);
            }
        }
    }

    /**
     * Creates decorations for a vulnerability's lines.
     */
    private createDecorationsForVulnerability(
        editor: vscode.TextEditor,
        document: vscode.TextDocument,
        lines: number[],
        description: string,
        decorations: vscode.DecorationOptions[],
        editorDecorationIds: Set<string>
    ): void {
        // Group consecutive line numbers
        let startLine = 0;
        let endLine = 0;
        
        lines.forEach((line, index) => {
            if (startLine === 0) {
                startLine = line;
                endLine = line;
            } else if (line === endLine + 1) {
                endLine = line;
            } else {
                this.addDecorationForRange(editor, document, startLine, endLine, 
                    description, decorations, editorDecorationIds);
                startLine = line;
                endLine = line;
            }
            
            // Process the last group
            if (index === lines.length - 1) {
                this.addDecorationForRange(editor, document, startLine, endLine,
                    description, decorations, editorDecorationIds);
            }
        });
    }
    
    /**
     * Adds a decoration for a specific line range.
     */
    private addDecorationForRange(
        editor: vscode.TextEditor,
        document: vscode.TextDocument,
        startLine: number,
        endLine: number,
        description: string,
        decorations: vscode.DecorationOptions[],
        editorDecorationIds: Set<string>
    ): void {
        const range = this.createRange(document, startLine, endLine);
        const decorationId = this.generateUniqueId();
        
        const decorationOption = {
            range,
            hoverMessage: this.createCombinedHoverMessage([description], decorationId)
        };
        
        decorations.push(decorationOption);
        editorDecorationIds.add(decorationId);
        
        // Store in the registry
        this.decorationRegistry.set(decorationId, {
            editor,
            range,
            descriptions: [description]
        });
        
        this.logger.debug(`Created decoration ${decorationId} for range ${startLine}-${endLine}`);
    }

    /**
     * Dismisses a single highlight by its decoration ID.
     */
    public dismissSingleHighlight(decorationId: string): void {
        this.logger.debug(`Trying to dismiss highlight with ID: ${decorationId}`);
        
        if (!decorationId) {
            this.logger.warn("No decoration ID provided for dismissal");
            return;
        }
        
        const decoration = this.decorationRegistry.get(decorationId);
        if (!decoration) {
            this.logger.warn(`No decoration found with ID: ${decorationId}`);
            this.logger.debug("Available decoration IDs:", Array.from(this.decorationRegistry.keys()));
            return;
        }

        const { editor } = decoration;
        const editorId = this.getEditorId(editor);
        
        try {
            // Get all decorations for this editor
            const editorDecorationIds = this.editorDecorations.get(editorId) || new Set<string>();
            
            // Remove this decoration ID
            editorDecorationIds.delete(decorationId);
            
            // Update the editor decorations map
            this.editorDecorations.set(editorId, editorDecorationIds);
            
            // Remove from registry
            this.decorationRegistry.delete(decorationId);
            
            // Refresh all decorations for the editor
            this.refreshEditorDecorations(editor);
            
            this.logger.info(`Successfully dismissed highlight with ID: ${decorationId}`);
        } catch (e) {
            this.logger.error(`Error dismissing highlight: ${e}`);
        }
    }

    /**
     * Dismisses all vulnerability highlights from editors.
     */
    public dismissHighlights(): void {
        // Clear the registry
        this.decorationRegistry.clear();
        this.editorDecorations.clear();
        
        // Increment sequence to cancel any ongoing operations
        ++this.operationSequence;
        
        // Clear decorations from all visible editors
        for (const editor of vscode.window.visibleTextEditors) {
            editor.setDecorations(this.errorHighlightDecoration, []);
        }
        
        this.logger.info("All highlights dismissed");
    }
    
    /**
     * Dismisses all highlights in a specific editor.
     */
    private dismissHighlightsInEditor(editor: vscode.TextEditor): void {
        const editorId = this.getEditorId(editor);
        
        // Get all decoration IDs for this editor
        const editorDecorationIds = this.editorDecorations.get(editorId);
        if (editorDecorationIds) {
            // Remove all these decorations from the registry
            for (const id of editorDecorationIds) {
                this.decorationRegistry.delete(id);
            }
            
            // Clear the editor's decoration IDs
            this.editorDecorations.delete(editorId);
        }
        
        // Clear decorations from the editor
        editor.setDecorations(this.errorHighlightDecoration, []);
        
        this.logger.debug(`Dismissed all highlights in editor ${editorId}`);
    }
    
    /**
     * Refreshes the decorations in an editor based on the current registry state.
     */
    private refreshEditorDecorations(editor: vscode.TextEditor): void {
        const editorId = this.getEditorId(editor);
        const editorDecorationIds = this.editorDecorations.get(editorId);
        
        if (!editorDecorationIds || editorDecorationIds.size === 0) {
            // No decorations for this editor
            editor.setDecorations(this.errorHighlightDecoration, []);
            return;
        }
        
        // Build decoration options from the registry
        const decorations: vscode.DecorationOptions[] = [];
        
        for (const id of editorDecorationIds) {
            const decoration = this.decorationRegistry.get(id);
            if (decoration) {
                decorations.push({
                    range: decoration.range,
                    hoverMessage: this.createCombinedHoverMessage(decoration.descriptions, id)
                });
            }
        }
        
        // Apply decorations
        editor.setDecorations(this.errorHighlightDecoration, decorations);
        this.logger.debug(`Refreshed ${decorations.length} decorations in editor ${editorId}`);
    }
    
    /**
     * Gets a unique ID for an editor.
     */
    private getEditorId(editor: vscode.TextEditor): string {
        return `editor-${editor.document.fileName}`;
    }
    
    /**
     * Generates a unique ID for a decoration.
     */
    private generateUniqueId(): string {
        return `decoration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Groups vulnerabilities by their line range.
     */
    private groupVulnerabilitiesByRange(
        vulnerabilities: Vulnerability[],
        editor: vscode.TextEditor
    ): Map<string, { range: vscode.Range, descriptions: string[] }> {
        const document = editor.document;
        const result = new Map<string, { range: vscode.Range, descriptions: string[] }>();
        
        vulnerabilities.forEach(vuln => {
            vuln.lines?.forEach(lineInfo => {
                if (lineInfo.contract.includes('node_modules')) return; // Skip highlighting for node_modules
                
                if (document.fileName.includes(lineInfo.contract)) {
                    // This vulnerability applies to the current document
                    this.processVulnerabilityLines(document, lineInfo.lines, vuln.description, result);
                }
            });
        });
        
        return result;
    }
    
    /**
     * Processes vulnerability lines and groups them by range.
     */
    private processVulnerabilityLines(
        document: vscode.TextDocument,
        lines: number[],
        description: string,
        result: Map<string, { range: vscode.Range, descriptions: string[] }>
    ): void {
        // Group consecutive line numbers
        let startLine = 0;
        let endLine = 0;
        
        lines.forEach((line, index) => {
            if (startLine === 0) {
                startLine = line;
                endLine = line;
            } else if (line === endLine + 1) {
                endLine = line;
            } else {
                this.addToRangeGroup(document, startLine, endLine, description, result);
                startLine = line;
                endLine = line;
            }
            
            // Process the last group
            if (index === lines.length - 1) {
                this.addToRangeGroup(document, startLine, endLine, description, result);
            }
        });
    }
    
    /**
     * Adds a vulnerability description to the map of decorations grouped by range.
     */
    private addToRangeGroup(
        document: vscode.TextDocument,
        startLine: number,
        endLine: number,
        description: string,
        result: Map<string, { range: vscode.Range, descriptions: string[] }>
    ): void {
        const range = this.createRange(document, startLine, endLine);
        const rangeKey = `${range.start.line}-${range.end.line}`;
        
        if (result.has(rangeKey)) {
            const existing = result.get(rangeKey)!;
            // Only add the description if it doesn't already exist
            if (!existing.descriptions.includes(description)) {
                existing.descriptions.push(description);
            }
        } else {
            result.set(rangeKey, { range, descriptions: [description] });
        }
    }

    /**
     * Creates a range from start and end line numbers.
     */
    private createRange(document: vscode.TextDocument, startLine: number, endLine: number): vscode.Range {
        return new vscode.Range(
            startLine - 1, 0, 
            endLine - 1, document.lineAt(endLine - 1).range.end.character
        );
    }

    /**
     * Creates a combined hover message from multiple descriptions with dismiss buttons.
     */
    private createCombinedHoverMessage(descriptions: string[], decorationId: string): vscode.MarkdownString {
        const hoverMessage = new vscode.MarkdownString();
        
        descriptions.forEach((desc, index) => {
            if (index > 0) {
                hoverMessage.appendMarkdown('\n\n---\n\n');
            }
            hoverMessage.appendMarkdown(desc);
        });
        
        // Add buttons at the end
        hoverMessage.appendMarkdown('\n\n---\n\n');
        
        // Add the dismiss buttons
        hoverMessage.appendMarkdown(`[Dismiss This Highlight](command:solidity-analyzer.dismissSingleHighlight?"${decorationId}") | `);
        hoverMessage.appendMarkdown('[Dismiss All Highlights](command:solidity-analyzer.dismissHighlights)');
        hoverMessage.isTrusted = true; // Enable command links
        
        return hoverMessage;
    }

    /**
     * Opens or focuses an existing editor for a document.
     */
    private async openOrFocusDocument(filename: string): Promise<void> {
        // Find the document
        let document = vscode.workspace.textDocuments.find(doc => 
            doc.fileName.includes(filename)
        );
        
        // Check if the file is already open in an editor tab
        let editorAlreadyOpen = false;
        if (document) {
            for (const editor of vscode.window.visibleTextEditors) {
                if (editor.document === document) {
                    await vscode.window.showTextDocument(editor.document, editor.viewColumn);
                    editorAlreadyOpen = true;
                    break;
                }
            }
        }
        
        // If document doesn't exist or isn't open in a tab
        if (!document || !editorAlreadyOpen) {
            // Try to find the file in the workspace and open it
            const files = await vscode.workspace.findFiles(
                `**/${filename}`, 
                '**/node_modules/**'
            );
            
            if (files.length > 0) {
                document = await vscode.workspace.openTextDocument(files[0]);
                await vscode.window.showTextDocument(document, { preview: false });
            } else {
                this.logger.warn(`Could not find file: ${filename}`);
            }
        }
    }
    
    /**
     * Cleans up resources used by the decoration manager.
     */
    public dispose(): void {
        this.dismissHighlights();
        this.errorHighlightDecoration.dispose();
    }
}
