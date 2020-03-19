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
        const welcomeCard = CardFactory.adaptiveCard(WelcomeCard);
        await stepContext.context.sendActivity({ attachments: [welcomeCard] });

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
                const locationCard = CardFactory.adaptiveCard(LocationCard);
                return await stepContext.context.sendActivity({ attachments: [locationCard] });
            }
            default: {

                const didntUnderstandMessageText = 'Bạn hãy chọn 1 trong các lựa chọn bên dưới';
                await stepContext.context.sendActivity(didntUnderstandMessageText, didntUnderstandMessageText, InputHints.IgnoringInput);
            }
        }

        return await stepContext.next();
    }


    async finalStep(stepContext) {


        const prompt = stepContext.result;
        // mới thêm !
        if (!prompt) {
            return await stepContext.replaceDialog(this.initialDialogId, { restartMsg: prompt });

        }
        //Init card confirm
        const confirmCard = CardFactory.adaptiveCard();
        await stepContext.context.sendActivity({ attachments: [confirmCard] });

        // IF confirm thì tiếp tục
        return await stepContext.replaceDialog(this.initialDialogId, { restartMsg: 'Bạn cần tôi giúp gì thêm không?' });

        // else thì return Bye bye
    }
}

module.exports.MainDialog = MainDialog;
