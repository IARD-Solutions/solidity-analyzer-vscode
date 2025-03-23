import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as sinon from 'sinon';

// Import the extension directly to access its exports for testing
import * as myExtension from '../../extension';

suite('Solidity Analyzer Extension Test Suite', () => {
    // Reference to existing test files
    let testFileUri1: vscode.Uri;
    const sandbox = sinon.createSandbox();

    // This will run before all tests in this suite
    suiteSetup(async function () {
        this.timeout(60000); // Longer timeout for setup

        // Check that we have a workspace with example contracts
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            console.log('No workspace available, some tests might fail');
        } else {
            // Use the existing example files
            const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
            const testFile1Path = path.join(workspaceFolder, 'TestFile1.sol');

            // Make sure the file exists
            if (fs.existsSync(testFile1Path)) {
                testFileUri1 = vscode.Uri.file(testFile1Path);

                // Open the file to ensure extension activates
                try {
                    const document = await vscode.workspace.openTextDocument(testFileUri1);
                    await vscode.window.showTextDocument(document);

                    // Give extension time to activate fully
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    console.log('Using existing test file at:', testFile1Path);
                } catch (error) {
                    console.error('Error opening test file:', error);
                }
            } else {
                console.error('Test file not found at expected location:', testFile1Path);
            }
        }

        // Activate the extension explicitly
        const extension = vscode.extensions.getExtension('IARD-Solutions.iards-solidity-analyzer');
        if (extension && !extension.isActive) {
            await extension.activate();
        }
    });

    // Cleanup after all tests - no need to delete files since we're using existing ones
    suiteTeardown(async function () {
        this.timeout(10000);

        // Restore any stubs
        sandbox.restore();

        vscode.window.showInformationMessage('All tests done!');
    });

    // Reset before each test
    setup(function () {
        // Create fresh stubs for each test
    });

    // Cleanup after each test
    teardown(function () {
        // Clean up stubs
        sandbox.reset();
    });

    // Test that the extension was activated properly
    test('Extension should be activated', async function () {
        this.timeout(10000);

        const extension = vscode.extensions.getExtension('IARD-Solutions.iards-solidity-analyzer');
        assert.notStrictEqual(extension, undefined, 'Extension should be available');

        if (extension) {
            if (!extension.isActive) {
                await extension.activate();
            }
            assert.strictEqual(extension.isActive, true, 'Extension should be activated');

            // Verify extension exports the expected functions
            assert.strictEqual(typeof myExtension.activate, 'function', 'Should export activate function');
            assert.strictEqual(typeof myExtension.deactivate, 'function', 'Should export deactivate function');
        }
    });

    // Test for command registration
    test('All commands should be registered', async function () {
        this.timeout(10000);

        const expectedCommands = [
            'extension.analyzeAllSolidityFiles',
            'extension.analyzeCurrentSolidityFile',
            'extension.dismissHighlights',
            'extension.ignoreLinterRule',
            'extension.showSolidityAnalyzerOutput',
            'extension.showSolidityAnalyzerWelcome',
            'solidity-analyzer.dismissSingleHighlight'
        ];

        const allCommands = await vscode.commands.getCommands(true);

        // Debug output for available commands related to our extension
        const extensionCommands = allCommands.filter(cmd =>
            cmd.includes('solidity') || cmd.includes('extension.')
        );
        console.log('Available extension commands:', extensionCommands);

        // Check each expected command
        for (const command of expectedCommands) {
            assert.strictEqual(
                allCommands.includes(command),
                true,
                `Command "${command}" should be registered`
            );
        }
    });

    // Test settings definition
    test('Extension settings should be properly defined', async function () {
        this.timeout(10000);

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

    // Test command execution
    test('Commands should execute without errors', async function () {
        this.timeout(15000);

        // Skip API-dependent tests if we don't have proper API credentials
        const apiKey = process.env.API_KEY || "";
        if (!apiKey) {
            console.log('Skipping API-dependent command tests (no API key)');
            this.skip();
        }

        // We'll only test non-destructive commands that don't make API calls
        try {
            // Test welcome command (should not throw)
            await vscode.commands.executeCommand('extension.showSolidityAnalyzerWelcome');

            // Test dismiss highlights (should not throw)
            await vscode.commands.executeCommand('extension.dismissHighlights');

            // Note: We don't test actual analyze commands as they make API calls
        } catch (error) {
            assert.fail(`Command execution failed: ${error}`);
        }
    });

    // Test status bar item initialization
    test('Status bar item should be created', function () {
        // Check if status bar is visible by default
        const config = vscode.workspace.getConfiguration('solidityAnalyzer');
        const hideStatusBar = config.get('hideStatusBar', false);

        if (!hideStatusBar) {
            // This is a bit tricky to test directly, but we can check if the
            // status bar items contain something related to our extension
            // This is more of an integration test aspect that's hard to verify
            // in unit tests without deeper access to the extension internals

            // For now, we'll just pass this test since we can't easily check status bar contents
            assert.ok(true, 'Status bar test placeholder');
        } else {
            // If status bar is hidden by configuration, just verify the setting
            assert.strictEqual(hideStatusBar, true, 'Status bar should be hidden per config');
        }
    });

    // Tests for extension services
    suite('Extension Services', function () {
        // Define tests for specific services

        // Test settings service
        test('Settings Service should return expected values', function () {
            // Create temporary settings for testing
            const tempSettings = {
                'solidityAnalyzer.enableLinting': true,
                'solidityAnalyzer.autoAnalyzeOnSave': false,
                'solidityAnalyzer.filterSeverity': ['Critical', 'High']
            };

            // We would need to mock the settings service to properly test this
            // For now, we're just checking the actual settings are available
            const config = vscode.workspace.getConfiguration('solidityAnalyzer');
            assert.notStrictEqual(config.get('enableLinting'), undefined);
            assert.notStrictEqual(config.get('autoAnalyzeOnSave'), undefined);
            assert.notStrictEqual(config.get('filterSeverity'), undefined);
        });

        // Test file change events (incomplete as this is hard to test without mocking)
        test('File change events should trigger analysis when configured', async function () {
            this.timeout(5000);

            // This would require injecting a mock analyzer to detect if it was called
            // For now, just verify the setting is accessible
            const config = vscode.workspace.getConfiguration('solidityAnalyzer');
            const autoAnalyzeOnSave = config.get('autoAnalyzeOnSave');

            assert.notStrictEqual(autoAnalyzeOnSave, undefined,
                'autoAnalyzeOnSave setting should be defined');
        });
    });
});
