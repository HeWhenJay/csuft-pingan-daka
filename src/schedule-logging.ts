import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const LOG_ROOT_DIR = path.join(ROOT, '总日志');

export type ScheduleLogResult = '成功' | '失败' | '跳过';

function pad(value: number) {
    return String(value).padStart(2, '0');
}

function formatTimestamp(date = new Date()) {
    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds()),
    ].join('-');
}

function normalizeLine(value: string) {
    return value.replace(/\r?\n/g, ' ').trim();
}

export function getScheduleLogDir(date = new Date()) {
    const yearDir = `${date.getFullYear()}年日志`;
    const monthDir = `${date.getMonth() + 1}月日志`;
    const weekDir = `第${Math.ceil(date.getDate() / 7)}周日志`;
    return path.join(LOG_ROOT_DIR, yearDir, monthDir, weekDir);
}

export async function ensureScheduleLogDir(date = new Date()) {
    const logDir = getScheduleLogDir(date);
    await mkdir(logDir, { recursive: true });
    return logDir;
}

export async function writeScheduleLog(result: ScheduleLogResult, lines: string[], date = new Date()) {
    const logDir = await ensureScheduleLogDir(date);
    const fileName = `${formatTimestamp(date)}${result}.log`;
    const filePath = path.join(logDir, fileName);
    const content = `${lines.map((line) => normalizeLine(line)).join('\n')}\n`;
    await writeFile(filePath, content, 'utf8');
    return filePath;
}
