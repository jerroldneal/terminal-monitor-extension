const vscode = require('vscode');

let monitorInterval = null;
const terminalActivity = new Map();
const IDLE_TIMEOUT = 60000; // 1 minute
const CHECK_INTERVAL = 10000; // 10 seconds

function activate(context) {
    console.log('Terminal Monitor extension activated');

    // Start monitoring command
    let startCmd = vscode.commands.registerCommand('terminalMonitor.start', () => {
        if (monitorInterval) {
            vscode.window.showInformationMessage('Terminal Monitor is already running');
            return;
        }

        vscode.window.showInformationMessage('Terminal Monitor started');
        monitorInterval = setInterval(checkTerminals, CHECK_INTERVAL);

        // Track new terminals
        context.subscriptions.push(
            vscode.window.onDidOpenTerminal(terminal => {
                terminalActivity.set(terminal, Date.now());
            })
        );

        context.subscriptions.push(
            vscode.window.onDidCloseTerminal(terminal => {
                terminalActivity.delete(terminal);
            })
        );
    });

    // Stop monitoring command
    let stopCmd = vscode.commands.registerCommand('terminalMonitor.stop', () => {
        if (monitorInterval) {
            clearInterval(monitorInterval);
            monitorInterval = null;
            vscode.window.showInformationMessage('Terminal Monitor stopped');
        }
    });

    context.subscriptions.push(startCmd);
    context.subscriptions.push(stopCmd);

    // Auto-start on activation
    vscode.commands.executeCommand('terminalMonitor.start');
}

function checkTerminals() {
    const now = Date.now();
    const terminals = vscode.window.terminals;
    const protectedNames = ['PowerShell Extension', 'Monitor Idle Terminals'];

    for (const terminal of terminals) {
        // Skip protected terminals
        if (protectedNames.includes(terminal.name)) {
            continue;
        }

        // Initialize activity tracking
        if (!terminalActivity.has(terminal)) {
            terminalActivity.set(terminal, now);
            continue;
        }

        const lastActivity = terminalActivity.get(terminal);
        const idleTime = now - lastActivity;

        if (idleTime > IDLE_TIMEOUT) {
            console.log(`Closing idle terminal: ${terminal.name} (idle: ${Math.floor(idleTime / 1000)}s)`);
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
