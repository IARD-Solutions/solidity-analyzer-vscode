import * as vscode from 'vscode';
import dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const apiURL = "https://api.iard.solutions/v2/analyze";

interface Vulnerability {
	check: string;
	description: string;
	impact: string;
	confidence: string;
}

interface ApiResponse {
	result: Vulnerability[];
}

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('extension.analyzeAllSolidityFiles', async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const document = editor.document;
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

			if (!workspaceFolder) {
				vscode.window.showErrorMessage('Please open a workspace folder containing the Solidity files.');
				return;
			}

			const solidityFiles = await vscode.workspace.findFiles('**/*.sol', '**/node_modules/**');
			const codeObject: { [key: string]: any } = {};

			for (const file of solidityFiles) {
				const relativePath = path.relative(workspaceFolder.uri.fsPath, file.fsPath);
				const document = await vscode.workspace.openTextDocument(file);
				codeObject[relativePath] = { content: document.getText() };
			}

			try {
				console.debug({code: codeObject});
				const response = await fetch(apiURL, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-API-KEY': process.env.API_KEY || ''
					},
					body: JSON.stringify({code: codeObject})
				});

				// Check if the response is successful
				if (!response.ok) {
					throw new Error(`API Request error: ${response.statusText}`);
				}

				const data = await response.json() as ApiResponse;

				const vulnerabilities = data.result;
				console.debug(vulnerabilities);
				// Display vulnerabilities in a webview panel
				const panel = vscode.window.createWebviewPanel(
					'solidityAnalyzer',
					'Solidity Analyzer',
					vscode.ViewColumn.Two,
					{}
				);
				panel.webview.html = getWebviewContent(vulnerabilities);

			} catch (error) {
				vscode.window.showErrorMessage('Failed to analyze Solidity code: ' + error);
			}
		}
	});

	context.subscriptions.push(disposable);
}

function getWebviewContent(vulnerabilities: Vulnerability[]): string {
	// Generate HTML content for the webview panel
	let html = `
		<html>
		<head>
			<style>
				body { font-family: Arial, sans-serif; padding: 20px; }
				h1 { color: #FFF; }
				ul { list-style-type: none; padding: 0; }
				li { background: #f9f9f9; margin: 10px 0; padding: 10px; border-radius: 5px; }
				li h2 { margin: 0; font-size: 1.2em; color: #d9534f; }
				li p { margin: 5px 0; }
				li .impact { font-weight: bold; }
				li .confidence { color: #5bc0de; }
				li .description { white-space: pre-wrap; }
			</style>
		</head>
		<body>
			<h1>Vulnerabilities</h1>
			<ul>`;
	vulnerabilities.forEach(vuln => {
		html += `
			<li>
				<h2>${vuln.check}</h2>
				<p class="impact">Impact: ${vuln.impact}</p>
				<p class="confidence">Confidence: ${vuln.confidence}</p>
				<p class="description">${vuln.description}</p>
			</li>`;
	});
	html += `
			</ul>
		</body>
		</html>`;
	return html;
}


export function deactivate() { }
