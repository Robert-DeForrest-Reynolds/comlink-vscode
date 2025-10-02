import * as vscode from 'vscode';
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import * as readline from "readline";

const output = vscode.window.createOutputChannel('comlink');
output.show();

const comment_map: Record<string, string> = {
    javascript: '//',
    typescript: '//',
    python: '#',
    cpp: '//',
    c: '//',
    java: '//',
    ruby: '#',
    go: '//',
    lua: '--',
    html: '<!--',
    css: '/*',
    php: '//',
};

const repoUrl = "https://github.com/Robert-DeForrest-Reynolds/comlink.git";

let is_initalized = false;
let comlink:ChildProcessWithoutNullStreams|null = null;
let comlink_dir_path: string | null = null;
let workspace_uri: vscode.Uri | null = null;
let comlink_project_dir_path: vscode.Uri | null = null;
let decl_started = false;
let decl_position:vscode.Position|null;
let creating = false;


let rl:readline.Interface|null = null;
let pendingResolve: ((val: string | null) => void) | null = null;


function log(msg:string, pop:boolean=false){
	output.appendLine(msg);
	if (pop){ vscode.window.showInformationMessage(msg); }
}


function error(msg:string, pop:boolean=false){
	output.appendLine(msg);
	if (pop){ vscode.window.showErrorMessage(msg); }
}


async function init_project_comlink() {
	if (is_initalized) {
		error("comlink is already initialized", true);
		return;
	} else { is_initalized = true; }

	comlink_project_dir_path = vscode.Uri.joinPath(workspace_uri!, 'comlink');
    comlink!.stdin.write(`>init\n`, "utf-8");

	try {
		try {
			const stat = await vscode.workspace.fs.stat(comlink_project_dir_path);
			if (stat.type === vscode.FileType.Directory) {
				error('comlink directory already exists.', true);
			} else {
				error('A file exists with the same name as comlink directory.', true);
			}
		} catch {
			await vscode.workspace.fs.createDirectory(comlink_project_dir_path);
			comlink!.stdin.write('*\n', 'utf-8');
			log(`Directory ready:\n${comlink_project_dir_path.fsPath}`, true);
		}
	} catch (err) {
		error("Failed to create comlink directory for some reason.", true);
	}
}


function get_comment(id: string): Promise<string | null> {
    comlink!.stdin.write(`@${id}\n`, "utf-8");
    return new Promise(resolve => {
        pendingResolve = resolve;
    });
}


async function create_comment(comment:string) {
	creating = false;
	decl_started = false;
	decl_position = null;
	comlink!.stdin.write(`~${comment}\n`, "utf-8");
    return new Promise(resolve => {
        pendingResolve = resolve;
    });
}


async function delete_comment() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    const currentLine = editor.selection.active.line;
    const lineText = editor.document.lineAt(currentLine).text;

    const id = lineText.split(":")[1]?.trim();
    if (!id) {
        vscode.window.showWarningMessage("No ID found on this line.");
        return;
    }

    comlink!.stdin.write(`&${id}\n`, "utf-8");

    editor.edit(editBuilder => {
        const lineRange = editor.document.lineAt(currentLine).range;
        editBuilder.replace(lineRange, '');
    });
}


async function process_document_change_event(event:vscode.TextDocumentChangeEvent){
	const editor = vscode.window.activeTextEditor;
	if (!editor) { return; }

	let language_id = editor.document.languageId;
	
	if (event.document !== editor.document) { return; }

	for (const change of event.contentChanges) {
		check_character(event, change, editor, language_id);
	}
}


async function check_character(event:vscode.TextDocumentChangeEvent,
							   change:vscode.TextDocumentContentChangeEvent,
							   editor:vscode.TextEditor, language_id:string){
	if (change.text === '' && change.rangeLength > 0) {
		const deletedText = event.document.getText(change.range);
		if (deletedText.includes('~')) {
			creating = false;
			decl_started = false;
		}
		else if (deletedText.includes('*')) {
			creating = false;
			decl_started = false;
		}
	}
	else if (change.text.length > 0) {
		const last_char = change.text[change.text.length - 1];
		if (last_char === '*' && decl_started){
			creating = true;
		}
		else if (last_char === '~' && !decl_started){
			decl_started = true;
			decl_position = new vscode.Position(change.range.start.line, change.range.start.character);
		}
		else if (last_char === '~' && creating) {
			const commentRange = new vscode.Range(decl_position!, new vscode.Position(change.range.end.line, change.range.end.character+1));

			const commentText = event.document.getText(commentRange).slice(2, -1);
			
			log(`creation text: ${commentText}`);
			const replacement = await create_comment(commentText);

			const fullReplacement =
				language_id === 'html' ? "" + replacement + '-->'
								: language_id === 'css' ? "" + replacement + '*/'
								: "" + replacement;

			editor.edit(editBuilder => {
				editBuilder.replace(commentRange, fullReplacement);
			});
		}
		else if (last_char === '~' && !creating && decl_started){
			decl_started = false;
		}
	}
}


function parse_comlink_data(data: Buffer) {
    const msg = data.toString().trim();
    if (pendingResolve) {
		if (msg.startsWith('~')){
			pendingResolve(`id:${msg.slice(1)}`);
			pendingResolve = null;
		} else {
			pendingResolve(msg);
			pendingResolve = null;
		}
    	output.appendLine(msg);
    }
}


export function activate(context: vscode.ExtensionContext) {
	const workspace_folders = vscode.workspace.workspaceFolders;

	if (!workspace_folders || workspace_folders.length === 0){
		error("No workspace is open.", true);
		return;
	}
	
	if (workspace_folders.length === 2){
		error("Detected 2 workspaces open, will only init for the first workspace detected.", true);
	}

	workspace_uri = workspace_folders[0].uri;
	
	comlink_dir_path = vscode.Uri.joinPath(context.extensionUri, 'comlink', '__main__.py').fsPath;

	const init_command = vscode.commands.registerCommand('comlink.init', init_project_comlink);
	context.subscriptions.push(init_command);

	const del_command = vscode.commands.registerCommand('comlink.del', delete_comment);
	context.subscriptions.push(del_command);

	if (!comlink_dir_path){ log("comlink cannot be found"); return;}
	if (!workspace_uri){ log("comlink cannot be found"); return;}

	log("Starting comlink process...");
	comlink = spawn("python", ['-B', comlink_dir_path, workspace_uri.fsPath]);
	if (!comlink){ log("comlink cannot be found"); return; }

	comlink.stdout.on("data", parse_comlink_data);

	comlink.stderr.on("data", (data: Buffer) => {
		output.appendLine("DEBUG: " + data.toString().trim());
	});

	vscode.workspace.onDidChangeTextDocument(event => process_document_change_event(event));

    const provider = vscode.languages.registerHoverProvider(
        { scheme: "file", language: "*" },
        {
            async provideHover(document, position) {
				let language_id = document.languageId;
                let text = document.lineAt(position.line).text;
				let id = text.split(`${comment_map[language_id]}ID:`)[1];
				if (!id) { return; }
                const comment = await get_comment(id);
                if (comment) {
                    return new vscode.Hover(comment);
                }

                return undefined;
            }
        }
    );

    context.subscriptions.push(provider);
}
