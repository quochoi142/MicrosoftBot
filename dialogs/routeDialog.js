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
            //const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
            return await stepContext.prompt(LOCATION, { prompt: messageText }, InputHints.ExpectingInput);



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
        return await stepContext.prompt(LOCATION, { prompt: null }, InputHints.ExpectingInput);
    }
    async finalStep(stepContext) {
        if ('Đúng' == stepContext.result || 'đúng' == stepContext.result) {
            const activity = Object.assign({}, stepContext.context)._activity;

            // stepContext.context.sendActivity(JSON.stringify(activity), JSON.stringify(activity), InputHints.IgnoringInput);

            //var result = stepContext.options;
            var result = stepContext.options;
            result.origin = stepContext.result;
            // result.origin = "suối tiên";
            // await stepContext.context.sendActivity(JSON.stringify(stepContext.result), JSON.stringify(stepContext.result), InputHints.IgnoringInput);


            const http_request = process.env.GgAPI + "&origin=" + result.origin + ' tphcm' + "&destination=" + result.destination + ' tphcm';
            var prompt = '';

            try {
                const response = await fetch(utf8.encode(http_request));

                const json = await response.json();
                if (response.status != 200 || json.routes.length == 0) {
                    //await stepContext.context.sendActivity("Không tìm thấy đường đi bạn có thể cung cấp địa chỉ cụ thể hơn không", "Không tìm thấy đường đi bạn có thể cung cấp địa chỉ cụ thể hơn không", InputHints.IgnoringInput);
                    prompt = 'Không tìm thấy đường đi bạn có thể cung cấp địa chỉ cụ thể hơn không';

                }
                else {
                    let leg = json.routes[0].legs[0];
                    let route = leg.steps;
                    const summary_direction = "Đi từ " + leg.start_address + " đến " + leg.end_address + ".\n Tổng quãng đường là " + leg.distance.text + " đi mất khoảng " + leg.duration.text;

                    await stepContext.context.sendActivity(summary_direction, summary_direction, InputHints.IgnoringInput);
                    for (var i = 0; i < route.length; i++) {
                        var step = route[i];
                        if (step.travel_mode === 'WALKING') {

                            await stepContext.context.sendActivity(step.html_instructions, step.html_instructions, InputHints.IgnoringInput);
                        }
                        else {
                            const instuction = "Bắt xe bus " + step.transit_details.line.name + "\nTừ trạm " + step.transit_details.departure_stop.name + " tới trạm " + step.transit_details.arrival_stop.name
                            await stepContext.context.sendActivity(instuction, instuction, InputHints.IgnoringInput);

                        }
                    }
                    //console.log(config);
                    await stepContext.context.sendActivity("1", "1", InputHints.IgnoringInput);
                    const id = utils.getIdUser(stepContext.context);
                    await stepContext.context.sendActivity("2", "2", InputHints.IgnoringInput);
                    utils.saveRoute(id, result.destination);
                    prompt = "Bạn cần giúp gì thêm không?";
                }
            } catch (error) {
                prompt = error.message;
                await stepContext.context.sendActivity(prompt, prompt, InputHints.IgnoringInput);
            }

            return await stepContext.endDialog(prompt);
        }

        const wrongCardMessagetext = "Bạn hãy cho tôi biết là sai ở đâu?";
        await stepContext.context.sendActivity(wrongCardMessagetext, wrongCardMessagetext, InputHints.IgnoringInput);

        const wrongCard = CardFactory.adaptiveCard(WrongCard);
        await stepContext.context.sendActivity({ attachments: [wrongCard] });
        return await stepContext.prompt(LOCATION, { prompt: "" }, InputHints.ExpectingInput);

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
            default: {
                const didntUnderstandMessageText = "Lựa chọn của bạn không phù hợp?";
                await stepContext.context.sendActivity(didntUnderstandMessageText, didntUnderstandMessageText, InputHints.IgnoringInput);

                return await stepContext.beginDialog('routeDialog', route);
            }
        }
    }

}

module.exports.RouteDialog = RouteDialog;
