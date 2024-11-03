import * as vscode from 'vscode';
import { TabHistoryProvider } from './TabHistoryProvider';
import { Tab } from './Tab';
import { getInputFromPrompt } from './utils';
import { filterTabsByPattern } from './tabFiltering';

export function registerHistoryCmdsAndListeners(context: vscode.ExtensionContext, tabHistoryProvider: TabHistoryProvider) {
  const tabHistoryLimitChangeListener = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('tabby.tabHistoryLimit')) {
      tabHistoryProvider.onTabHistoryLimitChange();
  
    }
  });
  
  // Listen for tab close events to track closed tabs
  const tabCloseListener = vscode.window.tabGroups.onDidChangeTabs((event) => {
    event.closed.forEach((tab) => {
  
      const closedTab = Tab.fromVscodeTab(tab);
      //console.log("Closed tab %s has type %s", closedTab.label, closedTab.type);
      if (closedTab.type !== 'Unknown' && closedTab.type !== 'Webview' && closedTab.type !== 'Terminal') {
        tabHistoryProvider.pushToTabHistory(closedTab);
      }
  
    });
  });
  
  
  const reopenFromHistoryCmd =  vscode.commands.registerCommand('tabby.reopenFromHistory', async () => {
      const filterPattern = await getInputFromPrompt("Enter the filter: ", "t*, 1:3");
      if (!filterPattern) {
          return;
      }
  
      const tabsToOpen = filterTabsByPattern(tabHistoryProvider.closedTabsHistory, filterPattern, false); 
      
      if (tabsToOpen.length === 0) {
          vscode.window.showInformationMessage('No tabs matched the filter.');
          return;
      }
  
      for (const tab of tabsToOpen) {
        tab.open();
      }
  
    });
  
  
    const clearTabHistoryCmd = vscode.commands.registerCommand('tabby.clearTabHistory', () => {
      tabHistoryProvider.clearTabHistory();
    });

    context.subscriptions.push(    
      reopenFromHistoryCmd,
      clearTabHistoryCmd,
      tabCloseListener,
      tabHistoryLimitChangeListener,
    );
}

