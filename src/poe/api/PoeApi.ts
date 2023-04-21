import {readFileSync, writeFile} from "fs";
import {getUpdatedSettings, scrape} from "./credential.js";
import randomUseragent from "random-useragent";
import fetch from "cross-fetch";
import {connectWs, disconnectWs, listenWs} from "./websocket.js";
import WebSocket from 'ws';
import {PetExpose} from "../../lib/types.js";

const gqlDir = "../graphql";
const queries = {
    chatViewQuery: readFileSync(gqlDir + "/ChatViewQuery.graphql", "utf8"),
    addMessageBreakMutation: readFileSync(gqlDir + "/AddMessageBreakMutation.graphql", "utf8"),
    chatPaginationQuery: readFileSync(gqlDir + "/ChatPaginationQuery.graphql", "utf8"),
    addHumanMessageMutation: readFileSync(gqlDir + "/AddHumanMessageMutation.graphql", "utf8"),
    loginMutation: readFileSync(gqlDir + "/LoginWithVerificationCodeMutation.graphql", "utf8"),
    signUpWithVerificationCodeMutation: readFileSync(gqlDir + "/SignupWithVerificationCodeMutation.graphql", "utf8"),
    sendVerificationCodeMutation: readFileSync(gqlDir + "/SendVerificationCodeForLoginMutation.graphql", "utf8"),
};

enum BotType {
    'a2' = 'a2',
    'capybara' = 'capybara',
    'nutria' = 'nutria',
    'chinchilla' = 'chinchilla',
}
class PoeBot {
    public config = JSON.parse(readFileSync("config.json", "utf8"));
    private headers = {
        'Content-Type': 'application/json',
        'Host': 'poe.com',
        'Connection': 'keep-alive',
        'Origin': 'https://poe.com',
        'User-Agent': randomUseragent.getRandom(),
    }
    public chatId: number = 0;
    public bot: BotType = BotType.a2;

    public reConnectWs = false; // encounter error to set reconnect
    // @ts-ignore
    public ws : WebSocket;
    public submitedPrompt: string = '';
    private ctx: PetExpose
    constructor(ctx: PetExpose) {
        this.config = JSON.parse(readFileSync("config.json", "utf8"));
        this.ctx = ctx
    }
    /**
     *
     * @param pbCookie headers.get("set-cookie")?.split(";")[0];
     */
    public async init(pbCookie: string) {
        const isFormkeyAvailable = await this.getCredentials();
        if (!isFormkeyAvailable) {
            await this.setCredentials(pbCookie);
            await this.subscribe();

            // get login status + await this.setChatIds();
            await this.setChatIds();
        }
        if (this.ctx.db.get('poe.stream_response')) { // this.config.stream_response
            await getUpdatedSettings(this.config.channel_name, this.config.quora_cookie);
            await this.subscribe();
            this.ws = await connectWs();
        }
    }
    public async submit(submitedPrompt: string, callback: (result: string) => void) {
        if (submitedPrompt.length === 0) {
            console.log("No prompt to submit");
            return
        }
        await this.sendMsg(this.bot, submitedPrompt);
        if (this.config.stream_response) {
            if (this.reConnectWs) {
                await disconnectWs(this.ws);
                await getUpdatedSettings(this.config.channel_name, this.config.quora_cookie)
                await this.subscribe();
                this.ws = await connectWs();
                this.reConnectWs = false;
            }
            process.stdout.write("Response: ");
            await listenWs(this.ws, callback);
            console.log('\n');
        } else {
            let response = await this.getResponse(this.bot);
            console.log(response.data);
        }
        this.submitedPrompt = submitedPrompt;
    }
    public async clear(bot: BotType) {
        await this.clearContext(bot);
        if (this.config.stream_response) {
            if (this.reConnectWs) {
                await disconnectWs(this.ws);
                await getUpdatedSettings(this.config.channel_name, this.config.quora_cookie)
                await this.subscribe();
                this.ws = await connectWs();
                this.reConnectWs = false;
            }
        }
        console.log("Chat history cleared");
    }

    public async getCredentials() {
        const {quora_formkey, channel_name, quora_cookie} = this.config;
        if (quora_formkey.length > 0 && quora_cookie.length > 0) {
            // @ts-ignore
            this.headers["poe-formkey"] = quora_formkey;
            // @ts-ignore
            this.headers["poe-tchannel"] = channel_name;
            // @ts-ignore
            this.headers["Cookie"] = quora_cookie;
        }
        return quora_formkey.length > 0 && quora_cookie.length > 0;
    }

    public async setCredentials(pbCookie: string) {
        let result = await scrape(pbCookie);
        this.config.quora_formkey = result.appSettings.formkey;
        this.config.quora_cookie = result.pbCookie;
        this.config.channel_name = result.channelName;
        this.config.app_settings = result.appSettings;

        // set value
        // @ts-ignore
        this.headers["poe-formkey"] = this.config.quora_formkey;
        // @ts-ignore
        this.headers["poe-tchannel"] = this.config.channel_name;
        // @ts-ignore
        this.headers["Cookie"] = this.config.quora_cookie;

        writeFile("config.json", JSON.stringify(this.config, null, 4), function (err) {
            if (err) {
                console.log(err);
            }
        });
    }

    /**
     * Get every channel chat id
     */
    public async setChatIds() {
        const [a2, capybara, nutria, chinchilla] = await Promise.all([
            this.getChatId(BotType.a2),
            this.getChatId(BotType.capybara),
            this.getChatId(BotType.nutria),
            this.getChatId(BotType.chinchilla),
        ]);

        const credentials = JSON.parse(readFileSync("config.json", "utf8"));

        credentials.chat_ids = {
            a2,
            capybara,
            nutria,
            chinchilla,
        };

        this.config.chat_ids = {
            a2,
            capybara,
            nutria,
            chinchilla,
        }

        writeFile("config.json", JSON.stringify(credentials, null, 4), function (err) {
            if (err) {
                console.log(err);
            }
        });
    }
    public async clearContext(bot: string) {
        try {
            const data = await this.makeRequest({
                query: `${queries.addMessageBreakMutation}`,
                variables: {chatId: this.config.chat_ids[bot]},
            });

            if (!data.data) {
                this.reConnectWs = true; // for websocket purpose
                console.log("ON TRY! Could not clear context! Trying to reLogin.. | data:", data);
                // await this.reLogin();
                // await this.clearContext(bot);
            }
            return data
        } catch (e) {
            this.reConnectWs = true; // for websocket purpose
            // console.log("ON CATCH! Could not clear context! Trying to reLogin..");
            // await this.reLogin();
            // await this.clearContext(bot);
            console.error(e)
            return e
        }
    }

    public async resetConfig() {
        const defaultConfig = JSON.parse(readFileSync("config.example.json", "utf8"));
        console.log("Resetting config...")
        writeFile("config.json", JSON.stringify(defaultConfig, null, 4), function (err) {
            if (err) {
                console.log(err);
            }
        });
    }

    public async sendMsg(bot: string, query: string) {
        try {
            const data = await this.makeRequest({
                query: `${queries.addHumanMessageMutation}`,
                variables: {
                    bot: bot,
                    chatId: this.config.chat_ids[bot],
                    query: query,
                    source: null,
                    withChatBreak: false
                },
            });

            if (!data.data) {
                this.reConnectWs = true; // for cli websocket purpose
                console.log("Could not send message! Trying to reLogin.. | data:", data);
                // await this.reLogin();
                // await this.sendMsg(bot, query);
            }
            return data
        } catch (e) {
            this.reConnectWs = true; // for cli websocket purpose
            // console.log("ON CATCH! Could not send message! Trying to reLogin..");
            // await this.reLogin();
            // await this.sendMsg(bot, query);
            console.error(e)
            return e
        }
    }

    public async getResponse(bot: string): Promise<any> {
        let text: string
        let state: string
        let authorNickname: string
        try {
            while (true) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                let response = await this.makeRequest({
                    query: `${queries.chatPaginationQuery}`,
                    variables: {
                        before: null,
                        bot: bot,
                        last: 1,
                    },
                });
                let base = response.data.chatOfBot.messagesConnection.edges
                let lastEdgeIndex = base.length - 1;
                text = base[lastEdgeIndex].node.text;
                authorNickname = base[lastEdgeIndex].node.authorNickname;
                state = base[lastEdgeIndex].node.state;
                if (state === "complete" && authorNickname === bot) {
                    break;
                }
            }
        } catch (e) {
            console.log("Could not get response!");
            return {
                status: false,
                message: "failed",
                data: null,
            };
        }

        return {
            status: true,
            message: "success",
            data: text,
        }
    }

    public async deleteMessages(msgIds: number[]) {
        await this.makeRequest({
            queryName: 'MessageDeleteConfirmationModal_deleteMessageMutation_Mutation',
            variables: {
                messageIds: msgIds
            },
            query: `mutation MessageDeleteConfirmationModal_deleteMessageMutation_Mutation(\n  $messageIds: [BigInt!]!\n){\n  messagesDelete(messageIds: $messageIds) {\n    edgeIds\n  }\n}\n`
        })
    }

    public async getHistory(bot: string): Promise<any> {
        try {
            let response = await this.makeRequest({
                query: `${queries.chatPaginationQuery}`,
                variables: {
                    before: null,
                    bot: bot,
                    last: 25,
                },
            });

            return response.data.chatOfBot.messagesConnection.edges
                // @ts-ignore
                .map((({node: {messageId, text, authorNickname}}) => ({
                    messageId,
                    text,
                    authorNickname
                })))

        } catch(e) {
            console.log("There has been an error while fetching your history!")
        }
    }

    /**
     * for websocket(stream response) purpose
     */
    public async subscribe() {
        const query = {
            queryName: 'subscriptionsMutation',
            variables: {
                subscriptions: [
                    {
                        subscriptionName: 'messageAdded',
                        query: 'subscription subscriptions_messageAdded_Subscription(\n  $chatId: BigInt!\n) {\n  messageAdded(chatId: $chatId) {\n    id\n    messageId\n    creationTime\n    state\n    ...ChatMessage_message\n    ...chatHelpers_isBotMessage\n  }\n}\n\nfragment ChatMessageDownvotedButton_message on Message {\n  ...MessageFeedbackReasonModal_message\n  ...MessageFeedbackOtherModal_message\n}\n\nfragment ChatMessageDropdownMenu_message on Message {\n  id\n  messageId\n  vote\n  text\n  ...chatHelpers_isBotMessage\n}\n\nfragment ChatMessageFeedbackButtons_message on Message {\n  id\n  messageId\n  vote\n  voteReason\n  ...ChatMessageDownvotedButton_message\n}\n\nfragment ChatMessageOverflowButton_message on Message {\n  text\n  ...ChatMessageDropdownMenu_message\n  ...chatHelpers_isBotMessage\n}\n\nfragment ChatMessageSuggestedReplies_SuggestedReplyButton_message on Message {\n  messageId\n}\n\nfragment ChatMessageSuggestedReplies_message on Message {\n  suggestedReplies\n  ...ChatMessageSuggestedReplies_SuggestedReplyButton_message\n}\n\nfragment ChatMessage_message on Message {\n  id\n  messageId\n  text\n  author\n  linkifiedText\n  state\n  ...ChatMessageSuggestedReplies_message\n  ...ChatMessageFeedbackButtons_message\n  ...ChatMessageOverflowButton_message\n  ...chatHelpers_isHumanMessage\n  ...chatHelpers_isBotMessage\n  ...chatHelpers_isChatBreak\n  ...chatHelpers_useTimeoutLevel\n  ...MarkdownLinkInner_message\n}\n\nfragment MarkdownLinkInner_message on Message {\n  messageId\n}\n\nfragment MessageFeedbackOtherModal_message on Message {\n  id\n  messageId\n}\n\nfragment MessageFeedbackReasonModal_message on Message {\n  id\n  messageId\n}\n\nfragment chatHelpers_isBotMessage on Message {\n  ...chatHelpers_isHumanMessage\n  ...chatHelpers_isChatBreak\n}\n\nfragment chatHelpers_isChatBreak on Message {\n  author\n}\n\nfragment chatHelpers_isHumanMessage on Message {\n  author\n}\n\nfragment chatHelpers_useTimeoutLevel on Message {\n  id\n  state\n  text\n  messageId\n}\n'
                    },
                    {
                        subscriptionName: 'viewerStateUpdated',
                        query: 'subscription subscriptions_viewerStateUpdated_Subscription {\n  viewerStateUpdated {\n    id\n    ...ChatPageBotSwitcher_viewer\n  }\n}\n\nfragment BotHeader_bot on Bot {\n  displayName\n  ...BotImage_bot\n}\n\nfragment BotImage_bot on Bot {\n  profilePicture\n  displayName\n}\n\nfragment BotLink_bot on Bot {\n  displayName\n}\n\nfragment ChatPageBotSwitcher_viewer on Viewer {\n  availableBots {\n    id\n    ...BotLink_bot\n    ...BotHeader_bot\n  }\n}\n'
                    }
                ]
            },
            query: 'mutation subscriptionsMutation(\n  $subscriptions: [AutoSubscriptionQuery!]!\n) {\n  autoSubscribe(subscriptions: $subscriptions) {\n    viewer {\n      id\n    }\n  }\n}\n'
        };

        await this.makeRequest(query);
    }
    public async makeRequest(request: any) {
        const response = await fetch('https://poe.com/api/gql_POST', {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(request)
        });

        return await response.json();
    }
    public async getChatId(bot: BotType) {
        try {
            const {data: {chatOfBot: {chatId}}} = await this.makeRequest({
                query: `${queries.chatViewQuery}`,
                variables: {
                    bot,
                },
            });
            this.chatId = chatId;
            this.bot = bot;
            return chatId;
        } catch (e) {
            console.log(e)
            await this.resetConfig();
            throw new Error("Could not get chat id, invalid formkey or cookie! Please remove the quora_formkey value from the config.json file and try again.");
        }
    }
}

export default PoeBot;
