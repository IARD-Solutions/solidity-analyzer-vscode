import * as vscode from 'vscode';

/**
 * Log levels for the application
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

/**
 * Service for centralized logging throughout the extension.
 */
export class LoggingService {
    private outputChannel: vscode.OutputChannel;
    private currentLogLevel: LogLevel;

    constructor(channelName: string = 'Solidity Analyzer') {
        this.outputChannel = vscode.window.createOutputChannel(channelName);

        // Get log level from settings
        const config = vscode.workspace.getConfiguration('solidityAnalyzer');
        const configLogLevel = config.get<string>('logLevel', 'info').toLowerCase();

        this.currentLogLevel = this.getLogLevelFromString(configLogLevel);
    }

    /**
     * Log a debug message
     */
    public debug(message: string, ...args: any[]): void {
        this.log(LogLevel.DEBUG, message, ...args);
    }

    /**
     * Log an info message
     */
    public info(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, message, ...args);
    }

    /**
     * Log a warning message
     */
    public warn(message: string, ...args: any[]): void {
        this.log(LogLevel.WARN, message, ...args);
    }

    /**
     * Log an error message
     */
    public error(message: string | Error, ...args: any[]): void {
        const errorMessage = message instanceof Error ? `${message.message}\n${message.stack}` : message;
        this.log(LogLevel.ERROR, errorMessage, ...args);
    }

    /**
     * Show the output channel
     */
    public show(): void {
        this.outputChannel.show();
    }

    /**
     * Convert a string log level to enum value
     */
    private getLogLevelFromString(level: string): LogLevel {
        switch (level) {
            case 'debug': return LogLevel.DEBUG;
            case 'info': return LogLevel.INFO;
            case 'warn': case 'warning': return LogLevel.WARN;
            case 'error': return LogLevel.ERROR;
            default: return LogLevel.INFO;
        }
    }

    /**
     * Log a message if the current log level allows it
     */
    private log(level: LogLevel, message: string, ...args: any[]): void {
        if (level >= this.currentLogLevel) {
            const timestamp = new Date().toISOString();
            const levelPrefix = LogLevel[level].padEnd(5);
            let logMessage = `[${timestamp}] [${levelPrefix}] ${message}`;

            if (args.length > 0) {
                logMessage += '\n' + args.map(arg =>
                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
                ).join('\n');
            }

            this.outputChannel.appendLine(logMessage);
        }
    }

    /**
     * Dispose of the output channel
     */
    public dispose(): void {
        this.outputChannel.dispose();
    }
}
