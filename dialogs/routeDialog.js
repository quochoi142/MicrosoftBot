// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { InputHints, MessageFactory } = require('botbuilder');
const { TextPrompt, WaterfallDialog, AttachmentPrompt } = require('botbuilder-dialogs');
const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');
const { CardFactory } = require('botbuilder-core');
const OriginCard = require('../resources/originCard.json');
const DestinationCard = require('../resources/destinationCard.json');
const ConfirmODCard = require('../resources/confirmODCard.json');

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
                this.finalStep.bind(this)
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
            const destinationCard = CardFactory.adaptiveCard(DestinationCard);
            await stepContext.context.sendActivity({ attachments: [destinationCard] });

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
            const messageText = 'Bạn sẽ đi từ đâu?';

            //Init card destination
            //const originCard = CardFactory.adaptiveCard(OriginCard);
            //await stepContext.context.sendActivity({ attachments: [originCard] });

            //const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
            return await stepContext.prompt(LOCATION, { prompt: messageText }, InputHints.ExpectingInput);



        }
        return await stepContext.next(route.origin);
    }


    async finalStep(stepContext) {
        const route = stepContext.options;
        route.origin = stepContext.result;

        // return await stepContext.endDialog(route);
        /*----------------------------------------------*/

        //Cho người dùng biết 2 điểm O-D
        const messageText = "Bạn muốn đi từ " + route.origin + " đến " + route.destination + ".";
        const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
        await stepContext.prompt(TEXT_PROMPT, { prompt: msg });

        //Init card confirmOD
        const confirmODCard = CardFactory.adaptiveCard(ConfirmODCard);
        await stepContext.context.sendActivity({ attachments: [confirmODCard] });

        //IF (Confirm)  thì mới chạy cái bên dưới
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

                const id = utils.getIdUser(stepContext.context);
                utils.saveRoute(id, result.destination);
                prompt = "Tôi có thể giúp gì thêm cho bạn?";
            }

            //else thì kiểm tra sai ở đâu
            //IF destination thì quay lại bước lấy điểm đến 
            //IF origin thì quay lại bước lấy điểm xuất phát
            //IF cả hai thì ...

        } catch (error) {
            prompt = error.message;


        }
        return await stepContext.endDialog(prompt);
    }




}

module.exports.RouteDialog = RouteDialog;
