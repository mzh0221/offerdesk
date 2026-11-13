import { Copy } from 'lucide-react';
import type { HarnessConfig } from '@/lib/external-import-bridge';

export default function McpManualSetup({ config, open, onToggle, copy }: { config: HarnessConfig; open: boolean; onToggle: (open: boolean) => void; copy: (text: string, feedback: string) => Promise<void> }) {
    return <details className="manual-setup" open={open} onToggle={event => onToggle(event.currentTarget.open)}><summary>手动配置与参数</summary>
                <div className="setup-guide"><h4>在 {config.name} 中完成设置</h4><ol>{config.setup.steps.map(step => <li key={step}>{step}</li>)}</ol></div>
                {config.connection && <details className="connection-form" open={config.id === 'codex'}>
                    <summary>{config.id === 'codex' ? '按表单逐项填写（推荐）' : '界面要求填启动命令？查看 STDIO 表单值'}</summary>
                    <p className="form-help">类型选择 STDIO / 本地命令。以下数值已按当前应用位置生成，复制后无需替换路径。</p>
                    <dl className="connection-fields">
                        <div><dt>名称</dt><dd><code>offerdesk</code></dd></div>
                        <div><dt>类型</dt><dd>STDIO（本地命令）</dd></div>
                        <div><dt>启动命令</dt><dd><input aria-label="MCP 启动命令" readOnly value={config.connection.command} onFocus={event => event.target.select()}/><button className="text-button" onClick={() => void copy(config.connection!.command, '启动命令已复制')}><Copy size={13}/>复制启动命令</button></dd></div>
                        <div><dt>参数</dt><dd><ol className="connection-args">{config.connection.args.map((arg, index) => <li key={index}><span>参数 {index + 1}</span><input aria-label={`MCP 参数 ${index + 1}`} readOnly value={arg} onFocus={event => event.target.select()}/><button className="text-button" aria-label={`复制参数 ${index + 1}`} onClick={() => void copy(arg, `参数 ${index + 1} 已复制`)}><Copy size={13}/></button></li>)}</ol><p>点击“添加参数”，按上面的顺序逐项添加。不要把整段 JSON、数组括号或额外引号填进参数栏。</p></dd></div>
                        <div><dt>环境变量</dt><dd>留空；“环境变量传递”也留空。</dd></div>
                        <div><dt>工作目录</dt><dd>可留空。如果工具要求必填，可复制：<input aria-label="MCP 工作目录" readOnly value={config.connection.cwd} onFocus={event => event.target.select()}/><button className="text-button" onClick={() => void copy(config.connection!.cwd, '工作目录已复制')}><Copy size={13}/>复制工作目录</button></dd></div>
                    </dl>
                    <p>不用填写服务器 URL，也不用把启动命令粘贴到终端运行。AI 工具会自动启动 MCP 服务。</p>
                </details>}
                <details className="config-file-guide" open={config.id !== 'codex'}>
                    <summary>{config.id === 'codex' ? '或编辑配置文件（与表单任选一种）' : '复制到配置文件'}</summary>
                    {config.setup.file && <p className="config-location"><strong>位置：</strong><code>{config.setup.file}</code></p>}
                    {config.setup.merge && <p>{config.setup.merge}</p>}
                    <div className="config-block">
                    <div className="config-toolbar"><span>{config.configLabel || 'MCP 配置'}</span><button className="text-button" onClick={() => void copy(config.config, '配置已复制')}><Copy size={13}/>复制配置</button></div>
                    <textarea aria-label={config.configLabel || 'MCP 配置'} rows={8} wrap="off" readOnly value={config.config} onFocus={event => event.target.select()}/>
                    </div>
                </details>
                </details>;
}
