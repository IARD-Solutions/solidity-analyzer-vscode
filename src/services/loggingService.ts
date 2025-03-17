import * as vscode from 'vscode';
import { settingsService } from './settingsService';

/**
 * Logging levels supported by the application
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

/**
 * Service for logging messages to the output channel
 */
export class LoggingService {
    private outputChannel: vscode.OutputChannel;
    private disposables: vscode.Disposable[] = [];

    /**
     * Creates a new instance of the LoggingService
     */
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Solidity Analyzer');

        // Use settings service to set initial log level
        this.updateLogLevel();

        // Listen for configuration changes to update log level
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration(event => {
                if (event.affectsConfiguration('solidityAnalyzer.logLevel')) {
                    this.updateLogLevel();
                }
            })
        );
    }

    private updateLogLevel(): void {
        // Get log level from settings service
        const logLevel = settingsService.getLogLevel();
        // Apply the log level
    }

    /**
     * Gets the current configured log level from settings
     */
    private getConfiguredLogLevel(): LogLevel {
        const config = vscode.workspace.getConfiguration('solidityAnalyzer');
        const logLevelStr = config.get<string>('logLevel', 'info').toLowerCase();

        switch (logLevelStr) {
            case 'debug': return LogLevel.DEBUG;
            case 'info': return LogLevel.INFO;
            case 'warn': return LogLevel.WARN;
            case 'error': return LogLevel.ERROR;
            default: return LogLevel.INFO;
        }
    }

    /**
     * Checks if a log level should be logged based on current settings
     */
    private shouldLog(level: LogLevel): boolean {
        const configuredLevel = this.getConfiguredLogLevel();
        return level >= configuredLevel;
    }

    /**
     * Logs a debug message
     * 
     * @param message The message to log
     * @param data Optional data to include with the log
     */
    public debug(message: string, data?: any): void {
        if (!this.shouldLog(LogLevel.DEBUG)) return;

        const logMessage = data !== undefined
            ? `[DEBUG] ${message}: ${this.formatData(data)}`
            : `[DEBUG] ${message}`;

        this.outputChannel.appendLine(logMessage);
    }

    /**
     * Logs an info message
     * 
     * @param message The message to log
     * @param data Optional data to include with the log
     */
    public info(message: string, data?: any): void {
        if (!this.shouldLog(LogLevel.INFO)) return;

        const logMessage = data !== undefined
            ? `[INFO] ${message}: ${this.formatData(data)}`
            : `[INFO] ${message}`;

        this.outputChannel.appendLine(logMessage);
    }

    /**
     * Logs a warning message
     * 
     * @param message The message to log
     * @param data Optional data to include with the log
     */
    public warn(message: string, data?: any): void {
        if (!this.shouldLog(LogLevel.WARN)) return;

        const logMessage = data !== undefined
            ? `[WARN] ${message}: ${this.formatData(data)}`
            : `[WARN] ${message}`;

        this.outputChannel.appendLine(logMessage);
    }

    /**
     * Logs an error message
     * 
     * @param message The message to log
     * @param error Optional error to include with the log
     */
    public error(message: string, error?: any): void {
        if (!this.shouldLog(LogLevel.ERROR)) return;

        let logMessage = `[ERROR] ${message}`;

        if (error) {
            if (error instanceof Error) {
                logMessage += `: ${error.message}\n${error.stack || ''}`;
            } else {
                logMessage += `: ${this.formatData(error)}`;
            }
        }

        this.outputChannel.appendLine(logMessage);
    }

    /**
     * Shows the output channel
     */
    public show(): void {
        this.outputChannel.show();
    }

    /**
     * Formats data for logging
     * 
     * @param data The data to format
     * @returns Formatted string representation of the data
     */
    private formatData(data: any): string {
        try {
            if (typeof data === 'object') {
                return JSON.stringify(data, null, 2);
            }
            return String(data);
        } catch (err) {
            return `[Unformattable data: ${typeof data}]`;
        }
    }

    /**
     * Cleans up resources used by the logging service
     */
    public dispose(): void {
        this.outputChannel.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
