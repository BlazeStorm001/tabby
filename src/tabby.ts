import * as vscode from 'vscode';
import * as path from 'path';


let tabModeActive = false;
let inputBoxVisible = false;
let statusBarItem: vscode.StatusBarItem;

class Tab {
  readonly label: string;
  readonly type: string;
  readonly input?: {
    readonly uri?: vscode.Uri; // For normal text or notebook tabs
    readonly original?: vscode.Uri; // For TextDiff or NotebookDiff tabs
    readonly modified?: vscode.Uri; // For TextDiff or NotebookDiff tabs
  };
  readonly timestamp?: number;


  constructor(
    label: string,
    type: string,
    uri?: vscode.Uri,
    originalUri?: vscode.Uri,
    modifiedUri?: vscode.Uri,
    timestamp?: number
  ) {
    this.label = label;
    this.type = type;
    this.input = { uri, original: originalUri, modified: modifiedUri };
    this.timestamp = timestamp;
  }

  toJSON(): string {
    return JSON.stringify({
      label: this.label,
      type: this.type,
      uri: this.input?.uri?.toString(),
      originalUri: this.input?.original?.toString(),
      modifiedUri: this.input?.modified?.toString(),
      timestamp: this.timestamp
    });
  }

  static fromJSON(json: string): Tab {
    const data = JSON.parse(json);
    const label = data.label;
    const type = data.type;

    const uri = data.uri ? vscode.Uri.parse(data.uri) : undefined;
    const originalUri = data.originalUri ? vscode.Uri.parse(data.originalUri) : undefined;
    const modifiedUri = data.modifiedUri ? vscode.Uri.parse(data.modifiedUri) : undefined;
    const timestamp = data.timestamp;
    return new Tab(label, type, uri, originalUri, modifiedUri, timestamp);
  }

  static fromVscodeTab(tab: vscode.Tab, timestamp?: number): Tab {
    const label = tab.label;
    const type = this.getTabType(tab);
    let uri: vscode.Uri | undefined;
    let originalUri: vscode.Uri | undefined;
    let modifiedUri: vscode.Uri | undefined;

    if (type === 'Text' || type === 'Custom' || type === 'Notebook') {
      const tabInput = tab.input as vscode.TabInputText;
      uri = tabInput.uri;
    } else if (type === 'TextDiff' || type === 'NotebookDiff') {
      const tabInput = tab.input as vscode.TabInputTextDiff;
      originalUri = tabInput.original;
      modifiedUri = tabInput.modified;
    }

    return new Tab(label, type, uri, originalUri, modifiedUri, timestamp);
  }

  open() {
    try {
      switch (this.type) {
        case 'Text':
        case 'Notebook':
        case 'Custom':
          vscode.commands.executeCommand('vscode.open', this.input?.uri);
          break;

        case 'TextDiff':
        case 'NotebookDiff':
          vscode.commands.executeCommand('vscode.diff', this.input?.original, this.input?.modified);
          break;

        default:
          break;
      }
    } catch (error) {
      const err = error as Error;
      vscode.window.showInformationMessage(`Failed to open "${this.label}": ${err.message}`);
      //console.error(`Error opening this ${this.label}:`, err); // Log the error for debugging
    }
  }

  static getTabType(tab: vscode.Tab): string {
    if (tab.input instanceof vscode.TabInputText) {
      return 'Text';
    } else if (tab.input instanceof vscode.TabInputNotebook) {
      return 'Notebook';
    } else if (tab.input instanceof vscode.TabInputCustom) {
      return 'Custom';
    } else if (tab.input instanceof vscode.TabInputTextDiff) {
      return 'TextDiff';
    } else if (tab.input instanceof vscode.TabInputNotebookDiff) {
      return 'NotebookDiff';
    } else if (tab.input instanceof vscode.TabInputWebview) {
      return 'Webview';
    } else if (tab.input instanceof vscode.TabInputTerminal) {
      return 'Terminal';
    } else {
      return 'Unknown';
    }
  }

  equals(other: Tab): boolean {
    return (
      this.label === other.label &&
      this.type === other.type &&
      this.input?.uri?.toString() === other.input?.uri?.toString() &&
      this.input?.original?.toString() === other.input?.original?.toString() &&
      this.input?.modified?.toString() === other.input?.modified?.toString()
    );
  }

  toString(): string {
    if (this.type === 'TextDiff' || this.type === 'NotebookDiff') {
      return `${this.type}: ${this.input?.original} ⇔ ${this.input?.modified}`;
    } else {
      return `${this.type}: ${this.input?.uri}`;
    }
  }
}



export function activate(context: vscode.ExtensionContext) {
  //console.log(getCurrentOpenFolderPath() );
  // Create the status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  statusBarItem.show(); // Ensure it is always shown
  updateStatusBar(); // Initial status bar update

  const closedTabsProvider =  new ClosedTabsProvider(context);

  const tabHistoryLimitChangeListener =  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('tabby.tabHistoryLimit')) {
      closedTabsProvider.onTabHistoryLimitChange();
      
    }
  }); 


  // Create a TreeView to display closed tabs history
  const closedTabsTreeView = vscode.window.createTreeView('closedTabsHistory', {
    treeDataProvider: closedTabsProvider,
    showCollapseAll: true,
  });

 // Listen for tab close events to track closed tabs
  const tabCloseListener = vscode.window.tabGroups.onDidChangeTabs((event) => {
    event.closed.forEach((tab) => {
      
      const closedTab = Tab.fromVscodeTab(tab);
      //console.log("Closed tab %s has type %s", closedTab.label, closedTab.type);
      if (closedTab.type !== 'Unknown' && closedTab.type !== 'Webview' && closedTab.type !== 'Terminal') {
        closedTabsProvider.pushToTabHistory(closedTab);
      }

    });
  });

  
  
  const toggleTabModeCmd = vscode.commands.registerCommand('tabby.toggleTabMode', async () => {
    tabModeActive = !tabModeActive;
    await vscode.commands.executeCommand('setContext', 'tabModeActive', tabModeActive);

    updateStatusBar(); // Update status bar after toggling Tab Mode

  });

  const clearTabHistoryCmd = vscode.commands.registerCommand('tabby.clearTabHistory', () => {
    closedTabsProvider.clearTabHistory();
  });

  const filterTabsCmd = vscode.commands.registerCommand('tabby.filterTabs', async () => {
    const filterPattern = await getInputfromPrompt("Enter the filter: ", "*.py, 1:3, ?myfolder, \\123");
    if (!filterPattern) {
        return;
    }
    const activeTabs = vscode.window.tabGroups.activeTabGroup.tabs;
    
    let tabsToClose = filterTabsByPattern(activeTabs, filterPattern, true); 

    // Dont close pinned tabs
    tabsToClose = tabsToClose.filter(tab => {
      return !tab.isPinned;
    });

    if (tabsToClose.length === activeTabs.length) {
        vscode.window.showInformationMessage('No tab matched the filter.');
        return; 
    }

    
    await vscode.window.tabGroups.close(tabsToClose);

});
  
  const navigateToTabCmd =  vscode.commands.registerCommand('tabby.navigateToTab', (args: { tabIndex: number }) => {
    if (!tabModeActive || inputBoxVisible) return; 
    const tabIndex = args.tabIndex;
    // Focus on the file explorer before navigating to the tab
    vscode.commands.executeCommand('workbench.action.openEditorAtIndex', tabIndex);
  });

  const navigateToTabPreviousCmd = vscode.commands.registerCommand('tabby.navigateToTabPrevious', async () => {
    if (!tabModeActive || inputBoxVisible) return;
    
    // navigate to the previous tab
    await vscode.commands.executeCommand('workbench.action.previousEditor');

  });

  const navigateToTabNext = vscode.commands.registerCommand('tabby.navigateToTabNext', async () => {
    if (!tabModeActive || inputBoxVisible) return; 

    await vscode.commands.executeCommand('workbench.action.nextEditor');

  });

  const moveTabLeftCmd = vscode.commands.registerCommand('tabby.moveTabLeft', async () => {
    if (!tabModeActive || inputBoxVisible) return; 
    
    // navigate to the previous tab
    await vscode.commands.executeCommand('workbench.action.moveEditorLeftInGroup');

  });

  const moveTabRightCmd = vscode.commands.registerCommand('tabby.moveTabRight', async () => {
    if (!tabModeActive || inputBoxVisible) return;
    
    // navigate to the previous tab
    await vscode.commands.executeCommand('workbench.action.moveEditorRightInGroup');

  });

  const closeTabCmd = vscode.commands.registerCommand('tabby.closeTab', async () => {
    if (!tabModeActive || inputBoxVisible) return;
    
    // navigate to the previous tab
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

  });


  const reopenFromHistoryCmd =  vscode.commands.registerCommand('tabby.reopenFromHistory', async () => {
    const filterPattern = await getInputfromPrompt("Enter the filter: ", "t*, 1:3");
    if (!filterPattern) {
        // Set to false if input is cancelled
        return;
    }

    const tabsToOpen = filterTabsByPattern(closedTabsProvider.closedTabsHistory, filterPattern, false); 
    
    if (tabsToOpen.length === 0) {
        vscode.window.showInformationMessage('No tabs matched the filter.');
        return;
    }

    for (const tab of tabsToOpen) {
      tab.open();
    }

  });


  context.subscriptions.push(    
    reopenFromHistoryCmd,
    navigateToTabNext,
    navigateToTabPreviousCmd,
    navigateToTabCmd,
    clearTabHistoryCmd,
    closeTabCmd,
    moveTabRightCmd,
    moveTabLeftCmd,
    filterTabsCmd,
    toggleTabModeCmd,
    closedTabsTreeView,
    statusBarItem,
    tabCloseListener,
    closedTabsTreeView,
    tabHistoryLimitChangeListener,
  );


  
}


function getCurrentOpenFolderPath(): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (workspaceFolders && workspaceFolders.length > 0) {
    // Return the path of the first workspace folder
    return workspaceFolders[0].uri.path;
  }

  return ""; // No folder is open
}

//validates path and converts to absolute if relative path supplied
function validateAndObtainAbsolutePath(inputPath: string): string {
  // Resolve to absolute path
  const currentWorkSpaceFolderPath = getCurrentOpenFolderPath();
  //console.log("currentWorkSpaceFolderPath = ", currentWorkSpaceFolderPath);
  if (!path.isAbsolute(inputPath)) {
    inputPath = path.join(path.join(currentWorkSpaceFolderPath,""), inputPath);
  }
  //console.log("After conversion to abs path, inputPath = ", inputPath);
  try {
      // TODO: Add check to verify if valid path
      return vscode.Uri.file(inputPath).path;
  } catch (error) {
    return "";
  }

}


function filterTabsByPattern<T extends vscode.Tab | Tab>(
  tabs: readonly T[],
  pattern: string,
  invertMatch: boolean
): T[] {
  // Split the input into different filters by commas
  const filters = pattern.split(',').map(f => f.trim());

  const filteredTabs: T[] = [];

  // Iterate over all tabs and check if they match the filter patterns
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    const tabFileName = tab.label;
    let tabUri: vscode.Uri | undefined;
    let tabModifiedUri: vscode.Uri | undefined;
    let tabOriginalUri: vscode.Uri | undefined;
    let tabType: string;

    if (tab instanceof Tab) {
      tabType = tab.type;
    } else {
      tabType = Tab.getTabType(tab);
    }

    if (tabType === 'Text' || tabType === 'Notebook' || tabType === 'Custom') {
      tabUri = (tab.input as any).uri;
    } else if (tabType === 'TextDiff' || tabType === 'NotebookDiff') {
      tabOriginalUri = (tab.input as any).original;
      tabModifiedUri = (tab.input as any).modified;
    }

    //console.log(`Tab File Name: ${tabFileName}`);

    let matched = false;

    for (const filter of filters) {
      // If the filter is a range (e.g., 1:3)
      if (/^\d*:\d*$/.test(filter)) {
        //console.log("Filter passed");
        let [start, end]: any[] = filter.split(':');
        if (!start) {
          start = 1;
        } else {
          start = Number(start);
        }
        // If the end is omitted (e.g., "1:"), set it to the length of the array
        if (!end) {
          end = tabs.length;
        } else {
          end = Number(end);
        }
        if (i >= start - 1 && i <= end - 1) {
          matched = true;
          break;
        }
      }
      // If the filter is a complete number (e.g., 5)
      else if (/^\d+$/.test(filter)) {
        if (i === Number(filter) - 1) {
          matched = true;
          break;
        }
      }
      // If the filter is a number preceded by a backslash (e.g., \123) [used for filenames that only contain numbers]
      else if (/^\\\d+$/.test(filter)) {
        const number = filter.slice(1); // Remove the backslash
        if (tabFileName.includes(number)) {
          matched = true;
          break;
        }
      }
      // filter by path when pattern starts with '?'
      else if(filter.startsWith('?')) {
        const filterPath = validateAndObtainAbsolutePath(filter.slice(1));
        //console.log("filterpath = ", filterPath);
        if (filterPath) {
          if (tabUri) {
            const tabFolderPath = vscode.Uri.file(path.dirname(tabUri.path)).path;
            if (tabFolderPath === filterPath) {
              matched = true;
              break;
            }
          } else if (tabModifiedUri && tabOriginalUri) {
            const tabModifiedFolderPath = vscode.Uri.file(path.dirname(tabModifiedUri.path)).path;
            const tabOriginalFolderPath = vscode.Uri.file(path.dirname(tabOriginalUri.path)).path;
            if (tabModifiedFolderPath === filterPath || tabOriginalFolderPath === filterPath) {
              matched = true;
              break;
            }
          }          
        }
      }
      // Otherwise, treat it as a wildcard pattern (e.g., t*, __)
      else {
        const filterRegex = convertPatternToRegex(filter);
        if (filterRegex.test(tabFileName)) {
          matched = true;
          break;
        }
      }
    }

    if ((!invertMatch && matched) || (invertMatch && !matched)) {
      filteredTabs.push(tab);
    }
  }

  return filteredTabs;
}

async function getInputfromPrompt(prompt: string, placeHolder: string) {
    inputBoxVisible = true;
    await vscode.commands.executeCommand('setContext', 'inputBoxVisible', inputBoxVisible);

    // Prompt the user to input the filter pattern (e.g., 't*', '1:3', '\\12.txt')
    const input = await vscode.window.showInputBox({
        prompt: prompt,
        placeHolder: placeHolder,
    });

    // Mark input box as not visible after closing
    inputBoxVisible = false;
    await vscode.commands.executeCommand('setContext', 'inputBoxVisible', inputBoxVisible);
    return input;
}

// Tree Data Provider for closed tabs
class ClosedTabsProvider implements vscode.TreeDataProvider<Tab> {

  private _onDidChangeTreeData: vscode.EventEmitter<Tab | undefined | null | void> = new vscode.EventEmitter<Tab | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<Tab | undefined | null | void> = this._onDidChangeTreeData.event;
  closedTabsHistory: Tab[] = [];
  constructor(private context: vscode.ExtensionContext) {
    this.context = context;
    this.closedTabsHistory = this.restoreClosedTabsHistory();
    //console.log("Restored Tab history : ", this.closedTabsHistory);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(tab: Tab): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(tab.label, vscode.TreeItemCollapsibleState.None);
    
    if (tab.type === 'Text' || tab.type === 'Notebook' || tab.type === 'Custom') {
  
      treeItem.command = {
        command: 'vscode.open', 
        title: 'Open File',
        arguments: [tab.input?.uri], 
      };
  
      // Set tooltip to show the full file path
      treeItem.tooltip = tab.input?.uri?.fsPath;
  
    } else if (tab.type === 'TextDiff' || tab.type === 'NotebookDiff') {
  
      treeItem.command = {
        command: 'vscode.diff', 
        title: 'Open Diff',
        arguments: [tab.input?.original, tab.input?.modified], 
      };
  
      // Set tooltip to show paths of the files being compared
      treeItem.tooltip = `${tab.input?.original?.fsPath} ⇔ ${tab.input?.modified?.fsPath}`;
    }
  
    return treeItem;
  }
  

  getChildren(): Tab[] {
    return this.closedTabsHistory;
  }

  saveClosedTabsHistory(): void {
    const serializedTabs = this.closedTabsHistory.map(tab => tab.toJSON()); // Serialize each Tab
    this.context.workspaceState.update('closedTabsHistory', serializedTabs); // Save to workspace state
  }

  restoreClosedTabsHistory(): Tab[] {
    const serializedTabs = this.context.workspaceState.get<string[]>('closedTabsHistory', []);
    return serializedTabs.map(Tab.fromJSON); // Deserialize each Tab object
  }

  pushToTabHistory(newTab: Tab) {
    const newTabIndex = this.closedTabsHistory.findIndex(tab => tab.equals(newTab));
    //console.log("new tab index ", newTabIndex);
    if (newTabIndex == -1) {
      const tabLimit = vscode.workspace.getConfiguration('tabby').get<number>('tabHistoryLimit', 1000);
      if (this.closedTabsHistory.length >= tabLimit) {
        this.closedTabsHistory.pop();
      }
      this.closedTabsHistory.unshift(newTab);
    } else {
      //move existing tab to the first index
      this.closedTabsHistory.unshift(this.closedTabsHistory.splice(newTabIndex, 1)[0]);
    }
    this.saveClosedTabsHistory();
    this.refresh();
  }

  onTabHistoryLimitChange() {
    const config = vscode.workspace.getConfiguration('tabby');
    const updatedTabHistoryLimit = config.get<number>('tabHistoryLimit', 1000);
      
    if (this.closedTabsHistory.length > updatedTabHistoryLimit) {
      this.closedTabsHistory = this.closedTabsHistory.slice(0, updatedTabHistoryLimit);
      this.saveClosedTabsHistory();
      this.refresh();
    }

  }

  clearTabHistory() {
    this.closedTabsHistory = [];
    this.saveClosedTabsHistory();
    this.refresh();
  }

}

// Utility function to convert wildcard patterns (* and _) to RegExp
function convertPatternToRegex(pattern: string): RegExp {
  // Escape any special regex characters
  const escapedPattern = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');

  // Replace * with .* (zero or more characters)
  const regexPattern = escapedPattern.replace(/\*/g, '.*').replace(/_/g, '.');

  return new RegExp(`^${regexPattern}$`, 'i'); // Case-insensitive, match whole string
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

