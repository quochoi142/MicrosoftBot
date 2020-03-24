// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { MessageFactory, InputHints } = require('botbuilder');
const { LuisRecognizer } = require('botbuilder-ai');
const { ComponentDialog, DialogSet, DialogTurnStatus, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');
const { CardFactory } = require('botbuilder-core');
const WelcomeCard = require('../resources/welcomeCard.json');
//const WelcomeCard = require('../resources/confirmCard.json');
const LocationCard = require('../resources/locationCard.json');
const ConfirmCard = require('../resources/confirmCard.json');

const MAIN_WATERFALL_DIALOG = 'mainWaterfallDialog';

class MainDialog extends ComponentDialog {
    constructor(luisRecognizer, routeDialog) {
        super('MainDialog');

        if (!luisRecognizer) throw new Error('[MainDialog]: Missing parameter \'luisRecognizer\' is required');
        this.luisRecognizer = luisRecognizer;

        if (!routeDialog) throw new Error('[MainDialog]: Missing parameter \'routeDialog\' is required');

        // Define the main dialog and its related components.
        // This is a sample "book a flight" dialog.
        this.addDialog(new TextPrompt('TextPrompt'))
            .addDialog(routeDialog)
            .addDialog(new WaterfallDialog(MAIN_WATERFALL_DIALOG, [
                this.introStep.bind(this),
                this.actStep.bind(this),
                this.confirmEndStep.bind(this),
                this.finalStep.bind(this)

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
        const welcomeMessageText = 'Chào mừng bạn đến với Bus bot. Hãy chọn 1 trong 2 chức năng ở dưới';
        await stepContext.context.sendActivity(welcomeMessageText, welcomeMessageText, InputHints.IgnoringInput);


        const welcomeCard = CardFactory.adaptiveCard(WelcomeCard);
        await stepContext.context.sendActivity({ attachments: [welcomeCard] });

        const welcomeMessageText_Hint = 'Ngoài cách lựa chọn chức năng bạn cũng có thể nhập trực tiếp yêu cầu vào';
        const welcomeMessageText_Example1 = 'VD: Tìm đường';
        const welcomeMessageText_Example2 = 'Tra cứu xe bus tại trạm suối tiên';
        const welcomeMessageText_Example3 = 'Tôi muốn đi từ đầm sen đến suối tiên v.v.';
        await stepContext.context.sendActivity(welcomeMessageText_Hint, welcomeMessageText_Hint, InputHints.IgnoringInput);
        await stepContext.context.sendActivity(welcomeMessageText_Example1, welcomeMessageText_Example1, InputHints.IgnoringInput);
        await stepContext.context.sendActivity(welcomeMessageText_Example2, welcomeMessageText_Example2, InputHints.IgnoringInput);
        await stepContext.context.sendActivity(welcomeMessageText_Example3, welcomeMessageText_Example3, InputHints.IgnoringInput);

        //const messageText = stepContext.options.restartMsg ? stepContext.options.restartMsg : 'Tôi có thể giúp gì thêm cho bạn?';
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
            case 'Tra_cứu': {
                //chỉ hiện location card

                //Init card location
                const locationMessageText = 'Bạn tra cứu xe bus cho trạm nào?';
                await stepContext.context.sendActivity(locationMessageText, locationMessageText, InputHints.IgnoringInput);

                const locationCard = CardFactory.adaptiveCard(LocationCard);
                await stepContext.context.sendActivity({ attachments: [locationCard] });

                const locationMessageText_Hint = 'Ngoài các lựa chọn trên bạn cũng có thể nhập nơi bạn muốn tra cứu vào';
                const LocationMessageText_Example = 'VD: tra cứu xe bus tại trạm suối tiên';
                await stepContext.context.sendActivity(locationMessageText_Hint, locationMessageText_Hint, InputHints.IgnoringInput);
                await stepContext.context.sendActivity(LocationMessageText_Example, LocationMessageText_Example, InputHints.IgnoringInput);

                const alert = "Chưa cài đặt chức năng"
                return await stepContext.context.sendActivity(alert, alert, InputHints.IgnoringInput);

            }
            default: {

                const didntUnderstandMessageText = 'Bạn hãy chọn 1 trong các lựa chọn bên dưới';
                await stepContext.context.sendActivity(didntUnderstandMessageText, didntUnderstandMessageText, InputHints.IgnoringInput);
            }
        }

        return await stepContext.next();
    }


    async confirmEndStep(stepContext) {
        const prompt = stepContext.result;

        // mới thêm !
        if (prompt == "Bạn cần giúp gì thêm không?") {
            //Init card confirm
            const confirmCard = CardFactory.adaptiveCard(ConfirmCard);
            await stepContext.context.sendActivity({ attachments: [confirmCard] });

            return await stepContext.prompt('TextPrompt', { prompt: prompt });
        }

        return await stepContext.replaceDialog(this.initialDialogId, { restartMsg: prompt });
    }

    async finalStep(stepContext) {

        if ('Có' == stepContext.result || 'có' == stepContext.result ||'\"Có\"' == stepContext.result) {
            return await stepContext.beginDialog('MainDialog');
        }
        const byeMessageText = "Chào tạm biệt, hi vọng tôi đã giúp được bạn <3 !!!";
        return await stepContext.context.sendActivity(byeMessageText,byeMessageText, InputHints.IgnoringInput);

    }
}

module.exports.MainDialog = MainDialog;
