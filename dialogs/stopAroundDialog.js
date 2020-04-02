const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');

const { InputHints, MessageFactory, ActivityTypes } = require('botbuilder');
const { TextPrompt, WaterfallDialog, AttachmentPrompt } = require('botbuilder-dialogs');

const WATERFALL_DIALOG = 'STOP_AROUND_WATERFALL'
const LOCATION = 'CONFIRM_LOCATION'
const TEXT_PROMPT = 'TextPrompt_StopAround';

class StopArounDialog extends CancelAndHelpDialog {
    constructor(id) {
        super(id);
        this.addDialog(new TextPrompt(TEXT_PROMPT))
            .addDialog(new AttachmentPrompt(LOCATION, this.locationValidator))
            .addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.getLocationStep.bind(this),
                this.searchStopsStep.bind(this)
            ]));

        this.initialDialogId = WATERFALL_DIALOG;

    }

    async locationValidator(promptContext) {
         promptContext.context.sendActivity(JSON.stringify(promptContext));

        // if (promptContext.recognized.succeeded) {
        //     const obj = promptContext.recognized.value;
        //     promptContext.context.sendActivity(JSON.stringify(obj));
        //     return true;
        // }
        // else {
        //     return false;
        // }
        return true;
    }



    async getLocationStep(stepContext) {
        const result = stepContext.options;
        if (!result.location) {
            const messageText = 'Cho tôi biết nơi bạn muốn tìm';
            const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
            return await stepContext.prompt(LOCATION, { prompt: msg });
            // stepContext.context.sendActivity()
        }
    }


    async searchStopsStep(stepContext) {
        prompt = "Bạn cần giúp gì thêm không?";
        return await stepContext.endDialog(prompt);
    }
}


module.exports.StopArounDialog=StopArounDialog;