import * as vscode from 'vscode';
import { Vulnerability } from '../models/types';

/**
 * Manages editor decorations for highlighting vulnerable code.
 */
export class DecorationManager {
    private readonly errorHighlightDecoration: vscode.TextEditorDecorationType;
    private activeEditorWithDecorations?: vscode.TextEditor;

    /**
     * Creates a new DecorationManager instance.
     */
    constructor() {
        this.errorHighlightDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255,0,0,0.3)',
            overviewRulerColor: 'red',
            overviewRulerLane: vscode.OverviewRulerLane.Right,
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

        const decorations: vscode.DecorationOptions[] = [];

        vulnerabilities.forEach(vuln => {
            vuln.lines?.forEach(lineInfo => {
                if (lineInfo.contract.includes('node_modules')) return; // Skip highlighting for node_modules
                
                const document = vscode.workspace.textDocuments.find(doc => 
                    doc.fileName.includes(lineInfo.contract)
                );
                
                if (document) {
                    let startLine = 0;
                    let endLine = 0;
                    
                    lineInfo.lines.forEach((line, index) => {
                        if (startLine === 0) {
                            startLine = line;
                            endLine = line;
                        } else if (line === endLine + 1) {
                            endLine = line;
                        } else {
                            this.addDecoration(document, startLine, endLine, vuln.description, decorations);
                            startLine = line;
                            endLine = line;
                        }
                        
                        if (index === lineInfo.lines.length - 1) {
                            this.addDecoration(document, startLine, endLine, vuln.description, decorations);
                        }
                    });
                }
            });
        });

        editor.setDecorations(this.errorHighlightDecoration, decorations);
        this.activeEditorWithDecorations = editor;
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
        
        if (!vulnerability.lines || vulnerability.lines.length === 0) {
            return;
        }
        
        for (const lineInfo of vulnerability.lines) {
            // Skip node_modules
            if (lineInfo.contract.includes('node_modules')) continue;
            
            // Find or open the document containing this vulnerability
            await this.openOrFocusDocument(lineInfo.contract);
            
            const editor = vscode.window.activeTextEditor;
            if (!editor) continue;
            
            const document = editor.document;
            const decorations: vscode.DecorationOptions[] = [];
            
            // Group consecutive line numbers
            let startLine = 0;
            let endLine = 0;
            
            lineInfo.lines.forEach((line, index) => {
                if (startLine === 0) {
                    startLine = line;
                    endLine = line;
                } else if (line === endLine + 1) {
                    endLine = line;
                } else {
                    this.addDecoration(document, startLine, endLine, vulnerability.description, decorations);
                    startLine = line;
                    endLine = line;
                }
                
                // Process the last group
                if (index === lineInfo.lines.length - 1) {
                    this.addDecoration(document, startLine, endLine, vulnerability.description, decorations);
                }
            });
            
            // Apply decorations
            editor.setDecorations(this.errorHighlightDecoration, decorations);
            
            // Scroll to the first highlighted line
            if (decorations.length > 0) {
                editor.revealRange(
                    decorations[0].range, 
                    vscode.TextEditorRevealType.InCenter
                );
            }
            
            // Store this editor as having decorations
            this.activeEditorWithDecorations = editor;
        }
    }

    /**
     * Dismisses all vulnerability highlights from editors.
     */
    public dismissHighlights(): void {
        // Clear decorations from the active editor if it exists
        if (this.activeEditorWithDecorations) {
            this.activeEditorWithDecorations.setDecorations(this.errorHighlightDecoration, []);
        }

        // Also try to clear from currently active editor
        const currentEditor = vscode.window.activeTextEditor;
        if (currentEditor && currentEditor !== this.activeEditorWithDecorations) {
            currentEditor.setDecorations(this.errorHighlightDecoration, []);
        }
    }

    /**
     * Adds a decoration to the list of decorations.
     */
    private addDecoration(
        document: vscode.TextDocument,
        startLine: number,
        endLine: number,
        description: string,
        decorations: vscode.DecorationOptions[]
    ): void {
        const range = new vscode.Range(
            startLine - 1, 0, 
            endLine - 1, document.lineAt(endLine - 1).range.end.character
        );
        
        decorations.push({
            range,
            hoverMessage: new vscode.MarkdownString(description)
        });
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
