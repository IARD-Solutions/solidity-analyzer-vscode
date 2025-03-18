// .vscode-test.js
import { defineConfig } from '@vscode/test-cli';

export default defineConfig([
	{
		label: 'unitTests',
		files: 'out/test/**/*.test.js',
		version: 'insiders',
		workspaceFolder: './sampleWorkspace',
		mocha: {
			ui: 'tdd',
			timeout: 30000 // Increased timeout to allow for extension activation
		},
		launchArgs: [
			'--disable-extensions', // Disable other extensions that might interfere
			'--extensionDevelopmentPath=.' // Explicitly point to the extension being tested
		]
	}
	// you can specify additional test configurations, too
]);
