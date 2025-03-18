import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as path from 'path';
// import * as myExtension from '../extension';

suite('Extension Test Suite', () => {
    // This will run after all tests in this suite
    suiteTeardown(() => {
        vscode.window.showInformationMessage('All tests done!');
    });

    // Ensure extension is activated before running tests
    suiteSetup(async function () {
        this.timeout(30000); // Increase timeout for extension activation

        // Activate the extension explicitly before tests
        const ext = vscode.extensions.getExtension('IARD-Solutions.iards-solidity-analyzer');
        if (ext && !ext.isActive) {
            try {
                await ext.activate();
            } catch (error) {
                console.error('Failed to activate extension:', error);
            }
        }

        // Create a dummy .sol file to trigger extension activation
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            const testFilePath = path.join(workspaceFolders[0].uri.fsPath, 'test.sol');
            const content = 'pragma solidity ^0.8.0;\n\ncontract Test {}\n';

            try {
                const uri = vscode.Uri.file(testFilePath);
                await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));

                // Open the file to ensure the extension activates
                await vscode.window.showTextDocument(uri);
            } catch (error) {
                console.error('Failed to create test Solidity file:', error);
            }
        }
    });

    // Test that the extension was activated properly
    test('Extension should be activated', async function () {
        this.timeout(10000); // Increase timeout for this test

        // The extension should be activated since we are referring to it
        const extension = vscode.extensions.getExtension('IARD-Solutions.iards-solidity-analyzer');
        assert.notStrictEqual(extension, undefined, 'Extension should be available');

        if (extension) {
            // If not active yet, try to activate it
            if (!extension.isActive) {
                await extension.activate();
            }
            assert.strictEqual(extension.isActive, true, 'Extension should be activated');
        }
    });

    // Test that all expected commands are registered
    test('All commands should be registered', async function () {
        this.timeout(10000); // Increase timeout for this test

        // List of commands that should be registered by the extension
        const expectedCommands = [
            'extension.analyzeAllSolidityFiles',
            'extension.analyzeCurrentSolidityFile',
            'extension.dismissHighlights',
            'extension.ignoreLinterRule',
            'extension.showSolidityAnalyzerOutput',
            'extension.showSolidityAnalyzerWelcome',
            'solidity-analyzer.dismissSingleHighlight'
        ];

        // Get all commands
        const allCommands = await vscode.commands.getCommands(true);

        // Check if each expected command is registered
        for (const command of expectedCommands) {
            assert.strictEqual(
                allCommands.includes(command),
                true,
                `Command "${command}" should be registered`
            );
        }
    });

    // Test that extension settings are properly defined
    test('Extension settings should be properly defined', async function () {
        this.timeout(10000); // Increase timeout for this test

        // List of settings that should be defined by the extension
        const expectedSettings = [
            'solidityAnalyzer.analyzeNodeModules',
            'solidityAnalyzer.autoAnalyzeOnSave',
            'solidityAnalyzer.enableLinting',
            'solidityAnalyzer.showExplanations',
            'solidityAnalyzer.showRecommendations',
            'solidityAnalyzer.hideStatusBar',
            'solidityAnalyzer.filterSeverity',
            'solidityAnalyzer.filterLintCategories',
            'solidityAnalyzer.filterLintSeverity',
            'solidityAnalyzer.ignoreRules',
            'solidityAnalyzer.ignorePresets',
            'solidityAnalyzer.logLevel'
        ];

        // Get the extension's configuration
        const config = vscode.workspace.getConfiguration();

        // Check if each expected setting is defined
        for (const setting of expectedSettings) {
            const hasProperty = config.has(setting);
            assert.strictEqual(
                hasProperty,
                true,
                `Setting "${setting}" should be defined`
            );
        }
    });
});
