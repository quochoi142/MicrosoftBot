// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { InputHints, MessageFactory } = require('botbuilder');
const { TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');
const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');
const { CardFactory } = require('botbuilder-core');
const LocationCard = require('../resources/locationCard.json');
const ConfirmLocationCard = require('../resources/confirmLocationCard.json');

const TEXT_PROMPT = 'TextPrompt_RouteDetail';
const WATERFALL_DIALOG = 'waterfallDialog_RouteDetail';
const LOCATION = 'location_prompt';

const utf8 = require('utf8');
const fetch = require("node-fetch");
const utils = require('../firebaseConfig/utils');


class SearchDialog extends CancelAndHelpDialog {
    constructor(id) {
        super(id);

        this.addDialog(new TextPrompt(TEXT_PROMPT))
            .addDialog(new TextPrompt(LOCATION, this.locationValidator))
            .addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.locationStep.bind(this),
                this.confirmLocationStep.bind(this),
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


    async locationStep(stepContext) {
        //code lấy vị trí để tra cứu trong đây

        //Init card location
        const locationMessageText = 'Trạm bạn tra cứu là?';
        await stepContext.context.sendActivity(locationMessageText, locationMessageText, InputHints.IgnoringInput);

        const locationCard = CardFactory.adaptiveCard(LocationCard);
        await stepContext.context.sendActivity({ attachments: [locationCard] });

        const locationMessageText_Hint = 'Ngoài các lựa chọn trên bạn cũng có thể nhập điểm đến vào';
        const locationMessageText_Example = 'VD: tra cứu xe bus tại trạm suối tiên';
        await stepContext.context.sendActivity(locationMessageText_Hint, locationMessageText_Hint, InputHints.IgnoringInput);
        await stepContext.context.sendActivity(locationMessageText_Example, locationMessageText_Example, InputHints.IgnoringInput);

        const messageText = null;
        const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
        return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
    }


    async confirmLocationStep(stepContext) {

        //Cho người dùng biết trạm sẽ tra cứu
        const confirmLocationmessageText = "Bạn muốn tra cứu cho trạm này có phải không?";
        await stepContext.context.sendActivity(confirmLocationmessageText, confirmLocationmessageText, InputHints.IgnoringInput);

        //Init card confirmOD
        const confirmLocationCard = CardFactory.adaptiveCard(ConfirmLocationCard);
        await stepContext.context.sendActivity({ attachments: [confirmLocationCard] });

        const messageText = null;
        const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
        return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
    }

    async finalStep(stepContext) {

        // code tra cứu nằm trong đây
        if ('Đúng' == stepContext.result || 'đúng' == stepContext.result || "\"Đúng\"" == stepContext.result) {

            const prompt = "Bạn cần giúp gì thêm không?";
            return await stepContext.endDialog(prompt);

        }
        else {

            return await stepContext.beginDialog('searchDialog');

        }
    }


}

module.exports.SearchDialog = SearchDialog;
