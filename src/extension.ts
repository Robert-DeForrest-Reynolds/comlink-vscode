import * as vscode from 'vscode';
import { spawn } from "child_process";
import * as path from "path";
import { types } from 'util';

let is_initalized = false;
const output = vscode.window.createOutputChannel('comlink');
let comlinkpy_path: string | null = null;
let workspace_uri: vscode.Uri | null = null;
let com_link_dir_path: vscode.Uri | null = null;

function log(msg:string, pop:boolean=false){
	console.log(msg);
	if (pop){
		vscode.window.showInformationMessage(msg);
	}
}

function error(msg:string, pop:boolean=false){
	console.error(msg);
	if (pop){
		vscode.window.showErrorMessage(msg);
	}
}


async function init_com_link() {
	if (is_initalized) {
		error("com-link is already initialized", true);
		return;
	} else {
		is_initalized = true;
	}
	const workspace_folders = vscode.workspace.workspaceFolders;

	if (!workspace_folders || workspace_folders.length === 0){
		error("No workspace is open.", true);
		return;
	}
	
	if (workspace_folders.length === 2){
		error("Detected 2 workspaces open, will only init for the first workspace detected.", true);
	}

	workspace_uri = workspace_folders[0].uri;
	com_link_dir_path = vscode.Uri.joinPath(workspace_uri, 'comlink');


	try {
		try {
			const stat = await vscode.workspace.fs.stat(com_link_dir_path);
			if (stat.type === vscode.FileType.Directory) {
				error('com-link directory already exists.', true);
			} else {
				error('A file exists with the same name as com-link directory.', true);
			}
		} catch {
			// Path doesn’t exist → create it
			log('Creating com-link directory...', true);
			await vscode.workspace.fs.createDirectory(com_link_dir_path);
			log(`Directory ready:\n${com_link_dir_path.fsPath}`, true);
		}
	} catch (err) {
		error("Failed to create com-link directory for some reason.", true);
	}
}


function getCommentForSymbol(symbol: string): Promise<string | null> {
	log("getting comment");
    return new Promise((resolve, reject) => {
		let child;
		if (comlinkpy_path){
			log("Getting comment...", true);
			child = spawn("python", [comlinkpy_path, symbol]);

			let collected = "";

			// listen to stdout
			child.stdout.on("data", (data: Buffer) => {
				const text = data.toString();
				collected += text;
				output.appendLine(text.trim()); // log to OutputChannel live
			});

			// listen to stderr
			child.stderr.on("data", (data: Buffer) => {
				const text = data.toString();
				output.appendLine("ERROR: " + text.trim());
			});

			// process exits
			child.on("close", (code) => {
				resolve(collected.trim() || null);
			});
		}
    });
}


export function activate(context: vscode.ExtensionContext) {
    comlinkpy_path = context.asAbsolutePath("comlink.py");
	const init_command = vscode.commands.registerCommand('com-link.init', init_com_link);
	context.subscriptions.push(init_command);


    const provider = vscode.languages.registerHoverProvider(
        { scheme: "file", language: "*" },
        {
            async provideHover(document, position) {
                const range = document.getWordRangeAtPosition(position);
                if (!range) { return; }

                const symbol = document.getText(range);

                const doc = await getCommentForSymbol(symbol);
                if (doc) {
					log(doc);
                    return new vscode.Hover(doc);
                }

                return undefined;
            }
        }
    );

    context.subscriptions.push(provider);

	vscode.window.showInformationMessage("com-link active");
}

// This method is called when your extension is deactivated
export function deactivate() {}
