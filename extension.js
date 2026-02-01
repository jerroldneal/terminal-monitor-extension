const vscode = require('vscode');

let monitorInterval = null;
const terminalActivity = new Map(); // Stores { timestamp, lastBuffer }
const terminalBuffers = new Map(); // Stores last 500 bytes of terminal output
const IDLE_TIMEOUT = 60000; // 1 minute
const CHECK_INTERVAL = 10000; // 10 seconds
const BUFFER_SIZE = 500; // bytes
let outputChannel = null;

function activate(context) {
    try {
        console.log('Terminal Monitor extension activating...');

        // Create output channel for logging
        outputChannel = vscode.window.createOutputChannel('Terminal Monitor');
        context.subscriptions.push(outputChannel);

        // Register event handlers once at activation
        context.subscriptions.push(
            vscode.window.onDidOpenTerminal(terminal => {
                terminalActivity.set(terminal, { timestamp: Date.now(), lastBuffer: '' });
                terminalBuffers.set(terminal, '');
                console.log(`Terminal opened: ${terminal.name}`);
            })
        );

        context.subscriptions.push(
            vscode.window.onDidCloseTerminal(terminal => {
                terminalActivity.delete(terminal);
                terminalBuffers.delete(terminal);
                console.log(`Terminal closed: ${terminal.name}`);
            })
        );

        // Track terminal data writes (this is key for detecting actual terminal output)
        context.subscriptions.push(
            vscode.window.onDidWriteTerminalData(event => {
                const terminal = event.terminal;
                const data = event.data;
                
                // Update buffer with new data (keep last 500 bytes)
                let buffer = terminalBuffers.get(terminal) || '';
                buffer += data;
                if (buffer.length > BUFFER_SIZE) {
                    buffer = buffer.slice(-BUFFER_SIZE);
                }
                terminalBuffers.set(terminal, buffer);
                
                // Reset activity timestamp
                const activity = terminalActivity.get(terminal);
                if (activity) {
                    activity.timestamp = Date.now();
                    terminalActivity.set(terminal, activity);
                } else {
                    terminalActivity.set(terminal, { timestamp: Date.now(), lastBuffer: buffer });
                }
                
                console.log(`Terminal data written: ${terminal.name} (${data.length} bytes)`);
            })
        );

        // Track active terminal - user switching to a terminal indicates activity
        context.subscriptions.push(
            vscode.window.onDidChangeActiveTerminal(terminal => {
                if (terminal) {
                    const activity = terminalActivity.get(terminal);
                    if (activity) {
                        activity.timestamp = Date.now();
                        terminalActivity.set(terminal, activity);
                    } else {
                        terminalActivity.set(terminal, { timestamp: Date.now(), lastBuffer: '' });
                    }
                    console.log(`Active terminal changed: ${terminal.name} - activity reset`);
                }
            })
        );

        // Start monitoring command
        let startCmd = vscode.commands.registerCommand('terminalMonitor.start', () => {
            if (monitorInterval) {
                vscode.window.showInformationMessage('Terminal Monitor is already running');
                return;
            }

            vscode.window.showInformationMessage('Terminal Monitor started');
            monitorInterval = setInterval(checkTerminals, CHECK_INTERVAL);
            console.log('Terminal Monitor started');
        });

        // Stop monitoring command
        let stopCmd = vscode.commands.registerCommand('terminalMonitor.stop', () => {
            if (monitorInterval) {
                clearInterval(monitorInterval);
                monitorInterval = null;
                vscode.window.showInformationMessage('Terminal Monitor stopped');
                console.log('Terminal Monitor stopped');
            }
        });

        context.subscriptions.push(startCmd);
        context.subscriptions.push(stopCmd);

        // Auto-start on activation
        setTimeout(() => {
            vscode.commands.executeCommand('terminalMonitor.start').then(() => {
                console.log('Terminal Monitor auto-started successfully');
            }, (error) => {
                console.error('Failed to auto-start Terminal Monitor:', error);
            });
        }, 1000);

        console.log('Terminal Monitor extension activated successfully');
    } catch (error) {
        console.error('Terminal Monitor activation failed:', error);
        vscode.window.showErrorMessage(`Terminal Monitor failed to activate: ${error.message}`);
    }
}

function checkTerminals() {
    const now = Date.now();
    const terminals = vscode.window.terminals;
    const protectedNames = ['PowerShell Extension', 'Monitor Idle Terminals', 'Start Terminal Monitor'];
    const config = vscode.workspace.getConfiguration('terminalMonitor');
    const enableLogging = config.get('enableLogging', false);

    // Log terminal status if logging is enabled
    if (enableLogging && outputChannel) {
        outputChannel.appendLine(`\n[${new Date().toLocaleTimeString()}] Terminal Status Check`);
        outputChannel.appendLine(`Active terminals: ${terminals.length}`);
    }

    for (const terminal of terminals) {
        // Skip protected terminals
        if (protectedNames.includes(terminal.name)) {
            continue;
        }

        // Check if terminal has exited
        if (terminal.exitStatus !== undefined) {
            if (enableLogging && outputChannel) {
                outputChannel.appendLine(`  - ${terminal.name}: EXITED - will close`);
            }
            console.log(`Closing exited terminal: ${terminal.name}`);
            terminal.dispose();
            terminalActivity.delete(terminal);
            terminalBuffers.delete(terminal);
            continue;
        }

        // Get current terminal buffer (last 500 bytes)
        const currentBuffer = terminalBuffers.get(terminal) || '';

        // Initialize activity tracking
        if (!terminalActivity.has(terminal)) {
            terminalActivity.set(terminal, { timestamp: now, lastBuffer: currentBuffer });
            if (enableLogging && outputChannel) {
                outputChannel.appendLine(`  - ${terminal.name}: NEW (just detected)`);
            }
            continue;
        }

        const activity = terminalActivity.get(terminal);
        const lastBuffer = activity.lastBuffer;

        // Check if buffer has changed (indicates activity)
        if (currentBuffer !== lastBuffer && currentBuffer.length > 0) {
            // Buffer changed - reset timeout
            activity.timestamp = now;
            activity.lastBuffer = currentBuffer;
            terminalActivity.set(terminal, activity);

            if (enableLogging && outputChannel) {
                const bufferPreview = currentBuffer.slice(-50).replace(/\n/g, '\\n');
                outputChannel.appendLine(`  - ${terminal.name}: 🔄 ACTIVITY DETECTED (buffer changed)`);
                outputChannel.appendLine(`    Last 50 chars: "${bufferPreview}"`);
            }
            continue;
        }

        const idleTime = now - activity.timestamp;
        const idleSeconds = Math.floor(idleTime / 1000);

        if (enableLogging && outputChannel) {
            const status = idleTime > IDLE_TIMEOUT ? '⚠️ IDLE' : '✓ Active';
            outputChannel.appendLine(`  - ${terminal.name}: ${status} (idle for ${idleSeconds}s)`);
        }

        if (idleTime > IDLE_TIMEOUT) {
            const message = `Closing idle terminal: ${terminal.name} (idle for ${idleSeconds}s)`;
            console.log(message);
            if (outputChannel) {
                outputChannel.appendLine(`\n[${new Date().toLocaleTimeString()}] 🗑️ ${message}`);
            }
            terminal.dispose();
            terminalActivity.delete(terminal);
            terminalBuffers.delete(terminal);
        }
    }
}

function deactivate() {
    if (monitorInterval) {
        clearInterval(monitorInterval);
    }
}

module.exports = {
    activate,
    deactivate
};
