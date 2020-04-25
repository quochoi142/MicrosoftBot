// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { MessageFactory, InputHints } = require('botbuilder');
const { LuisRecognizer } = require('botbuilder-ai');
const { ComponentDialog, DialogSet, DialogTurnStatus, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');
const { CardFactory } = require('botbuilder-core');

const WelcomeCard = require('../resources/welcomeCard.json');
const ConfirmCard = require('../resources/confirmCard.json');

const MAIN_WATERFALL_DIALOG = 'mainWaterfallDialog';


const { StopArounDialog } = require('./stopAroundDialog')
const STOP_AROUND_DIALOG = 'STOP_AROUND_DIALOG';
const SEARCH_DIALOG = 'searchDialog';

class MainDialog extends ComponentDialog {

    constructor(luisRecognizer, routeDialog, searchDialog) {

        super('MainDialog');

        if (!luisRecognizer) throw new Error('[MainDialog]: Missing parameter \'luisRecognizer\' is required');
        this.luisRecognizer = luisRecognizer;

        if (!routeDialog) throw new Error('[MainDialog]: Missing parameter \'routeDialog\' is required');

        if (!searchDialog) throw new Error('[MainDialog]: Missing parameter \'searchDialog\' is required');


        const stopAround = new StopArounDialog(STOP_AROUND_DIALOG);

        // Define the main dialog and its related components.
        // This is a sample "book a flight" dialog.
        this.addDialog(new TextPrompt('TextPrompt'))
            .addDialog(routeDialog)
            .addDialog(stopAround)
            .addDialog(searchDialog)
            .addDialog(new WaterfallDialog(MAIN_WATERFALL_DIALOG, [
                this.introStep.bind(this),
                this.actStep.bind(this),
                this.finalStep.bind(this),
                this.confirmEndStep.bind(this)

            ]));

        this.initialDialogId = MAIN_WATERFALL_DIALOG;
    }



    /**
     * The run method handles the incoming activity (in the form of a TurnContext) and passes it through the dialog system.
     * If no dialog is active, it will start the default dialog.
     * @param {*} turnContext
     * @param {*} accessor
     */
    async run(turnContext, accessor) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);

        const dialogContext = await dialogSet.createContext(turnContext);
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            await dialogContext.beginDialog(this.id);
        }
    }

    /**
     * First step in the waterfall dialog. Prompts the user for a command.
     * Currently, this expects a booking request, like "book me a flight from Paris to Berlin on march 22"
     * Note that the sample LUIS model will only recognize Paris, Berlin, New York and London as airport cities.
     */
    async introStep(stepContext) {
        // if (!this.luisRecognizer.isConfigured) {
        //     const messageText = 'NOTE: LUIS is not configured. To enable all capabilities, add `LuisAppId`, `LuisAPIKey` and `LuisAPIHostName` to the .env file.';
        //     await stepContext.context.sendActivity(messageText, null, InputHints.IgnoringInput);
        //     return await stepContext.next();
        // }

        //Init card welcome

        const welcomeCard = CardFactory.adaptiveCard(WelcomeCard);
        await stepContext.context.sendActivity({ attachments: [welcomeCard] });

        const messageText = null; //set null Intro message
        const promptMessage = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
        return await stepContext.prompt('TextPrompt', { prompt: promptMessage });
    }

    /**
     * Second step in the waterfall.  This will use LUIS to attempt to extract the origin, destination and travel dates.
     * Then, it hands off to the bookingDialog child dialog to collect any remaining details.
     */
    async actStep(stepContext) {
        const routeDetails = {};


        if (!this.luisRecognizer.isConfigured) {
            // LUIS is not configured, we just run the BookingDialog path.
            return await stepContext.beginDialog('routeDialog', routeDetails);
        }

        // Call LUIS and gather any potential booking details. (Note the TurnContext has the response to the prompt)
        const luisResult = await this.luisRecognizer.executeLuisQuery(stepContext.context);
        switch (LuisRecognizer.topIntent(luisResult)) {
            case 'Tìm_đường': {
                const from = this.luisRecognizer.getFromEntities(luisResult);
                const to = this.luisRecognizer.getToEntities(luisResult);
                routeDetails.origin = from;
                routeDetails.destination = to;
                return await stepContext.beginDialog('routeDialog', routeDetails);
            }
            case 'Tìm_xe_bus': {
                console.log('chua vo');
                return await stepContext.context.sendActivity({
                    text: "test",
                    channelData: {
                        "attachment": {
                            "type": "template",
                            "payload": {
                                "template_type": "generic",
                                "elements": [
                                    {
                                        "title": "Welcome!",
                                        "image_url": "https://www.gocbao.com/https://img2.thuthuatphanmem.vn/uploads/2018/11/25/anh-dep-lol-sieu-pham_030638022.jpg-content/uploads/2020/04/anh-dep-hoa-huong-duong-va-mat-troi_022805970-1-1181x800-6.jpg",
                                        "buttons": [
                                            {
                                                "type": "web_url",
                                                "url": "https://petersfancybrownhats.com",
                                                "title": "View Website"
                                            },
                                            {
                                                "type": "postback",
                                                "title": "Start Chatting",
                                                "payload": "DEVELOPER_DEFINED_PAYLOAD"
                                            }
                                        ]
                                    },
                                    {
                                        "title": "com1!",
                                        "image_url": "https://www.data:image/jpeg;base64,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.com/wp-content/uploads/2020/04/anh-dep-hoa-huong-duong-va-mat-troi_022805970-1-1181x800-6.jpg",
                                        "buttons": [
                                            {
                                                "type": "web_url",
                                                "url": "https://petersfancybrownhats.com",
                                                "title": "View Website"
                                            },
                                            {
                                                "type": "postback",
                                                "title": "Start Chatting",
                                                "payload": "DEVELOPER_DEFINED_PAYLOAD"
                                            }
                                        ]
                                    },
                                    {
                                        "title": "com3!",
                                        "image_url": "https://https://hinhanhdep.net/wp-content/https://hinhanhdep.net/wp-content/uploads/2017/06/hinh-nen-lien-minh-huyen-thoai-99.jpg/2017/06/hinh-nen-lien-minh-huyen-thoai-99.jpg.gocbao.com/wp-content/uploads/2020/04/anh-dep-hoa-huong-duong-va-mat-troi_022805970-1-1181x800-6.jpg",
                                        "buttons": [
                                            {
                                                "type": "web_url",
                                                "url": "https://petersfancybrownhats.com",
                                                "title": "View Website"
                                            },
                                            {
                                                "type": "postback",
                                                "title": "Start Chatting",
                                                "payload": "DEVELOPER_DEFINED_PAYLOAD"
                                            }
                                        ]
                                    }

                                ]
                            }
                        }

                    }
                });

                const StopDetail = {};
                const result = luisResult;
                if (result.entities.$instance.Stop) {
                    StopDetail.stop = result.entities.$instance.Stop[0].text;
                }

                return await stepContext.beginDialog(SEARCH_DIALOG, StopDetail);

            }
            case 'Tìm_trạm': {


                var location = {};
                const result = luisResult
                if (result.entities.$instance.Origin) {
                    location.origin = result.entities.$instance.Origin[0].text;
                }

                return await stepContext.beginDialog(STOP_AROUND_DIALOG, location);


            }
            case 'Kết_thúc': {
                //chỉ hiện location card
                return await stepContext.next();
            }
            default: {

                const didntUnderstandMessageText = 'Bạn hãy chọn 1 trong các lựa chọn bên dưới';
                await stepContext.context.sendActivity(didntUnderstandMessageText, didntUnderstandMessageText, InputHints.IgnoringInput);
            }
            case 'Trợ_giúp': {
                const helpMessageText = 'Bạn hãy chọn 1 trong các lựa chọn bên dưới \r\n Hoặc bạn có thể nhập trực tiếp yêu cầu vào \r\n VD: Tìm đường \r\n Tra cứu xe bus tại trạm suối tiên \r\n Tôi muốn đi từ đầm sen đến suối tiên v.v.';
                await stepContext.context.sendActivity(helpMessageText, helpMessageText, InputHints.IgnoringInput);

            }

        }

        return await stepContext.replaceDialog(this.initialDialogId);
    }

    async finalStep(stepContext) {

        if (stepContext.result == "Bạn cần giúp gì thêm không?") {

            return await stepContext.next(stepContext.result);

        }
        else {

            const byeMessageText = 'Chào tạm biệt...';
            await stepContext.context.sendActivity(byeMessageText, byeMessageText, InputHints.IgnoringInput);

            return await stepContext.endDialog();
        }
    }

    async confirmEndStep(stepContext) {

        const prompt = stepContext.result;
        await stepContext.context.sendActivity(prompt, prompt, InputHints.IgnoringInput);

        return await stepContext.replaceDialog(this.initialDialogId);


    }
}
module.exports.MainDialog = MainDialog;
