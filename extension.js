const vscode = require('vscode');

let monitorInterval = null;
const terminalActivity = new Map(); // Stores { timestamp, lastState }
const IDLE_TIMEOUT = 60000; // 1 minute
const CHECK_INTERVAL = 10000; // 10 seconds
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
                terminalActivity.set(terminal, { timestamp: Date.now(), lastState: 'opened' });
                console.log(`Terminal opened: ${terminal.name}`);
            })
        );

        context.subscriptions.push(
            vscode.window.onDidCloseTerminal(terminal => {
                terminalActivity.delete(terminal);
                console.log(`Terminal closed: ${terminal.name}`);
            })
        );

        // Track terminal state changes (fires when terminal is busy/idle)
        context.subscriptions.push(
            vscode.window.onDidChangeTerminalState(event => {
                const terminal = event.terminal;
                const activity = terminalActivity.get(terminal);
                const newState = terminal.state ? terminal.state.isInteractedWith : false;
                
                if (activity) {
                    // Reset timestamp on state change
                    activity.timestamp = Date.now();
                    activity.lastState = newState;
                    terminalActivity.set(terminal, activity);
                    console.log(`Terminal state changed: ${terminal.name} - activity reset`);
                } else {
                    terminalActivity.set(terminal, { timestamp: Date.now(), lastState: newState });
                }
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
                        terminalActivity.set(terminal, { timestamp: Date.now(), lastState: 'active' });
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
            continue;
        }

        // Initialize activity tracking
        if (!terminalActivity.has(terminal)) {
            terminalActivity.set(terminal, { timestamp: now, lastState: 'new' });
            if (enableLogging && outputChannel) {
                outputChannel.appendLine(`  - ${terminal.name}: NEW (just detected)`);
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
