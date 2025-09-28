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
let comlinkpy:ChildProcessWithoutNullStreams|null = null;
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
			log(`Directory ready:\n${comlink_project_dir_path.fsPath}`, true);
		}
	} catch (err) {
		error("Failed to create comlink directory for some reason.", true);
	}
}


function get_comment(id: string): Promise<string | null> {
    return new Promise(resolve => {
        pendingResolve = resolve;
        comlinkpy!.stdin.write(`${id}\n`, "utf-8");
    });
}


async function create(comment:string) {
	creating = false;
	decl_started = false;
	decl_position = null;
	comlinkpy!.stdin.write(`~${comment}\n`, "utf-8");
    return new Promise(resolve => {
        pendingResolve = resolve;
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
			const decl_end = change.range.end.translate(0, change.text.length);
			const commentRange = new vscode.Range(decl_position!, decl_end);
			const commentText = event.document.getText(commentRange).slice(2, -1);
			
			log(`creation text: ${commentText}`);
			const replacement = await create(commentText);

			const fullReplacement =
				language_id === 'html'
					? "" + replacement + '-->'
					: language_id === 'css'
					? "" + replacement + '*/'
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
	
	comlink_dir_path = context.asAbsolutePath("comlink.py");

	const init_command = vscode.commands.registerCommand('comlink.init', init_project_comlink);
	context.subscriptions.push(init_command);

	log("Trying to start comlink process");
	if (!comlink_dir_path){ log("comlinkpy cannot be found"); return;}
	if (!workspace_uri){ log("comlinkpy cannot be found"); return;}

	log("Starting comlinkpy process");
	comlinkpy = spawn("python", ['-u', comlink_dir_path, workspace_uri.fsPath]);
	if (!comlinkpy){ log("comlinkpy cannot be found"); return; }

	comlinkpy.stdout.on("data", parse_comlink_data);

	comlinkpy.stderr.on("data", (data: Buffer) => {
		output.appendLine("DEBUG: " + data.toString().trim());
	});

	vscode.workspace.onDidChangeTextDocument(event => process_document_change_event(event));

    const provider = vscode.languages.registerHoverProvider(
        { scheme: "file", language: "*" },
        {
            async provideHover(document, position) {
				let language_id = document.languageId;
                let text = document.lineAt(position.line).text;
				let id = text.split(`${comment_map[language_id]}id:`)[1];
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
