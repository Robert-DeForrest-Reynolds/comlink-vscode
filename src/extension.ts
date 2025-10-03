import * as vscode from 'vscode';
import { spawn } from "child_process";
import * as comlink_interface from './comlink_interface';
import { globals as g } from './globals';




function get_current_workspace_folders(){
    const folders = vscode.workspace.workspaceFolders;
    g.workspace_folders = folders ? [...folders] : [];
}


function log(msg:string, pop:boolean=false){
	g.output.appendLine(msg);
	if (pop){ vscode.window.showInformationMessage(msg); }
}


function error(msg:string, pop:boolean=false){
	g.output.appendLine(msg);
	if (pop){ vscode.window.showErrorMessage(msg); }
}


async function init_project_comlink() {
	if (g.is_initalized) {
		error("comlink is already initialized", true);
		return;
	} else { g.is_initalized = true; }

	g.comlink_project_dir_path = vscode.Uri.joinPath(g.workspace_uri!, 'comlink');
    g.comlink!.stdin.write(`>init\n`, "utf-8");

	try {
		try {
			const stat = await vscode.workspace.fs.stat(g.comlink_project_dir_path);
			if (stat.type === vscode.FileType.Directory) {
				error('comlink directory already exists.', true);
			} else {
				error('A file exists with the same name as comlink directory.', true);
			}
		} catch {
			await vscode.workspace.fs.createDirectory(g.comlink_project_dir_path);
			g.comlink!.stdin.write('*\n', 'utf-8');
			log(`Directory ready:\n${g.comlink_project_dir_path.fsPath}`, true);
		}
	} catch (err) {
		error("Failed to create comlink directory for some reason.", true);
	}
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

    g.comlink!.stdin.write(`&${id}\n`, "utf-8");

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
		if (deletedText.includes('~')) { g.creating = false; g.decl_started = false; }
		else if (deletedText.includes('*')) { g.creating = false;g.decl_started = false;
		}
	}
	else if (change.text.length > 0) {
		const last_char = change.text[change.text.length - 1];
		if (last_char === '*' && g.decl_started){ g.creating = true; }
		else if (last_char === '~' && !g.decl_started){
			g.decl_started = true;
			g.decl_position = new vscode.Position(change.range.start.line, change.range.start.character);
		}
		else if (last_char === '~' && g.creating) {
			const commentRange = new vscode.Range(g.decl_position!,
												  new vscode.Position(change.range.end.line,
																	  change.range.end.character+1));

			const commentText = event.document.getText(commentRange).slice(2, -1);
			
			log(`creation text: ${commentText}`);
			const replacement = await comlink_interface.create_comment(commentText);

			const fullReplacement =
				language_id === 'html' ? "" + replacement + '-->'
								: language_id === 'css' ? "" + replacement + '*/'
								: "" + replacement;

			editor.edit(editBuilder => {
				editBuilder.replace(commentRange, fullReplacement);
			});
		}
		else if (last_char === '~' && !g.creating && g.decl_started){ g.decl_started = false; }
	}
}


function parse_comlink_data(data: Buffer) {
    const msg = data.toString().trim();
    if (g.pendingResolve) {
		if (msg.startsWith('~')){
			g.pendingResolve(`id:${msg.slice(1)}`);
			g.pendingResolve = null;
		} else {
			g.pendingResolve(msg);
			g.pendingResolve = null;
		}
    	g.output.appendLine(msg);
    }
}


function verify_workspace(){
	get_current_workspace_folders();

	if (!g.workspace_folders || g.workspace_folders.length === 0){
		error("No workspace is open.", true);
		return;
	}
	
	if (g.workspace_folders.length === 2){
		error("Detected 2 workspaces open, will only init for the first workspace detected.", true);
	}
}


function register_hover(){
    const hover_provider = vscode.languages.registerHoverProvider(
        { scheme: "file", language: "*" },
        {
            async provideHover(document, position) {
				let id = document.lineAt(position.line).text
						 .split(`${g.comment_map[document.languageId]}ID:`)[1]?.trim();
				if (!id) { return; }
                const comment:string|null = await comlink_interface.get_comment(id);
                if (comment) { return new vscode.Hover(comment); }

                return undefined;
            }
        }
    );
	return hover_provider;
}


export function activate(context: vscode.ExtensionContext) {
	g.output.show();
	verify_workspace();
	g.workspace_uri = g.workspace_folders![0].uri;
	
	g.comlink_path = vscode.Uri.joinPath(context.extensionUri, 'comlink', '__main__.py').fsPath;

	context.subscriptions.push(vscode.commands.registerCommand('comlink.init', init_project_comlink));

	context.subscriptions.push(vscode.commands.registerCommand('comlink.del', delete_comment));

	if (!g.comlink_path){ log("comlink-vscode's comlink directory cannot be found"); return;}
	if (!g.workspace_uri){ log("workspace uri cannot be worked out"); return;}

	log("Starting comlink process...");
	g.comlink = spawn("python", ['-B', g.comlink_path, g.workspace_uri.fsPath]);
	if (!g.comlink){ log("comlink cannot be found"); return; }

	g.comlink.stdout.on("data", parse_comlink_data);

	g.comlink.stderr.on("data", (data: Buffer) => {
		g.output.appendLine("DEBUG: " + data.toString().trim());
	});

	vscode.workspace.onDidChangeTextDocument(event => process_document_change_event(event));

    context.subscriptions.push(register_hover());
}
