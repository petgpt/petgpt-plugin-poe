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
