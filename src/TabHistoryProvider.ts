import * as vscode from 'vscode';
import { Tab } from './Tab';

// Tree Data Provider for closed tabs
export class TabHistoryProvider implements vscode.TreeDataProvider<Tab> {

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