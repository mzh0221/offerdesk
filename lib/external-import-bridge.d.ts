export {};
declare global {
    interface Window {
        externalImports?: {
            configs(): Promise<{ id: string; name: string; destination: string; config: string; kind?: 'file'; configLabel?: string; taskPrompt?: string }[]>;
            listen(callback: (id: string, body: unknown) => void): () => void;
            respond(id: string, response: { result?: unknown; error?: string }): void;
        };
    }
}
