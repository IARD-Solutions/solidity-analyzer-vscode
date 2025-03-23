// .vscode-test.js
import { defineConfig } from '@vscode/test-cli';

export default defineConfig([
	{
		label: 'unitTests',
		files: 'out/test/**/*.test.js',
		version: 'insiders',
		workspaceFolder: './src/exampleContracts', // Use the example contracts as workspace
		mocha: {
			ui: 'tdd',
			timeout: 60000 // Increased timeout to allow for extension activation
		},
		launchArgs: [
			// Don't disable extensions as it may affect language support
			'--extensionDevelopmentPath=.', // Explicitly point to the extension being tested
			'--enable-proposed-api=IARD-Solutions.iards-solidity-analyzer' // Enable any proposed APIs if needed
		]
	}
	// you can specify additional test configurations, too
]);
