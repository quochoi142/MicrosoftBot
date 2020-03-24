// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { InputHints, MessageFactory } = require('botbuilder');
const { TextPrompt, WaterfallDialog, AttachmentPrompt } = require('botbuilder-dialogs');
const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');
const { CardFactory } = require('botbuilder-core');
const OriginCard = require('../resources/originCard.json');
const DestinationCard = require('../resources/destinationCard.json');
const ConfirmODCard = require('../resources/confirmODCard.json');
const WrongCard = require('../resources/wrongCard.json');

const TEXT_PROMPT = 'TextPrompt_RouteDetail';
const WATERFALL_DIALOG = 'waterfallDialog_RouteDetail';
const LOCATION = 'location_prompt';

const utf8 = require('utf8');
const fetch = require("node-fetch");
const utils = require('../firebaseConfig/utils');


class RouteDialog extends CancelAndHelpDialog {
    constructor(id) {
        super(id);

        this.addDialog(new TextPrompt(TEXT_PROMPT))
            .addDialog(new TextPrompt(LOCATION, this.locationValidator))
            .addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.destinationStep.bind(this),
                this.originStep.bind(this),
                this.confirmODStep.bind(this),
                this.finalStep.bind(this),
                this.errorStep.bind(this)


            ]));

        this.initialDialogId = WATERFALL_DIALOG;


    }
    async locationValidator(promptContext) {
        if (promptContext.recognized.succeeded) {
            const obj = promptContext.recognized.value;
            promptContext.context.sendActivity(JSON.stringify(obj));
            return true;
        }
        else {
            return false;
        }
        // var location = activity.entry[0];
        // if (location != null) {
        //     return true;
        // }
        // return false
        // return promptContext.recognized.succeeded && promptContext.recognized.value > 0 && promptContext.recognized.value < 150;
    }

    async destinationStep(stepContext) {
        const route = stepContext.options;
        if (!route.destination) {
            //Init card destination
            const destinationMessageText = 'Nơi bạn muốn đến là?';
            await stepContext.context.sendActivity(destinationMessageText, destinationMessageText, InputHints.IgnoringInput);

            const destinationCard = CardFactory.adaptiveCard(DestinationCard);
            await stepContext.context.sendActivity({ attachments: [destinationCard] });

            const destinationMessageText_Hint = 'Ngoài các lựa chọn trên bạn cũng có thể nhập điểm đến vào';
            const destinationMessageText_Example = 'VD: tôi muốn đến suối tiên';
            await stepContext.context.sendActivity(destinationMessageText_Hint, destinationMessageText_Hint, InputHints.IgnoringInput);
            await stepContext.context.sendActivity(destinationMessageText_Example, destinationMessageText_Example, InputHints.IgnoringInput);

            //const messageText = 'Nơi bạn muốn đến là?';
            const messageText = null;
            const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
            return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
        }

        return await stepContext.next(route.destination);
    }

    async originStep(stepContext) {
        const route = stepContext.options;
        route.destination = stepContext.result;
        if (!route.origin) {


            //Init card destination
            const originMessageText = 'Bạn sẽ đi từ đâu?';
            await stepContext.context.sendActivity(originMessageText, originMessageText, InputHints.IgnoringInput);

            const originCard = CardFactory.adaptiveCard(OriginCard);
            await stepContext.context.sendActivity({ attachments: [originCard] });

            const originMessageText_Hint = 'Ngoài các lựa chọn trên bạn cũng có thể nhập điểm xuất phát vào';
            const originMessageText_Example = 'VD: tôi muốn đi từ suối tiên';
            await stepContext.context.sendActivity(originMessageText_Hint, originMessageText_Hint, InputHints.IgnoringInput);
            await stepContext.context.sendActivity(originMessageText_Example, originMessageText_Example, InputHints.IgnoringInput);

            const messageText = null;
            const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
            return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });



        }
        return await stepContext.next(route.origin);
    }

    async confirmODStep(stepContext) {
        const route = stepContext.options;
        route.origin = stepContext.result;

        // return await stepContext.endDialog(route);
        /*----------------------------------------------*/

        //Cho người dùng biết 2 điểm O-D
        const confirmODmessageText = "Bạn muốn đi từ " + route.origin + " đến " + route.destination + " có phải không?";
        await stepContext.context.sendActivity(confirmODmessageText, confirmODmessageText, InputHints.IgnoringInput);

        //Init card confirmOD
        const confirmODCard = CardFactory.adaptiveCard(ConfirmODCard);
        await stepContext.context.sendActivity({ attachments: [confirmODCard] });

        const messageText = null;
        const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
        return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
    }
    async finalStep(stepContext) {
        if ('Đúng' == stepContext.result || 'đúng' == stepContext.result || "\"Đúng\"" == stepContext.result) {
            const activity = Object.assign({}, stepContext.context)._activity;

            // stepContext.context.sendActivity(JSON.stringify(activity), JSON.stringify(activity), InputHints.IgnoringInput);

            //var result = stepContext.options;
            var result = stepContext.options;
            result.origin = stepContext.result;
            // result.origin = "suối tiên";
            // await stepContext.context.sendActivity(JSON.stringify(stepContext.result), JSON.stringify(stepContext.result), InputHints.IgnoringInput);

            try {

            } catch (error) {
                prompt = error.message;
            }

            return await stepContext.endDialog(prompt);
        }

        const wrongCardMessagetext = "Bạn hãy cho tôi biết là sai ở đâu?";
        await stepContext.context.sendActivity(wrongCardMessagetext, wrongCardMessagetext, InputHints.IgnoringInput);

        const wrongCard = CardFactory.adaptiveCard(WrongCard);
        await stepContext.context.sendActivity({ attachments: [wrongCard] });

        const messageText = null;
        const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
        return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });

    }

    async errorStep(stepContext) {
        const route = stepContext.options;
        switch (stepContext.result) {
            case 'Sai điểm xuất phát': {
                route.origin = null;
                return await stepContext.beginDialog('routeDialog', route);
            }
            case 'Sai điểm đến': {
                route.destination = null;
                return await stepContext.beginDialog('routeDialog', route);
            }
            case 'Sai cả hai': {
                route.origin = null;
                route.destination = null;
                return await stepContext.beginDialog('routeDialog', route);
            }
            case '\"Sai điểm xuất phát\"': {
                route.origin = null;
                return await stepContext.beginDialog('routeDialog', route);
            }
            case '\"Sai điểm đến\"': {
                route.destination = null;
                return await stepContext.beginDialog('routeDialog', route);
            }
            case '\"Sai cả hai\"': {
                route.origin = null;
                route.destination = null;
                return await stepContext.beginDialog('routeDialog', route);
            }
            default: {
                const didntUnderstandMessageText = "Lựa chọn của bạn không phù hợp?";
                await stepContext.context.sendActivity(didntUnderstandMessageText, didntUnderstandMessageText, InputHints.IgnoringInput);

                return await stepContext.beginDialog('routeDialog', route);
            }
        }
    }

}

module.exports.RouteDialog = RouteDialog;
