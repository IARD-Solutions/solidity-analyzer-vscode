import * as vscode from 'vscode';
import dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const apiURL = process.env.API_URL || "https://api.iard.solutions/v2/analyze";
//const apiURL = process.env.API_URL || "https://39a6f5b7-dad1-4ec7-8f85-8f91c97d650b-00-3jyz30ougo887.riker.replit.dev/v2/analyze";

interface Vulnerability {
	check: string;
	description: string;
	impact: "Critical" | "High" | "Medium" | "Low" | "Informational" | string;
	confidence: "High" | "Medium" | "Low" | string;
	lines?: { contract: string, lines: number[] }[];
}

interface ApiResponse {
	result: Vulnerability[];
}

const errorHighlightDecoration = vscode.window.createTextEditorDecorationType({
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

/**
 * Activates the Solidity Analyzer extension.
 * 
 * @param context - The extension context provided by VSCode.
 * 
 * Registers two commands:
 * 1. `extension.analyzeAllSolidityFiles`: Analyzes all Solidity files in the workspace.
 * 2. `extension.analyzeCurrentSolidityFile`: Analyzes the currently open Solidity file.
 * 
 * The analysis results are fetched from an external API and displayed in a webview panel.
 * 
 * The `analyzeAllSolidityFiles` command:
 * - Checks if a workspace folder is open.
 * - Finds all Solidity files in the workspace, excluding those in `node_modules`.
 * - Reads the content of each Solidity file and sends it to the API for analysis.
 * - Displays the analysis results in a webview panel.
 * 
 * The `analyzeCurrentSolidityFile` command:
 * - Checks if the current file is a Solidity file.
 * - Reads the content of the current Solidity file and its imports (excluding those from `node_modules`).
 * - Sends the content to the API for analysis.
 * - Displays the analysis results in a webview panel.
 * 
 * If any errors occur during the analysis, an error message is shown to the user.
 */
export function activate(context: vscode.ExtensionContext) {
	let analyzeAllCommand = vscode.commands.registerCommand('extension.analyzeAllSolidityFiles', async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

			if (!workspaceFolder) {
				vscode.window.showErrorMessage('Please open a workspace folder containing the Solidity files.');
				return;
			}

			const solidityFiles = await vscode.workspace.findFiles('**/*.sol', '**/node_modules/**');

			if (solidityFiles.length === 0) {
				vscode.window.showErrorMessage('No Solidity files found in the workspace.');
				return;
			}

			const codeObject: { [key: string]: any } = {};

			for (const file of solidityFiles) {
				const relativePath = path.relative(workspaceFolder.uri.fsPath, file.fsPath);
				const document = await vscode.workspace.openTextDocument(file);
				codeObject[relativePath] = { content: document.getText() };
			}

			try {
				console.debug({ code: codeObject });
				const response = await fetch(apiURL, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-API-KEY': process.env.API_KEY || ''
					},
					body: JSON.stringify({ code: codeObject })
				});

				// Check if the response is successful
				if (!response.ok) {
					throw new Error(`API Request error: ${response.statusText}`);
				}

				const data = await response.json() as ApiResponse;

				const vulnerabilities = handleVulnerabilities(data.result);
				console.debug(vulnerabilities);
				// Display vulnerabilities in a webview panel
				const panel = vscode.window.createWebviewPanel(
					'solidityAnalyzer',
					'Solidity Analyzer',
					vscode.ViewColumn.Two,
					{
						enableScripts: true
					}
				);
				panel.webview.html = getWebviewContent(vulnerabilities);

				highlightVulnerabilities(vulnerabilities);

			} catch (error) {
				console.error('Error analyzing Solidity code:', error);
				vscode.window.showErrorMessage('Failed to analyze Solidity code: ' + error);
			}
		}
	});

	let analyzeCurrentFileCommand = vscode.commands.registerCommand('extension.analyzeCurrentSolidityFile', async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const document = editor.document;
			if (document.languageId !== 'solidity') {
				vscode.window.showErrorMessage('The current file is not a Solidity file.');
				return;
			}

			const codeObject: { [key: string]: any } = {};
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			const relativePath = workspaceFolder ? path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath) : document.uri.fsPath;
			codeObject[relativePath] = { content: document.getText() };

			const importRegex = /import\s+(?:["'](?!@)(.+?\.sol)["']|{[^}]+}\s+from\s+["'](?!@)(.+?\.sol)["']);/g; // Match import statements that are not from node_modules (with @), including curly brace imports
			const importedFiles = new Set<string>();

			async function addImports(filePath: string) {
				const document = await vscode.workspace.openTextDocument(filePath);
				const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

				if (!workspaceFolder) {
					vscode.window.showErrorMessage('Please open a workspace folder containing the Solidity files.');
					return;
				}
				const content = document.getText();
				let match;
				while ((match = importRegex.exec(content)) !== null) {
					const importPath = match[1] || match[2];
					if (!importPath) continue;
					const absoluteImportPath = path.resolve(path.dirname(filePath), importPath);
					const relativeImportPath = path.relative(workspaceFolder.uri.fsPath, absoluteImportPath);
					if (!importedFiles.has(relativeImportPath)) {
						importedFiles.add(relativeImportPath);
						const importDocument = await vscode.workspace.openTextDocument(absoluteImportPath);
						codeObject[relativeImportPath] = { content: importDocument.getText() };
						await addImports(absoluteImportPath);
					}
				}
			}

			await addImports(document.uri.fsPath);

			try {
				console.debug({ code: codeObject });
				const response = await fetch(apiURL, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-API-KEY': process.env.API_KEY || '',
						'Access-Control-Allow-Origin': '*',
					},
					body: JSON.stringify({ code: codeObject })
				});

				// Check if the response is successful
				if (!response.ok) {
					throw new Error(`API Request error: ${response.statusText}`);
				}

				const data = await response.json() as ApiResponse;

				const vulnerabilities = handleVulnerabilities(data.result);
				console.debug(vulnerabilities);
				// Display vulnerabilities in a webview panel
				const panel = vscode.window.createWebviewPanel(
					'solidityAnalyzer',
					'Solidity Analyzer',
					vscode.ViewColumn.Two,
					{
						enableScripts: true,
						localResourceRoots: [vscode.Uri.file(context.extensionPath)]
					}
				);
				panel.webview.html = getWebviewContent(vulnerabilities);

				highlightVulnerabilities(vulnerabilities);

			} catch (error) {
				vscode.window.showErrorMessage('Failed to analyze Solidity code: ' + error);
			}
		}
	});

	// Add a status bar item to dismiss all highlights
	const editor = vscode.window.activeTextEditor;

	if (editor) {
		const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
		statusBarItem.text = 'Dismiss SA Highlights';
		statusBarItem.command = 'extension.dismissAllHighlights';
		statusBarItem.show();
		vscode.commands.registerCommand('extension.dismissAllHighlights', () => {
			editor.setDecorations(errorHighlightDecoration, []);
		});
		context.subscriptions.push(statusBarItem);
	}

	context.subscriptions.push(analyzeAllCommand);
	context.subscriptions.push(analyzeCurrentFileCommand);
}

function highlightVulnerabilities(vulnerabilities: Vulnerability[]) {
	const editor = vscode.window.activeTextEditor;
	if (!editor) return;

	const decorations: vscode.DecorationOptions[] = [];

	vulnerabilities.forEach(vuln => {
		vuln.lines?.forEach(lineInfo => {

			if (lineInfo.contract.includes('node_modules')) return; // Skip highlighting for node_modules
			const document = vscode.workspace.textDocuments.find(doc => doc.fileName.includes(lineInfo.contract));
			if (document) {
				let startLine: number = 0;
				let endLine: number = 0;
				lineInfo.lines.forEach((line, index) => {
					if (startLine === 0) {
						startLine = line;
						endLine = line;
					} else if (line === endLine + 1) {
						endLine = line;
					} else {
						const range = new vscode.Range(startLine - 1, 0, endLine - 1, document.lineAt(endLine - 1).range.end.character);
						const decoration: vscode.DecorationOptions = {
							range,
							hoverMessage: new vscode.MarkdownString(`
								${vuln.description}
							`)
						};
						decorations.push(decoration);
						startLine = line;
						endLine = line;
					}
					if (index === lineInfo.lines.length - 1) {
						const range = new vscode.Range(startLine - 1, 0, endLine - 1, document.lineAt(endLine - 1).range.end.character);
						const decoration: vscode.DecorationOptions = {
							range,
							hoverMessage: new vscode.MarkdownString(`
								${vuln.description}
							`)
						};
						decorations.push(decoration);
					}
				});
			}
		});
	});

	editor.setDecorations(errorHighlightDecoration, decorations);

}


function handleVulnerabilities(vulnerabilities: Vulnerability[]): Vulnerability[] {
	const lineRegex = /([^\s()]+\.sol)#(\d+)(?:-(\d+))?/g;

	return vulnerabilities.map(vuln => {
		const lines: { contract: string, lines: number[] }[] = [];
		let match;
		while ((match = lineRegex.exec(vuln.description)) !== null) {
			const contract = match[1];
			const startLine = parseInt(match[2], 10);
			const endLine = match[3] ? parseInt(match[3], 10) : startLine;
			const lineNumbers = [];
			for (let line = startLine; line <= endLine; line++) {
				lineNumbers.push(line);
			}
			lines.push({ contract, lines: lineNumbers });
		}
		vuln.lines = lines;
		return vuln;
	});
}


function getWebviewContent(vulnerabilities: Vulnerability[]): string {
	const vulnerabilityItems = vulnerabilities.map(vuln => {
		let confidenceColor;
		switch (vuln.confidence) {
			case 'High':
				confidenceColor = '#d9534f'; // red
				break;
			case 'Medium':
				confidenceColor = '#f0ad4e'; // orange
				break;
			case 'Low':
				confidenceColor = '#5bc0de'; // blue
				break;
			case 'Informational':
				confidenceColor = '#5bc0de'; // blue
				break;
			default:
				confidenceColor = '#d4d4d4'; // default color
		}

		let impactColor;
		switch (vuln.impact) {
			case 'Critical':
				impactColor = '#d9534f'; // red
				break;
			case 'High':
				impactColor = '#f0ad4e'; // orange
				break;
			case 'Medium':
				impactColor = '#f7e359'; // yellow
				break;
			case 'Low':
				impactColor = '#5bc0de'; // blue
				break;
			case 'Informational':
				impactColor = '#5bc0de'; // blue
				break;
			default:
				impactColor = '#d4d4d4'; // default color
		}

		return `
			<li>
				<h2 class="toggle"><span class="arrow">▶</span>${vuln.check}</h2>
				<p class="impact" style="color: ${impactColor};">Impact: ${vuln.impact}</p>
				<p class="confidence" style="color: ${confidenceColor};">Confidence: ${vuln.confidence}</p>
				<p class="description">${vuln.description}</p>
			</li>`;
	}).join('');

	return `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Vulnerabilities</title>
			<style>
				body { font-family: Arial, sans-serif; padding: 20px; background-color: #1e1e1e; color: #d4d4d4; }
				h1 { color: #d4d4d4; }
				ul { list-style-type: none; padding: 0; }
				li { background: #2d2d2d; margin: 10px 0; padding: 10px; border-radius: 5px; }
				li h2 { margin: 0; font-size: 1.2em; color: #d9534f; cursor: pointer; }
				li p { margin: 5px 0; }
				li .impact { font-weight: bold; }
				li .description { white-space: pre-wrap; display: none; }
				.arrow { margin-right: 10px; }
			</style>
			<script>
				function toggleDescription(event) {
					const description = event.currentTarget.parentElement.querySelector('.description');
					const arrow = event.currentTarget.querySelector('.arrow');
					if (description.style.display === 'none' || description.style.display === '') {
						description.style.display = 'block';
						arrow.textContent = '▼';
					} else {
						description.style.display = 'none';
						arrow.textContent = '▶';
					}
				}
				window.addEventListener('DOMContentLoaded', () => {
					document.querySelectorAll('.toggle').forEach(item => {
						item.addEventListener('click', toggleDescription);
					});
				});
			</script>
		</head>
		<body>
			<h1>Vulnerabilities</h1>
			<ul>
				${vulnerabilityItems}
			</ul>
		</body>
		</html>`;
}

export function deactivate() { }
