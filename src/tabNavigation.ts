import { isInputBoxVisible } from "./utils";
import { isTabModeEnabled } from "./tabby";
import * as vscode from 'vscode';

export function registerNavCmdsAndListeners(context: vscode.ExtensionContext) {
	const navigateToTabCmd = vscode.commands.registerCommand('tabby.navigateToTab', (args: { tabIndex: number }) => {
		if (!isTabModeEnabled() || isInputBoxVisible()) return;
		const tabIndex = args.tabIndex;
		vscode.commands.executeCommand('workbench.action.openEditorAtIndex', tabIndex);
	});

	const navigateToTabPreviousCmd = vscode.commands.registerCommand('tabby.navigateToTabPrevious', async () => {
		if (!isTabModeEnabled() || isInputBoxVisible()) return;

		await vscode.commands.executeCommand('workbench.action.previousEditor');

	});

	const navigateToTabNext = vscode.commands.registerCommand('tabby.navigateToTabNext', async () => {
		if (!isTabModeEnabled() || isInputBoxVisible()) return;

		await vscode.commands.executeCommand('workbench.action.nextEditor');

	});

	const moveTabLeftCmd = vscode.commands.registerCommand('tabby.moveTabLeft', async () => {
		if (!isTabModeEnabled() || isInputBoxVisible()) return;

		await vscode.commands.executeCommand('workbench.action.moveEditorLeftInGroup');

	});

	const moveTabRightCmd = vscode.commands.registerCommand('tabby.moveTabRight', async () => {
		if (!isTabModeEnabled() || isInputBoxVisible()) return;

		await vscode.commands.executeCommand('workbench.action.moveEditorRightInGroup');

	});

	const closeTabCmd = vscode.commands.registerCommand('tabby.closeTab', async () => {
		if (!isTabModeEnabled() || isInputBoxVisible()) return;

		await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

	});

	context.subscriptions.push(
		navigateToTabNext,
		navigateToTabPreviousCmd,
		navigateToTabCmd,
		closeTabCmd,
		moveTabRightCmd,
		moveTabLeftCmd,
	);
}

