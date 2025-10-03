import { globals as g } from './globals';

export function get_comment(id: string): Promise<string | null> {
    g.comlink!.stdin.write(`@${id}\n`, "utf-8");
    return new Promise(resolve => {
        g.pendingResolve = resolve;
    });
}


export async function create_comment(comment:string) {
	g.creating = false;
	g.decl_started = false;
	g.decl_position = null;
	g.comlink!.stdin.write(`~${comment}\n`, "utf-8");
    return new Promise(resolve => {
        g.pendingResolve = resolve;
    });
}