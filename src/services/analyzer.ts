import * as vscode from 'vscode';
import * as path from 'path';
import { ApiResponse, CodeObject, Vulnerability, LinterResult } from '../models/types';
import { handleVulnerabilities, handleLinterResults } from '../utils/vulnerabilityProcessor';
import { LoggingService } from './loggingService';
import { settingsService } from './settingsService';

/**
 * Service class for analyzing Solidity code for vulnerabilities.
 */
export class SolidityAnalyzer {
    private readonly apiURL: string;
    private readonly apiKey: string | undefined;
    private readonly logger: LoggingService;

    /**
     * Creates a new SolidityAnalyzer instance.
     * 
     * @param apiURL The URL of the analyzer API
     * @param apiKey Optional API key for authentication
     * @param logger The logging service
     */
    constructor(apiURL: string, apiKey: string | undefined, logger: LoggingService) {
        this.apiURL = apiURL;
        this.apiKey = apiKey;
        this.logger = logger;
        this.logger.debug(`SolidityAnalyzer initialized with API URL: ${apiURL}`);
    }

    /**
     * Analyzes all Solidity files in the current workspace by dependency groups.
     * 
     * @returns A promise resolving to processed vulnerabilities and linter results
     * @throws Error if no workspace is open or API request fails
     */
    public async analyzeAllSolidityFiles(): Promise<{
        vulnerabilities: Vulnerability[],
        linterResults: LinterResult[]
    }> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

        if (!workspaceFolder) {
            this.logger.error('No workspace folder opened');
            throw new Error('Please open a workspace folder containing the Solidity files.');
        }

        this.logger.info('Finding Solidity files in workspace');

        // Use settings service to determine if node_modules should be analyzed
        const analyzeNodeModules = settingsService.getAnalyzeNodeModules();
        const excludePattern = analyzeNodeModules ? undefined : '**/node_modules/**';

        // Find all solidity files in the workspace
        const solidityFiles = await vscode.workspace.findFiles('**/*.sol', excludePattern);

        if (solidityFiles.length === 0) {
            this.logger.warn('No Solidity files found in the workspace');
            throw new Error('No Solidity files found in the workspace.');
        }

        this.logger.info(`Found ${solidityFiles.length} Solidity files to analyze`);

        // Build dependency graph
        const graph = await this.buildDependencyGraph(solidityFiles, workspaceFolder);

        // Find connected components (file groups) in the graph
        const fileGroups = this.findConnectedComponents(graph);

        this.logger.info(`Identified ${fileGroups.length} independent file groups for analysis`);

        // Analyze each file group separately
        let allVulnerabilities: Vulnerability[] = [];
        let allLinterResults: LinterResult[] = [];

        for (let i = 0; i < fileGroups.length; i++) {
            const group = fileGroups[i];
            this.logger.info(`Analyzing file group ${i + 1}/${fileGroups.length} with ${group.length} files`);

            // Build code object for this group
            const codeObject: CodeObject = {};
            for (const filePath of group) {
                try {
                    const uri = vscode.Uri.file(filePath);
                    const document = await vscode.workspace.openTextDocument(uri);
                    const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);
                    codeObject[relativePath] = { content: document.getText() };
                } catch (error) {
                    this.logger.warn(`Failed to open file: ${filePath}`, error);
                }
            }

            if (Object.keys(codeObject).length === 0) {
                this.logger.warn(`Skipping empty file group ${i + 1}`);
                continue;
            }

            // Analyze this group
            try {
                const result = await this.analyzeCode(codeObject);
                allVulnerabilities = [...allVulnerabilities, ...result.vulnerabilities];
                allLinterResults = [...allLinterResults, ...result.linterResults];
            } catch (error) {
                this.logger.error(`Error analyzing file group ${i + 1}`, error);
                // Continue with next group instead of failing completely
            }
        }

        return {
            vulnerabilities: allVulnerabilities,
            linterResults: allLinterResults
        };
    }

    /**
     * Builds a dependency graph of Solidity files.
     * 
     * @param solidityFiles List of file URIs
     * @param workspaceFolder The workspace folder
     * @returns Map representing the dependency graph (file path -> array of dependencies)
     */
    private async buildDependencyGraph(
        solidityFiles: vscode.Uri[],
        workspaceFolder: vscode.WorkspaceFolder
    ): Promise<Map<string, string[]>> {
        const graph = new Map<string, string[]>();

        // Initialize the graph with empty dependency arrays
        for (const file of solidityFiles) {
            graph.set(file.fsPath, []);
        }

        // Fill in dependencies
        for (const file of solidityFiles) {
            try {
                const document = await vscode.workspace.openTextDocument(file);
                const content = document.getText();

                // Use regex to find imports
                const importRegex = /import\s+(?:["'](?!@)(.+?\.sol)["']|{[^}]+}\s+from\s+["'](?!@)(.+?\.sol)["']);/g;
                let match;

                while ((match = importRegex.exec(content)) !== null) {
                    const importPath = match[1] || match[2];
                    if (!importPath) continue;

                    // Resolve the absolute path of the imported file
                    const absoluteImportPath = path.resolve(path.dirname(file.fsPath), importPath);

                    // Add the dependency to the graph if it exists in our file list
                    if (solidityFiles.some(uri => uri.fsPath === absoluteImportPath)) {
                        const dependencies = graph.get(file.fsPath) || [];
                        if (!dependencies.includes(absoluteImportPath)) {
                            dependencies.push(absoluteImportPath);
                            graph.set(file.fsPath, dependencies);
                        }
                    }
                }
            } catch (error) {
                this.logger.warn(`Failed to analyze imports in ${file.fsPath}`, error);
            }
        }

        return graph;
    }

    /**
     * Finds connected components in the dependency graph.
     * Each component represents a group of files that should be analyzed together.
     * 
     * @param graph The dependency graph
     * @returns Array of file groups (each group is an array of file paths)
     */
    private findConnectedComponents(graph: Map<string, string[]>): string[][] {
        const visited = new Set<string>();
        const fileGroups: string[][] = [];

        // Helper function for DFS
        const dfs = (node: string, component: string[]) => {
            visited.add(node);
            component.push(node);

            // For each dependency of this file
            const dependencies = graph.get(node) || [];
            for (const dependency of dependencies) {
                if (!visited.has(dependency)) {
                    dfs(dependency, component);
                }
            }

            // Check for reverse dependencies (files that import this file)
            for (const [file, deps] of graph.entries()) {
                if (!visited.has(file) && deps.includes(node)) {
                    dfs(file, component);
                }
            }
        };

        // Find all connected components
        for (const node of graph.keys()) {
            if (!visited.has(node)) {
                const component: string[] = [];
                dfs(node, component);
                fileGroups.push(component);
            }
        }

        return fileGroups;
    }

    /**
     * Analyzes a specific Solidity document.
     * 
     * @param document The document to analyze
     * @returns A promise resolving to processed vulnerabilities and linter results
     * @throws Error if the document is not a Solidity file or API request fails
     */
    public async analyzeSolidityDocument(document: vscode.TextDocument): Promise<{
        vulnerabilities: Vulnerability[],
        linterResults: LinterResult[]
    }> {
        if (document.languageId !== 'solidity') {
            this.logger.error(`Document has language ID: ${document.languageId}, not solidity`);
            throw new Error('The document is not a Solidity file.');
        }

        this.logger.info(`Analyzing Solidity document: ${document.fileName}`);
        const codeObject: CodeObject = {};
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

        if (!workspaceFolder) {
            this.logger.error('No workspace folder opened');
            throw new Error('Please open a workspace folder containing the Solidity files.');
        }

        const relativePath = path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath);
        codeObject[relativePath] = { content: document.getText() };
        this.logger.debug(`Added main file to analysis: ${relativePath}`);

        // Add imported files
        this.logger.debug('Starting to process imports');
        await this.addImportedFiles(document.uri.fsPath, codeObject);
        this.logger.debug(`Finished processing imports, total files: ${Object.keys(codeObject).length}`);

        return await this.analyzeCode(codeObject);
    }

    /**
     * Analyzes the currently active Solidity file and its imports.
     * 
     * @returns A promise resolving to processed vulnerabilities and linter results
     * @throws Error if the current file is not a Solidity file or API request fails
     */
    public async analyzeCurrentSolidityFile(): Promise<{
        vulnerabilities: Vulnerability[],
        linterResults: LinterResult[]
    }> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this.logger.error('No active editor found');
            throw new Error('No active editor found.');
        }

        return await this.analyzeSolidityDocument(editor.document);
    }

    /**
     * Recursively adds imported Solidity files to the code object.
     * 
     * @param filePath The path of the file to analyze for imports
     * @param codeObject The object to populate with imported files
     * @param importedFiles Set of already imported files to avoid duplicates
     */
    private async addImportedFiles(
        filePath: string,
        codeObject: CodeObject,
        importedFiles: Set<string> = new Set<string>()
    ): Promise<void> {
        const document = await vscode.workspace.openTextDocument(filePath);
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

        if (!workspaceFolder) {
            return;
        }

        const content = document.getText();
        const importRegex = /import\s+(?:["'](?!@)(.+?\.sol)["']|{[^}]+}\s+from\s+["'](?!@)(.+?\.sol)["']);/g;

        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const importPath = match[1] || match[2];
            if (!importPath) continue;

            const absoluteImportPath = path.resolve(path.dirname(filePath), importPath);
            const relativeImportPath = path.relative(workspaceFolder.uri.fsPath, absoluteImportPath);

            if (!importedFiles.has(relativeImportPath)) {
                importedFiles.add(relativeImportPath);
                try {
                    const importDocument = await vscode.workspace.openTextDocument(absoluteImportPath);
                    codeObject[relativeImportPath] = { content: importDocument.getText() };
                    this.logger.debug(`Added imported file: ${relativeImportPath}`);
                    await this.addImportedFiles(absoluteImportPath, codeObject, importedFiles);
                } catch (error) {
                    this.logger.warn(`Failed to open import file: ${absoluteImportPath}`, error);
                }
            }
        }
    }

    /**
     * Sends code to the API for analysis and processes the vulnerabilities.
     * 
     * @param codeObject Object containing code content by file path
     * @returns A promise resolving to processed vulnerabilities and linter results
     * @throws Error if the API request fails
     */
    private async analyzeCode(codeObject: CodeObject): Promise<{
        vulnerabilities: Vulnerability[],
        linterResults: LinterResult[]
    }> {
        try {
            const fileNames = Object.keys(codeObject);
            this.logger.info(`Sending ${fileNames.length} files to API for analysis: ${fileNames.join(', ')}`);

            const response = await fetch(this.apiURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': this.apiKey || '',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({ code: codeObject })
            });

            if (!response.ok) {
                this.logger.error(`API request failed with status: ${response.status} ${response.statusText}`);
                throw new Error(`API Request error: ${response.statusText}`);
            }

            this.logger.debug('API response received, processing');
            const data = await response.json() as ApiResponse;
            this.logger.debug(`API response data: ${JSON.stringify(data)}`);
            // Debug log the response content to help diagnose issues
            this.logger.debug(`Raw API result has ${data.result?.length || 0} vulnerability entries`);

            if (data.linter) {
                // Log the linter data to see if it contains multiple files
                const linterPreview = data.linter.substring(0, 500) + (data.linter.length > 500 ? '...' : '');
                this.logger.debug(`Linter data preview: ${linterPreview}`);

                // Count file mentions in linter output
                const fileMatches = data.linter.match(/\.sol\s*$/gm);
                this.logger.debug(`Found references to ${fileMatches?.length || 0} files in linter output`);
            }

            // Process vulnerabilities
            const vulnerabilities = handleVulnerabilities(data.result || []);
            this.logger.info(`Analysis complete: found ${vulnerabilities.length} vulnerabilities`);

            // Process linter results if available
            let linterResults: LinterResult[] = [];
            if (data.linter) {
                linterResults = handleLinterResults(data.linter);
                this.logger.info(`Linting complete: found ${linterResults.length} issues`);

                // Log breakdown of linter results by file
                const fileBreakdown = linterResults.reduce((acc, item) => {
                    const file = item.filePath || 'Unknown';
                    acc[file] = (acc[file] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);

                this.logger.debug(`Linter issues by file: ${JSON.stringify(fileBreakdown)}`);
            }

            return { vulnerabilities, linterResults };
        } catch (error) {
            this.logger.error('Failed to analyze Solidity code', error);
            throw new Error(`Failed to analyze Solidity code: ${error}`);
        }
    }
}
