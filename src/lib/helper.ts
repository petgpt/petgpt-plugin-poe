import {PetExpose} from "./types.js";
export class Log {
    private ctx: PetExpose
    constructor(ctx: PetExpose) {
        this.ctx = ctx
    }
    public info(str: string, ...args: any[]) {
        this.ctx.logger.info(`[plugin] [poe] ${str}`, args)
    }
    public error(...args: any[]) {
        this.ctx.logger.error(`[plugin] [poe] ${args}`)
    }

    public warn(...args: any[]) {
        this.ctx.logger.warn(`[plugin] [poe] ${args}`)
    }

    public debug(...args: any[]) {
        this.ctx.logger.debug(`[plugin] [poe] ${args}`)
    }
}
export function isNotEmptyString(value: any): boolean {
    return typeof value === 'string' && value.length > 0
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type FetchFunction = typeof fetch
// @ts-ignore
export const requestWithRetries = async (fetch_func: FetchFunction, max_attempts=10, retry_interval=1000) => {
    let attempt = 0;
    let last_error = null;

    while (attempt < max_attempts) {
        attempt += 1;

        try {
            // const response = await fetch_func();
            // if (!response.ok) {
            //     throw new Error(`Request failed with status code ${response.status}, retrying... ${attempt}/${max_attempts}`);
            // }
            // return response;
            return null;
        } catch (error) {
            last_error = error;
            await sleep(retry_interval);
        }
    }

    throw last_error;
}
