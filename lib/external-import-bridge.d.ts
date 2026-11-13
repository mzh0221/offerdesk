export type HarnessConfig = {
    id: string; name: string; subtitle: string; destination: string; config: string;
    configLabel?: string; taskPrompt: string; verifyPrompt: string;
    connection: { command: string; args: string[]; cwd: string };
    setup: { steps: string[]; file?: string; merge?: string };
};
export type AutoMcpPlan = {
    token: string; toolId: string; ready: boolean; target?: string; configured: boolean; method?: string; message: string;
};
export type AutoMcpResult = { target: string; serviceReady: boolean; message: string };
declare global {
    interface Window {
        externalImports?: {
            configs(): Promise<HarnessConfig[]>;
            copyText(text: string): Promise<void>;
            prepareAuto(id: string, variant?: 'code' | 'desktop'): Promise<AutoMcpPlan>;
            applyAuto(token: string): Promise<AutoMcpResult>;
            checkService(): Promise<boolean>;
            listen(callback: (id: string, body: unknown) => void): () => void;
            respond(id: string, response: { result?: unknown; error?: string }): void;
        };
    }
}
