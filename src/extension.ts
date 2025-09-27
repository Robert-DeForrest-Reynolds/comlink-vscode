import * as vscode from 'vscode';
import { spawn } from "child_process";

let is_initalized = false;
const output = vscode.window.createOutputChannel('comlink');
let comlinkpy_path: string | null = null;
let workspace_uri: vscode.Uri | null = null;
let com_link_dir_path: vscode.Uri | null = null;

let stack = "";

let cache:Record<string, string> = {
	'12348':'i\'m some comment'
};

let decl_started = false;
let creating = false;

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



function log(msg:string, pop:boolean=false){
	output.appendLine(msg);
	if (pop){
		vscode.window.showInformationMessage(msg);
	}
}

function error(msg:string, pop:boolean=false){
	output.appendLine(msg);
	if (pop){
		vscode.window.showErrorMessage(msg);
	}
}


async function init_comlink() {
	if (is_initalized) {
		error("comlink is already initialized", true);
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
				error('comlink directory already exists.', true);
			} else {
				error('A file exists with the same name as comlink directory.', true);
			}
		} catch {
			// Path doesn’t exist → create it
			log('Creating comlink directory...', true);
			await vscode.workspace.fs.createDirectory(com_link_dir_path);
			log(`Directory ready:\n${com_link_dir_path.fsPath}`, true);
		}
	} catch (err) {
		error("Failed to create comlink directory for some reason.", true);
	}
}


function get_comment(symbol: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
		let child;
		if (comlinkpy_path){
			child = spawn("python", [comlinkpy_path, symbol]);

			let collected = '';

			child.stdout.on("data", (data: Buffer) => {
				const text = data.toString();
				collected += text;
				output.appendLine(text.trim());
			});

			child.stderr.on("data", (data: Buffer) => {
				const text = data.toString();
				output.appendLine("ERROR: " + text.trim());
			});

			child.on("close", (code) => {
				resolve(collected.trim() || null);
			});

			return new vscode.Hover(`**${collected}**`);
		}
    });
}


function create() {
	creating = false;
	decl_started = false;
	let id = "id:12348";
	stack = '';
	return id;
}


function check_character(event:vscode.TextDocumentChangeEvent){
	const editor = vscode.window.activeTextEditor;
	if (!editor) { return; }

	let language_id = editor.document.languageId;

	if (event.document !== editor.document) { return; }

	for (const change of event.contentChanges) {
		if (change.text.length > 0) {
			const last_char = change.text[change.text.length - 1];
            const line = editor.document.lineAt(change.range.start.line);
			if (last_char === '*' && decl_started){
				creating = true;
			}
			else if (last_char === '~' && !decl_started){
				decl_started = true;
			}
			else if (last_char === '~' && creating){
				let replacement = create();
				if (language_id === 'html'){
					editor.edit(editBuilder => {
						editBuilder.replace(line.range, comment_map[language_id] + replacement + '-->');
					});
				}
				else if (language_id === 'css'){
					editor.edit(editBuilder => {
						editBuilder.replace(line.range, comment_map[language_id] + replacement + '*/');
					});
				} else {
					editor.edit(editBuilder => {
						editBuilder.replace(line.range, comment_map[language_id] + replacement);
					});
				}
			}
			else if (last_char === '~' && !creating && decl_started){
				decl_started = false;
			}
			else if (last_char !== '') {
				stack += last_char;
			}
		}
	}
}


export function activate(context: vscode.ExtensionContext) {
    comlinkpy_path = context.asAbsolutePath("comlink.py");
	const init_command = vscode.commands.registerCommand('comlink.init', init_comlink);
	context.subscriptions.push(init_command);

	vscode.workspace.onDidChangeTextDocument(event => check_character(event));


    const provider = vscode.languages.registerHoverProvider(
        { scheme: "file", language: "*" },
        {
            async provideHover(document, position) {
                let text = document.lineAt(position.line).text;
				let split = text.split(":");
				let id = '';
				if (split[0] === '#id'){
					id = split[1];
				}

				// actual statement:
                // const doc = get_comment[id];
                const doc = cache[id];
                if (doc) {
					log(doc);
                    return new vscode.Hover(doc);
                }

                return undefined;
            }
        }
    );

    context.subscriptions.push(provider);

	vscode.window.showInformationMessage("comlink active");
}

export function deactivate() {}
