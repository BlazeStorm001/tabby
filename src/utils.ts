import * as vscode from 'vscode';
import * as path from 'path';

export function getCurrentOpenFolderPath(): string {
	const workspaceFolders = vscode.workspace.workspaceFolders;

	if (workspaceFolders && workspaceFolders.length > 0) {
		// Return the path of the first workspace folder
		return workspaceFolders[0].uri.path;
	}

	return ""; // No folder is open
}

//validates path and converts to absolute if relative path supplied
export function validateAndObtainAbsolutePath(inputPath: string): string {
	// Resolve to absolute path
	const currentWorkSpaceFolderPath = getCurrentOpenFolderPath();
	//console.log("currentWorkSpaceFolderPath = ", currentWorkSpaceFolderPath);
	if (!path.isAbsolute(inputPath)) {
		inputPath = path.join(path.join(currentWorkSpaceFolderPath, ""), inputPath);
	}
	// console.log("inputpath =", inputPath);
	// uncapitalize the drive letter in Windows
	let finalPath = vscode.Uri.file(inputPath).path;
	finalPath = finalPath.replace(/^\/([A-Z]):/, (match, driveLetter) => "/" + driveLetter.toLowerCase() + ":");
	// console.log("After conversion to abs path, finalPath = ", finalPath);
	try {
		// TODO: Add check to verify if valid path
		return finalPath;
	} catch (error) {
		return "";
	}

}

let inputBoxVisible = false;

export function isInputBoxVisible() {
	return inputBoxVisible;
}

export async function getInputFromPrompt(prompt: string, placeHolder: string) {
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
  


