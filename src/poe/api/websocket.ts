import WebSocket from 'ws';
import * as diff from 'diff';
import {readFileSync} from "fs";

const getSocketUrl = async () => {
    const tchRand = Math.floor(100000 + Math.random() * 900000); // They're surely using 6 digit random number for ws url.
    const socketUrl = `wss://tch${tchRand}.tch.quora.com`;
    const credentials = JSON.parse(readFileSync("config.json", "utf8"));
    const appSettings = credentials.app_settings.tchannelData;
    const boxName = appSettings.boxName;
    const minSeq = appSettings.minSeq;
    const channel = appSettings.channel;
    const hash = appSettings.channelHash;
    return `${socketUrl}/up/${boxName}/updates?min_seq=${minSeq}&channel=${channel}&hash=${hash}`;
}

export const connectWs = async (): Promise<WebSocket> => {
    const url = await getSocketUrl();
    const ws = new WebSocket(url);
    return new Promise((resolve) => {
        ws.on('open', function open() {
            console.log("Connected to websocket");
            return resolve(ws);
        });
    });
}

export const disconnectWs = async (ws: WebSocket) => {
    return new Promise((resolve) => {
        ws.on('close', function close() {
            return resolve(true);
        });
        ws.close();
    });
}

export const listenWs = async (ws: WebSocket, callback?: (result: string) => void) => {
    let previousText = '';
    return new Promise((resolve) => {
        const onMessage = function incoming(data: any) {
            let jsonData = JSON.parse(data);
            if (jsonData.messages && jsonData.messages.length > 0) {
                const messages = JSON.parse(jsonData.messages[0]);
                const dataPayload = messages.payload.data;
                const text = dataPayload.messageAdded.text;
                const state = dataPayload.messageAdded.state;
                if (state !== 'complete') {
                    const differences = diff.diffChars(previousText, text);
                    let result = '';
                    differences.forEach((part) => {
                        if (part.added) {
                            result += part.value;
                        }
                    });
                    previousText = text;
                    // process.stdout.write(result);
                    callback?.(result)
                    // console.log(result)
                } else {
                    ws.removeListener('message', onMessage);
                    return resolve(true);
                }
            }
        };
        ws.on('message', onMessage);
    });
}
