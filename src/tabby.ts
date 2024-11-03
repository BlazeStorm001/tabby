import * as vscode from 'vscode';
import { TabHistoryProvider } from './TabHistoryProvider';
import { registerFilterCmdsAndListeners } from './tabFiltering';
import { registerHistoryCmdsAndListeners } from './tabHistory';
import { registerNavCmdsAndListeners } from './tabNavigation';

let statusBarItem: vscode.StatusBarItem;
let tabModeActive = false;

export function activate(context: vscode.ExtensionContext) {

  const tabHistoryProvider = new TabHistoryProvider(context);
  const tabHistoryTreeView = vscode.window.createTreeView('closedTabsHistory', {
    treeDataProvider: tabHistoryProvider,
    showCollapseAll: true,
  });

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  statusBarItem.show(); 
  updateStatusBar(); 

  
  const toggleTabModeCmd = vscode.commands.registerCommand('tabby.toggleTabMode', async () => {
    tabModeActive = !tabModeActive;
    await vscode.commands.executeCommand('setContext', 'tabModeActive', tabModeActive);

    updateStatusBar();

  });

  registerFilterCmdsAndListeners(context);
  registerHistoryCmdsAndListeners(context, tabHistoryProvider);
  registerNavCmdsAndListeners(context);

  context.subscriptions.push(    
    toggleTabModeCmd,
    tabHistoryTreeView,
    statusBarItem,
    tabHistoryTreeView,
  );

}

export function isTabModeEnabled() {
  return tabModeActive;
}

// Function to update the status bar with the tab mode status
function updateStatusBar() {
  statusBarItem.text = `Tab Mode: ${tabModeActive ? 'Enabled' : 'Disabled'}`;
}

export function deactivate() {
  if (statusBarItem) {
    statusBarItem.dispose(); // Cleanup the status bar item when the extension is deactivated
  }
}

