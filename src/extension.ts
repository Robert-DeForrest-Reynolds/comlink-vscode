import * as vscode from 'vscode';

let is_activated = false;


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
	if (is_activated) {
		error("com-link is already activated", true);
		return;
	}
	const workspace_folders = vscode.workspace.workspaceFolders;

	if (!workspace_folders || workspace_folders.length === 0){
		error("No workspace is open.", true);
		return;
	}
	
	if (workspace_folders.length === 2){
		error("Detected 2 workspaces open, will only init for the first workspace detected.", true);
	}

	const workspace_uri = workspace_folders[0].uri;
	const com_link_dir_path = vscode.Uri.joinPath(workspace_uri, 'com-link');


	try {
		const com_link_dir_stat = await vscode.workspace.fs.stat(com_link_dir_path);
		if (com_link_dir_stat.type === vscode.FileType.Directory){
			error('com-link directory already exists in workspace folder.', true);
		} else {
			log('Creating com-link directory...', true);
			await vscode.workspace.fs.createDirectory(com_link_dir_path);
			log(`Directory ready:\n${com_link_dir_path.fsPath}`, true);
		}
	} catch (err) {
		error("Failed to create com-link directory for some reason.", true);
	}
}


export function activate(context: vscode.ExtensionContext) {
    const output = vscode.window.createOutputChannel('com-link');

	const init_command = vscode.commands.registerCommand('com-link.init', init_com_link);
	context.subscriptions.push(init_command);

	vscode.window.showInformationMessage("com-link active");
	is_activated = true;
}

// This method is called when your extension is deactivated
export function deactivate() {}
