import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { DecorationManager } from '../../services/decorationManager';
import { LoggingService } from '../../services/loggingService';
import { Category } from '../../models/types'; // Import the Category type

suite('Solidity Analyzer - Decoration Manager', () => {
    // Create sandbox for stubs
    const sandbox = sinon.createSandbox();

    // Create mock instances
    let logger: LoggingService;
    let decorationManager: DecorationManager;

    // Mocked editor and document
    let mockEditor: vscode.TextEditor;
    let mockDocument: vscode.TextDocument;

    // Sample vulnerability and linter issue for testing
    const sampleVulnerability = {
        id: "test-vuln-1",
        title: "Test Vulnerability",
        check: "test-check",
        impact: "Critical",
        confidence: "High",
        description: "Test vulnerability description",
        lines: [
            {
                contract: "test.sol",
                lines: [1, 2, 3]
            }
        ]
    };

    // Fixed: properly type the category as Category enum value
    const sampleLinterIssue = {
        filePath: "test.sol",
        line: 5,
        column: 1,
        severity: 2,
        ruleId: "test-rule",
        message: "Test linter message",
        category: "Security" as Category // Cast to Category type
    };

    setup(() => {
        // Create stub for logger
        logger = {
            debug: sandbox.stub(),
            info: sandbox.stub(),
            warn: sandbox.stub(),
            error: sandbox.stub(),
            show: sandbox.stub(),
            dispose: sandbox.stub()
        } as unknown as LoggingService;

        // Create instance of DecorationManager with stubbed logger
        decorationManager = new DecorationManager(logger);

        // Create stubs for VS Code APIs
        mockDocument = {
            uri: vscode.Uri.file('/workspace/test.sol'),
            fileName: '/workspace/test.sol',
            lineCount: 10,
            lineAt: sandbox.stub().returns({
                text: 'contract Test {}',
                range: new vscode.Range(0, 0, 0, 16)
            }),
            getText: sandbox.stub().returns('contract Test {}')
        } as unknown as vscode.TextDocument;

        mockEditor = {
            document: mockDocument,
            setDecorations: sandbox.stub(),
            revealRange: sandbox.stub(),
            selection: new vscode.Selection(0, 0, 0, 0),
            options: {}
        } as unknown as vscode.TextEditor;

        // Stub the window.visibleTextEditors
        sandbox.stub(vscode.window, 'visibleTextEditors').value([mockEditor]);

        // Stub workspace folders
        sandbox.stub(vscode.workspace, 'workspaceFolders').value([
            { uri: vscode.Uri.file('/workspace'), name: 'workspace', index: 0 }
        ]);
    });

    teardown(() => {
        // Clean up stubs and spies
        sandbox.restore();

        // Clean up decoration manager
        decorationManager.dispose();
    });

    test('Should create vulnerability decorations', () => {
        // Call the method
        decorationManager.highlightVulnerabilities([sampleVulnerability]);

        // Verify setDecorations was called
        assert.ok(
            (mockEditor.setDecorations as sinon.SinonStub).called,
            'Editor.setDecorations should be called for vulnerability highlighting'
        );
    });

    test('Should create linter issue decorations', () => {
        // Call the method
        decorationManager.highlightLinterIssues([sampleLinterIssue]);

        // Verify setDecorations was called
        assert.ok(
            (mockEditor.setDecorations as sinon.SinonStub).called,
            'Editor.setDecorations should be called for linter highlighting'
        );
    });

    test('Should dismiss decorations on command', () => {
        // First highlight something
        decorationManager.highlightVulnerabilities([sampleVulnerability]);
        decorationManager.highlightLinterIssues([sampleLinterIssue]);

        // Reset the stub to check for new calls
        (mockEditor.setDecorations as sinon.SinonStub).resetHistory();

        // Call dismiss method
        decorationManager.dismissHighlights();

        // Check that logger was called with debug message
        assert.ok(
            (logger.debug as sinon.SinonStub).calledWith('Dismissing all highlights'),
            'Logger should log the action'
        );
    });

    test('Should dismiss a single highlight', () => {
        // First highlight something
        decorationManager.highlightVulnerabilities([sampleVulnerability]);

        // Reset stubs
        (mockEditor.setDecorations as sinon.SinonStub).resetHistory();

        // Call dismissSingleHighlight
        decorationManager.dismissSingleHighlight(sampleVulnerability.id);

        // Check that logger was called with debug message
        assert.ok(
            (logger.debug as sinon.SinonStub).calledWith(
                sinon.match(`Dismissing vulnerability highlight with ID: ${sampleVulnerability.id}`)
            ),
            'Logger should log the action'
        );
    });

    test('Should focus on vulnerability', () => {
        // Stub window.showTextDocument
        const showTextDocumentStub = sandbox.stub(vscode.window, 'showTextDocument')
            .resolves(mockEditor);

        // Stub workspace.openTextDocument
        sandbox.stub(vscode.workspace, 'openTextDocument').resolves(mockDocument);

        // Stub workspace.findFiles
        sandbox.stub(vscode.workspace, 'findFiles').resolves([vscode.Uri.file('/workspace/test.sol')]);

        // Call focusOnVulnerability
        decorationManager.focusOnVulnerability(sampleVulnerability);

        // Wait for async operations
        return new Promise<void>(resolve => {
            setTimeout(() => {
                // Verify showTextDocument was called
                assert.ok(showTextDocumentStub.called, 'showTextDocument should be called to focus file');
                resolve();
            }, 200);
        });
    });
});
