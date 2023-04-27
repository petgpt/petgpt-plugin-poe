import {IPetPluginInterface, PetExpose, PluginData, SlotMenu} from './lib/types.js'
import {Log} from "./lib/helper.js";
import {v4 as uuidv4} from 'uuid'
import {BotNickNameEnum, PoeClient} from "poe-node-api";

let log: Log;
const pluginName = 'poe'
let chatBot: PoeClient;

// 在设置里更新了配置，设置了需要的p-b cookie
function updateDB(ctx: PetExpose, data: any) {
    log.debug(`data: ${ctx}`, data)
    Object.keys(data).forEach((key) => {
        // if(data[key]) {
            log.debug(`set: key: `, key, ` to value: `, data[key])
            ctx.db.set(key, data[key])
        // }
    })
}

function initChatParam(ctx: PetExpose) {
    // initApi(completionParams) // 修改了completionParams，需要重新初始化api
    let pbCookie = ctx.db.get('pb_cookie');
    if (pbCookie) {
        // 设置了cookie，重新初始化client
        chatBot = new PoeClient({
            cookie: ctx.db.get('pb_cookie'),
            debug: true,
        })
        console.log(`init poe`)
        chatBot.init();
    } else {
        log.error(`pb_cookie is empty!!!!`)
    }
}
function initpoe(ctx: PetExpose) {
    // initEnv(ctx)
    initChatParam(ctx)
}
function bindEventListener(ctx: PetExpose) {
    // 监听配置是否发生变化，如果有变化，通过赋予的db权限，获取新的值
    if(!ctx.emitter.listenerCount(`plugin.${pluginName}.config.update`)) {
        ctx.emitter.on(`plugin.${pluginName}.config.update`, (data: any) => {
            updateDB(ctx, data)

            // setting里的配置改变，需要重新初始化api
            initpoe(ctx)
            // log.debug(`[event] [plugin.${pluginName}.config.update] receive data:`, data)
        })
    }

    if(!ctx.emitter.listenerCount(`plugin.${pluginName}.data`)) {
        // 监听发来的对话信息，调用poe的api，获取回复
        ctx.emitter.on(`plugin.${pluginName}.data`, (data: PluginData) => {
            let id = uuidv4();
            chatBot.sendMessage(data.data, ctx.db.get('selectChannel'),false,(result: string) => {
                ctx.emitter.emit('upsertLatestText', {
                    id: id,
                    type: 'system',
                    text: result
                })
            });
            log.debug(`[event] [plugin.${pluginName}.data] receive data:`, data)
        })
    }

    if(!ctx.emitter.listenerCount(`plugin.${pluginName}.slot.push`)) {
        // 监听slot里的数据更新事件
        ctx.emitter.on(`plugin.${pluginName}.slot.push`, (newSlotData: any) => {
            let slotDataList:[] = JSON.parse(newSlotData)
            // log.debug(`receive newSlotData(type: ${typeof slotDataList})(len: ${slotDataList.length}):`, slotDataList)
            for (let i = 0; i < slotDataList.length; i++) {
                let slotData: any = slotDataList[i]
                switch (slotData.type) {
                    case 'switch': {
                        // log.debug(`${i}, switch value:`, slotData.value)
                        // ctx.db.set('enableChatContext', slotData.value)
                        break;
                    }
                    case 'dialog': {
                        // slotData.value.forEach((diaItem: any) => {
                            // log.debug(`${i}, dialog item:`, diaItem)
                            // ctx.db.set(diaItem.name, diaItem.value)
                        // })
                        break;
                    }
                    case 'select': {
                        // log.debug(`${i}, select value:`, slotData.value)
                        ctx.db.set('selectChannel', slotData.value)
                        break;
                    }
                    case 'uploda': {break;}
                    default: {break;}
                }

            }

            // slot里的数据更新，不用重新初始化api，只需要更新对话参数
            initChatParam(ctx)
        })
    }


    if(!ctx.emitter.listenerCount(`plugin.${pluginName}.func.clear`)) {
        // 监听clear事件
        ctx.emitter.on(`plugin.${pluginName}.func.clear`, async () => {
            await chatBot.addChatBreak(ctx.db.get("selectChannel"))
            // chatBot.init(ctx.db.get('pb_cookie'))
            log.debug(`clear`)
        })
    }
}
const config = (ctx: PetExpose) => [
    {
        name: 'pb_cookie',
        type: 'input',
        required: true,
        value: ctx.db.get('pb_cookie') || '',
    }
]
const slotMenu = (ctx: PetExpose): SlotMenu[] => [
    // {
    //     slot: 1,
    //     name: "setting",
    //     menu: {
    //         type: 'dialog',
    //         child: [
    //             {name: 'systemMessage', type: 'input', required: false,
    //                 message: 'The system message helps set the behavior of the assistant. 例如：You are a helpful assistant.',
    //                 default: ctx.db.get('systemMessage') || 'You are poe, a large language model trained by OpenAI. Answer as concisely as possible.\nKnowledge cutoff: 2021-09-01\n'},
    //             {name: 'max_tokens', type: 'input', required: false,
    //                 message: '最大2048，gpt3模型中，一次对话最多生成的token数量', default: ctx.db.get('max_tokens') || 100},
    //             {name: 'temperature', type: 'input', required: false,
    //                 message: '[0, 2], 默认1, 更低更精确，更高随机性增加.', default: ctx.db.get('temperature') || 1},
    //             {name: 'presence_penalty', type: 'input', required: false,
    //                 message: '[-2.0, 2.0], 默认0, 数值越大，越鼓励生成input中没有的文本.', default: ctx.db.get('presence_penalty') || 0},
    //             {name: 'frequency_penalty', type: 'input', required: false,
    //                 message: '[-2.0, 2.0], 默认0, 数值越大，降低生成的文本的重复率，更容易生成新的东西', default: ctx.db.get('frequency_penalty') || 0},
    //         ]
    //     },
    //     description: "对话参数设置"
    // },
    // {
    //     slot: 2,
    //     name: 'enableChatContext',
    //     menu: {
    //         type: 'switch',
    //         value: ctx.db.get('enableChatContext') || false
    //     },
    //     description: "是否开启上下文"
    // },
    {
        slot: 3,
        name: 'selectChannel',
        menu: {
            type: 'select',
            child: [
                {name: 'Sage', value: BotNickNameEnum.capybara, type: 'select', required: false},
                {name: 'ChatGPT', value: BotNickNameEnum.chinchilla, type: 'select', required: false},
                {name: 'Claude+', value: BotNickNameEnum.a2_2, type: 'select', required: false},
                {name: 'Dragonfly', value: BotNickNameEnum.nutria, type: 'select', required: false},
                {name: 'Claude-instant', value: BotNickNameEnum.a2, type: 'select', required: false},
                {name: 'GPT-4', value: BotNickNameEnum.beaver, type: 'select', required: false},
                {name: 'NeevaAI', value: BotNickNameEnum.hutia, type: 'select', required: false},
            ],
            value: ctx.db.get('selectChannel') || BotNickNameEnum.capybara // 如果没有的话，默认选择第一个标签
        },
        description: "selectChannel to chat with"
    }
]
export default (ctx: PetExpose): IPetPluginInterface => {
    let count = 0;
    const register = () => {
        log = new Log(ctx)
        if(count++) initpoe(ctx)
        bindEventListener(ctx)
        log.debug(`[register]`)
    }

    const unregister = () => {
        ctx.emitter.removeAllListeners(`plugin.${pluginName}.config.update`)
        ctx.emitter.removeAllListeners(`plugin.${pluginName}.data`)
        ctx.emitter.removeAllListeners(`plugin.${pluginName}.slot.push`)
        ctx.emitter.removeAllListeners(`plugin.${pluginName}.func.clear`)
        log.debug(`[unregister]`)
    }

    return {
        register,
        unregister,
        config,
        slotMenu,
        handle: (data: PluginData) => new Promise(() => {
            ctx.emitter.emit(`plugin.${pluginName}.data`, data) // 转发给自己的listener
            log.debug('[handle]')
        }),
        stop: () => new Promise((resolve, _) => {
            log.debug('[stop]')
            resolve()
        }),
    }
}
