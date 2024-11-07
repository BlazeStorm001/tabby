import * as vscode from 'vscode';
import { Tab } from './Tab';
import { TabHistoryProvider } from './TabHistoryProvider';
import { isInputBoxVisible } from './utils';
import { isTabModeEnabled } from './tabby';

//for undo restore closed tabs in Tab Mode
class SavedTabManager {
	readonly tabs: any[] = [];
	readonly maxUndoOperations = 100;

	push(tabs: Tab[]) {
		this.tabs.push(tabs);
		if (this.tabs.length > this.maxUndoOperations) {
			this.tabs.shift();
		}
	}
	
	undoClose() {
		if (!this.tabs || this.tabs.length === 0) {
			return;
		}
		const lastClosedTabs = this.tabs.pop();
		for (const tab of lastClosedTabs) {
			tab.open();
		}
	}	

}

export const savedTabsForUndo = new SavedTabManager();


export function registerCloseCmdsAndListeners(context: vscode.ExtensionContext, tabHistoryProvider: TabHistoryProvider) {
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

	const closeTabCmd = vscode.commands.registerCommand('tabby.closeTab', async () => {
		if (!isTabModeEnabled() || isInputBoxVisible()) return;

		// await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
		if (activeTab) {
			const savedActiveTab = Tab.fromVscodeTab(activeTab);
			await vscode.window.tabGroups.close(activeTab);
			savedTabsForUndo.push([savedActiveTab]);
		} else {
			console.log("No active tab to close.");
		}
		


	});

	const closeAllTabsCmd = vscode.commands.registerCommand('tabby.closeAllTabs', async () => {
		if (!isTabModeEnabled() || isInputBoxVisible()) return;

		// await vscode.commands.executeCommand('workbench.action.closeAllEditors');
		const activeTabs = vscode.window.tabGroups.activeTabGroup.tabs;
		if (activeTabs) {
			const savedActiveTabs = activeTabs.map(tab => Tab.fromVscodeTab(tab)); 
			await vscode.window.tabGroups.close(activeTabs);
			savedTabsForUndo.push(savedActiveTabs);
		} else {
			console.log("No active tabs to close.");
		}
		

	});
	const undoRecentlyClosedTabsCmd = vscode.commands.registerCommand('tabby.undoRecentlyClosedTabs', async () => {
		if (!isTabModeEnabled() || isInputBoxVisible() || !savedTabsForUndo) return;

		savedTabsForUndo.undoClose();
	});

	context.subscriptions.push(
		tabCloseListener,
		closeTabCmd,
		closeAllTabsCmd,
		undoRecentlyClosedTabsCmd
	);
}


