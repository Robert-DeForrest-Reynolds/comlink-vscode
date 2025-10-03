import * as vscode from 'vscode';
import { ChildProcessWithoutNullStreams } from 'child_process';

export const globals = {
    is_initalized: false,
    workspace_folders: [] as vscode.WorkspaceFolder[] | undefined,
    workspace_uri: undefined as vscode.Uri | undefined,
    comlink: undefined as ChildProcessWithoutNullStreams | undefined,
    comlink_path: '',
    comlink_project_dir_path: undefined as vscode.Uri | undefined,
    decl_position: null as vscode.Position | null,
    decl_started: false,
    creating: false,
    comment_map: {
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
    } as Record<string,string>,
    repo_url: 'https://github.com/Robert-DeForrest-Reynolds/comlink.git',
    output: vscode.window.createOutputChannel('comlink'),
    pendingResolve: null as ((val: string | null) => void) | null,
};
