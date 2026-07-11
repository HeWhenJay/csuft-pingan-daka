import { useEffect, useMemo, useState } from 'react';
import {
    CalendarDays,
    CalendarRange,
    BadgeCheck,
    CircleAlert,
    Clock3,
    KeyRound,
    LoaderCircle,
    Plus,
    Radar,
    Save,
    Send,
    ShieldCheck,
    Trash2,
    UserRound,
} from 'lucide-react';

// 前端总控页面：
// 负责多 OpenID 管理、手动签到、OpenID 抓取和定时任务配置。
const initialSummary = {
    loginSuccess: false,
    withinTimeWindow: null,
    signStatus: null,
    signedSuccess: false,
    alreadySigned: false,
    account: null,
    task: null,
    error: null,
    startedAt: null,
    completedAt: null,
};

const initialCaptureSummary = {
    startedAt: null,
    completedAt: null,
    openid: null,
    saved: false,
    matchedUrl: null,
    error: null,
};

const initialDebuggerStatus = {
    installed: false,
    dependenciesInstalled: false,
    running: false,
    wsUrl: '',
    repoDir: '',
    logPath: '',
};

const initialSchedule = {
    enabled: false,
    mode: 'daily',
    time: '21:05',
    dates: [],
    timezone: 'Asia/Shanghai',
    lastAttemptDate: null,
    lastAttemptAt: null,
    lastResult: null,
    lastMessage: null,
    nextRunAt: null,
};

const initialScheduleMeta = {
    runtimeActive: false,
    driver: 'node-cron',
    cronPattern: '',
    timezone: 'Asia/Shanghai',
    lastTriggeredAt: null,
};

function formatClock(value) {
    return new Intl.DateTimeFormat('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).format(value);
}

function formatDateTime(value) {
    if (!value) {
        return '未开始';
    }

    return new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).format(new Date(value));
}

function createLog(message, tone = 'neutral') {
    return {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        message,
        tone,
        time: formatClock(new Date()),
    };
}

function formatDateTimeVerbose(value) {
    if (!value) {
        return '未设置';
    }

    return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
}

function statusTone(summary) {
    if (summary.error) {
        return 'error';
    }

    if (summary.signedSuccess || summary.alreadySigned) {
        return 'success';
    }

    if (summary.withinTimeWindow === false) {
        return 'warning';
    }

    return 'neutral';
}

function captureTone(summary) {
    if (summary.error) {
        return 'error';
    }

    if (summary.openid) {
        return 'success';
    }

    return 'neutral';
}

function parseOpenIds(value) {
    return Array.from(
        new Set(
            (Array.isArray(value) ? value : String(value ?? '').split(','))
                .map((item) => item.trim())
                .filter(Boolean),
        ),
    );
}

function joinOpenIds(openids) {
    return parseOpenIds(openids).join(',');
}

export default function App() {
    const [clock, setClock] = useState(() => new Date());
    const [openidInput, setOpenidInput] = useState('');
    const [openidList, setOpenidList] = useState([]);
    const [savedOpenidList, setSavedOpenidList] = useState([]);
    const [debuggerWsUrl, setDebuggerWsUrl] = useState('');
    const [logs, setLogs] = useState([
        createLog('控制台已就绪。'),
    ]);
    const [summary, setSummary] = useState(initialSummary);
    const [captureSummary, setCaptureSummary] = useState(initialCaptureSummary);
    const [debuggerStatus, setDebuggerStatus] = useState(initialDebuggerStatus);
    const [schedule, setSchedule] = useState(initialSchedule);
    const [scheduleMeta, setScheduleMeta] = useState(initialScheduleMeta);
    const [scheduleDateInput, setScheduleDateInput] = useState('');
    const [captureStatus, setCaptureStatus] = useState('捕获服务未启动。');
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingSchedule, setIsSavingSchedule] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const [inlineError, setInlineError] = useState('');
    const [serverReady, setServerReady] = useState(false);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setClock(new Date());
        }, 1000);

        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function loadInitialData() {
            try {
                const [configResponse, debuggerResponse, scheduleResponse] = await Promise.all([
                    fetch('/api/config'),
                    fetch('/api/debugger/status'),
                    fetch('/api/schedule'),
                ]);
                const config = await configResponse.json();
                const debuggerData = await debuggerResponse.json();
                const scheduleData = await scheduleResponse.json();

                if (!cancelled) {
                    const nextOpenids = parseOpenIds(config.openids ?? config.openid ?? '');
                    setOpenidList(nextOpenids);
                    setSavedOpenidList(nextOpenids);
                    setDebuggerWsUrl(config.debuggerWsUrl ?? '');
                    setDebuggerStatus(debuggerData);
                    setSchedule(scheduleData.config ?? initialSchedule);
                    setScheduleMeta({
                        runtimeActive: scheduleData.runtimeActive ?? false,
                        driver: scheduleData.driver ?? 'node-cron',
                        cronPattern: scheduleData.cronPattern ?? '',
                        timezone: scheduleData.timezone ?? 'Asia/Shanghai',
                        lastTriggeredAt: scheduleData.lastTriggeredAt ?? null,
                    });
                    setServerReady(true);
                }
            }
            catch (error) {
                if (!cancelled) {
                    setInlineError(error instanceof Error ? error.message : '无法连接本地服务。');
                }
            }
        }

        loadInitialData();
        return () => {
            cancelled = true;
        };
    }, []);

    const pendingChanges = joinOpenIds(openidList) !== joinOpenIds(savedOpenidList);
    const runAccountCount = parseOpenIds([...openidList, ...parseOpenIds(openidInput)]).length;
    const captureButtonLabel = '启动捕获';

    const headline = useMemo(() => {
        if (summary.signedSuccess) {
            return '签到成功';
        }

        if (summary.alreadySigned) {
            return '今日已签到';
        }

        if (summary.withinTimeWindow === false) {
            return '不在签到时段';
        }

        if (summary.error) {
            return '签到任务失败';
        }

        if (isRunning) {
            return '正在执行签到任务';
        }

        if (isCapturing) {
            return '正在启动捕获服务';
        }

        return '等待执行';
    }, [isCapturing, isRunning, summary]);

    async function refreshDebuggerStatus() {
        try {
            const response = await fetch('/api/debugger/status');
            const data = await response.json();
            setDebuggerStatus(data);
        }
        catch {
            // keep current status when refresh fails
        }
    }

    async function refreshSchedule() {
        try {
            const response = await fetch('/api/schedule');
            const data = await response.json();
            setSchedule(data.config ?? initialSchedule);
            setScheduleMeta({
                runtimeActive: data.runtimeActive ?? false,
                driver: data.driver ?? 'node-cron',
                cronPattern: data.cronPattern ?? '',
                timezone: data.timezone ?? 'Asia/Shanghai',
                lastTriggeredAt: data.lastTriggeredAt ?? null,
            });
        }
        catch {
            // keep current schedule when refresh fails
        }
    }

    function addOpenId(candidate = openidInput) {
        const normalized = parseOpenIds(candidate);
        if (normalized.length === 0) {
            return false;
        }

        let changed = false;
        setOpenidList((current) => {
            const next = Array.from(new Set([...current, ...normalized]));
            changed = next.length !== current.length;
            return next;
        });
        setOpenidInput('');
        return changed;
    }

    function removeOpenId(target) {
        setOpenidList((current) => current.filter((item) => item !== target));
    }

    async function handleSave() {
        const normalizedList = parseOpenIds([...openidList, ...parseOpenIds(openidInput)]);
        if (normalizedList.length === 0) {
            setInlineError('请先添加至少一个 OpenID。');
            return;
        }

        setOpenidList(normalizedList);
        setIsSaving(true);
        setInlineError('');

        try {
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ openids: normalizedList }),
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error ?? '保存失败');
            }

            const savedList = parseOpenIds(data.openids ?? data.openid ?? '');
            setOpenidList(savedList);
            setSavedOpenidList(savedList);
            setOpenidInput('');
            setLogs((current) => [
                createLog('账号配置已保存。', 'success'),
                ...current,
            ]);
        }
        catch (error) {
            setInlineError(error instanceof Error ? error.message : '保存失败');
        }
        finally {
            setIsSaving(false);
        }
    }

    function addScheduleDate() {
        if (!scheduleDateInput) {
            return;
        }

        setSchedule((current) => ({
            ...current,
            dates: Array.from(new Set([...current.dates, scheduleDateInput])).sort(),
        }));
        setScheduleDateInput('');
    }

    function removeScheduleDate(value) {
        setSchedule((current) => ({
            ...current,
            dates: current.dates.filter((item) => item !== value),
        }));
    }

    async function handleSaveSchedule() {
        setIsSavingSchedule(true);
        setInlineError('');

        try {
            const response = await fetch('/api/schedule', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(schedule),
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error ?? '保存定时配置失败');
            }

            setSchedule(data.config ?? initialSchedule);
            setScheduleMeta({
                runtimeActive: data.runtimeActive ?? false,
                driver: data.driver ?? 'node-cron',
                cronPattern: data.cronPattern ?? '',
                timezone: data.timezone ?? 'Asia/Shanghai',
                lastTriggeredAt: data.lastTriggeredAt ?? null,
            });
            setLogs((current) => [
                createLog(
                    data.config?.enabled
                        ? `定时任务已更新，下次执行时间：${formatDateTimeVerbose(data.config?.nextRunAt)}`
                        : '定时任务已关闭。',
                    'success',
                ),
                ...current,
            ]);
        }
        catch (error) {
            setInlineError(error instanceof Error ? error.message : '保存定时配置失败');
        }
        finally {
            setIsSavingSchedule(false);
        }
    }

    function handleCapture() {
        setCaptureSummary(initialCaptureSummary);
        setCaptureStatus('正在启动 OpenID 捕获服务。');
        setIsCapturing(true);
        setInlineError('');
        setLogs((current) => [
            createLog('正在启动 OpenID 捕获服务。'),
            ...current,
        ]);

        const source = new EventSource('/api/openid/capture/stream');

        source.addEventListener('status', (event) => {
            const payload = JSON.parse(event.data);
            setCaptureStatus(payload.message);
            setLogs((current) => [createLog(payload.message), ...current]);
        });

        source.addEventListener('found', (event) => {
            const payload = JSON.parse(event.data);
            let totalAccounts = 1;
            setOpenidList((current) => {
                const next = Array.from(new Set([...current, payload.openid]));
                totalAccounts = next.length;
                return next;
            });
            setSavedOpenidList((current) => Array.from(new Set([...current, payload.openid])));
            setCaptureStatus('OpenID 已捕获并保存。');
            setLogs((current) => [
                createLog(`已捕获 OpenID：${payload.openid}，当前共 ${totalAccounts} 个账号。`, 'success'),
                ...current,
            ]);
        });

        source.addEventListener('error', (event) => {
            const payload = JSON.parse(event.data);
            setCaptureStatus(payload.message);
            setCaptureSummary((current) => ({
                ...current,
                error: payload.message,
            }));
            setLogs((current) => [createLog(payload.message, 'error'), ...current]);
        });

        source.addEventListener('summary', (event) => {
            const payload = JSON.parse(event.data);
            setCaptureSummary(payload);
            setCaptureStatus(payload.error ?? (payload.openid ? 'OpenID 捕获完成。' : '捕获已结束。'));
            setIsCapturing(false);
            refreshDebuggerStatus();
            setLogs((current) => [
                createLog(
                    payload.error ?? (payload.openid ? 'OpenID 已保存。' : 'OpenID 捕获结束。'),
                    payload.error ? 'error' : 'success',
                ),
                ...current,
            ]);
            source.close();
        });

        source.onerror = () => {
            source.close();
            setIsCapturing(false);
        };
    }

    function handleRun() {
        const normalizedList = parseOpenIds([...openidList, ...parseOpenIds(openidInput)]);
        if (normalizedList.length === 0) {
            setInlineError('请先添加或获取至少一个 OpenID。');
            return;
        }

        setOpenidList(normalizedList);
        setInlineError('');
        setIsRunning(true);
        setSummary(initialSummary);
        setLogs([
            createLog(`签到任务已启动：${normalizedList.length} 个账号。`),
        ]);

        const source = new EventSource(`/api/sign-in/stream?openid=${encodeURIComponent(normalizedList.join(','))}`);

        const addLog = (message, tone = 'neutral') => {
            setLogs((current) => [createLog(message, tone), ...current]);
        };

        source.addEventListener('start', (event) => {
            const payload = JSON.parse(event.data);
            addLog(`开始处理 OpenID：${payload.openid}`);
            setSummary((current) => ({
                ...current,
                startedAt: payload.at,
            }));
        });

        source.addEventListener('wait', (event) => {
            const payload = JSON.parse(event.data);
            addLog(`账号间隔：${(payload.durationMs / 1000).toFixed(1)} 秒。`);
        });

        source.addEventListener('log', (event) => {
            const payload = JSON.parse(event.data);
            addLog(payload.message);
        });

        source.addEventListener('signInResult', (event) => {
            const payload = JSON.parse(event.data);
            addLog(`登录成功：${payload.userName} / ${payload.accountNo}`, 'success');
            setSummary((current) => ({
                ...current,
                loginSuccess: true,
                account: payload,
            }));
        });

        source.addEventListener('taskDetail', (event) => {
            const payload = JSON.parse(event.data);
            addLog(`签到窗口：${payload.signStartTime} - ${payload.signEndTime}`);
            setSummary((current) => ({
                ...current,
                withinTimeWindow: true,
                task: payload,
            }));
        });

        source.addEventListener('signTimeInvalid', (event) => {
            const payload = JSON.parse(event.data);
            addLog(payload.message, 'warning');
            setSummary((current) => ({
                ...current,
                withinTimeWindow: false,
                error: payload.message,
            }));
        });

        source.addEventListener('recordStatus', (event) => {
            const payload = JSON.parse(event.data);
            addLog(`当前签到状态：${payload.signStatusName}`);
            setSummary((current) => ({
                ...current,
                signStatus: payload.signStatusName,
                alreadySigned: payload.signStatus === 0,
            }));
        });

        source.addEventListener('signRecordResponse', (event) => {
            const payload = JSON.parse(event.data);
            addLog(payload.signedSuccess ? '签到提交成功。' : '签到提交失败。', payload.signedSuccess ? 'success' : 'warning');
            setSummary((current) => ({
                ...current,
                signedSuccess: payload.signedSuccess,
            }));
        });

        source.addEventListener('error', (event) => {
            const payload = JSON.parse(event.data);
            addLog(payload.message, 'error');
            setSummary((current) => ({
                ...current,
                error: payload.message,
            }));
        });

        source.addEventListener('summary', (event) => {
            const payload = JSON.parse(event.data);
            setSummary(payload);
            setIsRunning(false);
            addLog(
                payload.error ?? (payload.signedSuccess ? '本次签到已完成。' : '任务执行结束。'),
                payload.error ? 'error' : 'success',
            );
            source.close();
        });

        source.onerror = () => {
            source.close();
            setIsRunning(false);
        };
    }

    return (
        <main className="app-shell">
            <header className="app-header">
                <div className="brand-lockup">
                    <span className="brand-mark" aria-hidden="true">
                        <ShieldCheck size={22} />
                    </span>
                    <div>
                        <span className="brand-kicker">CSUFT</span>
                        <h1>平安打卡控制台</h1>
                    </div>
                </div>
                <div className="header-meta">
                    <span className={serverReady ? 'service-indicator is-online' : 'service-indicator is-connecting'}>
                        <span className="status-dot" aria-hidden="true" />
                        {serverReady ? '本地服务已连接' : '正在连接本地服务'}
                    </span>
                    <time dateTime={clock.toISOString()}>{formatClock(clock)}</time>
                </div>
            </header>

            <section className={`run-status tone-${statusTone(summary)}`} aria-live="polite">
                <div className="run-status-title">
                    {summary.error ? (
                        <CircleAlert size={20} />
                    ) : summary.signedSuccess || summary.alreadySigned ? (
                        <BadgeCheck size={20} />
                    ) : isRunning || isCapturing ? (
                        <LoaderCircle className="spin" size={20} />
                    ) : (
                        <ShieldCheck size={20} />
                    )}
                    <div>
                        <span>执行状态</span>
                        <strong>{headline}</strong>
                    </div>
                </div>
                <div className="run-status-meta">
                    <span>{openidList.length} 个签到账号</span>
                    <span>{scheduleMeta.runtimeActive ? `定时任务 ${schedule.time}` : '定时任务未运行'}</span>
                </div>
            </section>

            <div className="console-grid">
                <section className="panel accounts-panel" aria-labelledby="accounts-title">
                    <header className="panel-header">
                        <div>
                            <h2 id="accounts-title">签到账号</h2>
                            <p>管理 OpenID 并执行手动签到。</p>
                        </div>
                        <span className="count-badge">{openidList.length} 个账号</span>
                    </header>

                    <div className="field-group">
                        <label className="field-label" htmlFor="openid-input">OpenID</label>
                        <div className="input-action-row">
                            <div className="field-input">
                                <KeyRound size={18} aria-hidden="true" />
                                <input
                                    id="openid-input"
                                    type="text"
                                    value={openidInput}
                                    onChange={(event) => setOpenidInput(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            addOpenId();
                                        }
                                    }}
                                    placeholder="输入 OpenID"
                                />
                            </div>
                            <button
                                type="button"
                                className="secondary-button add-button"
                                onClick={() => addOpenId()}
                                disabled={isSaving || isRunning || isCapturing || !openidInput.trim()}
                            >
                                <Plus size={17} />
                                <span>添加</span>
                            </button>
                        </div>
                    </div>

                    <div className="account-list" aria-label="签到账号列表">
                        {openidList.length > 0 ? openidList.map((item) => (
                            <div key={item} className="account-row">
                                <code title={item}>{item}</code>
                                <button
                                    type="button"
                                    className="icon-button danger-button"
                                    onClick={() => removeOpenId(item)}
                                    disabled={isSaving || isRunning || isCapturing}
                                    aria-label={`移除 OpenID ${item}`}
                                    title="移除账号"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        )) : (
                            <div className="empty-state">
                                <KeyRound size={20} aria-hidden="true" />
                                <span>暂无签到账号</span>
                                <a href="#openid-capture">获取 OpenID</a>
                            </div>
                        )}
                    </div>

                    <div className="action-row">
                        <button
                            type="button"
                            className="secondary-button"
                            onClick={handleSave}
                            disabled={isSaving || isRunning || isCapturing || runAccountCount === 0}
                        >
                            <Save size={18} />
                            <span>{isSaving ? '保存中' : '保存账号'}</span>
                        </button>
                        <button
                            type="button"
                            className="primary-button"
                            onClick={handleRun}
                            disabled={isRunning || isCapturing || runAccountCount === 0}
                        >
                            {isRunning ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}
                            <span>{isRunning ? '正在签到' : `执行签到（${runAccountCount}）`}</span>
                        </button>
                    </div>

                    {inlineError ? (
                        <div className="inline-feedback tone-error" role="alert">
                            <CircleAlert size={16} />
                            <span>{inlineError}</span>
                        </div>
                    ) : null}

                    {pendingChanges ? (
                        <div className="inline-feedback tone-warning" role="status">
                            <CircleAlert size={16} />
                            <span>账号配置有未保存的更改。</span>
                        </div>
                    ) : null}

                    <dl className="metadata-grid">
                        <div>
                            <dt>任务开始</dt>
                            <dd>{formatDateTime(summary.startedAt)}</dd>
                        </div>
                        <div>
                            <dt>任务结束</dt>
                            <dd>{formatDateTime(summary.completedAt)}</dd>
                        </div>
                        <div>
                            <dt>签到状态</dt>
                            <dd>{summary.signStatus ?? '待获取'}</dd>
                        </div>
                    </dl>
                </section>

                <section className="panel result-panel" aria-labelledby="result-title">
                    <header className="panel-header">
                        <div>
                            <h2 id="result-title">最近结果</h2>
                            <p>最近一次签到任务的执行信息。</p>
                        </div>
                        <span className={`panel-status tone-${statusTone(summary)}`}>{headline}</span>
                    </header>

                    <div className="result-grid">
                        <div>
                            <span>登录</span>
                            <strong>{summary.loginSuccess ? '成功' : '未确认'}</strong>
                        </div>
                        <div>
                            <span>时间校验</span>
                            <strong>
                                {summary.withinTimeWindow === null
                                    ? '待校验'
                                    : summary.withinTimeWindow
                                        ? '时段内'
                                        : '时段外'}
                            </strong>
                        </div>
                        <div>
                            <span>任务名称</span>
                            <strong>{summary.task?.taskName ?? '待获取'}</strong>
                        </div>
                        <div>
                            <span>执行结果</span>
                            <strong>
                                {summary.signedSuccess
                                    ? '签到成功'
                                    : summary.alreadySigned
                                        ? '已签过'
                                        : summary.error
                                            ? '执行失败'
                                            : '待执行'}
                            </strong>
                        </div>
                    </div>

                    <dl className="detail-list">
                        <div className="detail-row">
                            <UserRound size={18} aria-hidden="true" />
                            <div>
                                <dt>账号信息</dt>
                                <dd>
                                    {summary.account
                                        ? `${summary.account.userName} · ${summary.account.accountNo}`
                                        : '待获取'}
                                </dd>
                            </div>
                        </div>
                        <div className="detail-row">
                            <Clock3 size={18} aria-hidden="true" />
                            <div>
                                <dt>签到窗口</dt>
                                <dd>
                                    {summary.task
                                        ? `${summary.task.signStartTime} - ${summary.task.signEndTime}`
                                        : '待获取'}
                                </dd>
                            </div>
                        </div>
                        <div className="detail-row">
                            <ShieldCheck size={18} aria-hidden="true" />
                            <div>
                                <dt>异常说明</dt>
                                <dd>{summary.error ?? '暂无异常'}</dd>
                            </div>
                        </div>
                    </dl>
                </section>

                <section className="panel capture-panel" id="openid-capture" aria-labelledby="capture-title">
                    <header className="panel-header">
                        <div>
                            <h2 id="capture-title">OpenID 捕获</h2>
                            <p>用于首次配置或新增签到账号。</p>
                        </div>
                        <span className={`panel-status tone-${captureTone(captureSummary)}`}>
                            {isCapturing ? '监听中' : captureSummary.openid ? '已捕获' : '未启动'}
                        </span>
                    </header>

                    <div className="capture-layout">
                        <div className="capture-control">
                            <div className={`capture-status tone-${captureTone(captureSummary)}`} role="status" aria-live="polite">
                                <Radar size={20} aria-hidden="true" />
                                <div>
                                    <span>捕获状态</span>
                                    <strong>{captureStatus}</strong>
                                </div>
                            </div>

                            <div className="capture-result">
                                <span>捕获结果</span>
                                <code>{captureSummary.openid ?? '未捕获'}</code>
                            </div>

                            <button
                                type="button"
                                className="primary-button full-width-button"
                                onClick={handleCapture}
                                disabled={isCapturing || isRunning}
                            >
                                {isCapturing ? <LoaderCircle className="spin" size={18} /> : <Radar size={18} />}
                                <span>{isCapturing ? '正在监听登录请求' : captureButtonLabel}</span>
                            </button>
                        </div>

                        <ol className="steps-list" aria-label="OpenID 捕获步骤">
                            <li>点击“启动捕获”，等待状态显示监听中。</li>
                            <li>在微信打开“中南林业科技大学学生工作部”小程序，进入“我的”并重新登录。</li>
                            <li>捕获成功后，OpenID 将自动保存并加入签到账号。</li>
                        </ol>
                    </div>

                    <dl className="metadata-grid compact-metadata">
                        <div>
                            <dt>开始时间</dt>
                            <dd>{formatDateTime(captureSummary.startedAt)}</dd>
                        </div>
                        <div>
                            <dt>结束时间</dt>
                            <dd>{formatDateTime(captureSummary.completedAt)}</dd>
                        </div>
                        <div>
                            <dt>保存状态</dt>
                            <dd>{captureSummary.saved ? '已保存' : '未保存'}</dd>
                        </div>
                    </dl>

                    <details className="advanced-details">
                        <summary>高级信息</summary>
                        <dl>
                            <div><dt>捕获方式</dt><dd>mitmproxy</dd></div>
                            <div><dt>监听地址</dt><dd><code>{debuggerWsUrl || '未配置'}</code></dd></div>
                            <div><dt>备用调试器</dt><dd>{debuggerStatus.running ? '可用' : '未启用'}</dd></div>
                        </dl>
                    </details>
                </section>

                <section className="panel schedule-panel" aria-labelledby="schedule-title">
                    <header className="panel-header">
                        <div>
                            <h2 id="schedule-title">定时签到</h2>
                            <p>本地服务运行期间有效。</p>
                        </div>
                        <span className={scheduleMeta.runtimeActive ? 'panel-status tone-success' : 'panel-status tone-neutral'}>
                            {scheduleMeta.runtimeActive ? '运行中' : '未运行'}
                        </span>
                    </header>

                    <label className="switch-row" htmlFor="schedule-enabled">
                        <span>
                            <strong>启用定时任务</strong>
                            <small>{schedule.enabled ? '已开启' : '已关闭'}</small>
                        </span>
                        <span className="switch-control">
                            <input
                                id="schedule-enabled"
                                type="checkbox"
                                checked={schedule.enabled}
                                onChange={(event) => setSchedule((current) => ({ ...current, enabled: event.target.checked }))}
                            />
                            <span className="switch-track" aria-hidden="true"><span /></span>
                        </span>
                    </label>

                    <div className="mode-grid" role="group" aria-label="执行频率">
                        <button
                            type="button"
                            className={schedule.mode === 'daily' ? 'mode-button active' : 'mode-button'}
                            aria-pressed={schedule.mode === 'daily'}
                            onClick={() => setSchedule((current) => ({ ...current, mode: 'daily' }))}
                        >
                            <CalendarDays size={17} aria-hidden="true" />
                            <span>每天</span>
                        </button>
                        <button
                            type="button"
                            className={schedule.mode === 'weekdays' ? 'mode-button active' : 'mode-button'}
                            aria-pressed={schedule.mode === 'weekdays'}
                            onClick={() => setSchedule((current) => ({ ...current, mode: 'weekdays' }))}
                        >
                            <BadgeCheck size={17} aria-hidden="true" />
                            <span>工作日</span>
                        </button>
                        <button
                            type="button"
                            className={schedule.mode === 'dates' ? 'mode-button active' : 'mode-button'}
                            aria-pressed={schedule.mode === 'dates'}
                            onClick={() => setSchedule((current) => ({ ...current, mode: 'dates' }))}
                        >
                            <CalendarRange size={17} aria-hidden="true" />
                            <span>指定日期</span>
                        </button>
                    </div>

                    <div className="schedule-form-grid">
                        <label className="field" htmlFor="schedule-time">
                            <span className="field-label">执行时间</span>
                            <div className="field-input">
                                <input
                                    id="schedule-time"
                                    type="time"
                                    value={schedule.time}
                                    onChange={(event) => setSchedule((current) => ({ ...current, time: event.target.value }))}
                                />
                            </div>
                        </label>

                        {schedule.mode === 'dates' ? (
                            <div className="field">
                                <span className="field-label">指定日期</span>
                                <div className="date-entry">
                                    <input
                                        id="schedule-date"
                                        aria-label="选择签到日期"
                                        type="date"
                                        value={scheduleDateInput}
                                        onChange={(event) => setScheduleDateInput(event.target.value)}
                                    />
                                    <button type="button" className="secondary-button compact-button" onClick={addScheduleDate} disabled={!scheduleDateInput}>
                                        <Plus size={16} aria-hidden="true" />
                                        <span>添加</span>
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {schedule.mode === 'dates' ? (
                        <div className="date-token-list" aria-label="已选日期">
                            {schedule.dates.length > 0 ? schedule.dates.map((value) => (
                                <div key={value} className="date-token">
                                    <span>{value}</span>
                                    <button type="button" className="icon-button" onClick={() => removeScheduleDate(value)} aria-label={`移除日期 ${value}`} title="移除日期">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            )) : <span className="helper-text">未选择日期。</span>}
                        </div>
                    ) : null}

                    <dl className="metadata-grid">
                        <div>
                            <dt>下次执行</dt>
                            <dd>{formatDateTimeVerbose(schedule.nextRunAt)}</dd>
                        </div>
                        <div>
                            <dt>最近触发</dt>
                            <dd>{formatDateTimeVerbose(scheduleMeta.lastTriggeredAt)}</dd>
                        </div>
                        <div>
                            <dt>时区</dt>
                            <dd>{scheduleMeta.timezone}</dd>
                        </div>
                    </dl>

                    <button
                        type="button"
                        className="primary-button full-width-button"
                        onClick={handleSaveSchedule}
                        disabled={isSavingSchedule || isRunning || isCapturing}
                    >
                        {isSavingSchedule ? <LoaderCircle className="spin" size={18} /> : <CalendarDays size={18} />}
                        <span>{isSavingSchedule ? '保存中' : '保存定时任务'}</span>
                    </button>

                    <details className="advanced-details">
                        <summary>高级信息</summary>
                        <dl>
                            <div><dt>调度器</dt><dd><code>{scheduleMeta.driver}</code></dd></div>
                            <div><dt>规则</dt><dd><code>{scheduleMeta.cronPattern || '未生成'}</code></dd></div>
                        </dl>
                    </details>
                </section>

                <section className="panel logs-panel" aria-labelledby="logs-title">
                    <header className="panel-header">
                        <div>
                            <h2 id="logs-title">运行日志</h2>
                            <p>按时间倒序显示。</p>
                        </div>
                        <span className="count-badge">{logs.length} 条</span>
                    </header>

                    <div className="log-list" role="log" aria-live="polite" aria-relevant="additions">
                    {logs.map((log) => (
                        <div key={log.id} className={`log-row tone-${log.tone}`}>
                            <time>{log.time}</time>
                            <span className="log-marker" aria-hidden="true" />
                            <p>{log.message}</p>
                        </div>
                    ))}
                    </div>
                </section>
            </div>
        </main>
    );
}
