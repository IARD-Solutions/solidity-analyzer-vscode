import * as vscode from 'vscode';
import * as path from 'path';
import { ApiResponse, CodeObject, Vulnerability, LinterResult } from '../models/types';
import { handleVulnerabilities, handleLinterResults } from '../utils/vulnerabilityProcessor';
import { LoggingService } from './loggingService';

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
     * Analyzes all Solidity files in the current workspace.
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
        const solidityFiles = await vscode.workspace.findFiles('**/*.sol', '**/node_modules/**');

        if (solidityFiles.length === 0) {
            this.logger.warn('No Solidity files found in the workspace');
            throw new Error('No Solidity files found in the workspace.');
        }

        this.logger.info(`Found ${solidityFiles.length} Solidity files to analyze`);
        const codeObject: CodeObject = {};

        for (const file of solidityFiles) {
            const relativePath = path.relative(workspaceFolder.uri.fsPath, file.fsPath);
            const document = await vscode.workspace.openTextDocument(file);
            codeObject[relativePath] = { content: document.getText() };
            this.logger.debug(`Added file to analysis: ${relativePath}`);
        }

        return await this.analyzeCode(codeObject);
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
            this.logger.info(`Sending ${Object.keys(codeObject).length} files to API for analysis`);
            
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
            
            // Process vulnerabilities
            const vulnerabilities = handleVulnerabilities(data.result);
            this.logger.info(`Analysis complete: found ${vulnerabilities.length} vulnerabilities`);
            
            // Process linter results if available
            let linterResults: LinterResult[] = [];
            if (data.linter) {
                linterResults = handleLinterResults(data.linter);
                this.logger.info(`Linting complete: found ${linterResults.length} issues`);
            }
            
            return { vulnerabilities, linterResults };
        } catch (error) {
            this.logger.error('Failed to analyze Solidity code', error);
            throw new Error(`Failed to analyze Solidity code: ${error}`);
        }
    }
}
