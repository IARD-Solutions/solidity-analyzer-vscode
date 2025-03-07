# Solidity Analyzer README

Welcome to the Solidity Analyzer extension for Visual Studio Code. This extension helps you analyze Solidity code for vulnerabilities using the open-source tool Solidity Analyzer.

## Features

- Analyze all Solidity files in the current workspace.
- Analyze the currently open Solidity file.
- Highlight vulnerabilities directly in the code editor.
- Display detailed analysis results in a webview panel.
- Dismiss individual vulnerability highlights.
- Status bar information about analysis progress.

![Solidity Analyzer Example](images/solidity-analyzer-example.png)

## Requirements

- Visual Studio Code version 1.96.0 or higher.

## Installation

You can install this extension through the VS Code marketplace:
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Solidity Analyzer"
4. Click Install

## Usage

1. Open a Solidity file or workspace containing Solidity files
2. Use the command palette (Ctrl+Shift+P) and search for "Solidity Analyzer"
3. Select the desired analysis option
4. View results in the editor and detailed panel

## Debugging and Logs

If you encounter any issues with the extension, you can access the logs via the Output Panel:

- Go to View → Output (or press Ctrl+Shift+U)
- Select "Solidity Analyzer" from the dropdown menu at the top of the Output panel

The log level can be configured in the extension settings (`solidityAnalyzer.logLevel`).

## Extension Settings

This extension contributes the following settings:

- `solidityAnalyzer.analyzeNodeModules`: Enable/disable analysis of Solidity files in the `node_modules` folder.
- `solidityAnalyzer.logLevel`: Set the logging level for the extension (`debug`, `info`, `warn`, `error`).
- `solidityAnalyzer.autoAnalyzeOnSave`: Automatically run analysis when saving Solidity files.
- `solidityAnalyzer.filterSeverity`: Show vulnerabilities with selected severity levels (Critical, High, Medium, Low, Informational, Optimization).
- `solidityAnalyzer.highlightColors`: Custom highlight colors for different vulnerability severities.
- `solidityAnalyzer.hideStatusBar`: Hide the Solidity Analyzer status bar item.

## Known Issues

Please report any issues you encounter, or any feedback you might have, by email at iard.solutions@gmail.com

## Release Notes

### 0.1.3

- Added better highlight handling
- Enhanced interface webview

### 0.1.2

- Added "Dismiss highlights" functionality
- Implemented logging
- Added status bar integration

### 0.1.1

- Added extension logo

### 0.1.0

- Bug fixes and stability improvements

### 0.0.1

- Initial release of Solidity Analyzer.

