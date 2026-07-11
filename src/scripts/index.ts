import EventEmitter from 'node:events';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import 'dotenv/config';
import axios from 'axios';
import main from './main.js';
import type { MainEvents, MainLoopResult } from './main.js';

export type { MainEvents, MainLoopResult, OpenIdRunResult, OpenIdRunStatus } from './main.js';

interface LogEvents {
    log: [...args: any[]];
    error: [...args: any[]];
}

function stringifyResponseData(data: unknown): string {
    if (typeof data === 'string') {
        return data.replace(/\s+/g, ' ').trim();
    }

    try {
        return JSON.stringify(data);
    }
    catch {
        return String(data);
    }
}

function formatErrorForLog(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const response = error.response;
        const base = `${error.name}: ${error.message}`;
        if (!response) {
            return error.stack ?? base;
        }

        const responseData = stringifyResponseData(response.data).slice(0, 1200);
        return [
            base,
            `status=${response.status} ${response.statusText}`,
            `response=${responseData}`,
        ].join('; ');
    }

    if (error instanceof Error) {
        return error.stack ?? error.message;
    }

    return String(error);
}

export async function mainLoop(): Promise<MainLoopResult> {
    if (!process.env.openid) {
        throw new Error('请在环境变量中设置 openid。');
    }

    const openids = process.env.openid
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0);

    const events = new EventEmitter<MainEvents>();
    const logEvents = new EventEmitter<LogEvents>();

    logEvents.on('log', (...args) => {
        console.log(...args);
    });

    logEvents.on('error', (...args) => {
        console.error(...args);
    });

    events.on('log', (...args) => {
        logEvents.emit('log', ...args);
    });

    events.on('error', (error) => {
        logEvents.emit('error', '发生错误:', formatErrorForLog(error));
    });

    events.on('start', (openid) => {
        logEvents.emit('log', `开始处理 openid: ${openid}`);
    });

    events.on('finish', (openid) => {
        logEvents.emit('log', `处理结束 openid: ${openid}`);
    });

    events.on('destroy', () => {
        logEvents.removeAllListeners();
        events.removeAllListeners();
    });

    return await main(openids, events);
}

const entryFile = process.argv[1];
const isDirectRun = !!entryFile && import.meta.url === pathToFileURL(entryFile).href;

if (isDirectRun) {
    mainLoop().catch((error) => {
        console.error('mainLoop 执行失败:', error);
        process.exitCode = 1;
    });
}
