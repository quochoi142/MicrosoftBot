// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
const { LuisRecognizer } = require('botbuilder-ai');
const { InputHints, MessageFactory, ActivityTypes } = require('botbuilder');
const { TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');
const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');
const { CardFactory } = require('botbuilder-core');
const OriginCard = require('../resources/originCard.json');
const DestinationCard = require('../resources/destinationCard.json');
const ConfirmODCard = require('../resources/confirmODCard.json');
const WrongCard = require('../resources/wrongCard.json');
const { BusRecognizer } = require('../dialogs/BusRecognizer');

const TEXT_PROMPT = 'TextPrompt_RouteDetail';
const WATERFALL_DIALOG = 'waterfallDialog_RouteDetail';
const LOCATION = 'location_prompt';

const utf8 = require('utf8');
const fetch = require("node-fetch");
const utils = require('../firebaseConfig/utils');
var encodeUrl = require('encodeurl')
var flat = 0;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}




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

            // Get destiantion from Firebase
            try {
                const id = await utils.getIdUser(stepContext.context);
                var myDestiantion = await utils.readDestination(id);
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
                                        "title": "Nơi bạn muốn đến là?",
                                        "image_url": "https://www.controleng.com/wp-content/uploads/sites/2/2013/02/ctl1304-f5-Roadmap-TriCore-Map-w.jpg",
                                        "subtitle": "Bạn có thể chọn 1 trong các lựa chọn bên dưới hoặc nhập trực tiếp.",
                                        "buttons": [
                                            {
                                                "type": "postback",
                                                "title": myDestiantion[0],
                                                "payload": myDestiantion[0]
                                            },
                                            {
                                                "type": "postback",
                                                "title": myDestiantion[1],
                                                "payload": myDestiantion[1]
                                            },
                                            {
                                                "type": "postback",
                                                "title": myDestiantion[2],
                                                "payload": myDestiantion[2]
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
                                        "title": "Nơi bạn muốn đến là?",
                                        "image_url": "https://www.controleng.com/wp-content/uploads/sites/2/2013/02/ctl1304-f5-Roadmap-TriCore-Map-w.jpg",
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

        return await stepContext.next(route.destination);
    }

    async originStep(stepContext) {

        const route = stepContext.options;

        if (!route.origin) {

            const { LuisAppId, LuisAPIKey, LuisAPIHostName } = process.env;
            const luisConfig = { applicationId: LuisAppId, endpointKey: LuisAPIKey, endpoint: `https://${LuisAPIHostName}` };
            const luis = new BusRecognizer(luisConfig);

            // check From and To to Restart routeDialogs

            var luisResult = await luis.executeLuisQuery(stepContext.context);

            var from = null;
            var to = null;
            const routeDetails = {};

            if (LuisRecognizer.topIntent(luisResult) == "Tìm_đường") {
                from = luis.getFromEntities(luisResult);
                to = luis.getToEntities(luisResult);


                if (from && to) {
                    routeDetails.origin = from;
                    routeDetails.destination = to;
                    await stepContext.endDialog();
                    return await stepContext.beginDialog('routeDialog', routeDetails);
                }
                else if ((from == "đây" || from == "nơi đây" || from == "chổ này" || from == "nơi này") && flat == 1) {
                    route.destination = stepContext.result;
                }
                else if (from && !to) {

                    await stepContext.context.sendActivity('Câu trả lời không hợp lệ.\r\n Vui lòng cho tôi biết điểm đến thay vì điểm xuất phát.', '', InputHints.IgnoringInput);
                    await stepContext.endDialog();
                    return await stepContext.beginDialog('routeDialog', routeDetails);
                }
                else if (!from && to) {
                    route.destination = to;
                }

            }
            else if (LuisRecognizer.topIntent(luisResult) == "None" && flat != 1) {

                await stepContext.context.sendActivity('Câu trả lời không hợp lệ.\r\n Vui lòng nhập chi tiết hoặc chính xác hơn.', '', InputHints.IgnoringInput);
                await stepContext.endDialog();
                return await stepContext.beginDialog('routeDialog', routeDetails);
            }
            else {
                route.destination = stepContext.result;
            }

            //reset parameter flat
            flat = 0;

            // Get origin from Firebase
            try {
                const id = await utils.getIdUser(stepContext.context);
                var myOrigin = await utils.readOrigin(id);

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
                                        "title": "Bạn muốn đi từ đâu?",
                                        "image_url": "https://encrypted-tbn0.gstatic.com/images?q=tbn%3AANd9GcRg4DM9oYGD3aAPH41C2RJpRwga6ChMdSSSRTy6dYN47wC3j2d9",
                                        "subtitle": "Bạn có thể chọn 1 trong các lựa chọn bên dưới hoặc nhập trực tiếp.",
                                        "buttons": [
                                            {
                                                "type": "postback",
                                                "title": myOrigin[0],
                                                "payload": myOrigin[0]
                                            },
                                            {
                                                "type": "postback",
                                                "title": myOrigin[1],
                                                "payload": myOrigin[1]
                                            },
                                            {
                                                "type": "postback",
                                                "url": "Vị trí hiện tại",
                                                "title": "Vị trí hiện tại",
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
                                        "title": "Bạn muốn đi từ đâu?",
                                        "image_url": "https://encrypted-tbn0.gstatic.com/images?q=tbn%3AANd9GcRg4DM9oYGD3aAPH41C2RJpRwga6ChMdSSSRTy6dYN47wC3j2d9",
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
                                                "type": "postbacknode ",
                                                "url": "Vị trí hiện tại",
                                                "title": "Vị trí hiện tại",
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

        return await stepContext.next(route.origin);
    }

    async finalStep(stepContext) {


        var result = stepContext.options;

        const { LuisAppId, LuisAPIKey, LuisAPIHostName } = process.env;
        const luisConfig = { applicationId: LuisAppId, endpointKey: LuisAPIKey, endpoint: `https://${LuisAPIHostName}` };
        const luis = new BusRecognizer(luisConfig);

        var luisResult = await luis.executeLuisQuery(stepContext.context);

        var from = null;
        var to = null;
        const routeDetails = {};

        if (LuisRecognizer.topIntent(luisResult) == "Tìm_đường") {
            from = luis.getFromEntities(luisResult);
            to = luis.getToEntities(luisResult);
        }

        if (from == "đây" || from == "nơi đây" || from == "chổ này" || from == "nơi này" || stepContext.result == "Vị trí hiện tại" || stepContext.result == "\"Vị trí hiện tại\"" || LuisRecognizer.topIntent(luisResult) == "Tại_đây") {
            try {
                const id = await utils.getIdUser(stepContext.context);

                utils.setToken(stepContext.context);
                var promise = new Promise(function (resolve, reject) {
                    var token;
                    var firebase = utils.getFirebase();
                    firebase.database().ref('users/' + id + '/token').once('value', (snap) => {
                        token = snap.val();
                        var url = 'https://botbusvqh.herokuapp.com/map?id=' + id + '&token=' + token;
                        setTimeout(function () {
                            firebase.database().ref('users/' + id + '/token').set(randomstring.generate(10));

                        }, 5 * 60000);
                        resolve({ url, token })

                    })


                });
                var myUrl;
                var myToken;
                await promise.then(res => {
                    myUrl = res.url;
                    myToken = res.token
                }).catch(err => {
                    console.log(err);
                })

                //Send card 
                try {
                    await stepContext.context.sendActivity({
                        //text: "Bạn cũng có thể nhập trực tiếp",
                        channelData: {
                            "attachment": {
                                "type": "template",
                                "payload": {
                                    "template_type": "generic",
                                    "elements": [
                                        {
                                            "title": "Bạn muốn tìm xung quanh trạm nào?",
                                            "image_url": "https://previews.123rf.com/images/vadmary/vadmary1302/vadmary130200031/17960600-street-map-with-gps-icons-navigation.jpg",
                                            "subtitle": "Bạn có thể chọn 1 trong các lựa chọn bên dưới hoặc nhập trực tiếp.",
                                            "buttons": [
                                                {
                                                    "type": "web_url",
                                                    "url": myUrl,
                                                    "title": "Mở map",
                                                }
                                            ]
                                        }
                                    ]
                                }
                            }
                        }
                    });
                } catch (error) {
                    await stepContext.context.sendActivity('không lấy được vị trí hiện tại', '', InputHints.IgnoringInput);
                }

                var map = utils.openMap(id, myToken);

                await map.then(async res => {

                    var token = await utils.getTokenbyId(id)
                    if (res.token != token) {
                        result.origin = null;
                    } else {
                        result.origin = res.location;
                    }


                })
            } catch (error) {

                routeDetails.destination = result.destination;
                flat = 1;
                await stepContext.context.sendActivity('không lấy được vị trí hiện tại', '', InputHints.IgnoringInput);
                await stepContext.endDialog();
                return await stepContext.beginDialog('routeDialog', routeDetails);

            }
        }
        else if (LuisRecognizer.topIntent(luisResult) == "None") {
            routeDetails.destination = result.destination;
            flat = 1;
            await stepContext.endDialog();
            return await stepContext.beginDialog('routeDialog', routeDetails);
        }
        else {
            // check From and To to Restart routeDialogs
            if (from && to) {
                result.origin = from;
                result.destination = to;
            }
            else if (to && !from) {
                routeDetails.destination = result.destination;

                await stepContext.context.sendActivity('Câu trả lời không hợp lệ.\r\n Vui lòng cho tôi biết điểm xuất phát thay vì điểm đến', '', InputHints.IgnoringInput);
                await stepContext.endDialog();
                return await stepContext.beginDialog('routeDialog', routeDetails);
            }
            else if (from && !to) {
                result.origin = from;
            }
            else if (!from && !to) {
                result.origin = stepContext.result;
            }

        }


        //cho người dùng biết 2 điểm O-D
        const confirmMsg = "Đi từ " + result.origin + " đến " + result.destination + ".";
        stepContext.context.sendActivity(confirmMsg, confirmMsg, InputHints.IgnoringInput);

        const http_request = process.env.GgAPI + "&origin=" + result.origin + ' tphcm' + "&destination=" + result.destination + ' tphcm';
        var prompt = '';

        try {
            const response = await fetch(utf8.encode(http_request));


            const json = await response.json();
            if (response.status != 200 || json.routes.length == 0) {
                prompt = 'Không tìm thấy đường đi bạn có thể cung cấp địa chỉ cụ thể hơn không?';

            }
            else {

                const route = json.routes[0].legs[0];


                const geoOrigin = route.start_location.lat + ',' + route.start_location.lng;
                const geoDest = route.end_location.lat + ',' + route.end_location.lng;

                // const start_address = route.start_address;
                // const end_address = route.end_address;

                const urls = [];
                urls.push('https://transit.router.hereapi.com/v8/routes?changes=1&pedestrian[speed]=0.5&lang=vi&modes=bus&pedestrian[maxDistance]=1000&origin=' + geoOrigin + '&destination=' + geoDest + '&return=intermediate,polyline,travelSummary');
                urls.push('https://transit.router.hereapi.com/v8/routes?pedestrian[speed]=0.5&lang=vi&modes=bus&origin=' + geoOrigin + '&destination=' + geoDest + '&return=intermediate,polyline,travelSummary');

                var urlImage = 'https://image.maps.ls.hereapi.com/mia/1.6/route?apiKey=a0EUQVr4TtxyS9ZkBWKSR1xonz0FUZIuSBrRIDl7UiY&h=2048&w=2048&ml=vie&ppi=250&q=100'

                var myHeaders = new fetch.Headers();
                myHeaders.append("Authorization", 'Bearer ' + process.env.token);

                var requestOptions = {
                    method: 'GET',
                    headers: myHeaders,
                    redirect: 'follow'
                };

                var data;

                for (var i = 0; i < urls.length; i++) {
                    const response = await fetch(urls[i], requestOptions)
                    data = await response.json();
                    if (data.routes.length) {
                        break;
                    }
                }


                console.log(JSON.stringify(data));
                const steps = data.routes[0].sections;

                var duration = 0;
                var length = 0;
                var index = 0;

                var time = 0;
                var instuctions = [];
                var indexGeo = 0;

                var markers = [];
                var polylines = [];
                // markers.push({
                //     instuction: result.origin,
                //     geo: geoOrigin,
                // });
                // markers.push({
                //     instuction: result.destination,
                //     geo: geoDest,
                // });
                steps.forEach(step => {
                    var queryRoute = '';
                    if (index == 0 || index == steps.length - 1) {
                        queryRoute = '&r0' + '=' + utils.convertPolylineX1(step.polyline);
                    } else {
                        queryRoute = '&r0' + '=' + utils.convertPolylineX2(step.polyline);
                    }
                    polylines.push(utils.getPolylineGGMap(step.polyline))
                    duration = duration + step.travelSummary.duration;

                    length = length + step.travelSummary.length;
                    var pivot = '';

                    var instuction = '';
                    const type = step.type;
                    var queryPoint = ''
                    if (type === "pedestrian") {
                        var queryPoint1 = '', queryPoint2 = '';
                        if (index == 0) {
                            instuction = 'Từ ' + result.origin + ' đi bộ đến trạm ' + step.arrival.place.name;
                            // queryPoint1 = '&poix0' + '=' + step.departure.place.location.lat + ',' + step.departure.place.location.lng + ';white;blue;25;' + result.origin;
                            // queryPoint2 = '&poix1' + '=' + step.arrival.place.location.lat + ',' + step.arrival.place.location.lng + ';white;blue;25;đến trạm: ' + step.arrival.place.name;
                            markers.push({
                                instuction: result.origin,
                                geo: step.departure.place.location
                            });

                        } else if (index == steps.length - 1 && step.arrival.place.type == 'place') {
                            instuction = 'Đi bộ đến ' + result.destination;
                            // queryPoint1 = '&poix0' + '=' + step.departure.place.location.lat + ',' + step.departure.place.location.lng + ';white;blue;25;Đi bộ từ trạm:  ' + step.departure.place.name;
                            // queryPoint2 = '&poix1' + '=' + step.arrival.place.location.lat + ',' + step.arrival.place.location.lng + ';white;blue;25;' + result.destination;
                            markers.push({
                                instuction: result.destination,
                                geo: step.arrival.place.location
                            });
                            markers.push({
                                instuction: step.departure.place.name,
                                geo: step.departure.place.location
                            });
                        }
                        else if (pivot != '' && step.departure.place.name != pivot) {
                            instuction = 'Đi bộ đến ' + step.departure.place.name;
                            // pivot = '';
                            // queryPoint1 = '&poix0' + '=' + step.departure.place.location.lat + ',' + step.departure.place.location.lng + ';white;blue;25;Đi bộ từ ' + 'trạm: ' + step.departure.place.name;
                            // queryPoint2 = '&poix1' + '=' + step.arrival.place.location.lat + ',' + step.arrival.place.location.lng + ';white;blue;25;đến trạm: ' + step.arrival.place.name;
                            markers.push({
                                instuction: step.departure.place.name,
                                geo: step.departure.place.location
                            });
                            // markers.push({
                            //     instuction: step.arrival.place.name,
                            //     geo: step.arrival.place.location
                            // });
                        }
                        //queryPoint = queryPoint1 + queryPoint2;

                    } else if (type === 'transit') {
                        // const queryPoint1 = '&poix0' + '=' + step.departure.place.location.lat + ',' + step.departure.place.location.lng + ';white;blue;25;Buýt ' + step.transport.name + ': Trạm ' + step.departure.place.name;
                        // const queryPoint2 = '&poix1' + '=' + step.arrival.place.location.lat + ',' + step.arrival.place.location.lng + ';white;blue;25;Xuống trạm: ' + step.arrival.place.name;
                        // queryPoint = queryPoint1 + queryPoint2;
                        // pivot = step.arrival.place.name;
                        instuction = 'Bắt xe số ' + step.transport.name + ' đi đến trạm ' + step.arrival.place.name
                        //   indexGeo++;
                        markers.push({
                            instuction: 'Xe bus ' + step.transport.name + ': Trạm ' + step.departure.place.name,
                            geo: step.departure.place.location
                        });
                        // markers.push({
                        //     instuction: step.arrival.place.name,
                        //     geo: step.arrival.place.location
                        // });
                    }

                    index++;
                    //const Image = urlImage + queryRoute + queryPoint;


                    if (instuction != '') {
                        // var object = {};
                        // object.instuction = instuction;
                        //object.urlImage = Image;
                        instuctions.push({
                            step: instuction,
                            index: polylines.length - 1,
                            duration: utils.convertDuration(step.travelSummary.duration),
                            length: parseFloat(step.travelSummary.length / 1000).toFixed(1)
                        });

                    }

                    // markers.push({
                    //     instuction:'',
                    //     geo:''
                    // })
                });

                const summary_direction = "Tổng quãng đường là " + parseFloat(length / 1000).toFixed(1) + "km đi mất khoảng " + utils.convertDuration(duration);
                // console.log(urlImage);
                const dataRoute = {
                    polylines: polylines,
                    markers: markers,
                    summary: summary_direction,
                    steps: instuctions
                }

                /* await stepContext.context.sendActivity(summary_direction, summary_direction, InputHints.IgnoringInput);
                 for (var i = 0; i < instuctions.length; i++) {
                     // await stepContext.context.sendActivity(instuctions[i].instuction, instuctions[i].instuction, InputHints.IgnoringInput);
 
 
                     // const url = encodeUrl(instuctions[i].urlImage);
 
                     // await stepContext.context.sendActivity({
                     //     text: instuctions[i].instuction,
                     //     channelData: {
                     //         "attachment": {
                     //             "type": "image",
                     //             "payload": {
                     //                 "url": url,
                     //                 "is_reusable": true
                     //             }
                     //         }
                     //     }
                     // });
 
                     // await utils.sleep(500);
                     await stepContext.context.sendActivity(instuctions[i])
 
                 }*/

                // instuctions.forEach(async (element) => {
                //     await stepContext.context.sendActivity(element.instuction, element.instuction, InputHints.IgnoringInput);

                //     const json = {

                //         "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                //         "type": "AdaptiveCard",
                //         "version": "1.0",
                //         "body": [
                //             {
                //                 "type": "Image",
                //                 "url": element.urlImage,
                //                 "width": "stretch",
                //                 "style": "default"
                //             }
                //         ],


                //     };

                //     console.log(element.urlImage);
                //     await stepContext.context.sendActivity({ attachments: [json] });

                //     await utils.sleep(500);
                // })

                await stepContext.context.sendActivity(summary_direction, summary_direction, InputHints.IgnoringInput);
                for (var i = 0; i < instuctions.length; i++) {
                    await stepContext.context.sendActivity(instuctions[i].step)
                }

                const id = utils.getIdUser(stepContext.context);
                await utils.savePolyline(id, dataRoute);
                //console.log(id);
                utils.saveOriDes(id, result.origin, result.destination);

                var url = 'https://botbusvqh.herokuapp.com/route?id=' + id;
                await stepContext.context.sendActivity(url);
            }


        }
        catch (error) {
            prompt = error.message;
            console.log(error.message);


        }
        prompt = "Bạn cần giúp gì thêm không?";
        return await stepContext.endDialog(prompt);
    }

}





module.exports.RouteDialog = RouteDialog;
