# Solidity Analyzer README

Welcome to the Solidity Analyzer extension for Visual Studio Code. This extension helps you analyze Solidity code for vulnerabilities using the open-source tool Solidity Analyzer.

## Features

- **Security Analysis**: Detect potential vulnerabilities and security issues in Solidity code
- **Code Linting**: Identify style issues, best practices, and gas optimization opportunities
- **Detailed Reports**: View comprehensive analysis with categorized and prioritized issues
- **In-Editor Highlighting**: See issues directly in your code with severity-colored highlights
- **Code Navigation**: Jump directly to problem areas in your codebase
- **Configurable Filters**: Filter results by severity, confidence level, or category
- **Status Bar Integration**: Monitor analysis status and quickly access results

![Solidity Analyzer Example](images/solidity-analyzer-example.png)

## Requirements

- Visual Studio Code version 1.96.0 or higher.
- Node.js 14.0 or higher for some linting features.

## Installation

You can install this extension through the VS Code marketplace:
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Solidity Analyzer"
4. Click Install

## Usage

1. Open a Solidity file or workspace containing Solidity files
2. Use the command palette (Ctrl+Shift+P) and search for "Solidity Analyzer"
3. Select the desired analysis option:
   - `Solidity Analyzer: Analyze Current File` - Analyze only the active Solidity file
   - `Solidity Analyzer: Analyze All Solidity Files` - Analyze all Solidity files in the workspace
4. View results in the editor and detailed panel

### Quick Access
- Click the shield icon in the status bar to analyze the current file
- Configure auto-analysis on save in the extension settings

### Example Workflow
```solidity
// Example vulnerable contract
contract Vulnerable {
    function withdraw(uint amount) public {
        require(amount > 0);
        msg.sender.transfer(amount); // Potential reentrancy vulnerability
    }
}
```

When analyzing this contract, the extension will:
1. Highlight the vulnerable line directly in your editor
2. Show detailed information in the analysis panel
3. Group issues by severity and category

## Troubleshooting

### Common Issues

1. **No issues detected when expected**
   - Check that the solidity file has been saved
   - Verify that no filters are excluding your issues
   - Try analyzing with the "Analyze All Solidity Files" command

2. **Analysis fails with error**
   - Check your internet connection
   - View logs for more details (see Debugging and Logs section)
   - Ensure your contract is compiling

3. **Highlights not showing in editor**
   - Close and reopen the file
   - Restart VS Code
   - Check that the issue location correctly maps to your code

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
- `solidityAnalyzer.filterLintCategories`: Filter linter issues by category (Security, Gas Consumption, Best Practice, Style Guide, Miscellaneous).
- `solidityAnalyzer.filterLintSeverity`: Filter linter issues by severity level (Error, Warning, Info).
- `solidityAnalyzer.enableLinting`: Enable or disable linting functionality (true/false).
- `solidityAnalyzer.lintIgnoreRules`: List of linting rule IDs to ignore (e.g., ["no-unused-vars", "func-visibility"]).
- `solidityAnalyzer.hideStatusBar`: Hide the Solidity Analyzer status bar item.

## Known Issues

Please report any issues you encounter, or any feedback you might have, by email at iard.solutions@gmail.com

## Release Notes

### 0.3.0

- **Enhanced Vulnerability Explanations**: Added detailed explanations for each vulnerability type
  - Access explanations directly in the analysis results panel

- **Actionable Recommendations**: Added specific recommendations for fixing vulnerabilities
  - Get practical suggestions for code improvements

- **Bug Fixes**:
  - Cleanly remove linting issues when deactivited in the settings

### 0.2.5

- Bug fix and documentation update
- Move some logging to DEBUG

### 0.2.4

- Update example image

### 0.2.3

- Update repository location

### 0.2.2

- **Improved Multi-File Analysis**: Now analyzes files in dependency groups for more accurate results
  - Files are grouped based on their import relationships
  - Each group is analyzed separately to improve context
  - Enables more precise detection of cross-contract vulnerabilities

- **Enhanced Result Processing**: Better handling of analysis results across multiple files
  - Fixed linter output parsing for multi-file projects
  - Improved file path resolution in vulnerability reports

- **UI Improvements**: Fixed issues with collapsible sections in results view
  - Properly maintains expansion state of nested sections
  - Fixed inconsistent behavior when expanding/collapsing file sections

- **Logging Enhancements**: Fixed debug level settings and added detailed logs
  - Debug logs now properly respect the configured log level
  - Added more diagnostic information for troubleshooting

### 0.2.1

- **Keyboard Shortcuts Added**: Improve workflow efficiency with keyboard shortcuts
  - `Ctrl+Alt+A` / `Cmd+Alt+A` (Mac) - Analyze current Solidity file
  - `Ctrl+Alt+Shift+A` / `Cmd+Alt+Shift+A` (Mac) - Analyze all Solidity files in workspace
  - `Ctrl+Alt+D` / `Cmd+Alt+D` (Mac) - Dismiss all vulnerability highlights
  
- **Welcome Experience for New Users**: Added a friendly onboarding process
  - First-time users receive a welcome panel with basic instructions
  - Quick-start guide with keyboard shortcuts and main features
  - One-click buttons to analyze files and access settings

### 0.2.0

- **Linting Support**: Added integrated Solidity linter to identify coding standards issues and style violations
- **Enhanced UI**:
  - Redesigned interface with improved organization of issues by severity and category
  - Added color-coded category indicators for better visual classification
  - Improved focus button with visual feedback
- **Bug Fixes**:
  - Fixed vulnerability highlighting to use the most specific line range
  - Improved multi-line highlighting to display as a cohesive block
  - Fixed issue with multiple panels opening on repeated analyses
  - Enhanced file resolution logic for better navigation to issues
- **Status Bar Improvements**:
  - Added detailed tooltips showing breakdown of issues by severity and category
  - Click to re-analyze current file
  - Shows combined count of vulnerabilities and linter issues
- **Performance**: Optimized rendering of large result sets

### 0.1.4

- Updated Logging capabilities

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

