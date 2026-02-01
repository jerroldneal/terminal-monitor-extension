const vscode = require('vscode');

let monitorInterval = null;
const terminalActivity = new Map();
const IDLE_TIMEOUT = 60000; // 1 minute
const CHECK_INTERVAL = 10000; // 10 seconds

function activate(context) {
    try {
        console.log('Terminal Monitor extension activating...');

        // Register event handlers once at activation
        context.subscriptions.push(
            vscode.window.onDidOpenTerminal(terminal => {
                terminalActivity.set(terminal, Date.now());
                console.log(`Terminal opened: ${terminal.name}`);
            })
        );

        context.subscriptions.push(
            vscode.window.onDidCloseTerminal(terminal => {
                terminalActivity.delete(terminal);
                console.log(`Terminal closed: ${terminal.name}`);
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
