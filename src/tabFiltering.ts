import * as vscode from 'vscode';
import { Tab } from './Tab';
import * as path from 'path';
import * as utils from './utils';
import { getInputFromPrompt } from './utils';
import { savedTabsForUndo } from './tabClosing';

export function filterTabsByPattern<T extends vscode.Tab | Tab>(
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
			else if (filter.startsWith('?')) {
				const match_subfolders = filter.endsWith('*');
				const cleaned_filter = match_subfolders? filter.slice(1, -1): filter.slice(1);
				const filterPath = utils.validateAndObtainAbsolutePath(cleaned_filter);
				// console.log("filterpath = ", filterPath);
				if (filterPath) {
					if (tabUri) {
						const tabFolderPath = vscode.Uri.file(path.dirname(tabUri.path)).path;
						// console.log("tabfolderpath = ", tabFolderPath);
						if (tabFolderPath === filterPath || (match_subfolders && tabFolderPath.startsWith(filterPath))) {
							matched = true;
							break;
						}
					} else if (tabModifiedUri && tabOriginalUri) {
						const tabModifiedFolderPath = vscode.Uri.file(path.dirname(tabModifiedUri.path)).path;
						const tabOriginalFolderPath = vscode.Uri.file(path.dirname(tabOriginalUri.path)).path;
						const tabModifiedMatch = tabModifiedFolderPath === filterPath || (match_subfolders && tabModifiedFolderPath.startsWith(filterPath));
						const tabOriginalMatch = tabOriginalFolderPath === filterPath || (match_subfolders && tabOriginalFolderPath.startsWith(filterPath));
						if ( tabModifiedMatch || tabOriginalMatch ) {
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

// Utility function to convert wildcard patterns (* and _) to RegExp
function convertPatternToRegex(pattern: string): RegExp {
	// Escape any special regex characters
	const escapedPattern = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');

	// Replace * with .* (zero or more characters)
	const regexPattern = escapedPattern.replace(/\*/g, '.*').replace(/_/g, '.');

	return new RegExp(`^${regexPattern}$`, 'i'); // Case-insensitive, match whole string
}

export function registerFilterCmdsAndListeners(context: vscode.ExtensionContext) {

	const filterTabsCmd = vscode.commands.registerCommand('tabby.filterTabs', async () => {
		const filterPattern = await getInputFromPrompt("Enter the filter: ", "*.py, 1:3, ?myfolder, \\123");
		if (!filterPattern) {
		return;
		}
		const activeTabs = vscode.window.tabGroups.activeTabGroup.tabs;

		let tabsToClose = filterTabsByPattern(activeTabs, filterPattern, true);
		
		const closePinnedTabs = vscode.workspace.getConfiguration('tabby').get<boolean>('closePinnedTabs', false);
		// Dont close pinned tabs
		if (!closePinnedTabs)	{
			tabsToClose = tabsToClose.filter(tab => {
				return !tab.isPinned;
			});
		}

		if (tabsToClose.length === activeTabs.length) {
			vscode.window.showInformationMessage('No tab matched the filter.');
			return;
		}

		const areAllTabsClosed = await vscode.window.tabGroups.close(tabsToClose);
		if (areAllTabsClosed) {
			savedTabsForUndo.push(activeTabs.map(tab => Tab.fromVscodeTab(tab)));
		}
	});

	context.subscriptions.push(
		filterTabsCmd,
	);
}

