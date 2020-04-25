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
                                        "image_url": "https://petersfancybrownhats.com/company_image.png",
                                        "subtitle": "We have the right hat for everyone.",
                                        "default_action": {
                                            "type": "web_url",
                                            "url": "https://petersfancybrownhats.com/view?item=103",
                                            "messenger_extensions": false,
                                            "webview_height_ratio": "tall",
                                            "fallback_url": "https://petersfancybrownhats.com/"
                                        }
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
