import * as vscode from 'vscode';

export class Tab {
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