// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
const { LuisRecognizer } = require('botbuilder-ai');
const { BusRecognizer } = require('../dialogs/BusRecognizer');
const { InputHints, MessageFactory } = require('botbuilder');
const { TextPrompt, WaterfallDialog, ConfirmPrompt } = require('botbuilder-dialogs');
const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');
const { CardFactory } = require('botbuilder-core');
const StopCard = require('../resources/locationCard.json');
const ConfirmLocationCard = require('../resources/confirmLocationCard.json');

const TEXT_PROMPT = 'TextPrompt_RouteDetail';
const WATERFALL_DIALOG = 'waterfallDialog_RouteDetail';
const LOCATION = 'location_prompt';
const CONFIRM = "confirm_prompt"
const utf8 = require('utf8');
const fetch = require("node-fetch");
const utils = require('../firebaseConfig/utils');
var encodeUrl = require('encodeurl')
var stringSimilarity = require('string-similarity');

class SearchDialog extends CancelAndHelpDialog {
    constructor(id) {
        super(id);

        this.addDialog(new TextPrompt(TEXT_PROMPT))
            .addDialog(new ConfirmPrompt(CONFIRM))
            .addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.GetStopStep.bind(this),
                this.GetBusNum.bind(this),
                this.SearchStep.bind(this),
                // this.confirmNotify.bind(this)

            ]));

        this.initialDialogId = WATERFALL_DIALOG;


    }



    async GetStopStep(stepContext) {
        //code lấy vị trí để tra cứu trong đây
        const result = stepContext.options;
        if (!result.stop) {

            // Get departures from Firebase
            try {

                const id = await utils.getIdUser(stepContext.context);
                var myDep = await utils.readDeparture(id);
            } catch (error) {
                console.log(error);
            }

            //Send message
            try {
                await stepContext.context.sendActivity({
                    channelData: {
                        "attachment": {
                            "type": "template",
                            "payload": {
                                "template_type": "generic",
                                "elements": [
                                    {
                                        "title": "Trạm bạn muốn hỏi?",
                                        "image_url": "https://image.freepik.com/free-vector/flat-bus-stop-concept_23-2147846117.jpg",
                                        "subtitle": "Bạn có thể chọn 1 trong các lựa chọn bên dưới hoặc nhập trực tiếp.",
                                        "buttons": [
                                            {
                                                "type": "postback",
                                                "title": myDep[0],
                                                "payload": myDep[0]
                                            },
                                            {
                                                "type": "postback",
                                                "title": myDep[1],
                                                "payload": myDep[1]
                                            },
                                            {
                                                "type": "postback",
                                                "title": myDep[2],
                                                "payload": myDep[2]
                                            }
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                });

            } catch (error) {
                await stepContext.context.sendActivity({
                    channelData: {
                        "attachment": {
                            "type": "template",
                            "payload": {
                                "template_type": "generic",
                                "elements": [
                                    {
                                        "title": "Trạm bạn muốn hỏi?",
                                        "image_url": "https://image.freepik.com/free-vector/flat-bus-stop-concept_23-2147846117.jpg",
                                        "subtitle": "Bạn có thể chọn 1 trong các lựa chọn bên dưới hoặc nhập trực tiếp.",
                                        "buttons": [
                                            {
                                                "type": "postback",
                                                "title": "Đại học khoa học tự nhiên, Linh Trung, Thủ Đức.",
                                                "payload": "Đại học khoa học tự nhiên, Linh Trung, Thủ Đức."
                                            },
                                            {
                                                "type": "postback",
                                                "title": "Đại học khoa học tự nhiên, 227 nguyễn văn cừ.",
                                                "payload": "Đại học khoa học tự nhiên, 227 nguyễn văn cừ."
                                            },
                                            {
                                                "type": "postback",
                                                "title": "Suối tiên",
                                                "payload": "Suối tiên"
                                            }
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                });
            }

            const messageText = null;
            const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
            return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
        }
        return await stepContext.next(result.stop);

    }

    async GetBusNum(stepContext) {
        var result = stepContext.options;


        if (!result.bus) {
            
            const { LuisAppId, LuisAPIKey, LuisAPIHostName } = process.env;
            const luisConfig = { applicationId: LuisAppId, endpointKey: LuisAPIKey, endpoint: `https://${LuisAPIHostName}` };
            const luis = new BusRecognizer(luisConfig);

            // check From and To to Restart searchDialogs 
            const luisResult = await luis.executeLuisQuery(stepContext.context);
            var bus = null;
            var stop = null;

            if (LuisRecognizer.topIntent(luisResult) == "Tra_cứu_xe") {
                bus = luis.getBusEntities(luisResult);
                stop = luis.getStopEntities(luisResult);
            }

            const StopDetail = {};
            if (bus && stop) {
                StopDetail.stop = stop;
                StopDetail.bus = bus;
                await stepContext.endDialog();
                return await stepContext.beginDialog('searchDialog', StopDetail);
            }
            else if (bus && !stop) {
                await stepContext.context.sendActivity('Câu trả lời không hợp lệ.\r\n Vui lòng cho tôi biết tên trạm thay vì số xe', '', InputHints.IgnoringInput);
                await stepContext.endDialog();
                return await stepContext.beginDialog('searchDialog', StopDetail);
            }
            else if (!bus && stop) {
                result.stop = stop;
            }
            else if (!bus && !stop) {
                result.stop = stepContext.result;
            }

            // Get Bus from Firebase
            try {
                const id = await utils.getIdUser(stepContext.context);
                var myBus = await utils.readBus(id);

            } catch (error) {
                console.log(error);
            }

            //////--------------------------------------

            var place = (stepContext.result) ? stepContext.result : result.stop;
            const urlRequestGeo = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json?key=AIzaSyBuTd5eFJwpova9M3AGpPrSwmzp_hHWVuE&inputtype=textquery&language=vi&fields=formatted_address,geometry&input=' + place + ' tphcm';

            const response = await fetch(utf8.encode(urlRequestGeo));
            const json = await response.json();

            if (response.status != 200 || (json.candidates && json.candidates.length == 0)) {
                
                await stepContext.context.sendActivity('Không tìm thấy trạm này')
                return await stepContext.endDialog("Bạn cần giúp gì thêm không?");
            } else {
                //request get Geo(lat,lng)
                result = {};
                result.address = json.candidates[0].formatted_address;
                result.geo = json.candidates[0].geometry.location;
                this.geo = result.geo
                this.place = place
                const url = 'https://transit.hereapi.com/v8/departures?maxPerBoard=10&lang=vi&in=' + result.geo.lat + ',' + result.geo.lng + ';r=1000&name=' + place;
                var myHeaders = new fetch.Headers();
                myHeaders.append("Authorization", 'Bearer ' + process.env.token);

                var requestOptions = {
                    method: 'GET',
                    headers: myHeaders,
                    redirect: 'follow'
                };
                const response = await fetch(encodeUrl(url), requestOptions)
                if (response.status != 200) {
                    await stepContext.context.sendActivity("Lỗi server")
                    return await stepContext.endDialog("Bạn cần giúp gì thêm không?")
                }
                const data = await response.json();

                if (data.boards.length == 0) {
                    prompt = 'Không tìm thấy trạm ' + place;
                    await stepContext.context.sendActivity(prompt)
                    return await stepContext.endDialog("Bạn cần giúp gì thêm không?")
                } else {
                    var buses = [];
                    const boards = data.boards;
                    var isExistsBus = false;
                    for (var i = 0; i < boards.length; i++) {

                        if (stringSimilarity.compareTwoStrings(boards[i].place.name.toLowerCase(), place.toLowerCase()) > 0.7) {
                            //const departures = boards[i].departures;
                            buses = boards[i].departures;




                        }


                    }

                }
                if(buses.length==0){
                    await stepContext.context.sendActivity("Có vẻ như không tìm thấy trạm xe bus này. Vui lòng tìm các trạm xung quanh bạn để biết rõ hơn.");
                    return await stepContext.endDialog("Bạn cần giúp gì thêm không?")
                }
                var departures = []
                var buttons = []
                buses.forEach(e => {
                    if (!departures.includes(e.transport.name)) {
                        departures.push(e.transport.name)
                        buttons.push({
                            "type": "postback",
                            "title": e.transport.name,
                            "payload": e.transport.name
                        })
                    }
                });

                //////--------------------------------------
                
                //Send message
                try {
                    await stepContext.context.sendActivity({
                        channelData: {
                            "attachment": {
                                "type": "template",
                                "payload": {
                                    "template_type": "generic",
                                    "elements": [
                                        {
                                            "title": "Bạn muốn hỏi xe bus số mấy?",
                                            "image_url": "https://image.freepik.com/free-vector/happy-cute-kids-wait-school-bus-with-friends_97632-1086.jpg",
                                            "subtitle": "Bạn có thể chọn 1 trong các lựa chọn bên dưới hoặc nhập trực tiếp.",
                                            "buttons": buttons
                                        }
                                    ]
                                }
                            }
                        }
                    });

                } catch (error) {
                    // await stepContext.context.sendActivity({
                    //     channelData: {
                    //         "attachment": {
                    //             "type": "template",
                    //             "payload": {
                    //                 "template_type": "generic",
                    //                 "elements": [
                    //                     {
                    //                         "title": "Bạn muốn hỏi xe bus số mấy?",
                    //                         "image_url": "https://image.freepik.com/free-vector/happy-cute-kids-wait-school-bus-with-friends_97632-1086.jpg",
                    //                         "subtitle": "Bạn có thể chọn 1 trong các lựa chọn bên dưới hoặc nhập trực tiếp.",
                    //                         "buttons": [
                    //                             {
                    //                                 "type": "postback",
                    //                                 "title": "08",
                    //                                 "payload": "08"
                    //                             },
                    //                             {
                    //                                 "type": "postback",
                    //                                 "title": "19",
                    //                                 "payload": "19"
                    //                             },
                    //                             {
                    //                                 "type": "postback",
                    //                                 "title": "33",
                    //                                 "payload": "33"
                    //                             }
                    //                         ]
                    //                     }
                    //                 ]
                    //             }
                    //         }
                    //     }
                    // });
                    return stepContext.sendActivity("Bạn muốn hỏi bus số mấy?", "Bạn muốn hỏi bus số mấy?", InputHints.ExpectingInput)
                }

                const messageText = null;
                const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
                return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
            }

        }
        return stepContext.next(result.bus);
    }
    async SearchStep(stepContext) {
        const result0 = stepContext.options

        const { LuisAppId, LuisAPIKey, LuisAPIHostName } = process.env;
        const luisConfig = { applicationId: LuisAppId, endpointKey: LuisAPIKey, endpoint: `https://${LuisAPIHostName}` };
        const luis = new BusRecognizer(luisConfig);

        // check From and To to Restart searchDialogs 
        const luisResult = await luis.executeLuisQuery(stepContext.context);

        var bus = null;
        var stop = null;

        if (LuisRecognizer.topIntent(luisResult) == "Tra_cứu_xe") {
            bus = luis.getBusEntities(luisResult);
            stop = luis.getStopEntities(luisResult);
        }

        const StopDetail = {};
        if (bus && stop) {
            result0.stop = stop;
            result0.bus = bus;
        }
        else if (!bus && stop) {
            await stepContext.context.sendActivity('Câu trả lời không hợp lệ.\r\n Vui lòng cho tôi biết số xe thay vì tên trạm', '', InputHints.IgnoringInput);
            await stepContext.endDialog();
            return await stepContext.beginDialog('searchDialog', StopDetail);
        }
        else if (bus && !stop) {
            result0.bus = bus;
        }
        else if (!bus && !stop) {
            result0.bus = stepContext.result;
        }


        const place = result0.stop;
        var prompt = '';
        var flag = true;

        try {
            var result;
            var No_bus;
            const urlRequestGeo = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json?key=AIzaSyBuTd5eFJwpova9M3AGpPrSwmzp_hHWVuE&inputtype=textquery&language=vi&fields=formatted_address,geometry&input=' + place + ' tphcm';

            const response = await fetch(utf8.encode(urlRequestGeo));
            const json = await response.json();

            if (response.status != 200 ||(json.candidates && json.candidates.length == 0)) {
                await stepContext.context.sendActivity('Không tìm thấy trạm này')
                return await stepContext.endDialog("Bạn cần giúp gì thêm không?");
            
            } else {
                //request get Geo(lat,lng)
                result = {};
                result.address = json.candidates[0].formatted_address;
                result.geo = json.candidates[0].geometry.location;
                this.geo = result.geo
                this.place = place
                this.bus = result0.bus
                //request get departures around the place


            }

            if (flag == true) {
                const url = 'https://transit.hereapi.com/v8/departures?maxPerBoard=10&lang=vi&in=' + result.geo.lat + ',' + result.geo.lng + ';r=1000&name=' + place;
                var myHeaders = new fetch.Headers();
                myHeaders.append("Authorization", 'Bearer ' + process.env.token);

                var requestOptions = {
                    method: 'GET',
                    headers: myHeaders,
                    redirect: 'follow'
                };
                const response = await fetch(encodeUrl(url), requestOptions)
                if (response.status != 200) {
                    throw -1
                }
                const data = await response.json();

                if (data.boards.length == 0) {
                    prompt = 'Không tìm thấy trạm ' + place;
                    await stepContext.context.sendActivity(prompt)
                    flag = false;
                } else {
                    const boards = data.boards;
                    var isExistsBus = false;
                    for (var i = 0; i < boards.length; i++) {
                        var msg = '';
                        if (stringSimilarity.compareTwoStrings(boards[i].place.name.toLowerCase(), place.toLowerCase()) > 0.7) {
                            const departures = boards[i].departures;


                            for (var j = 0; j < departures.length; j++) {
                                if (result0.bus.match('(\\d+)')[0] == parseInt(departures[j].transport.name)) {
                                    isExistsBus = true
                                    No_bus = departures[j].transport.name;
                                    var time = departures[j].time;
                                    const moment = require('moment')
                                    var now = moment().format("YYYY-MM-DDTHH:mm:ssZ");

                                    time = moment.utc(moment(time, "YYYY-MM-DDTHH:mm:ssZ").diff(now)).format('HH:mm')
                                    const tokens = time.split(":");
                                    const h = tokens[0]
                                    const m = tokens[1]
                                    time = "";
                                    if (h != 0) {
                                        time += parseInt(h) + "h";
                                    }
                                    if (m != 0) {
                                        time += parseInt(m) + "'";
                                    }
                                    time = (time == "") ? "1'" : time;

                                    msg = "Xe bus số " + departures[j].transport.name + " xuất phát từ " + departures[j].transport.headsign + " khoảng " + time + " sẽ đi qua trạm " + boards[i].place.name;
                                    break;
                                }
                            }


                        }
                        if (msg !== "") {
                            await stepContext.context.sendActivity(msg);
                        }

                    }
                    if (!isExistsBus) {
                        await stepContext.context.sendActivity("Có vẻ như xe bus này không đi qua trạm")
                        flag = false
                    }
                }

            }

            // var result;
            // var No_bus;
            // const urlRequestGeo = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json?key=AIzaSyBuTd5eFJwpova9M3AGpPrSwmzp_hHWVuE&inputtype=textquery&language=vi&fields=formatted_address,geometry&input=' + place + ' tphcm';

            // const response = await fetch(utf8.encode(urlRequestGeo));
            // const json = await response.json();

            // if (response.status != 200 && Fjson.candidates && json.candidates.length == 0) {
            //     prompt = 'Không tìm thấy trạm nào xung quanh cả, bạn có thể cung cấp địa chỉ cụ thể hơn không?';
            //     await stepContext.context.sendActivity(prompt)
            //     flag = false;
            // } else {
            //     //request get Geo(lat,lng)
            //     result = {};
            //     result.address = json.candidates[0].formatted_address;
            //     result.geo = json.candidates[0].geometry.location;
            //     this.geo = result.geo
            //     this.place = place
            //     this.bus = result0.bus
            //     //request get departures around the place


            // }

            // if (flag == true) {

            //     const boards = data.boards;
            //     var isExistsBus = false;

            //     const departure = this.buses
            //     for (var j = 0; j < departures.length; j++) {
            //         if (result0.bus.match('(\\d+)')[0] == parseInt(departures[j].transport.name)) {
            //             isExistsBus = true
            //             No_bus = departures[j].transport.name;
            //             var time = departures[j].time;
            //             const moment = require('moment')
            //             var now = moment().format("YYYY-MM-DDTHH:mm:ssZ");

            //             time = moment.utc(moment(time, "YYYY-MM-DDTHH:mm:ssZ").diff(now)).format('HH:mm')
            //             const tokens = time.split(":");
            //             const h = tokens[0]
            //             const m = tokens[1]
            //             time = "";
            //             if (h != 0) {
            //                 time += parseInt(h) + "h";
            //             }
            //             if (m != 0) {
            //                 time += parseInt(m) + "'";
            //             }
            //             time = (time == "") ? "1'" : time;

            //             msg = "Xe bus số " + departures[j].transport.name + " xuất phát từ " + departures[j].transport.headsign + " khoảng " + time + " sẽ đi qua trạm " + boards[i].place.name;
            //             break;
            //         }
            //     }




            //     if (!isExistsBus) {
            //         await stepContext.context.sendActivity("Có vẻ như xe bus này không đi qua trạm")
            //         flag = false
            //     }
            // }




        } catch (err) {
            console.log(err);
            prompt = "Có lỗi trong quá trình tìm kiếm, mong bạn thử lại";
            await stepContext.context.sendActivity(prompt);
            return await stepContext.endDialog("Bạn cần giúp gì thêm không?");
            flag = false;
        }

        if (!flag) {

            prompt = "Bạn cần giúp gì thêm không?";
            return await stepContext.endDialog(prompt);

        } else {
            if (!No_bus) {
                No_bus = result0.bus;
            }
            const dataDeparture = {
                bus: No_bus,
                departure: result0.stop
            }
            const idUser = utils.getIdUser(stepContext.context);
            await utils.saveDepartures(idUser, dataDeparture);

            const prompt = "Bạn cần giúp gì thêm không?";

            return await stepContext.endDialog(prompt);
            // const id = utils.getIdUser(stepContext.context);
            // const isNoti = await utils.isTurnOnNotify(id)
            // if (isNoti == true) {
            //     return await stepContext.next(false)
            // }
            // //return await stepContext.endDialog(prompt);
            // return await stepContext.prompt(CONFIRM, 'Bạn có muốn đặt nhắc nhở cho các ngày (T2->T6) không? Tin nhắn sẽ được gửi trước 10\'', ['Có', 'Không']);
        }

    }

    async confirmNotify(stepContext) {
        const result = stepContext.result;
        if (result == true) {
            const fb = utils.getFirebase();
            const id = utils.getIdUser(stepContext.context)
            var time;
            const day = new Date().getDay()
            switch (day) {
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                    time = 85800000;
                    break;
                case 5:
                    time = 258600000;
                    break;
                case 6:
                    time = 172200000;
                    break;
            }
            setTimeout(utils.notify, time, this.geo, this.place, this.bus, id)
            fb.database().ref('users/' + id).child("/noti/isOn").set(true)
            fb.database().ref('users/' + id).child("/noti/TimeSet").set(day + "-------" + time)
            await stepContext.context.sendActivity('Đã đặt nhắc nhở, bạn có thể tắt bằng cầu lệnh "tắt nhắc nhở"');
        }

        const prompt = "Bạn cần giúp gì thêm không?";

        return await stepContext.endDialog(prompt);
    }

}




module.exports.SearchDialog = SearchDialog;
